import { useState } from "react";

const INIT_LISTINGS = [
  { id:1, addr:"47 Bedford Ave", hood:"Williamsburg", rent:3200, beds:2, status:"active", broker:"Marco Silva", photo:"https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600", desc:"Bright corner unit with exposed brick and skyline views. Steps from the L train and surrounded by Williamsburg's best coffee shops and galleries.", leads:[] },
  { id:2, addr:"210 Franklin St", hood:"Greenpoint", rent:2750, beds:1, status:"active", broker:"Priya Nair", photo:"https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600", desc:"Top-floor unit in a restored warehouse building with original hardwood floors. Quiet block, great natural light.", leads:[] },
  { id:3, addr:"88 Nostrand Ave", hood:"Crown Heights", rent:2100, beds:1, status:"active", broker:"Marco Silva", photo:"https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=600", desc:"Sunny garden-level in a limestone brownstone. Laundry in building, close to the 2/3/4/5 trains.", leads:[] },
  { id:4, addr:"330 W 42nd St", hood:"Hell's Kitchen", rent:4100, beds:3, status:"active", broker:"Jen Torres", photo:"https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600", desc:"Luxury three-bedroom with floor-to-ceiling windows and breathtaking Midtown views. Full-time doorman building.", leads:[] },
  { id:5, addr:"15 Myrtle Ave", hood:"Fort Greene", rent:2900, beds:2, status:"rented", broker:"Marco Silva", photo:"https://images.unsplash.com/photo-1484154218962-a197022b5858?w=600", desc:"Renovated two-bedroom with chef kitchen and private backyard.", leads:[] },
];

const HOOD_PHOTOS = {
  "Williamsburg":"https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600",
  "Greenpoint":"https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600",
  "Crown Heights":"https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=600",
  "Hell's Kitchen":"https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600",
  "Fort Greene":"https://images.unsplash.com/photo-1484154218962-a197022b5858?w=600",
  "Astoria":"https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=600",
  "Park Slope":"https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600",
  "Bushwick":"https://images.unsplash.com/photo-1536376072261-38c75246e2ba?w=600",
};

async function claude(prompt, max=300) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:max, messages:[{role:"user",content:prompt}] })
  });
  const d = await r.json();
  return d.content?.[0]?.text?.trim() || "";
}

