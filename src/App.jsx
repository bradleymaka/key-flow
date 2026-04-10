import { useState, useEffect, useRef } from "react";

const LISTINGS = [
  { id: 1, address: "47 Bedford Ave", neighborhood: "Williamsburg", rent: 3200, bedrooms: 2, status: "active", broker: "Marco Silva", photos: "🏢", description: "Bright corner unit with exposed brick and skyline views. Steps from L train.", ai_score: null, leads: [] },
  { id: 2, address: "210 Franklin St", neighborhood: "Greenpoint", rent: 2750, bedrooms: 1, status: "active", broker: "Priya Nair", photos: "🏬", description: "Top-floor unit in restored warehouse building. Original hardwood floors throughout.", ai_score: null, leads: [] },
  { id: 3, address: "88 Nostrand Ave", neighborhood: "Crown Heights", rent: 2100, bedrooms: 1, status: "active", broker: "Marco Silva", photos: "🏠", description: "Sunny garden-level in a limestone brownstone. Laundry in building.", ai_score: null, leads: [] },
  { id: 4, address: "330 W 42nd St", neighborhood: "Hell's Kitchen", rent: 4100, bedrooms: 3, status: "active", broker: "Jen Torres", photos: "🏙️", description: "Luxury three-bedroom with floor-to-ceiling windows. Doorman building.", ai_score: null, leads: [] },
  { id: 5, address: "15 Myrtle Ave", neighborhood: "Fort Greene", rent: 2900, bedrooms: 2, status: "rented", broker: "Priya Nair", photos: "🏡", description: "Renovated two-bedroom with chef kitchen and private backyard.", ai_score: null, leads: [] },
];

const NEIGHBORHOODS = ["All", "Williamsburg", "Greenpoint", "Crown Heights", "Hell's Kitchen", "Fort Greene", "Astoria", "Park Slope", "Bushwick"];

async function callClaude(prompt, maxTokens = 300) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

