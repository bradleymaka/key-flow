import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDlXKL5Xn0TdOFtoCSrP-gnSTbbmCJ2L_M",
  authDomain: "realestateai-921a5.firebaseapp.com",
  projectId: "realestateai-921a5",
  storageBucket: "realestateai-921a5.firebasestorage.app",
  messagingSenderId: "974090525280",
  appId: "1:974090525280:web:ed4769cb022ef4c53a0105"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

const INIT_LISTINGS = [
  { id:1, addr:"47 Bedford Ave", hood:"Williamsburg", rent:3200, beds:2, status:"active", broker:"Marco Silva", brokerId:"demo1", photo:"https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600", desc:"Bright corner unit with exposed brick and skyline views. Steps from the L train.", leads:[] },
  { id:2, addr:"210 Franklin St", hood:"Greenpoint", rent:2750, beds:1, status:"active", broker:"Priya Nair", brokerId:"demo2", photo:"https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600", desc:"Top-floor unit in a restored warehouse building. Original hardwood floors, great natural light.", leads:[] },
  { id:3, addr:"88 Nostrand Ave", hood:"Crown Heights", rent:2100, beds:1, status:"active", broker:"Marco Silva", brokerId:"demo1", photo:"https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=600", desc:"Sunny garden-level in a limestone brownstone. Close to the 2/3/4/5 trains.", leads:[] },
  { id:4, addr:"330 W 42nd St", hood:"Hell's Kitchen", rent:4100, beds:3, status:"active", broker:"Jen Torres", brokerId:"demo3", photo:"https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600", desc:"Luxury three-bedroom with floor-to-ceiling windows. Full-time doorman building.", leads:[] },
  { id:5, addr:"15 Myrtle Ave", hood:"Fort Greene", rent:2900, beds:2, status:"rented", broker:"Marco Silva", brokerId:"demo1", photo:"https://images.unsplash.com/photo-1484154218962-a197022b5858?w=600", desc:"Renovated two-bedroom with chef kitchen and private backyard.", leads:[] },
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

async function claudeAI(prompt, max=300) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:max, messages:[{role:"user",content:prompt}] })
  });
  const d = await r.json();
  return d.content?.[0]?.text?.trim() || "";
}

