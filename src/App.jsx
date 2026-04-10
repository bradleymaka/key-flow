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

  const showToast = (msg, type="ok") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };
  const myListings = listings.filter(l=>l.broker==="Marco Silva");
  const myLeads = myListings.flatMap(l=>(l.leads||[]).map(ld=>({...ld,listing:l})));
  const filtered = listings.filter(l=>{
    if(l.status!=="active") return false;
    if(fHood!=="All" && l.hood!==fHood) return false;
    if(fBeds!=="Any" && l.beds!==parseInt(fBeds)) return false;
    if(l.rent>fRent) return false;
    return true;
  });

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

  async function findPhotos() {
    setAiLoading(true); setAiTask("Finding apartment photos for " + newL.hood + "...");
    try {
      const photo = HOOD_PHOTOS[newL.hood] || HOOD_PHOTOS["Williamsburg"];
      setNewL(p=>({...p,photo}));
      showToast("Photos found for " + newL.hood + "!");
    } catch { showToast("Could not find photos","warn"); }
    setAiLoading(false); setAiTask("");
  }

  async function suggestPrice() {
    if(!newL.beds||!newL.hood){ showToast("Pick neighborhood and bedrooms first","warn"); return; }
    setAiLoading(true); setAiTask("Checking NYC market prices...");
    try {
      const res = await claude(`What is the typical monthly rent for a ${newL.beds}BR in ${newL.hood}, NYC in 2025? Return ONLY a range like "$2,800–$3,400". Nothing else.`, 20);
      setPriceHint(res);
      showToast("Price suggestion ready!");
    } catch { showToast("API error","warn"); }
    setAiLoading(false); setAiTask("");
  }

  async function doNLSearch() {
    if(!nlQuery.trim()) return;
    setAiLoading(true); setAiTask("Finding your best matches...");
    try {
      const summary = listings.filter(l=>l.status==="active").map(l=>`ID:${l.id}|${l.addr},${l.hood}|${l.beds}BR|$${l.rent}/mo`).join("\n");
      const res = await claude(`Renter query: "${nlQuery}"\nListings:\n${summary}\nReturn ONLY a JSON array of best matching IDs like [2,1]. Max 3. Empty array [] if no match.`, 50);
      const match = res.match(/\[[\d,\s]*\]/);
      if(match) {
        const ids = JSON.parse(match[0]);
        setNlResults(ids.map(id=>listings.find(l=>l.id===id)).filter(Boolean));
      } else { setNlResults([]); }
    } catch { setNlResults([]); }
    setAiLoading(false); setAiTask("");
  }

  async function openListing(l) {
    setSelected(l); setContactSent(false); setContactMsg(""); setHoodBio("");
    setBioLoading(true);
    try {
      const bio = await claude(`Write 2 sentences about ${l.hood}, NYC covering subway access, neighborhood vibe, and who it's best for. Be specific and honest.`, 120);
      setHoodBio(bio);
    } catch {}
    setBioLoading(false);
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
    .tnav{display:flex;gap:6px;}
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
    .feats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:40px;}
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
    @media(max-width:600px){.two{grid-template-columns:1fr;}.stats{grid-template-columns:repeat(2,1fr);}}
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
    .ailabel{font-size:11px;font-weight:700;color:#1a3a2a;margin-bottom:8px;display:flex;align-items:center;gap:6px;}
    .arow{display:flex;gap:8px;}
    .ainp{flex:1;padding:9px 12px;border:1px solid #e0ded8;border-radius:8px;font-size:13px;color:#1a1a1a;background:#fff;font-family:inherit;}
    .ainp:focus{outline:none;border-color:#1a3a2a;}
    .filters{background:#fff;border:1px solid #e0ded8;border-radius:12px;padding:14px 16px;margin-bottom:16px;display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;}
    .fg{display:flex;flex-direction:column;gap:4px;}
    .fl{font-size:11px;color:#6b6b6b;font-weight:600;text-transform:uppercase;letter-spacing:.04em;}
    select{padding:7px 10px;border:1px solid #e0ded8;border-radius:8px;font-size:13px;color:#1a1a1a;background:#fff;min-width:120px;font-family:inherit;}
    .lgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;}
    .lcard{background:#fff;border:1px solid #e0ded8;border-radius:12px;overflow:hidden;cursor:pointer;transition:transform .12s;}
    .lcard:hover{transform:translateY(-2px);}
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
    .btn{padding:9px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid;font-family:inherit;}
    .btn-p{background:#1a3a2a;color:#fff;border-color:#1a3a2a;}
    .btn-p:hover{opacity:.9;}
    .btn-s{background:#fff;color:#1a1a1a;border-color:#e0ded8;}
    .btn-s:hover{background:#f0efe9;}
    .btn-ai{background:#1a3a2a;color:#c8f0d0;border-color:#1a3a2a;font-size:12px;padding:7px 14px;}
    .btn-ai:hover{opacity:.85;}
    .btn-row{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;}
    .price-hint{font-size:12px;color:#1a3a2a;background:#e8f5e0;padding:5px 10px;border-radius:6px;margin-top:6px;display:inline-block;}
    .photo-preview{width:100%;height:160px;object-fit:cover;border-radius:8px;margin-top:8px;}
    .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;}
    .modal{background:#fff;border-radius:14px;padding:24px;max-width:500px;width:100%;max-height:88vh;overflow-y:auto;}
    .modal-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;}
    .modal-title{font-size:20px;font-weight:700;}
    .modal-sub{font-size:12px;color:#6b6b6b;margin-top:2px;}
    .modal-x{background:none;border:none;font-size:20px;cursor:pointer;color:#6b6b6b;padding:0;}
    .modal-img{width:100%;height:200px;object-fit:cover;border-radius:10px;margin-bottom:14px;}
    .modal-price{font-size:30px;font-weight:700;margin-bottom:8px;}
    .modal-desc{font-size:13px;color:#6b6b6b;line-height:1.7;margin-bottom:16px;}
    .hood-bio{background:#e8f5e0;border-radius:8px;padding:12px 14px;font-size:12px;color:#1a3a2a;line-height:1.6;margin-bottom:16px;}
    .hood-bio-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;opacity:.7;}
    .success{background:#e8f5e0;border-radius:10px;padding:18px;text-align:center;}
    .success p{font-size:13px;color:#1a3a2a;margin-top:6px;}
    .spin{display:inline-block;width:14px;height:14px;border:2px solid #c8f0d0;border-top-color:#1a3a2a;border-radius:50%;animation:sp .6s linear infinite;vertical-align:middle;margin-right:6px;}
    .big-spin{width:28px;height:28px;border:3px solid #c8f0d0;border-top-color:#1a3a2a;border-radius:50%;animation:sp .6s linear infinite;margin:0 auto;}
    @keyframes sp{to{transform:rotate(360deg)}}
    .ai-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:300;display:flex;align-items:center;justify-content:center;}
    .ai-box{background:#fff;border-radius:12px;padding:32px 40px;text-align:center;}
    .ai-box p{font-size:14px;color:#6b6b6b;margin-top:12px;}
    .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a1a1a;color:#fff;padding:11px 20px;border-radius:8px;font-size:13px;z-index:999;white-space:nowrap;}
    .toast.warn{background:#92400e;}
  `;

  return (
    <>
      <style>{css}</style>
      <div>
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
          <div className="modal-overlay" onClick={()=>{setSelected(null);setHoodBio("");}}>
            <div className="modal" onClick={e=>e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <div className="modal-title">{selected.addr}</div>
                  <div className="modal-sub">{selected.hood} · {selected.beds} BR · by {selected.broker}</div>
                </div>
                <button className="modal-x" onClick={()=>{setSelected(null);setHoodBio("");}}>✕</button>
              </div>
              <img className="modal-img" src={selected.photo} alt={selected.addr} onError={e=>e.target.src=HOOD_PHOTOS["Williamsburg"]} />
              <div className="modal-price">${selected.rent.toLocaleString()}/mo</div>
              <div className="modal-desc">{selected.desc}</div>
              {bioLoading ? (
                <div className="hood-bio"><div className="hood-bio-lbl">✦ AI neighborhood guide</div><span className="spin"></span>Loading...</div>
              ) : hoodBio ? (
                <div className="hood-bio"><div className="hood-bio-lbl">✦ AI neighborhood guide — {selected.hood}</div>{hoodBio}</div>
              ) : null}
              {!contactSent ? (
                <>
                  <div className="fgroup">
                    <label className="flabel">Message to broker</label>
                    <textarea className="farea" placeholder="Hi, I'm interested in this apartment. I'm looking to move next month..." value={contactMsg} onChange={e=>setContactMsg(e.target.value)} />
                  </div>
                  <button className="btn btn-p" style={{width:"100%"}} onClick={sendMessage}>Send message to broker</button>
                </>
              ) : (
                <div className="success">
                  <strong style={{color:"#1a3a2a",fontSize:16}}>Message sent!</strong>
                  <p>The broker will get back to you soon.</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bar">
          <div className="logo" onClick={()=>setView("home")}>BrokerAI</div>
          <div className="tnav">
            {!role && <>
              <button className="tbtn" onClick={()=>{setRole("renter");setView("search");}}>I'm a renter</button>
              <button className="tbtn on" onClick={()=>{setRole("broker");setView("broker");}}>I'm a broker</button>
            </>}
            {role==="broker" && <>
              <button className="tbtn" onClick={()=>setView("broker")}>Dashboard</button>
              <button className="tbtn" onClick={()=>setView("new-listing")}>+ New listing</button>
              <button className="tbtn" onClick={()=>{setRole(null);setView("home");}}>Sign out</button>
            </>}
            {role==="renter" && <>
              <button className="tbtn" onClick={()=>setView("search")}>Search</button>
              <button className="tbtn" onClick={()=>{setRole(null);setView("home");}}>Sign out</button>
            </>}
          </div>
        </div>

        {/* HOME */}
        <div className={`pg${view==="home"?" show":""}`}>
          <div className="hero">
            <h1>NYC apartments,<br/><em>powered by AI</em></h1>
            <p>The smarter replacement for StreetEasy — with AI tools built into every part of the experience.</p>
            <div className="hbtns">
              <button className="hbtn p" onClick={()=>{setRole("broker");setView("broker");}}>I'm a broker</button>
              <button className="hbtn s" onClick={()=>{setRole("renter");setView("search");}}>Browse apartments</button>
            </div>
          </div>
          <div className="feats">
            {[
              {i:"✦",t:"AI listing writer",d:"Claude writes your full listing description from just the address, neighborhood, and rent."},
              {i:"🖼",t:"AI photo finder",d:"No photos? AI finds real apartment photos matching your neighborhood automatically."},
              {i:"⬡",t:"Smart pricing",d:"AI suggests the right rent range based on current NYC market data."},
              {i:"◎",t:"Natural language search",d:'Search the way you talk. "Sunny 2BR near L train under $3,200, no fee."'},
              {i:"🗺",t:"AI neighborhood guide",d:"Every listing includes an AI-generated neighborhood summary — subway, vibe, and who it's best for."},
              {i:"📋",t:"AI application helper",d:"Renters get help writing a strong cover letter to the landlord when they apply."},
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
              <input className="ainp" placeholder='e.g. "sunny 2BR in Williamsburg under $3,500 near L train no fee"' value={nlQuery} onChange={e=>{setNlQuery(e.target.value);setNlResults(null);}} onKeyDown={e=>e.key==="Enter"&&doNLSearch()} />
              <button className="btn btn-ai" onClick={doNLSearch}>Search</button>
            </div>
            {nlResults && nlResults.length===0 && <p style={{fontSize:12,color:"#6b6b6b",marginTop:10}}>No matches found. Try different words.</p>}
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

      </div>
    </>
  );
}