export default function BrokerAI() {
  const [view, setView] = useState("home");
  const [role, setRole] = useState(null);
  const [listings, setListings] = useState(LISTINGS);
  const [searchNeighborhood, setSearchNeighborhood] = useState("All");
  const [searchMaxRent, setSearchMaxRent] = useState(5000);
  const [searchBeds, setSearchBeds] = useState("Any");
  const [selectedListing, setSelectedListing] = useState(null);
  const [contactMsg, setContactMsg] = useState("");
  const [contactSent, setContactSent] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTask, setAiTask] = useState("");
  const [newListing, setNewListing] = useState({ address: "", neighborhood: "Williamsburg", rent: "", bedrooms: "", description: "" });
  const [naturalQuery, setNaturalQuery] = useState("");
  const [naturalResults, setNaturalResults] = useState(null);
  const [suggestedRent, setSuggestedRent] = useState(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [activeLeadListing, setActiveLeadListing] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const filteredListings = listings.filter(l => {
    if (l.status !== "active") return false;
    if (searchNeighborhood !== "All" && l.neighborhood !== searchNeighborhood) return false;
    if (l.rent > searchMaxRent) return false;
    if (searchBeds !== "Any" && l.bedrooms !== parseInt(searchBeds)) return false;
    return true;
  });

  const myListings = listings.filter(l => l.broker === "Marco Silva");
  const myLeads = myListings.flatMap(l => (l.leads || []).map(ld => ({ ...ld, listing: l })));

  async function handleGenerateDescription() {
    if (!newListing.address || !newListing.bedrooms || !newListing.rent) {
      showToast("Fill in address, bedrooms, and rent first", "warn"); return;
    }
    setAiLoading(true); setAiTask("Writing listing description...");
    try {
      const result = await callClaude(
        `Write a compelling NYC apartment listing description (under 80 words) for: ${newListing.bedrooms} bedroom in ${newListing.neighborhood}, $${newListing.rent}/month, at ${newListing.address}. Be specific and appealing. No intro phrases like "Welcome to".`
      );
      setNewListing(prev => ({ ...prev, description: result.trim() }));
      showToast("AI description generated!");
    } catch { showToast("API error — check your key", "warn"); }
    setAiLoading(false); setAiTask("");
  }

  async function handleSuggestPrice() {
    if (!newListing.bedrooms || !newListing.neighborhood) {
      showToast("Pick a neighborhood and bedroom count first", "warn"); return;
    }
    setPriceLoading(true);
    try {
      const result = await callClaude(
        `What is the typical monthly rent range for a ${newListing.bedrooms}-bedroom apartment in ${newListing.neighborhood}, Brooklyn/NYC in 2025? Return ONLY a range like "$2,800–$3,400". Nothing else.`, 50
      );
      setSuggestedRent(result.trim());
    } catch { showToast("API error", "warn"); }
    setPriceLoading(false);
  }

  async function handleContactBroker() {
    if (!contactMsg.trim()) { showToast("Type a message first", "warn"); return; }
    setAiLoading(true); setAiTask("AI is scoring your lead...");
    try {
      const scoreText = await callClaude(
        `Score this rental inquiry from 1–10 on seriousness and readiness to rent. Return ONLY a single number.\n\nMessage: "${contactMsg}"\nListing rent: $${selectedListing.rent}/mo\n\nGuide: 1–3=vague, 4–6=interested, 7–10=ready with clear budget and timeline.`, 10
      );
      const score = parseInt(scoreText.trim()) || 5;
      const lead = { id: Date.now(), message: contactMsg, score, renter: "You (renter)", time: new Date().toLocaleTimeString() };
      setListings(prev => prev.map(l => l.id === selectedListing.id ? { ...l, leads: [...(l.leads || []), lead] } : l));
      setContactSent(true);
      showToast(`Message sent! AI lead score: ${score}/10`);
    } catch { showToast("API error", "warn"); }
    setAiLoading(false); setAiTask("");
  }

  async function handleNaturalSearch() {
    if (!naturalQuery.trim()) return;
    setAiLoading(true); setAiTask("AI is finding your best matches...");
    try {
      const listingsSummary = listings.filter(l => l.status === "active").map(l =>
        `ID:${l.id} | ${l.address}, ${l.neighborhood} | ${l.bedrooms}BR | $${l.rent}/mo`
      ).join("\n");
      const result = await callClaude(
        `A renter is searching for an NYC apartment. Their query: "${naturalQuery}"\n\nAvailable listings:\n${listingsSummary}\n\nReturn ONLY a JSON array of the best matching listing IDs in order, like [2,4,1]. Max 3 results. If none match well, return [].`, 50
      );
      const match = result.match(/\[[\d,\s]*\]/);
      if (match) {
        const ids = JSON.parse(match[0]);
        const matched = ids.map(id => listings.find(l => l.id === id)).filter(Boolean);
        setNaturalResults(matched);
      } else { setNaturalResults([]); }
    } catch { setNaturalResults([]); }
    setAiLoading(false); setAiTask("");
  }

  async function handleAddListing() {
    if (!newListing.address || !newListing.rent || !newListing.bedrooms || !newListing.description) {
      showToast("Fill in all fields first", "warn"); return;
    }
    const l = { id: Date.now(), ...newListing, rent: parseInt(newListing.rent), bedrooms: parseInt(newListing.bedrooms), status: "active", broker: "Marco Silva", photos: "🏢", leads: [] };
    setListings(prev => [l, ...prev]);
    setNewListing({ address: "", neighborhood: "Williamsburg", rent: "", bedrooms: "", description: "" });
    setSuggestedRent(null);
    setView("broker-dashboard");
    showToast("Listing published!");
  }

  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', sans-serif; background: #f7f6f2; color: #1a1a1a; }
    :root {
      --ink: #1a1a1a; --muted: #6b6b6b; --border: #e0ded8; --surface: #ffffff;
      --accent: #1a3a2a; --accent2: #c8f0d8; --warn: #f59e0b; --danger: #ef4444;
      --card-radius: 14px; --btn-radius: 8px;
    }
    .serif { font-family: 'DM Serif Display', serif; }
    .app { min-height: 100vh; }
    .topbar { background: var(--surface); border-bottom: 1px solid var(--border); padding: 0 24px; height: 56px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; }
    .logo { font-family: 'DM Serif Display', serif; font-size: 22px; color: var(--accent); cursor: pointer; }
    .topbar-nav { display: flex; gap: 8px; align-items: center; }
    .nav-btn { padding: 7px 16px; border-radius: var(--btn-radius); border: 1px solid var(--border); background: transparent; font-size: 13px; cursor: pointer; color: var(--ink); font-family: 'DM Sans', sans-serif; transition: all 0.15s; }
    .nav-btn:hover { background: #f0efe9; }
    .nav-btn.primary { background: var(--accent); color: white; border-color: var(--accent); }
    .nav-btn.primary:hover { background: #0f2a1a; }
    .main { max-width: 1100px; margin: 0 auto; padding: 32px 24px; }
    .hero { text-align: center; padding: 60px 0 40px; }
    .hero h1 { font-family: 'DM Serif Display', serif; font-size: clamp(36px, 6vw, 64px); line-height: 1.1; color: var(--ink); margin-bottom: 16px; }
    .hero h1 span { color: var(--accent); }
    .hero p { font-size: 17px; color: var(--muted); max-width: 500px; margin: 0 auto 32px; line-height: 1.6; }
    .hero-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
    .hero-btn { padding: 14px 28px; border-radius: var(--btn-radius); font-size: 15px; font-weight: 500; cursor: pointer; font-family: 'DM Sans', sans-serif; border: 1px solid; transition: all 0.15s; }
    .hero-btn.primary { background: var(--accent); color: white; border-color: var(--accent); }
    .hero-btn.primary:hover { background: #0f2a1a; }
    .hero-btn.secondary { background: white; color: var(--ink); border-color: var(--border); }
    .hero-btn.secondary:hover { background: #f0efe9; }
    .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-top: 48px; }
    .feature-card { background: white; border: 1px solid var(--border); border-radius: var(--card-radius); padding: 20px; }
    .feature-icon { font-size: 24px; margin-bottom: 10px; }
    .feature-title { font-size: 14px; font-weight: 600; color: var(--ink); margin-bottom: 6px; }
    .feature-desc { font-size: 13px; color: var(--muted); line-height: 1.5; }
    .search-bar { background: white; border: 1px solid var(--border); border-radius: var(--card-radius); padding: 16px 20px; margin-bottom: 24px; display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; }
    .filter-group { display: flex; flex-direction: column; gap: 4px; }
    .filter-label { font-size: 11px; color: var(--muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
    .filter-select, .filter-input { padding: 8px 12px; border: 1px solid var(--border); border-radius: var(--btn-radius); font-size: 13px; font-family: 'DM Sans', sans-serif; color: var(--ink); background: #fafafa; min-width: 130px; }
    .rent-display { font-size: 13px; font-weight: 600; color: var(--accent); padding: 8px 0; }
    .listing-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
    .listing-card { background: white; border: 1px solid var(--border); border-radius: var(--card-radius); overflow: hidden; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; }
    .listing-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
    .listing-photo { height: 140px; background: linear-gradient(135deg, #e8f5e2, #c8f0d8); display: flex; align-items: center; justify-content: center; font-size: 48px; }
    .listing-body { padding: 16px; }
    .listing-price { font-family: 'DM Serif Display', serif; font-size: 22px; color: var(--ink); margin-bottom: 4px; }
    .listing-address { font-size: 13px; color: var(--muted); margin-bottom: 8px; }
    .listing-tags { display: flex; gap: 6px; flex-wrap: wrap; }
    .tag { font-size: 11px; padding: 3px 8px; border-radius: 20px; border: 1px solid var(--border); color: var(--muted); }
    .tag.green { background: #e8f5e2; border-color: #c8f0d8; color: #1a3a2a; }
    .listing-desc { font-size: 12px; color: var(--muted); margin-top: 10px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .section-title { font-family: 'DM Serif Display', serif; font-size: 28px; margin-bottom: 8px; }
    .section-sub { font-size: 14px; color: var(--muted); margin-bottom: 24px; }
    .page-header { margin-bottom: 28px; }
    .broker-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    @media (max-width: 700px) { .broker-grid { grid-template-columns: 1fr; } }
    .dash-card { background: white; border: 1px solid var(--border); border-radius: var(--card-radius); padding: 20px; }
    .dash-card-title { font-size: 13px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px; }
    .stat-row { display: flex; gap: 16px; margin-bottom: 20px; }
    .stat { flex: 1; background: #f7f6f2; border-radius: 10px; padding: 14px; text-align: center; }
    .stat-num { font-family: 'DM Serif Display', serif; font-size: 28px; color: var(--ink); }
    .stat-label { font-size: 11px; color: var(--muted); }
    .lead-row { padding: 12px 0; border-bottom: 1px solid var(--border); display: flex; align-items: flex-start; gap: 12px; }
    .lead-row:last-child { border-bottom: none; }
    .score-badge { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0; }
    .score-high { background: #e8f5e2; color: #1a3a2a; }
    .score-mid { background: #fef3c7; color: #92400e; }
    .score-low { background: #fee2e2; color: #991b1b; }
    .lead-info { flex: 1; }
    .lead-address { font-size: 12px; font-weight: 600; color: var(--ink); }
    .lead-msg { font-size: 12px; color: var(--muted); margin-top: 2px; line-height: 1.4; }
    .lead-time { font-size: 11px; color: #aaa; }
    .form-group { margin-bottom: 16px; }
    .form-label { font-size: 12px; font-weight: 600; color: var(--muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em; display: block; }
    .form-input, .form-select, .form-textarea { width: 100%; padding: 10px 14px; border: 1px solid var(--border); border-radius: var(--btn-radius); font-size: 14px; font-family: 'DM Sans', sans-serif; color: var(--ink); background: white; }
    .form-input:focus, .form-select:focus, .form-textarea:focus { outline: none; border-color: var(--accent); }
    .form-textarea { min-height: 100px; resize: vertical; }
    .btn { padding: 10px 20px; border-radius: var(--btn-radius); font-size: 14px; font-weight: 500; cursor: pointer; font-family: 'DM Sans', sans-serif; border: 1px solid; transition: all 0.15s; }
    .btn-primary { background: var(--accent); color: white; border-color: var(--accent); }
    .btn-primary:hover { background: #0f2a1a; }
    .btn-secondary { background: white; color: var(--ink); border-color: var(--border); }
    .btn-secondary:hover { background: #f0efe9; }
    .btn-ai { background: #1a3a2a; color: #c8f0d8; border-color: #1a3a2a; display: flex; align-items: center; gap: 8px; }
    .btn-ai:hover { background: #0f2a1a; }
    .btn-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .modal { background: white; border-radius: var(--card-radius); padding: 28px; max-width: 520px; width: 100%; max-height: 85vh; overflow-y: auto; }
    .modal-title { font-family: 'DM Serif Display', serif; font-size: 24px; margin-bottom: 4px; }
    .modal-sub { font-size: 13px; color: var(--muted); margin-bottom: 20px; }
    .modal-close { float: right; background: none; border: none; font-size: 20px; cursor: pointer; color: var(--muted); }
    .ai-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; padding: 3px 10px; border-radius: 20px; background: #e8f5e2; color: #1a3a2a; font-weight: 500; border: 1px solid #c8f0d8; }
    .spinner { width: 16px; height: 16px; border: 2px solid #c8f0d8; border-top-color: #1a3a2a; border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loading-bar { text-align: center; padding: 40px 20px; }
    .loading-bar .spinner { width: 28px; height: 28px; margin: 0 auto 12px; }
    .loading-bar p { font-size: 14px; color: var(--muted); }
    .natural-box { background: white; border: 1px solid var(--border); border-radius: var(--card-radius); padding: 16px 20px; margin-bottom: 24px; }
    .natural-row { display: flex; gap: 10px; }
    .natural-input { flex: 1; padding: 10px 14px; border: 1px solid var(--border); border-radius: var(--btn-radius); font-size: 14px; font-family: 'DM Sans', sans-serif; }
    .natural-input:focus { outline: none; border-color: var(--accent); }
    .empty { text-align: center; padding: 40px; color: var(--muted); font-size: 14px; }
    .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: var(--ink); color: white; padding: 12px 20px; border-radius: var(--btn-radius); font-size: 13px; z-index: 999; animation: fadeUp 0.2s ease; }
    .toast.warn { background: #92400e; }
    @keyframes fadeUp { from { opacity: 0; transform: translateX(-50%) translateY(10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
    .badge-rented { background: #fee2e2; color: #991b1b; font-size: 11px; padding: 2px 8px; border-radius: 20px; }
    .badge-active { background: #e8f5e2; color: #1a3a2a; font-size: 11px; padding: 2px 8px; border-radius: 20px; }
    .price-hint { font-size: 12px; color: #1a3a2a; background: #e8f5e2; border-radius: 6px; padding: 6px 10px; margin-top: 6px; border: 1px solid #c8f0d8; }
    .my-listing-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border); cursor: pointer; }
    .my-listing-row:last-child { border-bottom: none; }
    .my-listing-row:hover { background: #f7f6f2; border-radius: 8px; padding-left: 8px; }
    .my-listing-icon { font-size: 22px; }
    .my-listing-info { flex: 1; }
    .my-listing-addr { font-size: 13px; font-weight: 600; color: var(--ink); }
    .my-listing-meta { font-size: 12px; color: var(--muted); }
    .leads-count { font-size: 12px; background: #1a3a2a; color: white; border-radius: 20px; padding: 2px 8px; }
  `;

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        {/* Toast */}
        {toast && <div className={`toast ${toast.type === "warn" ? "warn" : ""}`}>{toast.msg}</div>}

        {/* Loading overlay */}
        {aiLoading && (
          <div className="modal-bg">
            <div className="modal" style={{ textAlign: "center", padding: "40px" }}>
              <div className="loading-bar">
                <div className="spinner"></div>
                <p>{aiTask}</p>
              </div>
            </div>
          </div>
        )}

        {/* Listing detail modal */}
        {selectedListing && (
          <div className="modal-bg" onClick={() => { setSelectedListing(null); setContactSent(false); setContactMsg(""); }}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <button className="modal-close" onClick={() => { setSelectedListing(null); setContactSent(false); setContactMsg(""); }}>✕</button>
              <div style={{ fontSize: 48, textAlign: "center", background: "linear-gradient(135deg,#e8f5e2,#c8f0d8)", borderRadius: 10, padding: "20px", marginBottom: 16 }}>{selectedListing.photos}</div>
              <p className="modal-title">{selectedListing.address}</p>
              <p className="modal-sub">{selectedListing.neighborhood} · {selectedListing.bedrooms} BR · by {selectedListing.broker}</p>
              <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#1a3a2a", marginBottom: 12 }}>${selectedListing.rent.toLocaleString()}/mo</p>
              <p style={{ fontSize: 14, color: "#6b6b6b", lineHeight: 1.6, marginBottom: 20 }}>{selectedListing.description}</p>
              {!contactSent ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Message to broker</label>
                    <textarea className="form-textarea" placeholder="Hi, I'm interested in this apartment. I'm looking to move in next month and my budget is $3,200/month. Could we schedule a viewing?" value={contactMsg} onChange={e => setContactMsg(e.target.value)} />
                  </div>
                  <button className="btn btn-primary" style={{ width: "100%" }} onClick={handleContactBroker}>Send message — AI will score your lead</button>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "20px", background: "#e8f5e2", borderRadius: 10 }}>
                  <p style={{ fontSize: 24, marginBottom: 8 }}>✓</p>
                  <p style={{ fontWeight: 600, color: "#1a3a2a" }}>Message sent!</p>
                  <p style={{ fontSize: 13, color: "#1a3a2a", marginTop: 4 }}>The broker will see your AI lead score on their dashboard.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Topbar */}
        <div className="topbar">
          <div className="logo" onClick={() => setView("home")}>BrokerAI</div>
          <div className="topbar-nav">
            {role === "broker" && <>
              <button className="nav-btn" onClick={() => setView("broker-dashboard")}>Dashboard</button>
              <button className="nav-btn" onClick={() => setView("new-listing")}>+ New listing</button>
            </>}
            {role === "renter" && <>
              <button className="nav-btn" onClick={() => setView("search")}>Search</button>
            </>}
            {role && <button className="nav-btn primary" onClick={() => { setRole(null); setView("home"); }}>Sign out</button>}
            {!role && <>
              <button className="nav-btn" onClick={() => { setRole("renter"); setView("search"); }}>I'm a renter</button>
              <button className="nav-btn primary" onClick={() => { setRole("broker"); setView("broker-dashboard"); }}>I'm a broker</button>
            </>}
          </div>
        </div>

        <div className="main">

          {/* HOME */}
          {view === "home" && (
            <>
              <div className="hero">
                <h1>NYC apartments,<br /><span>reimagined with AI</span></h1>
                <p>The platform built for brokers first — with AI tools StreetEasy doesn't have and never will.</p>
                <div className="hero-btns">
                  <button className="hero-btn primary" onClick={() => { setRole("broker"); setView("broker-dashboard"); }}>I'm a broker →</button>
                  <button className="hero-btn secondary" onClick={() => { setRole("renter"); setView("search"); }}>Browse apartments</button>
                </div>
              </div>
              <div className="features">
                {[
                  { icon: "✦", title: "AI listing writer", desc: "Upload your details and Claude writes a compelling description in seconds." },
                  { icon: "◈", title: "Lead scorer", desc: "Every renter message gets an AI score so you chase the right leads first." },
                  { icon: "⬡", title: "Smart pricing", desc: "AI suggests the right rent based on neighborhood and bedroom count." },
                  { icon: "◎", title: "Natural language search", desc: "Renters search the way they talk. 'Sunny 1BR near L train, no fee.'" },
                ].map(f => (
                  <div className="feature-card" key={f.title}>
                    <div className="feature-icon">{f.icon}</div>
                    <div className="feature-title">{f.title}</div>
                    <div className="feature-desc">{f.desc}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* SEARCH */}
          {view === "search" && (
            <>
              <div className="page-header">
                <h2 className="section-title">Find your apartment</h2>
                <p className="section-sub">Search by filters or describe what you want in plain English</p>
              </div>

              {/* Natural language search */}
              <div className="natural-box">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span className="ai-badge">✦ AI search</span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>Describe what you want in plain English</span>
                </div>
                <div className="natural-row">
                  <input className="natural-input" placeholder="e.g. sunny 2BR in Williamsburg under $3,500 with good light" value={naturalQuery} onChange={e => { setNaturalQuery(e.target.value); setNaturalResults(null); }} onKeyDown={e => e.key === "Enter" && handleNaturalSearch()} />
                  <button className="btn btn-ai" onClick={handleNaturalSearch}>Search with AI</button>
                </div>
                {naturalResults && (
                  <div style={{ marginTop: 12 }}>
                    {naturalResults.length === 0
                      ? <p style={{ fontSize: 13, color: "var(--muted)" }}>No listings matched your search. Try different words.</p>
                      : <p style={{ fontSize: 12, color: "#1a3a2a", marginBottom: 10 }}>✦ AI found {naturalResults.length} match{naturalResults.length !== 1 ? "es" : ""} for "{naturalQuery}"</p>
                    }
                    <div className="listing-grid">
                      {naturalResults.map(l => (
                        <div className="listing-card" key={l.id} onClick={() => setSelectedListing(l)}>
                          <div className="listing-photo">{l.photos}</div>
                          <div className="listing-body">
                            <div className="listing-price">${l.rent.toLocaleString()}/mo</div>
                            <div className="listing-address">{l.address}, {l.neighborhood}</div>
                            <div className="listing-tags"><span className="tag green">{l.bedrooms} BR</span><span className="tag">{l.neighborhood}</span></div>
                            <div className="listing-desc">{l.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Filters */}
              <div className="search-bar">
                <div className="filter-group">
                  <span className="filter-label">Neighborhood</span>
                  <select className="filter-select" value={searchNeighborhood} onChange={e => setSearchNeighborhood(e.target.value)}>
                    {NEIGHBORHOODS.map(n => <option key={n}>{n}</option>)}
                  </select>
                </div>
                <div className="filter-group">
                  <span className="filter-label">Bedrooms</span>
                  <select className="filter-select" value={searchBeds} onChange={e => setSearchBeds(e.target.value)}>
                    {["Any","1","2","3"].map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div className="filter-group">
                  <span className="filter-label">Max rent: <strong>${searchMaxRent.toLocaleString()}</strong></span>
                  <input type="range" min="1500" max="6000" step="100" value={searchMaxRent} onChange={e => setSearchMaxRent(parseInt(e.target.value))} style={{ width: 160 }} />
                </div>
                <button className="btn btn-secondary" onClick={() => { setSearchNeighborhood("All"); setSearchMaxRent(5000); setSearchBeds("Any"); setNaturalResults(null); }}>Clear</button>
              </div>

              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>{filteredListings.length} listings found</p>

              {filteredListings.length === 0
                ? <div className="empty">No listings match your filters. Try adjusting them.</div>
                : <div className="listing-grid">
                  {filteredListings.map(l => (
                    <div className="listing-card" key={l.id} onClick={() => setSelectedListing(l)}>
                      <div className="listing-photo">{l.photos}</div>
                      <div className="listing-body">
                        <div className="listing-price">${l.rent.toLocaleString()}/mo</div>
                        <div className="listing-address">{l.address}, {l.neighborhood}</div>
                        <div className="listing-tags">
                          <span className="tag green">{l.bedrooms} BR</span>
                          <span className="tag">{l.neighborhood}</span>
                          <span className="tag">by {l.broker}</span>
                        </div>
                        <div className="listing-desc">{l.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              }
            </>
          )}

          {/* BROKER DASHBOARD */}
          {view === "broker-dashboard" && (
            <>
              <div className="page-header">
                <h2 className="section-title">Broker dashboard</h2>
                <p className="section-sub">Welcome back, Marco. Here's your activity.</p>
              </div>

              <div className="stat-row">
                <div className="stat"><div className="stat-num">{myListings.length}</div><div className="stat-label">Total listings</div></div>
                <div className="stat"><div className="stat-num">{myListings.filter(l => l.status === "active").length}</div><div className="stat-label">Active</div></div>
                <div className="stat"><div className="stat-num">{myLeads.length}</div><div className="stat-label">Total leads</div></div>
                <div className="stat"><div className="stat-num">{myLeads.filter(l => l.score >= 7).length}</div><div className="stat-label">Hot leads</div></div>
              </div>

              <div className="broker-grid">
                <div className="dash-card">
                  <div className="dash-card-title">My listings</div>
                  {myListings.length === 0
                    ? <div className="empty">No listings yet. <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => setView("new-listing")}>Add your first</button></div>
                    : myListings.map(l => (
                      <div className="my-listing-row" key={l.id} onClick={() => setView("new-listing")}>
                        <div className="my-listing-icon">{l.photos}</div>
                        <div className="my-listing-info">
                          <div className="my-listing-addr">{l.address}</div>
                          <div className="my-listing-meta">{l.neighborhood} · ${l.rent.toLocaleString()}/mo · {l.bedrooms} BR</div>
                        </div>
                        <span className={l.status === "active" ? "badge-active" : "badge-rented"}>{l.status}</span>
                        {(l.leads || []).length > 0 && <span className="leads-count">{l.leads.length}</span>}
                      </div>
                    ))
                  }
                  <button className="btn btn-primary" style={{ width: "100%", marginTop: 14 }} onClick={() => setView("new-listing")}>+ Add new listing</button>
                </div>

                <div className="dash-card">
                  <div className="dash-card-title">Leads — scored by AI ✦</div>
                  {myLeads.length === 0
                    ? <div className="empty" style={{ padding: "20px 0" }}>No leads yet. Leads appear here when renters contact you.</div>
                    : [...myLeads].sort((a, b) => b.score - a.score).map((lead, i) => {
                      const scoreClass = lead.score >= 7 ? "score-high" : lead.score >= 5 ? "score-mid" : "score-low";
                      return (
                        <div className="lead-row" key={i}>
                          <div className={`score-badge ${scoreClass}`}>{lead.score}</div>
                          <div className="lead-info">
                            <div className="lead-address">{lead.listing.address}</div>
                            <div className="lead-msg">"{lead.message}"</div>
                            <div className="lead-time">{lead.time}</div>
                          </div>
                        </div>
                      );
                    })
                  }
                </div>
              </div>
            </>
          )}

          {/* NEW LISTING */}
          {view === "new-listing" && (
            <>
              <div className="page-header">
                <h2 className="section-title">New listing</h2>
                <p className="section-sub">Fill in the details — let AI write the description for you</p>
              </div>

              <div style={{ maxWidth: 560 }}>
                <div className="form-group">
                  <label className="form-label">Street address</label>
                  <input className="form-input" placeholder="e.g. 47 Bedford Ave" value={newListing.address} onChange={e => setNewListing(p => ({ ...p, address: e.target.value }))} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Neighborhood</label>
                    <select className="form-select" value={newListing.neighborhood} onChange={e => { setNewListing(p => ({ ...p, neighborhood: e.target.value })); setSuggestedRent(null); }}>
                      {NEIGHBORHOODS.filter(n => n !== "All").map(n => <option key={n}>{n}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bedrooms</label>
                    <select className="form-select" value={newListing.bedrooms} onChange={e => { setNewListing(p => ({ ...p, bedrooms: e.target.value })); setSuggestedRent(null); }}>
                      <option value="">Select</option>
                      {[1,2,3,4].map(n => <option key={n}>{n}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Monthly rent ($)</label>
                  <input className="form-input" type="number" placeholder="e.g. 3200" value={newListing.rent} onChange={e => setNewListing(p => ({ ...p, rent: e.target.value }))} />
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                    <button className="btn btn-secondary" style={{ fontSize: 12, padding: "6px 12px" }} onClick={handleSuggestPrice} disabled={priceLoading}>
                      {priceLoading ? "Checking..." : "✦ AI price suggestion"}
                    </button>
                    {suggestedRent && <span className="price-hint">AI suggests: {suggestedRent}</span>}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-textarea" placeholder="Describe the apartment..." value={newListing.description} onChange={e => setNewListing(p => ({ ...p, description: e.target.value }))} />
                  <button className="btn btn-ai" style={{ marginTop: 8 }} onClick={handleGenerateDescription}>
                    <span className="ai-badge" style={{ background: "transparent", border: "none", color: "#c8f0d8", padding: 0 }}>✦</span>
                    Generate with AI
                  </button>
                </div>

                <div className="btn-row" style={{ marginTop: 8 }}>
                  <button className="btn btn-secondary" onClick={() => setView("broker-dashboard")}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleAddListing}>Publish listing</button>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}