// Compress image to base64 — max 150x150px, stored in Firestore (free)
function compressImage(file, maxSize=150) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(maxSize/img.width, maxSize/img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function avatarColor(name) {
  const colors = ["#7c3aed","#2563eb","#059669","#d97706","#dc2626","#0891b2","#9333ea"];
  let hash = 0;
  for(let i=0;i<(name||"U").length;i++) hash = (name||"U").charCodeAt(i) + ((hash<<5)-hash);
  return colors[Math.abs(hash) % colors.length];
}

const SkylineLogo = () => (
  <svg width="180" height="36" viewBox="0 0 260 50" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="nsky5" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0a0a1a"/><stop offset="60%" stopColor="#1a1040"/><stop offset="100%" stopColor="#2d1b69"/></linearGradient></defs>
    <rect width="260" height="50" fill="url(#nsky5)" rx="6"/>
    <rect x="0" y="38" width="260" height="12" fill="#0a0a1a"/>
    <rect x="0" y="36" width="260" height="3" fill="#7c3aed" opacity="0.5"/>
    <rect x="8" y="22" width="8" height="28" fill="#1e1b4b"/><rect x="10" y="18" width="4" height="5" fill="#1e1b4b"/>
    <rect x="20" y="28" width="10" height="22" fill="#1e1b4b"/><rect x="34" y="18" width="8" height="32" fill="#1e1b4b"/>
    <rect x="36" y="14" width="4" height="6" fill="#1e1b4b"/><rect x="46" y="24" width="10" height="26" fill="#1e1b4b"/>
    <rect x="60" y="20" width="7" height="30" fill="#1e1b4b"/><rect x="71" y="26" width="9" height="24" fill="#1e1b4b"/>
    <rect x="84" y="16" width="7" height="34" fill="#1e1b4b"/><rect x="86" y="12" width="3" height="6" fill="#1e1b4b"/>
    <rect x="21" y="32" width="2" height="2" fill="#fbbf24" opacity="0.9"/>
    <rect x="35" y="22" width="2" height="2" fill="#a78bfa" opacity="0.9"/>
    <rect x="48" y="28" width="2" height="2" fill="#fbbf24" opacity="0.7"/>
    <rect x="62" y="24" width="2" height="2" fill="#a78bfa" opacity="0.8"/>
    <rect x="85" y="20" width="2" height="2" fill="#fbbf24" opacity="0.9"/>
    <text x="100" y="28" fontSize="15" fontWeight="700" fill="white" fontFamily="-apple-system,system-ui,sans-serif" letterSpacing="1">REALESTATE<tspan fill="#a78bfa">AI</tspan></text>
    <text x="100" y="40" fontSize="6" fill="#7c3aed" fontFamily="-apple-system,system-ui,sans-serif" letterSpacing="3" opacity="0.9">NEW YORK CITY</text>
  </svg>
);

export default function RealEstateAI() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [authView, setAuthView] = useState(false);
  const [userRole, setUserRole] = useState("renter");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState("");
  const [authError, setAuthError] = useState(""); const [authBusy, setAuthBusy] = useState(false);

  const [listings, setListings] = useState(INIT_LISTINGS);
  const [view, setView] = useState("home");
  const [homeTab, setHomeTab] = useState("rent");
  const [selected, setSelected] = useState(null);
  const [contactMsg, setContactMsg] = useState(""); const [contactSent, setContactSent] = useState(false);
  const [coverLetter, setCoverLetter] = useState(""); const [coverLoading, setCoverLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false); const [aiTask, setAiTask] = useState("");
  const [nlQuery, setNlQuery] = useState(""); const [nlResults, setNlResults] = useState(null);
  const [fHood, setFHood] = useState("All"); const [fBeds, setFBeds] = useState("Any"); const [fRent, setFRent] = useState(5000);
  const [newL, setNewL] = useState({ addr:"", hood:"Williamsburg", beds:"", rent:"", desc:"", photo:"" });
  const [priceHint, setPriceHint] = useState("");
  const [toast, setToast] = useState(null);
  const [hoodBio, setHoodBio] = useState(""); const [bioLoading, setBioLoading] = useState(false);
  const [viewHistory, setViewHistory] = useState([]);
  const [publicBroker, setPublicBroker] = useState(null);

  // Profile state
  const [editBio, setEditBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [historyConsent, setHistoryConsent] = useState(true);
  const fileInputRef = useRef(null);

  const showToast = (msg, type="ok") => { setToast({msg,type}); setTimeout(()=>setToast(null),3500); };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if(u) {
        try {
          const snap = await getDoc(doc(db,"users",u.uid));
          if(snap.exists()) {
            const data = snap.data();
            setUserProfile(data);
            setUserRole(data.role||"renter");
            setViewHistory(data.viewHistory||[]);
            setEditBio(data.bio||"");
            setHistoryConsent(data.historyConsent!==false);
          } else {
            const newProfile = { role:"renter", bio:"", viewHistory:[], photoURL:u.photoURL||"", displayName:u.displayName||"", historyConsent:true, createdAt:Date.now() };
            await setDoc(doc(db,"users",u.uid), newProfile);
            setUserProfile(newProfile);
            setHistoryConsent(true);
          }
        } catch(e) { console.error("Firestore:", e); }
      } else { setUserProfile(null); setViewHistory([]); }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  const myListings = listings.filter(l=>l.brokerId===user?.uid||l.broker===(user?.displayName||""));
  const myLeads = myListings.flatMap(l=>(l.leads||[]).map(ld=>({...ld,listing:l})));
  const filtered = listings.filter(l=>{
    if(l.status!=="active") return false;
    if(fHood!=="All"&&l.hood!==fHood) return false;
    if(fBeds!=="Any"&&l.beds!==parseInt(fBeds)) return false;
    if(l.rent>fRent) return false;
    return true;
  });

  const displayName = user?.displayName||user?.email?.split("@")[0]||"User";
  const photoURL = userProfile?.photoURL||user?.photoURL||"";

  const Avatar = ({size=28, name=displayName, url=photoURL, style={}}) => (
    <div style={{width:size,height:size,borderRadius:"50%",background:url?"#0d0d1a":avatarColor(name),display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.38,fontWeight:700,color:"white",overflow:"hidden",flexShrink:0,border:"2px solid #3b1f8c",...style}}>
      {url ? <img src={url} alt={name} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>{e.target.style.display="none";e.target.parentElement.style.background=avatarColor(name);}} /> : name?.[0]?.toUpperCase()||"U"}
    </div>
  );

  async function handleGoogleLogin(role) {
    setAuthBusy(true); setAuthError("");
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const u = cred.user;
      const snap = await getDoc(doc(db,"users",u.uid));
      if(!snap.exists()) {
        await setDoc(doc(db,"users",u.uid), { role:role||"renter", bio:"", viewHistory:[], photoURL:u.photoURL||"", displayName:u.displayName||"", historyConsent:true, createdAt:Date.now() });
      }
      const data = snap.exists()?snap.data():{role:role||"renter"};
      setUserRole(data.role||role||"renter");
      setAuthView(false);
      setView(role==="broker"?"broker":"search");
      showToast("Welcome! Signed in with Google.");
    } catch(e) { setAuthError(e.message); }
    setAuthBusy(false);
  }

  async function handleEmailAuth() {
    setAuthBusy(true); setAuthError("");
    try {
      if(authMode==="signup") {
        const cred = await createUserWithEmailAndPassword(auth,email,password);
        if(name) await updateProfile(cred.user,{displayName:name});
        await setDoc(doc(db,"users",cred.user.uid),{role:userRole||"renter",bio:"",viewHistory:[],photoURL:"",displayName:name||"",historyConsent:true,createdAt:Date.now()});
      } else { await signInWithEmailAndPassword(auth,email,password); }
      setAuthView(false);
      setView(userRole==="broker"?"broker":"search");
      showToast(authMode==="signup"?"Account created! Welcome.":"Welcome back!");
    } catch(e) {
      const msg=e.code==="auth/email-already-in-use"?"Email already in use."
        :e.code==="auth/wrong-password"?"Wrong password."
        :e.code==="auth/user-not-found"?"No account found — sign up first."
        :e.code==="auth/weak-password"?"Password needs 6+ characters."
        :e.message;
      setAuthError(msg);
    }
    setAuthBusy(false);
  }

  async function handleSignOut() {
    await signOut(auth); setUserRole("renter"); setView("home"); showToast("Signed out.");
  }

  function openAuth(mode,role) {
    setAuthMode(mode||"login"); setUserRole(role||"renter");
    setAuthError(""); setEmail(""); setPassword(""); setName(""); setAuthView(true);
  }

  // Photo upload — compresses to base64, saves to Firestore (no Storage needed)
  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if(!file||!user) return;
    if(file.size>10*1024*1024){showToast("Photo must be under 10MB","warn");return;}
    setUploadingPhoto(true);
    try {
      const base64 = await compressImage(file, 200);
      await setDoc(doc(db,"users",user.uid),{photoURL:base64},{merge:true});
      await updateProfile(user,{photoURL:""});
      setUserProfile(p=>({...p,photoURL:base64}));
      showToast("Profile photo updated!");
    } catch(e) { showToast("Upload failed","warn"); console.error(e); }
    setUploadingPhoto(false);
    e.target.value="";
  }

  async function handleSaveProfile() {
    if(!user) return;
    setSavingProfile(true);
    try {
      await setDoc(doc(db,"users",user.uid),{bio:editBio,historyConsent},{merge:true});
      setUserProfile(p=>({...p,bio:editBio,historyConsent}));
      if(!historyConsent) setViewHistory([]);
      showToast("Profile saved!");
    } catch { showToast("Save failed","warn"); }
    setSavingProfile(false);
  }

  async function trackView(listing) {
    if(!user||!historyConsent) return;
    const alreadySeen = viewHistory.find(v=>v.id===listing.id);
    if(alreadySeen) return;
    const entry = {id:listing.id,addr:listing.addr,hood:listing.hood,rent:listing.rent,photo:listing.photo,viewedAt:Date.now()};
    const newHistory = [entry,...viewHistory].slice(0,30);
    setViewHistory(newHistory);
    try { await updateDoc(doc(db,"users",user.uid),{viewHistory:arrayUnion(entry)}); } catch {}
  }

  async function openListing(l) {
    setSelected(l); setContactSent(false); setContactMsg(""); setHoodBio(""); setCoverLetter("");
    trackView(l);
    setBioLoading(true);
    try {
      const bio = await claudeAI(`Write 2 sentences about ${l.hood}, NYC. Cover subway access, vibe, who would love it.`,130);
      setHoodBio(bio);
    } catch {}
    setBioLoading(false);
  }

  async function genDesc() {
    if(!newL.addr||!newL.beds||!newL.rent){showToast("Fill address, beds, rent first","warn");return;}
    setAiLoading(true); setAiTask("Writing listing description...");
    try {
      const res = await claudeAI(`Write a compelling NYC apartment listing description under 80 words for: ${newL.beds}BR in ${newL.hood}, $${newL.rent}/mo at ${newL.addr}. No "Welcome to" opener.`);
      setNewL(p=>({...p,desc:res})); showToast("AI description written!");
    } catch { showToast("API error","warn"); }
    setAiLoading(false); setAiTask("");
  }

  async function findPhotos() {
    setAiLoading(true); setAiTask("Finding photos...");
    setNewL(p=>({...p,photo:HOOD_PHOTOS[newL.hood]||HOOD_PHOTOS["Williamsburg"]}));
    showToast("Photos found!"); setAiLoading(false); setAiTask("");
  }

  async function suggestPrice() {
    if(!newL.beds||!newL.hood){showToast("Pick neighborhood and beds first","warn");return;}
    setAiLoading(true); setAiTask("Checking NYC prices...");
    try {
      const res = await claudeAI(`Typical rent for ${newL.beds}BR in ${newL.hood}, NYC 2025? Return ONLY a range like "$2,800–$3,400".`,25);
      setPriceHint(res);
    } catch { showToast("API error","warn"); }
    setAiLoading(false); setAiTask("");
  }

  async function doNLSearch() {
    if(!nlQuery.trim()) return;
    setAiLoading(true); setAiTask("Finding matches...");
    try {
      const summary = listings.filter(l=>l.status==="active").map(l=>`ID:${l.id}|${l.addr},${l.hood}|${l.beds}BR|$${l.rent}/mo`).join("\n");
      const res = await claudeAI(`Renter query: "${nlQuery}"\nListings:\n${summary}\nReturn ONLY JSON array like [2,1]. Max 3. [] if no match.`,50);
      const match = res.match(/\[[\d,\s]*\]/);
      if(match) setNlResults(JSON.parse(match[0]).map(id=>listings.find(l=>l.id===id)).filter(Boolean));
      else setNlResults([]);
    } catch { setNlResults([]); }
    setAiLoading(false); setAiTask("");
  }

  async function genCoverLetter() {
    if(!contactMsg.trim()){showToast("Write your message first","warn");return;}
    setCoverLoading(true);
    try {
      const res = await claudeAI(`Short professional cover letter under 80 words for renter applying for: ${selected.addr}, ${selected.hood}, ${selected.beds}BR, $${selected.rent}/mo. Note: "${contactMsg}". Warm and persuasive.`,150);
      setCoverLetter(res);
    } catch { showToast("API error","warn"); }
    setCoverLoading(false);
  }

  async function sendMessage() {
    if(!contactMsg.trim()){showToast("Type a message first","warn");return;}
    const lead={id:Date.now(),message:contactMsg,renter:user?.displayName||user?.email||"Renter",time:new Date().toLocaleTimeString()};
    setListings(prev=>prev.map(l=>l.id===selected.id?{...l,leads:[...(l.leads||[]),lead]}:l));
    setContactSent(true); showToast("Message sent!");
  }

  function publishListing() {
    if(!newL.addr||!newL.beds||!newL.rent||!newL.desc){showToast("Fill all fields first","warn");return;}
    const l={id:Date.now(),...newL,rent:parseInt(newL.rent),beds:parseInt(newL.beds),status:"active",broker:user?.displayName||user?.email||"Broker",brokerId:user?.uid||"",photo:newL.photo||HOOD_PHOTOS[newL.hood],leads:[]};
    setListings(prev=>[l,...prev]);
    setNewL({addr:"",hood:"Williamsburg",beds:"",rent:"",desc:"",photo:""});
    setPriceHint(""); setView("broker"); showToast("Listing published!");
  }

  const css = `
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0d0d1a;color:#f0f0ff;}
    .topnav{background:#0a0a1a;border-bottom:1px solid #2d1b69;padding:0 24px;height:60px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;}
    .topnav-links{display:flex;gap:4px;}
    .topnav-link{font-size:13px;font-weight:500;color:rgba(200,180,255,.7);padding:8px 14px;border-radius:6px;cursor:pointer;border:none;background:transparent;font-family:inherit;}
    .topnav-link:hover,.topnav-link.active{background:rgba(124,58,237,.2);color:#e0d4ff;}
    .topnav-actions{display:flex;gap:8px;align-items:center;}
    .user-chip{display:flex;align-items:center;gap:8px;background:rgba(124,58,237,.15);border:1px solid #3b1f8c;border-radius:20px;padding:4px 12px 4px 4px;cursor:pointer;}
    .user-chip:hover{border-color:#7c3aed;}
    .user-name{font-size:12px;color:#c4b5fd;font-weight:500;}
    .tnbtn{font-size:13px;font-weight:600;padding:7px 16px;border-radius:6px;cursor:pointer;font-family:inherit;}
    .tnbtn.ghost{background:transparent;color:#c4b5fd;border:1.5px solid rgba(196,181,253,.3);}
    .tnbtn.ghost:hover{border-color:#c4b5fd;}
    .tnbtn.solid{background:#7c3aed;color:#fff;border:1.5px solid #7c3aed;}
    .tnbtn.solid:hover{background:#6d28d9;}
    .tnbtn.sm{font-size:12px;padding:5px 12px;}

    /* AUTH */
    .auth-overlay{position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px;}
    .auth-modal{background:#13132a;border:1px solid #3b1f8c;border-radius:18px;padding:32px;max-width:420px;width:100%;box-shadow:0 0 80px rgba(124,58,237,.3);}
    .auth-logo{text-align:center;margin-bottom:20px;}
    .auth-title{font-size:22px;font-weight:800;color:#fff;text-align:center;margin-bottom:4px;}
    .auth-sub{font-size:13px;color:#7c6aaa;text-align:center;margin-bottom:24px;}
    .auth-role-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:20px;}
    .auth-role{border:1.5px solid #3b1f8c;border-radius:10px;padding:12px 6px;cursor:pointer;text-align:center;transition:all .15s;}
    .auth-role:hover{border-color:#7c3aed;background:rgba(124,58,237,.1);}
    .auth-role.sel{border-color:#7c3aed;background:rgba(124,58,237,.2);border-width:2px;}
    .auth-role-ico{font-size:20px;margin-bottom:4px;}
    .auth-role-t{font-size:11px;font-weight:700;color:#e0d4ff;}
    .auth-role-d{font-size:10px;color:#7c6aaa;margin-top:2px;}
    .google-btn{width:100%;padding:12px;border-radius:10px;border:1.5px solid #3b1f8c;background:#0d0d1a;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;font-family:inherit;color:#e0d4ff;margin-bottom:16px;}
    .google-btn:hover{border-color:#7c3aed;}
    .divider-auth{display:flex;align-items:center;gap:10px;margin:0 0 16px;font-size:12px;color:#4c3a8a;}
    .divider-auth::before,.divider-auth::after{content:"";flex:1;height:1px;background:#2d1b69;}
    .auth-input{width:100%;padding:10px 14px;border:1.5px solid #3b1f8c;border-radius:8px;font-size:13px;color:#e0d4ff;background:#0d0d1a;font-family:inherit;margin-bottom:10px;}
    .auth-input::placeholder{color:#4c3a8a;}
    .auth-input:focus{outline:none;border-color:#7c3aed;}
    .auth-submit{width:100%;padding:12px;border-radius:8px;background:#7c3aed;color:#fff;border:none;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;margin-top:4px;}
    .auth-submit:hover{background:#6d28d9;}
    .auth-submit:disabled{opacity:.5;cursor:not-allowed;}
    .auth-switch{text-align:center;font-size:12px;color:#7c6aaa;margin-top:14px;}
    .auth-switch a{color:#a78bfa;cursor:pointer;font-weight:600;}
    .auth-error{background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);border-radius:6px;padding:8px 12px;font-size:12px;color:#fca5a5;margin-bottom:10px;text-align:center;}
    .auth-close{float:right;background:none;border:none;color:#7c6aaa;font-size:20px;cursor:pointer;line-height:1;margin-top:-8px;}

    /* PROFILE */
    .profile-page{max-width:680px;margin:0 auto;padding:32px 24px;}
    .profile-card{background:#13132a;border:1px solid #2d1b69;border-radius:16px;padding:28px;margin-bottom:20px;}
    .profile-top{display:flex;align-items:flex-start;gap:20px;margin-bottom:24px;}
    .photo-upload-wrap{position:relative;cursor:pointer;flex-shrink:0;}
    .photo-upload-wrap:hover .photo-overlay{opacity:1;}
    .photo-overlay{position:absolute;inset:0;border-radius:50%;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s;font-size:20px;}
    .profile-info{flex:1;}
    .profile-name{font-size:22px;font-weight:800;color:#fff;margin-bottom:4px;}
    .profile-role{font-size:12px;color:#a78bfa;font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;}
    .profile-email{font-size:13px;color:#7c6aaa;}
    .profile-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:20px;}
    .profile-stat{background:#0d0d1a;border:1px solid #2d1b69;border-radius:10px;padding:14px;text-align:center;}
    .profile-stat-n{font-size:24px;font-weight:800;color:#fff;}
    .profile-stat-l{font-size:11px;color:#7c6aaa;margin-top:2px;}

    /* CONSENT TOGGLE */
    .consent-box{background:#0d0d1a;border:1px solid #2d1b69;border-radius:10px;padding:14px 16px;margin-bottom:14px;}
    .consent-row{display:flex;align-items:center;justify-content:space-between;gap:12px;}
    .consent-label{font-size:13px;color:#e0d4ff;font-weight:500;}
    .consent-desc{font-size:11px;color:#7c6aaa;margin-top:3px;line-height:1.4;}
    .toggle{position:relative;width:42px;height:24px;flex-shrink:0;}
    .toggle input{opacity:0;width:0;height:0;}
    .toggle-slider{position:absolute;inset:0;background:#2d1b69;border-radius:12px;cursor:pointer;transition:.2s;}
    .toggle-slider:before{content:"";position:absolute;width:18px;height:18px;left:3px;bottom:3px;background:#7c6aaa;border-radius:50%;transition:.2s;}
    .toggle input:checked + .toggle-slider{background:#7c3aed;}
    .toggle input:checked + .toggle-slider:before{transform:translateX(18px);background:#fff;}

    /* HISTORY */
    .section-card{background:#13132a;border:1px solid #2d1b69;border-radius:16px;padding:20px;margin-bottom:16px;}
    .section-title{font-size:13px;font-weight:700;color:#7c6aaa;text-transform:uppercase;letter-spacing:.05em;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;}
    .section-count{font-size:11px;color:#4c3a8a;font-weight:400;text-transform:none;letter-spacing:0;}
    .history-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #1e1b4b;cursor:pointer;transition:opacity .15s;}
    .history-row:last-child{border-bottom:none;}
    .history-row:hover{opacity:.8;}
    .history-thumb{width:52px;height:52px;border-radius:8px;object-fit:cover;flex-shrink:0;border:1px solid #2d1b69;}
    .history-info{flex:1;}
    .history-addr{font-size:13px;font-weight:700;color:#e0d4ff;}
    .history-hood{font-size:11px;color:#a78bfa;margin-top:1px;}
    .history-meta{font-size:11px;color:#7c6aaa;margin-top:2px;}
    .history-time{font-size:10px;color:#4c3a8a;white-space:nowrap;text-align:right;}
    .history-price{font-size:13px;font-weight:700;color:#fff;white-space:nowrap;}
    .clear-btn{font-size:11px;color:#7c6aaa;background:none;border:1px solid #3b1f8c;border-radius:6px;padding:3px 8px;cursor:pointer;font-family:inherit;}
    .clear-btn:hover{color:#fca5a5;border-color:#7f1d1d;}

    /* BROKER PUBLIC */
    .broker-pub{max-width:700px;margin:0 auto;padding:32px 24px;}
    .broker-pub-header{background:#13132a;border:1px solid #2d1b69;border-radius:16px;padding:28px;margin-bottom:20px;text-align:center;}
    .broker-pub-name{font-size:22px;font-weight:800;color:#fff;margin:12px 0 4px;}
    .broker-pub-role{font-size:12px;color:#a78bfa;font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;}
    .broker-pub-bio{font-size:13px;color:#c4b5fd;line-height:1.6;max-width:480px;margin:0 auto 16px;}
    .broker-pub-stats{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;}
    .broker-pub-stat{background:#0d0d1a;border:1px solid #2d1b69;border-radius:10px;padding:12px 20px;text-align:center;}
    .broker-pub-stat-n{font-size:20px;font-weight:800;color:#fff;}
    .broker-pub-stat-l{font-size:11px;color:#7c6aaa;}

    /* MAIN */
    .hero{background:linear-gradient(180deg,#0a0a1a 0%,#1a1040 50%,#2d1b69 100%);padding:70px 24px 60px;text-align:center;border-bottom:1px solid #3b1f8c;}
    .hero-eyebrow{font-size:12px;font-weight:700;color:#a78bfa;letter-spacing:.12em;text-transform:uppercase;margin-bottom:16px;}
    .hero-title{font-size:clamp(32px,5vw,56px);font-weight:800;color:#fff;line-height:1.1;margin-bottom:12px;letter-spacing:-.5px;}
    .hero-title span{background:linear-gradient(135deg,#a78bfa,#7c3aed);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
    .hero-sub{font-size:16px;color:#c4b5fd;margin-bottom:40px;max-width:480px;margin-left:auto;margin-right:auto;line-height:1.6;}
    .search-card{background:#13132a;border:1px solid #3b1f8c;border-radius:16px;max-width:760px;margin:0 auto;overflow:hidden;box-shadow:0 0 60px rgba(124,58,237,.2);}
    .search-tabs{display:flex;border-bottom:1px solid #2d1b69;}
    .search-tab{flex:1;padding:14px;text-align:center;font-size:14px;font-weight:600;cursor:pointer;color:#7c6aaa;border:none;background:transparent;border-bottom:3px solid transparent;font-family:inherit;}
    .search-tab.active{color:#e0d4ff;border-bottom-color:#7c3aed;background:rgba(124,58,237,.1);}
    .search-body{padding:20px;}
    .search-row{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;}
    .search-field{flex:1;display:flex;flex-direction:column;gap:5px;min-width:110px;}
    .search-label{font-size:11px;font-weight:700;color:#7c6aaa;text-transform:uppercase;letter-spacing:.06em;}
    .search-select{padding:10px 14px;border:1.5px solid #3b1f8c;border-radius:8px;font-size:14px;color:#e0d4ff;background:#0d0d1a;font-family:inherit;height:46px;}
    .search-btn{background:#7c3aed;color:#fff;border:none;border-radius:8px;padding:0 28px;font-size:15px;font-weight:700;cursor:pointer;height:46px;display:flex;align-items:center;gap:8px;font-family:inherit;}
    .search-btn:hover{background:#6d28d9;}
    .search-hint{font-size:12px;color:#7c6aaa;margin-top:12px;text-align:center;}
    .search-hint a{color:#a78bfa;font-weight:600;cursor:pointer;}
    .feat-bar{background:#0d0d1a;border-bottom:1px solid #1e1b4b;padding:36px 24px;}
    .feat-bar-inner{max-width:900px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:24px;}
    .feat-item{text-align:center;}
    .feat-item-ico{font-size:22px;margin-bottom:8px;}
    .feat-item-t{font-size:13px;font-weight:700;color:#e0d4ff;margin-bottom:3px;}
    .feat-item-d{font-size:11px;color:#7c6aaa;line-height:1.4;}
    .listings-preview{padding:48px 24px;background:#0a0a1a;}
    .lp-inner{max-width:1100px;margin:0 auto;}
    .lp-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;}
    .lp-title{font-size:20px;font-weight:800;color:#fff;}
    .lp-see-all{font-size:13px;font-weight:600;color:#a78bfa;cursor:pointer;background:none;border:none;font-family:inherit;}
    .lgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;}
    .lcard{background:#13132a;border:1px solid #2d1b69;border-radius:12px;overflow:hidden;cursor:pointer;transition:transform .12s,border-color .12s,box-shadow .12s;}
    .lcard:hover{transform:translateY(-3px);border-color:#7c3aed;box-shadow:0 8px 32px rgba(124,58,237,.2);}
    .lcard-img{width:100%;height:150px;object-fit:cover;}
    .lcard-body{padding:14px;}
    .lcard-price{font-size:20px;font-weight:800;color:#fff;margin-bottom:3px;}
    .lcard-addr{font-size:12px;color:#7c6aaa;margin-bottom:8px;}
    .tags{display:flex;gap:5px;flex-wrap:wrap;}
    .tag{font-size:11px;padding:3px 8px;border-radius:20px;border:1px solid #3b1f8c;color:#c4b5fd;background:rgba(124,58,237,.1);}
    .tag.bt{cursor:pointer;color:#a78bfa;}
    .tag.bt:hover{border-color:#7c3aed;}
    .lcard-desc{font-size:11px;color:#7c6aaa;margin-top:8px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
    .pg{display:none;padding:28px 24px;max-width:1100px;margin:0 auto;}
    .pg.show{display:block;}
    .ph{margin-bottom:24px;}
    .ph h2{font-size:24px;font-weight:800;color:#fff;margin-bottom:4px;}
    .ph p{font-size:13px;color:#7c6aaa;}
    .stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:24px;}
    .stat{background:#13132a;border:1px solid #2d1b69;border-radius:12px;padding:16px;text-align:center;}
    .stat-n{font-size:30px;font-weight:800;color:#fff;}
    .stat-l{font-size:11px;color:#7c6aaa;margin-top:2px;}
    .two{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
    @media(max-width:640px){.two{grid-template-columns:1fr;}.stats{grid-template-columns:repeat(2,1fr);}.search-row{flex-direction:column;}}
    .card{background:#13132a;border:1px solid #2d1b69;border-radius:12px;padding:18px;}
    .card-t{font-size:11px;font-weight:700;color:#7c6aaa;text-transform:uppercase;letter-spacing:.05em;margin-bottom:16px;}
    .lrow{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #1e1b4b;}
    .lrow:last-child{border-bottom:none;}
    .lthumb{width:36px;height:36px;border-radius:6px;object-fit:cover;flex-shrink:0;}
    .linfo{flex:1;min-width:0;}
    .laddr{font-size:12px;font-weight:700;color:#e0d4ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .lmeta{font-size:11px;color:#7c6aaa;}
    .badge-a{font-size:10px;padding:2px 8px;border-radius:20px;background:rgba(124,58,237,.2);color:#c4b5fd;border:1px solid #7c3aed;font-weight:600;}
    .badge-r{font-size:10px;padding:2px 8px;border-radius:20px;background:rgba(239,68,68,.15);color:#fca5a5;border:1px solid rgba(239,68,68,.3);font-weight:600;}
    .lead-row{display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid #1e1b4b;}
    .lead-row:last-child{border-bottom:none;}
    .lead-ico{width:30px;height:30px;border-radius:50%;background:rgba(124,58,237,.2);border:1px solid #7c3aed;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;}
    .lead-addr{font-size:12px;font-weight:700;color:#e0d4ff;}
    .lead-msg{font-size:11px;color:#7c6aaa;}
    .lead-time{font-size:10px;color:#4c3a8a;}
    .empty{text-align:center;padding:24px;font-size:13px;color:#7c6aaa;}
    .aibox{background:#13132a;border:1px solid #3b1f8c;border-radius:12px;padding:14px 16px;margin-bottom:16px;}
    .ailabel{font-size:11px;font-weight:700;color:#a78bfa;margin-bottom:8px;}
    .arow{display:flex;gap:8px;}
    .ainp{flex:1;padding:9px 12px;border:1.5px solid #3b1f8c;border-radius:8px;font-size:13px;color:#e0d4ff;background:#0d0d1a;font-family:inherit;}
    .ainp::placeholder{color:#4c3a8a;}
    .ainp:focus{outline:none;border-color:#7c3aed;}
    .filters{background:#13132a;border:1px solid #2d1b69;border-radius:12px;padding:14px 16px;margin-bottom:16px;display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;}
    .fg{display:flex;flex-direction:column;gap:4px;}
    .fl{font-size:11px;color:#7c6aaa;font-weight:700;text-transform:uppercase;letter-spacing:.04em;}
    select{padding:7px 10px;border:1.5px solid #3b1f8c;border-radius:8px;font-size:13px;color:#e0d4ff;background:#0d0d1a;min-width:120px;font-family:inherit;}
    .cnt{font-size:13px;color:#7c6aaa;margin-bottom:14px;}
    .fgroup{margin-bottom:14px;}
    .flabel{font-size:12px;font-weight:700;color:#7c6aaa;margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em;display:block;}
    .finput,.fsel,.farea{width:100%;padding:10px 14px;border:1.5px solid #3b1f8c;border-radius:8px;font-size:13px;color:#e0d4ff;background:#0d0d1a;font-family:inherit;}
    .finput::placeholder,.farea::placeholder{color:#4c3a8a;}
    .finput:focus,.fsel:focus,.farea:focus{outline:none;border-color:#7c3aed;}
    .farea{min-height:90px;resize:vertical;}
    .two-inp{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
    .btn{padding:9px 18px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;border:1.5px solid;font-family:inherit;}
    .btn-p{background:#7c3aed;color:#fff;border-color:#7c3aed;}
    .btn-p:hover{background:#6d28d9;}
    .btn-s{background:transparent;color:#c4b5fd;border-color:#3b1f8c;}
    .btn-s:hover{background:rgba(124,58,237,.1);}
    .btn-ai{background:rgba(124,58,237,.15);color:#c4b5fd;border-color:#3b1f8c;font-size:12px;padding:7px 14px;}
    .btn-ai:hover{background:rgba(124,58,237,.25);border-color:#7c3aed;}
    .btn-ai:disabled{opacity:.4;cursor:not-allowed;}
    .btn-row{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;}
    .price-hint{font-size:12px;color:#a78bfa;background:rgba(124,58,237,.15);padding:5px 10px;border-radius:6px;margin-top:6px;display:inline-block;border:1px solid #3b1f8c;font-weight:600;}
    .photo-preview{width:100%;height:160px;object-fit:cover;border-radius:8px;margin-top:8px;border:1px solid #3b1f8c;}
    .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;}
    .modal{background:#13132a;border:1px solid #3b1f8c;border-radius:16px;padding:24px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 0 80px rgba(124,58,237,.3);}
    .modal-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;}
    .modal-title{font-size:20px;font-weight:800;color:#fff;}
    .modal-sub{font-size:12px;color:#7c6aaa;margin-top:3px;}
    .modal-x{background:none;border:none;font-size:22px;cursor:pointer;color:#7c6aaa;padding:0;line-height:1;}
    .modal-img{width:100%;height:200px;object-fit:cover;border-radius:10px;margin-bottom:14px;border:1px solid #3b1f8c;}
    .modal-price{font-size:30px;font-weight:800;color:#fff;margin-bottom:8px;}
    .modal-desc{font-size:13px;color:#c4b5fd;line-height:1.7;margin-bottom:14px;}
    .hood-bio{background:rgba(124,58,237,.1);border:1px solid #3b1f8c;border-radius:8px;padding:12px 14px;font-size:12px;color:#c4b5fd;line-height:1.6;margin-bottom:14px;}
    .hood-bio-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;color:#a78bfa;}
    .cover-box{background:rgba(124,58,237,.08);border:1px solid #3b1f8c;border-radius:8px;padding:12px 14px;font-size:12px;color:#c4b5fd;line-height:1.7;margin-top:10px;}
    .cover-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;color:#a78bfa;}
    .divider-line{height:1px;background:#1e1b4b;margin:14px 0;}
    .success{background:rgba(124,58,237,.15);border:1px solid #3b1f8c;border-radius:10px;padding:18px;text-align:center;}
    .success strong{font-size:16px;color:#e0d4ff;}
    .success p{font-size:13px;color:#a78bfa;margin-top:6px;}
    .spin{display:inline-block;width:13px;height:13px;border:2px solid #3b1f8c;border-top-color:#a78bfa;border-radius:50%;animation:sp .6s linear infinite;vertical-align:middle;margin-right:5px;}
    .big-spin{width:28px;height:28px;border:3px solid #3b1f8c;border-top-color:#a78bfa;border-radius:50%;animation:sp .6s linear infinite;margin:0 auto;}
    @keyframes sp{to{transform:rotate(360deg)}}
    .ai-overlay{position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:300;display:flex;align-items:center;justify-content:center;}
    .ai-box{background:#13132a;border:1px solid #3b1f8c;border-radius:14px;padding:36px 48px;text-align:center;}
    .ai-box p{font-size:14px;color:#a78bfa;margin-top:14px;}
    .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1e1b4b;border:1px solid #7c3aed;color:#e0d4ff;padding:11px 22px;border-radius:8px;font-size:13px;z-index:999;white-space:nowrap;}
    .toast.warn{background:#1a0a0a;border-color:#7f1d1d;color:#fca5a5;}
    input[type=range]{accent-color:#7c3aed;}
    input[type=file]{display:none;}
  `;

  if(authLoading) return (
    <>
      <style>{css}</style>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#0a0a1a"}}>
        <div style={{textAlign:"center"}}><div className="big-spin" style={{margin:"0 auto 16px"}}></div><p style={{color:"#7c6aaa",fontSize:14}}>Loading...</p></div>
      </div>
    </>
  );

  return (
    <>
      <style>{css}</style>
      <input type="file" ref={fileInputRef} accept="image/*" onChange={handlePhotoUpload} style={{display:"none"}} />

      {toast&&<div className={`toast${toast.type==="warn"?" warn":""}`}>{toast.msg}</div>}
      {aiLoading&&<div className="ai-overlay"><div className="ai-box"><div className="big-spin"></div><p>{aiTask}</p></div></div>}

      {/* AUTH */}
      {authView&&(
        <div className="auth-overlay" onClick={()=>setAuthView(false)}>
          <div className="auth-modal" onClick={e=>e.stopPropagation()}>
            <button className="auth-close" onClick={()=>setAuthView(false)}>✕</button>
            <div className="auth-logo"><SkylineLogo /></div>
            <div className="auth-title">{authMode==="signup"?"Create your account":"Welcome back"}</div>
            <div className="auth-sub">{authMode==="signup"?"Join NYC's smartest real estate platform":"Sign in to continue"}</div>
            <div className="auth-role-row">
              {[{r:"renter",i:"🔍",t:"Renter",d:"Find a place"},{r:"broker",i:"🏢",t:"Broker",d:"List property"},{r:"buyer",i:"🏠",t:"Buyer",d:"Buy a home"}].map(({r,i,t,d})=>(
                <div key={r} className={`auth-role${userRole===r?" sel":""}`} onClick={()=>setUserRole(r)}>
                  <div className="auth-role-ico">{i}</div>
                  <div className="auth-role-t">{t}</div>
                  <div className="auth-role-d">{d}</div>
                </div>
              ))}
            </div>
            <button className="google-btn" onClick={()=>handleGoogleLogin(userRole)} disabled={authBusy}>
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              {authBusy?"Signing in...":"Continue with Google"}
            </button>
            <div className="divider-auth">or use email</div>
            {authError&&<div className="auth-error">{authError}</div>}
            {authMode==="signup"&&<input className="auth-input" placeholder="Full name" value={name} onChange={e=>setName(e.target.value)} />}
            <input className="auth-input" type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)} />
            <input className="auth-input" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleEmailAuth()} />
            <button className="auth-submit" onClick={handleEmailAuth} disabled={authBusy||!email||!password}>
              {authBusy?"Please wait...":(authMode==="signup"?"Create account":"Sign in")}
            </button>
            <div className="auth-switch">
              {authMode==="login"?<>No account? <a onClick={()=>{setAuthMode("signup");setAuthError("");}}>Sign up</a></>:<>Have an account? <a onClick={()=>{setAuthMode("login");setAuthError("");}}>Log in</a></>}
            </div>
          </div>
        </div>
      )}

      {/* LISTING MODAL */}
      {selected&&(
        <div className="modal-overlay" onClick={()=>{setSelected(null);setHoodBio("");setCoverLetter("");}}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="modal-title">{selected.addr}</div>
                <div className="modal-sub">{selected.hood} · {selected.beds} BR · <span style={{color:"#a78bfa",cursor:"pointer"}} onClick={e=>{e.stopPropagation();setPublicBroker({name:selected.broker,id:selected.brokerId});setSelected(null);setView("broker-public");}}>by {selected.broker} →</span></div>
              </div>
              <button className="modal-x" onClick={()=>{setSelected(null);setHoodBio("");setCoverLetter("");}}>✕</button>
            </div>
            <img className="modal-img" src={selected.photo} alt={selected.addr} onError={e=>e.target.src=HOOD_PHOTOS["Williamsburg"]} />
            <div className="modal-price">${selected.rent.toLocaleString()}<span style={{fontSize:14,fontWeight:400,color:"#7c6aaa"}}>/mo</span></div>
            <div className="modal-desc">{selected.desc}</div>
            {bioLoading?<div className="hood-bio"><div className="hood-bio-lbl">✦ AI neighborhood guide</div><span className="spin"></span>Loading...</div>
              :hoodBio?<div className="hood-bio"><div className="hood-bio-lbl">✦ AI neighborhood guide — {selected.hood}</div>{hoodBio}</div>:null}
            <div className="divider-line"></div>
            {!user?(
              <div style={{textAlign:"center",padding:"12px 0"}}>
                <p style={{fontSize:13,color:"#7c6aaa",marginBottom:12}}>Sign in to message this broker</p>
                <button className="btn btn-p" onClick={()=>{setSelected(null);openAuth("login","renter");}}>Sign in to contact broker</button>
              </div>
            ):!contactSent?(
              <>
                <div className="fgroup"><label className="flabel">Message to broker</label><textarea className="farea" placeholder="Hi, I'm interested in this apartment..." value={contactMsg} onChange={e=>setContactMsg(e.target.value)} style={{minHeight:80}} /></div>
                <div className="btn-row" style={{marginBottom:10}}>
                  <button className="btn btn-ai" onClick={genCoverLetter} disabled={coverLoading}>{coverLoading?<><span className="spin"></span>Writing...</>:"📋 AI application helper"}</button>
                </div>
                {coverLetter&&<div className="cover-box"><div className="cover-lbl">✦ AI cover letter</div>{coverLetter}</div>}
                <button className="btn btn-p" style={{width:"100%",marginTop:12}} onClick={sendMessage}>Send message to broker</button>
              </>
            ):(
              <div className="success"><strong>Message sent!</strong><p>The broker will get back to you soon.</p></div>
            )}
          </div>
        </div>
      )}

      {/* NAVBAR */}
      <div className="topnav">
        <div style={{cursor:"pointer"}} onClick={()=>setView("home")}><SkylineLogo /></div>
        <div className="topnav-links">
          <button className={`topnav-link${view==="home"?" active":""}`} onClick={()=>setView("home")}>Home</button>
          <button className={`topnav-link${view==="search"?" active":""}`} onClick={()=>setView("search")}>Search</button>
          {user&&userRole==="broker"&&<button className={`topnav-link${view==="broker"?" active":""}`} onClick={()=>setView("broker")}>Dashboard</button>}
        </div>
        <div className="topnav-actions">
          {user?(
            <>
              <div className="user-chip" onClick={()=>{setEditBio(userProfile?.bio||"");setView("profile");}}>
                <Avatar size={28} />
                <span className="user-name">{displayName}</span>
              </div>
              {userRole==="broker"&&<button className="tnbtn solid sm" onClick={()=>setView("new-listing")}>+ List</button>}
              <button className="tnbtn ghost sm" onClick={handleSignOut}>Sign out</button>
            </>
          ):(
            <>
              <button className="tnbtn ghost" onClick={()=>openAuth("login","renter")}>Log in</button>
              <button className="tnbtn solid" onClick={()=>openAuth("signup","broker")}>List your property</button>
            </>
          )}
        </div>
      </div>

      {/* PROFILE PAGE */}
      {view==="profile"&&user&&(
        <div className="profile-page">
          <div className="profile-card">
            <div className="profile-top">
              {/* Clickable avatar — opens file picker */}
              <div className="photo-upload-wrap" onClick={()=>!uploadingPhoto&&fileInputRef.current?.click()} title="Click to upload photo">
                <Avatar size={80} style={{border:"3px solid #3b1f8c",cursor:"pointer"}} />
                <div className="photo-overlay">
                  {uploadingPhoto?<span className="spin"></span>:"📷"}
                </div>
              </div>
              <div className="profile-info">
                <div className="profile-name">{displayName}</div>
                <div className="profile-role">{userRole}</div>
                <div className="profile-email">{user.email}</div>
                <div style={{fontSize:11,color:"#4c3a8a",marginTop:6}}>Click your photo to upload a new one</div>
              </div>
            </div>

            <div className="fgroup">
              <label className="flabel">Bio</label>
              <textarea className="farea" placeholder="Tell people about yourself — your NYC neighborhood expertise, what you're looking for, or your experience as a broker..." value={editBio} onChange={e=>setEditBio(e.target.value)} />
            </div>

            <button className="btn btn-p" onClick={handleSaveProfile} disabled={savingProfile} style={{marginBottom:16}}>
              {savingProfile?"Saving...":"Save profile"}
            </button>

            {/* View history consent toggle */}
            <div className="consent-box">
              <div className="consent-row">
                <div>
                  <div className="consent-label">Save my view history</div>
                  <div className="consent-desc">When enabled, listings you click on are saved to your profile so you can find them again easily. Turn this off to stop tracking.</div>
                </div>
                <label className="toggle">
                  <input type="checkbox" checked={historyConsent} onChange={e=>setHistoryConsent(e.target.checked)} />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            {userRole==="broker"&&(
              <div className="profile-stats">
                <div className="profile-stat"><div className="profile-stat-n">{myListings.length}</div><div className="profile-stat-l">Listings posted</div></div>
                <div className="profile-stat"><div className="profile-stat-n">{myLeads.length}</div><div className="profile-stat-l">Inquiries received</div></div>
                <div className="profile-stat"><div className="profile-stat-n">{myListings.filter(l=>l.status==="rented").length}</div><div className="profile-stat-l">Units rented</div></div>
              </div>
            )}
          </div>

          {/* View history */}
          {historyConsent&&(
            <div className="section-card">
              <div className="section-title">
                <span>👁 Recently viewed <span className="section-count">({viewHistory.length} listings)</span></span>
                {viewHistory.length>0&&<button className="clear-btn" onClick={async()=>{setViewHistory([]);try{await setDoc(doc(db,"users",user.uid),{viewHistory:[]},{merge:true});}catch{}showToast("History cleared");}}>Clear all</button>}
              </div>
              {viewHistory.length===0?(
                <div className="empty">No listings viewed yet. Browse apartments to start building your history.</div>
              ):viewHistory.slice(0,20).map((v,i)=>(
                <div className="history-row" key={i} onClick={()=>{const l=listings.find(x=>x.id===v.id);if(l){openListing(l);setView("search");}}}>
                  <img className="history-thumb" src={v.photo} alt={v.addr} onError={e=>e.target.src=HOOD_PHOTOS["Williamsburg"]} />
                  <div className="history-info">
                    <div className="history-addr">{v.addr}</div>
                    <div className="history-hood">{v.hood}</div>
                    <div className="history-meta">Viewed {new Date(v.viewedAt).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div className="history-price">${v.rent?.toLocaleString()}/mo</div>
                    <div className="history-time">{new Date(v.viewedAt).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!historyConsent&&(
            <div className="section-card">
              <div className="section-title">👁 View history</div>
              <div className="empty">View history is turned off. Enable it above to track listings you've clicked on.</div>
            </div>
          )}

          {userRole==="broker"&&myListings.length>0&&(
            <div className="section-card">
              <div className="section-title">🏢 My listings</div>
              {myListings.map(l=>(
                <div className="lrow" key={l.id} onClick={()=>{openListing(l);setView("search");}} style={{cursor:"pointer"}}>
                  <img className="lthumb" src={l.photo} alt="" onError={e=>e.target.src=HOOD_PHOTOS["Williamsburg"]} />
                  <div className="linfo"><div className="laddr">{l.addr}</div><div className="lmeta">{l.hood} · ${l.rent?.toLocaleString()}/mo · {l.beds} BR</div></div>
                  <span className={l.status==="active"?"badge-a":"badge-r"}>{l.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PUBLIC BROKER PAGE */}
      {view==="broker-public"&&publicBroker&&(
        <div className="broker-pub">
          <button className="btn btn-s" style={{marginBottom:20,fontSize:12}} onClick={()=>setView("search")}>← Back to search</button>
          <div className="broker-pub-header">
            <div style={{display:"flex",justifyContent:"center"}}>
              <Avatar size={80} name={publicBroker.name} url="" style={{border:"3px solid #3b1f8c"}} />
            </div>
            <div className="broker-pub-name">{publicBroker.name}</div>
            <div className="broker-pub-role">Real Estate Broker · New York City</div>
            <div className="broker-pub-bio">Helping clients find their perfect NYC apartment. Specializing in Brooklyn and Manhattan neighborhoods.</div>
            <div className="broker-pub-stats">
              <div className="broker-pub-stat"><div className="broker-pub-stat-n">{listings.filter(l=>l.broker===publicBroker.name).length}</div><div className="broker-pub-stat-l">Total listings</div></div>
              <div className="broker-pub-stat"><div className="broker-pub-stat-n">{listings.filter(l=>l.broker===publicBroker.name&&l.status==="active").length}</div><div className="broker-pub-stat-l">Active</div></div>
              <div className="broker-pub-stat"><div className="broker-pub-stat-n">{listings.filter(l=>l.broker===publicBroker.name&&l.status==="rented").length}</div><div className="broker-pub-stat-l">Rented</div></div>
              <div className="broker-pub-stat"><div className="broker-pub-stat-n">{listings.filter(l=>l.broker===publicBroker.name).reduce((a,l)=>a+(l.leads||[]).length,0)}</div><div className="broker-pub-stat-l">Inquiries</div></div>
            </div>
          </div>
          <div style={{marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontSize:14,fontWeight:700,color:"#fff"}}>{publicBroker.name}'s listings</span>
            <span style={{fontSize:12,color:"#7c6aaa"}}>{listings.filter(l=>l.broker===publicBroker.name&&l.status==="active").length} active</span>
          </div>
          <div className="lgrid">
            {listings.filter(l=>l.broker===publicBroker.name&&l.status==="active").length===0
              ?<div className="empty">No active listings.</div>
              :listings.filter(l=>l.broker===publicBroker.name&&l.status==="active").map(l=>(
                <div className="lcard" key={l.id} onClick={()=>{openListing(l);setView("search");}}>
                  <img className="lcard-img" src={l.photo} alt={l.addr} onError={e=>e.target.src=HOOD_PHOTOS["Williamsburg"]} />
                  <div className="lcard-body">
                    <div className="lcard-price">${l.rent.toLocaleString()}/mo</div>
                    <div className="lcard-addr">{l.addr}, {l.hood}</div>
                    <div className="tags"><span className="tag">{l.beds} BR</span><span className="tag">{l.hood}</span></div>
                    <div className="lcard-desc">{l.desc}</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* HOME */}
      {view==="home"&&(
        <>
          <div className="hero">
            <div className="hero-eyebrow">✦ AI-powered NYC real estate</div>
            <h1 className="hero-title">Your next home<br/>in <span>New York City</span></h1>
            <p className="hero-sub">The smarter way to rent, buy, and list — with AI built into every step.</p>
            <div className="search-card">
              <div className="search-tabs">{["rent","buy","sell"].map(t=><button key={t} className={`search-tab${homeTab===t?" active":""}`} onClick={()=>setHomeTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>)}</div>
              <div className="search-body">
                <div className="search-row">
                  <div className="search-field" style={{flex:2}}><span className="search-label">Location</span><select className="search-select"><option>Choose neighborhoods or boroughs</option>{["Williamsburg","Greenpoint","Crown Heights","Hell's Kitchen","Fort Greene","Astoria","Park Slope","Bushwick"].map(n=><option key={n}>{n}</option>)}</select></div>
                  <div className="search-field"><span className="search-label">Min Price</span><select className="search-select"><option>Min</option>{["1500","2000","2500","3000","3500","4000"].map(p=><option key={p}>${parseInt(p).toLocaleString()}</option>)}</select></div>
                  <div className="search-field"><span className="search-label">Max Price</span><select className="search-select"><option>Max</option>{["2000","2500","3000","3500","4000","5000","6000"].map(p=><option key={p}>${parseInt(p).toLocaleString()}</option>)}</select></div>
                  <button className="search-btn" onClick={()=>setView("search")}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>Search</button>
                </div>
                <div className="search-hint">{user?`Welcome back, ${displayName}!`:<>Find your home faster: <a onClick={()=>openAuth("signup","renter")}>sign up</a> or <a onClick={()=>openAuth("login","renter")}>log in</a></>}</div>
              </div>
            </div>
          </div>
          <div className="feat-bar">
            <div className="feat-bar-inner">
              {[{i:"✦",t:"AI listing writer",d:"Descriptions in seconds"},{i:"🖼",t:"AI photo finder",d:"Auto-find photos"},{i:"◎",t:"Natural search",d:"Search how you talk"},{i:"🗺",t:"Neighborhood guide",d:"AI insights every area"},{i:"📋",t:"Application helper",d:"AI cover letters"},{i:"⬡",t:"Smart pricing",d:"Market rent suggestions"}].map(f=>(
                <div className="feat-item" key={f.t}><div className="feat-item-ico">{f.i}</div><div className="feat-item-t">{f.t}</div><div className="feat-item-d">{f.d}</div></div>
              ))}
            </div>
          </div>
          <div className="listings-preview">
            <div className="lp-inner">
              <div className="lp-header"><div className="lp-title">Featured listings</div><button className="lp-see-all" onClick={()=>setView("search")}>See all →</button></div>
              <div className="lgrid">
                {listings.filter(l=>l.status==="active").slice(0,4).map(l=>(
                  <div className="lcard" key={l.id} onClick={()=>openListing(l)}>
                    <img className="lcard-img" src={l.photo} alt={l.addr} onError={e=>e.target.src=HOOD_PHOTOS["Williamsburg"]} />
                    <div className="lcard-body">
                      <div className="lcard-price">${l.rent.toLocaleString()}/mo</div>
                      <div className="lcard-addr">{l.addr}, {l.hood}</div>
                      <div className="tags"><span className="tag">{l.beds} BR</span><span className="tag">{l.hood}</span></div>
                      <div className="lcard-desc">{l.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* SEARCH */}
      <div className={`pg${view==="search"?" show":""}`}>
        <div className="ph"><h2>Find your apartment</h2><p>Search with filters or describe what you want</p></div>
        <div className="aibox">
          <div className="ailabel">✦ AI search</div>
          <div className="arow">
            <input className="ainp" placeholder='Try: "sunny 2BR in Williamsburg under $3,500 near L train"' value={nlQuery} onChange={e=>{setNlQuery(e.target.value);setNlResults(null);}} onKeyDown={e=>e.key==="Enter"&&doNLSearch()} />
            <button className="btn btn-ai" onClick={doNLSearch}>Search</button>
          </div>
          {nlResults&&nlResults.length===0&&<p style={{fontSize:12,color:"#7c6aaa",marginTop:10}}>No matches. Try different words.</p>}
          {nlResults&&nlResults.length>0&&<p style={{fontSize:12,color:"#a78bfa",marginTop:10}}>✦ {nlResults.length} match{nlResults.length!==1?"es":""} for "{nlQuery}"</p>}
        </div>
        <div className="filters">
          <div className="fg"><span className="fl">Neighborhood</span><select value={fHood} onChange={e=>setFHood(e.target.value)}><option>All</option>{["Williamsburg","Greenpoint","Crown Heights","Hell's Kitchen","Fort Greene","Astoria","Park Slope","Bushwick"].map(n=><option key={n}>{n}</option>)}</select></div>
          <div className="fg"><span className="fl">Bedrooms</span><select value={fBeds} onChange={e=>setFBeds(e.target.value)}><option>Any</option><option>1</option><option>2</option><option>3</option></select></div>
          <div className="fg"><span className="fl">Max rent: ${fRent.toLocaleString()}</span><input type="range" min="1500" max="6000" step="100" value={fRent} onChange={e=>setFRent(parseInt(e.target.value))} style={{width:140}} /></div>
          <button className="btn btn-s" style={{fontSize:12,padding:"7px 12px"}} onClick={()=>{setFHood("All");setFBeds("Any");setFRent(5000);setNlResults(null);}}>Clear</button>
        </div>
        <div className="cnt">{(nlResults||filtered).length} listing{(nlResults||filtered).length!==1?"s":""} found</div>
        <div className="lgrid">
          {(nlResults||filtered).length===0?<div className="empty" style={{gridColumn:"1/-1"}}>No listings match.</div>
            :(nlResults||filtered).map(l=>(
              <div className="lcard" key={l.id} onClick={()=>openListing(l)}>
                <img className="lcard-img" src={l.photo} alt={l.addr} onError={e=>e.target.src=HOOD_PHOTOS["Williamsburg"]} />
                <div className="lcard-body">
                  <div className="lcard-price">${l.rent.toLocaleString()}/mo</div>
                  <div className="lcard-addr">{l.addr}, {l.hood}</div>
                  <div className="tags">
                    <span className="tag">{l.beds} BR</span>
                    <span className="tag">{l.hood}</span>
                    <span className="tag bt" onClick={e=>{e.stopPropagation();setPublicBroker({name:l.broker,id:l.brokerId});setView("broker-public");}}>by {l.broker} →</span>
                  </div>
                  <div className="lcard-desc">{l.desc}</div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* BROKER DASHBOARD */}
      <div className={`pg${view==="broker"?" show":""}`}>
        <div className="ph"><h2>Broker dashboard</h2><p>Welcome back, {displayName}.</p></div>
        <div className="stats">
          <div className="stat"><div className="stat-n">{myListings.length}</div><div className="stat-l">Listings</div></div>
          <div className="stat"><div className="stat-n">{myListings.filter(l=>l.status==="active").length}</div><div className="stat-l">Active</div></div>
          <div className="stat"><div className="stat-n">{myLeads.length}</div><div className="stat-l">Inquiries</div></div>
          <div className="stat"><div className="stat-n">{myListings.reduce((a,l)=>a+(l.leads||[]).length,0)}</div><div className="stat-l">Messages</div></div>
        </div>
        <div className="two">
          <div className="card">
            <div className="card-t">My listings</div>
            {myListings.length===0?<div className="empty">No listings yet.</div>
              :myListings.map(l=>(
                <div className="lrow" key={l.id}>
                  <img className="lthumb" src={l.photo} alt="" onError={e=>e.target.src=HOOD_PHOTOS["Williamsburg"]} />
                  <div className="linfo"><div className="laddr">{l.addr}</div><div className="lmeta">{l.hood} · ${l.rent?.toLocaleString()}/mo · {l.beds} BR</div></div>
                  <span className={l.status==="active"?"badge-a":"badge-r"}>{l.status}</span>
                </div>
              ))}
            <button className="btn btn-p" style={{width:"100%",marginTop:14,fontSize:12}} onClick={()=>setView("new-listing")}>+ Add new listing</button>
          </div>
          <div className="card">
            <div className="card-t">Renter inquiries</div>
            {myLeads.length===0?<div className="empty">No inquiries yet.</div>
              :myLeads.map((ld,i)=>(
                <div className="lead-row" key={i}>
                  <div className="lead-ico">✉</div>
                  <div><div className="lead-addr">{ld.listing.addr}</div><div className="lead-msg">"{ld.message}"</div><div className="lead-time">{ld.time}</div></div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* NEW LISTING */}
      <div className={`pg${view==="new-listing"?" show":""}`}>
        <div className="ph"><h2>New listing</h2><p>Let AI do the hard work</p></div>
        <div style={{maxWidth:540}}>
          <div className="fgroup"><label className="flabel">Street address</label><input className="finput" placeholder="e.g. 47 Bedford Ave" value={newL.addr} onChange={e=>setNewL(p=>({...p,addr:e.target.value}))} /></div>
          <div className="two-inp">
            <div className="fgroup"><label className="flabel">Neighborhood</label><select className="fsel" value={newL.hood} onChange={e=>setNewL(p=>({...p,hood:e.target.value,photo:""}))}>{"Williamsburg,Greenpoint,Crown Heights,Hell's Kitchen,Fort Greene,Astoria,Park Slope,Bushwick".split(",").map(n=><option key={n}>{n}</option>)}</select></div>
            <div className="fgroup"><label className="flabel">Bedrooms</label><select className="fsel" value={newL.beds} onChange={e=>setNewL(p=>({...p,beds:e.target.value}))}><option value="">Select</option><option>1</option><option>2</option><option>3</option><option>4</option></select></div>
          </div>
          <div className="fgroup">
            <label className="flabel">Monthly rent ($)</label>
            <input className="finput" type="number" placeholder="e.g. 3200" value={newL.rent} onChange={e=>setNewL(p=>({...p,rent:e.target.value}))} />
            <div className="btn-row"><button className="btn btn-ai" onClick={suggestPrice}>⬡ AI price suggestion</button></div>
            {priceHint&&<div className="price-hint">✦ AI suggests: {priceHint}</div>}
          </div>
          <div className="fgroup">
            <label className="flabel">Photos</label>
            {newL.photo&&<img className="photo-preview" src={newL.photo} alt="preview" />}
            <div className="btn-row" style={{marginTop:8}}><button className="btn btn-ai" onClick={findPhotos}>🖼 Find photos with AI</button></div>
          </div>
          <div className="fgroup">
            <label className="flabel">Description</label>
            <textarea className="farea" placeholder="Describe the apartment, or let AI write it..." value={newL.desc} onChange={e=>setNewL(p=>({...p,desc:e.target.value}))} />
            <div className="btn-row"><button className="btn btn-ai" onClick={genDesc}>✦ Write with AI</button></div>
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