export default function BrokerAI() {
  const [listings, setListings] = useState(INIT_LISTINGS);
  const [view, setView] = useState("home");
  const [role, setRole] = useState(null);
  const [selected, setSelected] = useState(null);
  const [contactMsg, setContactMsg] = useState("");
  const [contactSent, setContactSent] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [coverLoading, setCoverLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTask, setAiTask] = useState("");
  const [nlQuery, setNlQuery] = useState("");
  const [nlResults, setNlResults] = useState(null);
  const [fHood, setFHood] = useState("All");
  const [fBeds, setFBeds] = useState("Any");
  const [fRent, setFRent] = useState(5000);
  const [newL, setNewL] = useState({ addr:"", hood:"Williamsburg", beds:"", rent:"", desc:"", photo:"" });
  const [priceHint, setPriceHint] = useState("");
  const [toast, setToast] = useState(null);
  const [hoodBio, setHoodBio] = useState("");
  const [bioLoading, setBioLoading] = useState(false);

  const showToast = (msg, type="ok") => { setToast({msg,type}); setTimeout(()=>setToast(null),3500); };
  const myListings = listings.filter(l=>l.broker==="Marco Silva");
  const myLeads = myListings.flatMap(l=>(l.leads||[]).map(ld=>({...ld,listing:l})));
  const filtered = listings.filter(l=>{
    if(l.status!=="active") return false;
    if(fHood!=="All" && l.hood!==fHood) return false;
    if(fBeds!=="Any" && l.beds!==parseInt(fBeds)) return false;
    if(l.rent>fRent) return false;
    return true;
  });

  // AI: Write listing description
  async function genDesc() {
    if(!newL.addr||!newL.beds||!newL.rent){ showToast("Fill address, beds, and rent first","warn"); return; }
    setAiLoading(true); setAiTask("Writing your listing description...");
    try {
      const res = await claude(`Write a compelling NYC apartment listing description under 80 words for: ${newL.beds}BR in ${newL.hood}, $${newL.rent}/mo at ${newL.addr}. Be specific and appealing. No opener like "Welcome to".`);
      setNewL(p=>({...p,desc:res}));
      showToast("AI description written!");
    } catch { showToast("API error — try again","warn"); }
    setAiLoading(false); setAiTask("");
  }

  // AI: Find apartment photos
  async function findPhotos() {
    setAiLoading(true); setAiTask("Finding apartment photos for " + newL.hood + "...");
    try {
      const photo = HOOD_PHOTOS[newL.hood] || HOOD_PHOTOS["Williamsburg"];
      setNewL(p=>({...p,photo}));
      showToast("Photos found for " + newL.hood + "!");
    } catch { showToast("Could not find photos","warn"); }
    setAiLoading(false); setAiTask("");
  }

  // AI: Suggest rent price
  async function suggestPrice() {
    if(!newL.beds||!newL.hood){ showToast("Pick neighborhood and bedrooms first","warn"); return; }
    setAiLoading(true); setAiTask("Checking NYC market prices...");
    try {
      const res = await claude(`What is the typical monthly rent for a ${newL.beds}BR apartment in ${newL.hood}, NYC in 2025? Return ONLY a price range like "$2,800–$3,400". Nothing else.`, 25);
      setPriceHint(res);
      showToast("Price suggestion ready!");
    } catch { showToast("API error — try again","warn"); }
    setAiLoading(false); setAiTask("");
  }

  // AI: Natural language search
  async function doNLSearch() {
    if(!nlQuery.trim()) return;
    setAiLoading(true); setAiTask("Finding your best matches...");
    try {
      const summary = listings.filter(l=>l.status==="active").map(l=>`ID:${l.id}|${l.addr},${l.hood}|${l.beds}BR|$${l.rent}/mo`).join("\n");
      const res = await claude(`Renter search query: "${nlQuery}"\nAvailable listings:\n${summary}\nReturn ONLY a JSON array of the best matching listing IDs in order, like [2,1]. Max 3 results. Return [] if nothing matches.`, 50);
      const match = res.match(/\[[\d,\s]*\]/);
      if(match) {
        const ids = JSON.parse(match[0]);
        setNlResults(ids.map(id=>listings.find(l=>l.id===id)).filter(Boolean));
      } else { setNlResults([]); }
    } catch { setNlResults([]); }
    setAiLoading(false); setAiTask("");
  }

  // AI: Neighborhood guide + open listing modal
  async function openListing(l) {
    setSelected(l); setContactSent(false); setContactMsg(""); setHoodBio(""); setCoverLetter("");
    setBioLoading(true);
    try {
      const bio = await claude(`Write 2 sentences about ${l.hood}, NYC. Cover: best subway lines, neighborhood vibe, and what kind of person would love living here. Be specific and honest.`, 130);
      setHoodBio(bio);
    } catch {}
    setBioLoading(false);
  }

  // AI: Application cover letter
  async function genCoverLetter() {
    if(!contactMsg.trim()){ showToast("Write your message to the broker first","warn"); return; }
    setCoverLoading(true);
    try {
      const res = await claude(`Write a short, professional cover letter (under 80 words) for a renter applying for this apartment: ${selected.addr}, ${selected.hood}, ${selected.beds}BR, $${selected.rent}/mo. The renter's note: "${contactMsg}". Make it warm, honest, and persuasive. No generic openers.`, 150);
      setCoverLetter(res);
      showToast("Cover letter written by AI!");
    } catch { showToast("API error — try again","warn"); }
    setCoverLoading(false);
  }

  async function sendMessage() {
    if(!contactMsg.trim()){ showToast("Type a message first","warn"); return; }
    setAiLoading(true); setAiTask("Sending your message...");
    const lead = { id:Date.now(), message:contactMsg, renter:"You", time:new Date().toLocaleTimeString() };
    setListings(prev=>prev.map(l=>l.id===selected.id?{...l,leads:[...(l.leads||[]),lead]}:l));
    setContactSent(true);
    showToast("Message sent to broker!");
    setAiLoading(false); setAiTask("");
  }

  function publishListing() {
    if(!newL.addr||!newL.beds||!newL.rent||!newL.desc){ showToast("Fill all fields first","warn"); return; }
    const l = {
      id:Date.now(), addr:newL.addr, hood:newL.hood,
      rent:parseInt(newL.rent), beds:parseInt(newL.beds),
      status:"active", broker:"Marco Silva",
      photo:newL.photo||HOOD_PHOTOS[newL.hood]||HOOD_PHOTOS["Williamsburg"],
      desc:newL.desc, leads:[]
    };
    setListings(prev=>[l,...prev]);
    setNewL({addr:"",hood:"Williamsburg",beds:"",rent:"",desc:"",photo:""});
    setPriceHint("");
    setView("broker");
    showToast("Listing published!");
  }

  const css = `
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:system-ui,-apple-system,sans-serif;background:#f7f6f2;color:#1a1a1a;}
    .bar{background:#fff;border-bottom:1px solid #e0ded8;padding:0 20px;height:52px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;}
    .logo{font-size:18px;font-weight:700;color:#1a3a2a;cursor:pointer;letter-spacing:-.5px;}
    .tnav{display:flex;gap:6px;align-items:center;}
    .tbtn{font-size:12px;padding:6px 14px;border-radius:8px;border:1px solid #e0ded8;background:transparent;color:#6b6b6b;cursor:pointer;font-family:inherit;}
    .tbtn:hover{background:#f0efe9;}
    .tbtn.on{background:#1a3a2a;color:#fff;border-color:#1a3a2a;}
    .pg{display:none;padding:24px 20px;max-width:1100px;margin:0 auto;}
    .pg.show{display:block;}
    .hero{text-align:center;padding:48px 20px 32px;}
    .hero h1{font-size:clamp(28px,5vw,52px);font-weight:700;line-height:1.15;margin-bottom:14px;}
    .hero h1 em{font-style:normal;color:#1a3a2a;}
    .hero p{font-size:15px;color:#6b6b6b;max-width:500px;margin:0 auto 28px;line-height:1.6;}
    .hbtns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}
    .hbtn{padding:13px 26px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;border:1px solid;font-family:inherit;}
    .hbtn.p{background:#1a3a2a;color:#fff;border-color:#1a3a2a;}
    .hbtn.s{background:#fff;color:#1a1a1a;border-color:#e0ded8;}
    .feats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-top:40px;}
    .feat{background:#fff;border:1px solid #e0ded8;border-radius:12px;padding:18px;}
    .feat-i{font-size:20px;margin-bottom:8px;}
    .feat-t{font-size:13px;font-weight:600;margin-bottom:4px;color:#1a1a1a;}
    .feat-d{font-size:12px;color:#6b6b6b;line-height:1.5;}
    .ph{margin-bottom:20px;}
    .ph h2{font-size:22px;font-weight:700;margin-bottom:4px;}
    .ph p{font-size:13px;color:#6b6b6b;}
    .stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:20px;}
    .stat{background:#fff;border:1px solid #e0ded8;border-radius:10px;padding:14px;text-align:center;}
    .stat-n{font-size:28px;font-weight:700;}
    .stat-l{font-size:11px;color:#6b6b6b;}
    .two{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
    @media(max-width:640px){.two{grid-template-columns:1fr;}.stats{grid-template-columns:repeat(2,1fr);}}
    .card{background:#fff;border:1px solid #e0ded8;border-radius:12px;padding:16px;}
    .card-t{font-size:11px;font-weight:600;color:#6b6b6b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:14px;}
    .lrow{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #f0efe9;}
    .lrow:last-child{border-bottom:none;}
    .lthumb{width:36px;height:36px;border-radius:6px;object-fit:cover;flex-shrink:0;}
    .linfo{flex:1;min-width:0;}
    .laddr{font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .lmeta{font-size:11px;color:#6b6b6b;}
    .badge-a{font-size:10px;padding:2px 7px;border-radius:20px;background:#e8f5e0;color:#1a3a2a;}
    .badge-r{font-size:10px;padding:2px 7px;border-radius:20px;background:#fee2e2;color:#7f1d1d;}
    .lead-row{display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid #f0efe9;}
    .lead-row:last-child{border-bottom:none;}
    .lead-ico{width:30px;height:30px;border-radius:50%;background:#e8f5e0;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;}
    .lead-addr{font-size:12px;font-weight:600;}
    .lead-msg{font-size:11px;color:#6b6b6b;line-height:1.4;}
    .lead-time{font-size:10px;color:#aaa;}
    .empty{text-align:center;padding:24px;font-size:13px;color:#6b6b6b;}
    .aibox{background:#fff;border:1px solid #e0ded8;border-radius:12px;padding:14px 16px;margin-bottom:16px;}
    .ailabel{font-size:11px;font-weight:700;color:#1a3a2a;margin-bottom:8px;}
    .arow{display:flex;gap:8px;}
    .ainp{flex:1;padding:9px 12px;border:1px solid #e0ded8;border-radius:8px;font-size:13px;color:#1a1a1a;background:#fff;font-family:inherit;}
    .ainp:focus{outline:none;border-color:#1a3a2a;}
    .filters{background:#fff;border:1px solid #e0ded8;border-radius:12px;padding:14px 16px;margin-bottom:16px;display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;}
    .fg{display:flex;flex-direction:column;gap:4px;}
    .fl{font-size:11px;color:#6b6b6b;font-weight:600;text-transform:uppercase;letter-spacing:.04em;}
    select{padding:7px 10px;border:1px solid #e0ded8;border-radius:8px;font-size:13px;color:#1a1a1a;background:#fff;min-width:120px;font-family:inherit;}
    .lgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;}
    .lcard{background:#fff;border:1px solid #e0ded8;border-radius:12px;overflow:hidden;cursor:pointer;transition:transform .12s,box-shadow .12s;}
    .lcard:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,.08);}
    .lcard-img{width:100%;height:150px;object-fit:cover;}
    .lcard-body{padding:14px;}
    .lcard-price{font-size:20px;font-weight:700;margin-bottom:3px;}
    .lcard-addr{font-size:12px;color:#6b6b6b;margin-bottom:8px;}
    .tags{display:flex;gap:5px;flex-wrap:wrap;}
    .tag{font-size:11px;padding:2px 7px;border-radius:20px;border:1px solid #e0ded8;color:#6b6b6b;}
    .tag-g{background:#e8f5e0;border-color:#c8f0d0;color:#1a3a2a;}
    .lcard-desc{font-size:11px;color:#6b6b6b;margin-top:8px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
    .cnt{font-size:13px;color:#6b6b6b;margin-bottom:14px;}
    .fgroup{margin-bottom:14px;}
    .flabel{font-size:12px;font-weight:600;color:#6b6b6b;margin-bottom:5px;text-transform:uppercase;letter-spacing:.04em;display:block;}
    .finput,.fsel,.farea{width:100%;padding:10px 12px;border:1px solid #e0ded8;border-radius:8px;font-size:13px;color:#1a1a1a;background:#fff;font-family:inherit;}
    .finput:focus,.fsel:focus,.farea:focus{outline:none;border-color:#1a3a2a;}
    .farea{min-height:90px;resize:vertical;}
    .two-inp{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
    .btn{padding:9px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid;font-family:inherit;transition:opacity .15s;}
    .btn-p{background:#1a3a2a;color:#fff;border-color:#1a3a2a;}
    .btn-p:hover{opacity:.88;}
    .btn-s{background:#fff;color:#1a1a1a;border-color:#e0ded8;}
    .btn-s:hover{background:#f0efe9;}
    .btn-ai{background:#1a3a2a;color:#c8f0d0;border-color:#1a3a2a;font-size:12px;padding:7px 14px;}
    .btn-ai:hover{opacity:.85;}
    .btn-ai:disabled{opacity:.5;cursor:not-allowed;}
    .btn-row{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;}
    .price-hint{font-size:12px;color:#1a3a2a;background:#e8f5e0;padding:5px 10px;border-radius:6px;margin-top:6px;display:inline-block;border:1px solid #c8f0d0;}
    .photo-preview{width:100%;height:160px;object-fit:cover;border-radius:8px;margin-top:8px;}
    .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;}
    .modal{background:#fff;border-radius:14px;padding:24px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;}
    .modal-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;}
    .modal-title{font-size:20px;font-weight:700;}
    .modal-sub{font-size:12px;color:#6b6b6b;margin-top:3px;}
    .modal-x{background:none;border:none;font-size:22px;cursor:pointer;color:#6b6b6b;padding:0;line-height:1;}
    .modal-img{width:100%;height:200px;object-fit:cover;border-radius:10px;margin-bottom:14px;}
    .modal-price{font-size:30px;font-weight:700;margin-bottom:8px;}
    .modal-desc{font-size:13px;color:#6b6b6b;line-height:1.7;margin-bottom:14px;}
    .hood-bio{background:#e8f5e0;border-radius:8px;padding:12px 14px;font-size:12px;color:#1a3a2a;line-height:1.6;margin-bottom:14px;}
    .hood-bio-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;opacity:.65;}
    .cover-box{background:#f0faf4;border:1px solid #c8f0d0;border-radius:8px;padding:12px 14px;font-size:12px;color:#1a3a2a;line-height:1.7;margin-top:10px;}
    .cover-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;opacity:.65;}
    .success{background:#e8f5e0;border-radius:10px;padding:18px;text-align:center;}
    .success strong{font-size:16px;color:#1a3a2a;}
    .success p{font-size:13px;color:#1a3a2a;margin-top:6px;}
    .spin{display:inline-block;width:13px;height:13px;border:2px solid #c8f0d0;border-top-color:#1a3a2a;border-radius:50%;animation:sp .6s linear infinite;vertical-align:middle;margin-right:5px;}
    .big-spin{width:28px;height:28px;border:3px solid #c8f0d0;border-top-color:#1a3a2a;border-radius:50%;animation:sp .6s linear infinite;margin:0 auto;}
    @keyframes sp{to{transform:rotate(360deg)}}
    .ai-overlay{position:fixed;inset:0;background:rgba(0,0,0,.48);z-index:300;display:flex;align-items:center;justify-content:center;}
    .ai-box{background:#fff;border-radius:12px;padding:32px 44px;text-align:center;min-width:220px;}
    .ai-box p{font-size:14px;color:#6b6b6b;margin-top:14px;}
    .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a1a1a;color:#fff;padding:11px 22px;border-radius:8px;font-size:13px;z-index:999;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,.2);}
    .toast.warn{background:#92400e;}
    .login-wrap{max-width:420px;margin:60px auto;padding:0 20px;}
    .login-card{background:#fff;border:1px solid #e0ded8;border-radius:16px;padding:36px 32px;text-align:center;}
    .login-logo{font-size:26px;font-weight:700;color:#1a3a2a;margin-bottom:4px;}
    .login-tagline{font-size:14px;color:#6b6b6b;margin-bottom:30px;}
    .google-btn{width:100%;padding:12px;border-radius:8px;border:1px solid #e0ded8;background:#fff;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;font-family:inherit;}
    .google-btn:hover{background:#f8f8f8;}
    .divider{display:flex;align-items:center;gap:12px;margin:22px 0 18px;font-size:12px;color:#bbb;}
    .divider::before,.divider::after{content:"";flex:1;height:1px;background:#e8e6e0;}
    .role-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
    .role-card{border:1px solid #e0ded8;border-radius:10px;padding:16px 8px;cursor:pointer;text-align:center;transition:all .15s;}
    .role-card:hover{border-color:#1a3a2a;background:#f0faf4;}
    .role-ico{font-size:24px;margin-bottom:6px;}
    .role-t{font-size:12px;font-weight:700;color:#1a1a1a;}
    .role-d{font-size:10px;color:#6b6b6b;margin-top:2px;line-height:1.4;}
    .coming-soon{font-size:11px;color:#bbb;margin-top:10px;}
    .section-divider{height:1px;background:#e0ded8;margin:16px 0;}
  `;

  // LOGIN SCREEN
  if(!role) return (
    <>
      <style>{css}</style>
      {toast && <div className={`toast${toast.type==="warn"?" warn":""}`}>{toast.msg}</div>}
      <div className="bar"><div className="logo">BrokerAI</div></div>
      <div className="login-wrap">
        <div className="login-card">
          <div className="login-logo">BrokerAI</div>
          <div className="login-tagline">NYC apartments, powered by AI</div>
          <button className="google-btn" onClick={()=>showToast("Google sign-in coming soon — pick a role below","warn")}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
          <div className="coming-soon">Google sign-in coming soon</div>
          <div className="divider">or continue as</div>
          <div className="role-grid">
            <div className="role-card" onClick={()=>{setRole("broker");setView("broker");}}>
              <div className="role-ico">🏢</div>
              <div className="role-t">Broker</div>
              <div className="role-d">List & manage apartments</div>
            </div>
            <div className="role-card" onClick={()=>{setRole("renter");setView("search");}}>
              <div className="role-ico">🔍</div>
              <div className="role-t">Renter</div>
              <div className="role-d">Find an apartment to rent</div>
            </div>
            <div className="role-card" onClick={()=>{setRole("buyer");setView("search");}}>
              <div className="role-ico">🏠</div>
              <div className="role-t">Buyer</div>
              <div className="role-d">Looking to buy a home</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <style>{css}</style>
      {toast && <div className={`toast${toast.type==="warn"?" warn":""}`}>{toast.msg}</div>}

      {aiLoading && (
        <div className="ai-overlay">
          <div className="ai-box">
            <div className="big-spin"></div>
            <p>{aiTask}</p>
          </div>
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={()=>{setSelected(null);setHoodBio("");setCoverLetter("");}}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="modal-title">{selected.addr}</div>
                <div className="modal-sub">{selected.hood} · {selected.beds} BR · Listed by {selected.broker}</div>
              </div>
              <button className="modal-x" onClick={()=>{setSelected(null);setHoodBio("");setCoverLetter("");}}>✕</button>
            </div>
            <img className="modal-img" src={selected.photo} alt={selected.addr} onError={e=>e.target.src=HOOD_PHOTOS["Williamsburg"]} />
            <div className="modal-price">${selected.rent.toLocaleString()}<span style={{fontSize:14,fontWeight:400,color:"#6b6b6b"}}>/mo</span></div>
            <div className="modal-desc">{selected.desc}</div>

            {/* AI Neighborhood Guide */}
            {bioLoading ? (
              <div className="hood-bio"><div className="hood-bio-lbl">✦ AI neighborhood guide</div><span className="spin"></span>Loading neighborhood info...</div>
            ) : hoodBio ? (
              <div className="hood-bio"><div className="hood-bio-lbl">✦ AI neighborhood guide — {selected.hood}</div>{hoodBio}</div>
            ) : null}

            <div className="section-divider"></div>

            {!contactSent ? (
              <>
                <div className="fgroup">
                  <label className="flabel">Message to broker</label>
                  <textarea className="farea" placeholder="Hi, I'm interested in this apartment. I'm looking to move in next month and my budget works. Could we schedule a viewing?" value={contactMsg} onChange={e=>setContactMsg(e.target.value)} style={{minHeight:80}} />
                </div>

                {/* AI Application Helper */}
                <div className="btn-row" style={{marginBottom:12}}>
                  <button className="btn btn-ai" onClick={genCoverLetter} disabled={coverLoading}>
                    {coverLoading ? <><span className="spin"></span>Writing...</> : "📋 AI application helper"}
                  </button>
                </div>
                {coverLetter && (
                  <div className="cover-box">
                    <div className="cover-lbl">✦ AI-written cover letter — copy and use this</div>
                    {coverLetter}
                  </div>
                )}

                <button className="btn btn-p" style={{width:"100%",marginTop:12}} onClick={sendMessage}>Send message to broker</button>
              </>
            ) : (
              <div className="success">
                <strong>Message sent!</strong>
                <p>The broker will get back to you soon.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TOP BAR */}
      <div className="bar">
        <div className="logo" onClick={()=>setView("home")}>BrokerAI</div>
        <div className="tnav">
          {role==="broker" && <>
            <button className="tbtn" onClick={()=>setView("broker")}>Dashboard</button>
            <button className="tbtn on" onClick={()=>setView("new-listing")}>+ New listing</button>
          </>}
          {(role==="renter"||role==="buyer") &&
            <button className="tbtn" onClick={()=>setView("search")}>Search</button>
          }
          <button className="tbtn" onClick={()=>setRole(null)}>Sign out</button>
        </div>
      </div>

      {/* HOME */}
      <div className={`pg${view==="home"?" show":""}`}>
        <div className="hero">
          <h1>NYC apartments,<br/><em>powered by AI</em></h1>
          <p>The smarter replacement for StreetEasy — with AI tools built into every part of the experience.</p>
          <div className="hbtns">
            <button className="hbtn p" onClick={()=>setView(role==="broker"?"broker":"search")}>
              {role==="broker"?"Broker dashboard":"Browse apartments"}
            </button>
            {role==="broker" && <button className="hbtn s" onClick={()=>setView("new-listing")}>+ New listing</button>}
          </div>
        </div>
        <div className="feats">
          {[
            {i:"✦",t:"AI listing writer",d:"Claude writes your full listing description from just the address, neighborhood, and rent."},
            {i:"🖼",t:"AI photo finder",d:"No photos? AI finds real apartment photos matching your neighborhood automatically."},
            {i:"⬡",t:"Smart pricing",d:"AI suggests the right rent range based on current NYC market data before you list."},
            {i:"◎",t:"Natural language search",d:'Search the way you talk. "Sunny 2BR near L train under $3,200, no fee."'},
            {i:"🗺",t:"AI neighborhood guide",d:"Every listing includes an AI-generated neighborhood summary — subway, vibe, and who it's best for."},
            {i:"📋",t:"AI application helper",d:"Renters get an AI-written cover letter to send to the landlord when they apply."},
          ].map(f=>(
            <div className="feat" key={f.t}>
              <div className="feat-i">{f.i}</div>
              <div className="feat-t">{f.t}</div>
              <div className="feat-d">{f.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* SEARCH */}
      <div className={`pg${view==="search"?" show":""}`}>
        <div className="ph"><h2>Find your apartment</h2><p>Search with filters or describe what you want in plain English</p></div>
        <div className="aibox">
          <div className="ailabel">✦ AI search — describe what you want</div>
          <div className="arow">
            <input className="ainp" placeholder='Try: "sunny 2BR in Williamsburg under $3,500 near L train no fee"' value={nlQuery} onChange={e=>{setNlQuery(e.target.value);setNlResults(null);}} onKeyDown={e=>e.key==="Enter"&&doNLSearch()} />
            <button className="btn btn-ai" onClick={doNLSearch}>Search</button>
          </div>
          {nlResults && nlResults.length===0 && <p style={{fontSize:12,color:"#6b6b6b",marginTop:10}}>No matches found. Try different words or use the filters below.</p>}
          {nlResults && nlResults.length>0 && <p style={{fontSize:12,color:"#1a3a2a",marginTop:10}}>✦ {nlResults.length} AI match{nlResults.length!==1?"es":""} for "{nlQuery}"</p>}
        </div>
        <div className="filters">
          <div className="fg">
            <span className="fl">Neighborhood</span>
            <select value={fHood} onChange={e=>setFHood(e.target.value)}>
              <option>All</option>
              {["Williamsburg","Greenpoint","Crown Heights","Hell's Kitchen","Fort Greene","Astoria","Park Slope","Bushwick"].map(n=><option key={n}>{n}</option>)}
            </select>
          </div>
          <div className="fg">
            <span className="fl">Bedrooms</span>
            <select value={fBeds} onChange={e=>setFBeds(e.target.value)}>
              <option>Any</option><option>1</option><option>2</option><option>3</option>
            </select>
          </div>
          <div className="fg">
            <span className="fl">Max rent: ${fRent.toLocaleString()}</span>
            <input type="range" min="1500" max="6000" step="100" value={fRent} onChange={e=>setFRent(parseInt(e.target.value))} style={{width:140}} />
          </div>
          <button className="btn btn-s" style={{fontSize:12,padding:"7px 12px"}} onClick={()=>{setFHood("All");setFBeds("Any");setFRent(5000);setNlResults(null);}}>Clear</button>
        </div>
        <div className="cnt">{(nlResults||filtered).length} listing{(nlResults||filtered).length!==1?"s":""} found</div>
        <div className="lgrid">
          {(nlResults||filtered).length===0
            ? <div className="empty" style={{gridColumn:"1/-1"}}>No listings match. Try adjusting your filters.</div>
            : (nlResults||filtered).map(l=>(
              <div className="lcard" key={l.id} onClick={()=>openListing(l)}>
                <img className="lcard-img" src={l.photo} alt={l.addr} onError={e=>e.target.src=HOOD_PHOTOS["Williamsburg"]} />
                <div className="lcard-body">
                  <div className="lcard-price">${l.rent.toLocaleString()}/mo</div>
                  <div className="lcard-addr">{l.addr}, {l.hood}</div>
                  <div className="tags">
                    <span className="tag tag-g">{l.beds} BR</span>
                    <span className="tag">{l.hood}</span>
                    <span className="tag">by {l.broker}</span>
                  </div>
                  <div className="lcard-desc">{l.desc}</div>
                </div>
              </div>
            ))
          }
        </div>
      </div>

      {/* BROKER DASHBOARD */}
      <div className={`pg${view==="broker"?" show":""}`}>
        <div className="ph"><h2>Broker dashboard</h2><p>Welcome back, Marco.</p></div>
        <div className="stats">
          <div className="stat"><div className="stat-n">{myListings.length}</div><div className="stat-l">Total listings</div></div>
          <div className="stat"><div className="stat-n">{myListings.filter(l=>l.status==="active").length}</div><div className="stat-l">Active</div></div>
          <div className="stat"><div className="stat-n">{myLeads.length}</div><div className="stat-l">Inquiries</div></div>
          <div className="stat"><div className="stat-n">{myListings.reduce((a,l)=>a+(l.leads||[]).length,0)}</div><div className="stat-l">Messages</div></div>
        </div>
        <div className="two">
          <div className="card">
            <div className="card-t">My listings</div>
            {myListings.length===0
              ? <div className="empty">No listings yet.</div>
              : myListings.map(l=>(
                <div className="lrow" key={l.id}>
                  <img className="lthumb" src={l.photo} alt="" onError={e=>e.target.src=HOOD_PHOTOS["Williamsburg"]} />
                  <div className="linfo">
                    <div className="laddr">{l.addr}</div>
                    <div className="lmeta">{l.hood} · ${l.rent.toLocaleString()}/mo · {l.beds} BR</div>
                  </div>
                  <span className={l.status==="active"?"badge-a":"badge-r"}>{l.status}</span>
                </div>
              ))
            }
            <button className="btn btn-p" style={{width:"100%",marginTop:14,fontSize:12}} onClick={()=>setView("new-listing")}>+ Add new listing</button>
          </div>
          <div className="card">
            <div className="card-t">Renter inquiries</div>
            {myLeads.length===0
              ? <div className="empty">No inquiries yet. They'll appear here when renters message you.</div>
              : myLeads.map((ld,i)=>(
                <div className="lead-row" key={i}>
                  <div className="lead-ico">✉</div>
                  <div>
                    <div className="lead-addr">{ld.listing.addr}</div>
                    <div className="lead-msg">"{ld.message}"</div>
                    <div className="lead-time">{ld.time}</div>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* NEW LISTING */}
      <div className={`pg${view==="new-listing"?" show":""}`}>
        <div className="ph"><h2>New listing</h2><p>Let AI do the hard work for you</p></div>
        <div style={{maxWidth:540}}>
          <div className="fgroup">
            <label className="flabel">Street address</label>
            <input className="finput" placeholder="e.g. 47 Bedford Ave" value={newL.addr} onChange={e=>setNewL(p=>({...p,addr:e.target.value}))} />
          </div>
          <div className="two-inp">
            <div className="fgroup">
              <label className="flabel">Neighborhood</label>
              <select className="fsel" value={newL.hood} onChange={e=>setNewL(p=>({...p,hood:e.target.value,photo:""}))}>
                {["Williamsburg","Greenpoint","Crown Heights","Hell's Kitchen","Fort Greene","Astoria","Park Slope","Bushwick"].map(n=><option key={n}>{n}</option>)}
              </select>
            </div>
            <div className="fgroup">
              <label className="flabel">Bedrooms</label>
              <select className="fsel" value={newL.beds} onChange={e=>setNewL(p=>({...p,beds:e.target.value}))}>
                <option value="">Select</option>
                <option>1</option><option>2</option><option>3</option><option>4</option>
              </select>
            </div>
          </div>
          <div className="fgroup">
            <label className="flabel">Monthly rent ($)</label>
            <input className="finput" type="number" placeholder="e.g. 3200" value={newL.rent} onChange={e=>setNewL(p=>({...p,rent:e.target.value}))} />
            <div className="btn-row">
              <button className="btn btn-ai" onClick={suggestPrice}>⬡ AI price suggestion</button>
            </div>
            {priceHint && <div className="price-hint">✦ AI suggests: {priceHint}</div>}
          </div>
          <div className="fgroup">
            <label className="flabel">Apartment photos</label>
            {newL.photo && <img className="photo-preview" src={newL.photo} alt="preview" />}
            <div className="btn-row" style={{marginTop:8}}>
              <button className="btn btn-ai" onClick={findPhotos}>🖼 Find photos with AI</button>
            </div>
          </div>
          <div className="fgroup">
            <label className="flabel">Description</label>
            <textarea className="farea" placeholder="Describe the apartment, or let AI write it for you..." value={newL.desc} onChange={e=>setNewL(p=>({...p,desc:e.target.value}))} />
            <div className="btn-row">
              <button className="btn btn-ai" onClick={genDesc}>✦ Write description with AI</button>
            </div>
          </div>
          <div className="btn-row" style={{marginTop:16}}>
            <button className="btn btn-s" onClick={()=>setView("broker")}>Cancel</button>
            <button className="btn btn-p" onClick={publishListing}>Publish listing</button>
          </div>
        </div>
      </div>
    </>
  );
}
