import { useState, useEffect } from "react";
const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

// ── Build-vs-AlgoPay toggle ──────────────────────────────────────────────────
const DIY = [
  { week:"Week 1", items:["Set up payment webhook server","Build HMAC signature verification","Write payment event normalizer"] },
  { week:"Week 2", items:["Design oracle signing architecture","Implement Ed25519 key management","Build replay attack protection"] },
  { week:"Week 3", items:["Write Algorand smart contract","Deploy + test on TestNet","Wire oracle to contract calls"] },
  { week:"Week 4", items:["Build monitoring dashboard","Write SDK + documentation","Onboarding + team handoff"] },
];
const SDK_LINES = [
  { t:"npm install @algopay/oracle-sdk", c:"var(--text2)" },
  { t:"", c:"" },
  { t:`const client = new AlgoPayClient({`, c:"var(--text)" },
  { t:`  mnemonic: process.env.ORACLE_MNEMONIC,`, c:"var(--text2)" },
  { t:`  network: "testnet", appId: APP_ID,`, c:"var(--text2)" },
  { t:`});`, c:"var(--text)" },
  { t:"", c:"" },
  { t:`const result = await client.verifyAndCommit({`, c:"var(--text)" },
  { t:`  payment_id: "pay_XXXXXXX",`, c:"var(--accent)" },
  { t:`  amount: 100, provider: "razorpay",`, c:"var(--accent)" },
  { t:`});  // ✓ signed, submitted, verified on-chain`, c:"var(--text2)" },
];

function BuildToggle() {
  const [show, setShow] = useState("diy");
  return (
    <div style={{ maxWidth:860, margin:"0 auto" }}>
      <div style={{ display:"flex", justifyContent:"center", marginBottom:24 }}>
        {[["diy","🔨 Build yourself (~4 weeks)"],["sdk","⚡ With AlgoPay Oracle (5 min)"]].map(([v,l])=>(
          <button key={v} onClick={()=>setShow(v)} style={{
            padding:"10px 24px", border:"1px solid var(--border)",
            background: show===v ? "var(--accent-dim)" : "transparent",
            color: show===v ? "var(--accent)" : "var(--text2)",
            fontFamily:"var(--mono)", fontSize:12, cursor:"pointer",
            borderRadius: v==="diy" ? "8px 0 0 8px" : "0 8px 8px 0",
            transition:"all .2s",
          }}>{l}</button>
        ))}
      </div>

      {show === "diy" ? (
        <div className="fi" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:12 }}>
          {DIY.map((w,i)=>(
            <div key={i} style={{ background:"var(--surface)", border:"1px solid var(--border2)", borderRadius:"var(--r)", padding:18 }}>
              <div style={{ color:"var(--red)", fontFamily:"var(--mono)", fontSize:10, letterSpacing:"1px", marginBottom:10 }}>{w.week}</div>
              {w.items.map((item,j)=>(
                <div key={j} style={{ display:"flex", gap:8, marginBottom:8, alignItems:"flex-start" }}>
                  <span style={{ color:"var(--text2)", marginTop:2, flexShrink:0 }}>→</span>
                  <span style={{ color:"var(--text2)", fontSize:12, lineHeight:1.5 }}>{item}</span>
                </div>
              ))}
            </div>
          ))}
          <div style={{ gridColumn:"1/-1", textAlign:"center", padding:"14px 0", fontFamily:"var(--mono)", fontSize:13, color:"var(--red)" }}>
            ~3-4 weeks · ~6,000 lines of custom infrastructure
          </div>
        </div>
      ) : (
        <div className="fi" style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--rl)", overflow:"hidden" }}>
          <div style={{ display:"flex", gap:7, padding:"10px 16px", borderBottom:"1px solid var(--border)", background:"var(--elevated)" }}>
            {["#F87171","#FBBF24","#00E5A0"].map((c,i)=><div key={i} style={{width:10,height:10,borderRadius:"50%",background:c,opacity:.7}}/>)}
            <span style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:11, marginLeft:4 }}>oracle.js</span>
          </div>
          <div style={{ padding:"20px 24px", fontFamily:"var(--mono)", fontSize:13, lineHeight:2 }}>
            {SDK_LINES.map((l,i)=>(
              <div key={i} style={{ display:"flex" }}>
                <span style={{ color:"var(--text3)", width:24, userSelect:"none" }}>{l.t ? i+1 : ""}</span>
                <span style={{ color: l.t.startsWith("npm") ? "var(--accent)" : l.c }}>{l.t}</span>
              </div>
            ))}
          </div>
          <div style={{ padding:"14px 24px", borderTop:"1px solid var(--border)", textAlign:"center", fontFamily:"var(--mono)", fontSize:12, color:"var(--accent)" }}>
            5 minutes · 11 lines · full cryptographic guarantees
          </div>
        </div>
      )}
    </div>
  );
}

// ── Animated architecture flow ────────────────────────────────────────────────
function ArchFlow() {
  const nodes = [
    { label:"User Payment", sub:"UPI · Razorpay · Stripe", color:"var(--amber)", icon:"₹" },
    { label:"Payment Gateway", sub:"HMAC webhook verified", color:"var(--blue)", icon:"⚡" },
    { label:"AlgoPay Oracle", sub:"Ed25519 signs APC-1", color:"var(--accent)", icon:"✦" },
    { label:"Algorand Contract", sub:"ed25519verify_bare", color:"var(--accent)", icon:"⬡" },
    { label:"Action Executes", sub:"Trustless · On-chain", color:"var(--accent)", icon:"✓" },
  ];
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:0, overflowX:"auto", padding:"8px 0" }}>
      {nodes.map((n,i)=>(
        <>
          <div key={i} style={{ flexShrink:0, textAlign:"center", padding:"0 8px" }}>
            <div style={{
              width:64, height:64, borderRadius:"50%", margin:"0 auto 10px",
              background:`rgba(${n.color==="var(--accent)"?"0,229,160":n.color==="var(--blue)"?"56,189,248":"251,191,36"},.08)`,
              border:`1px solid ${n.color}40`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:22, color:n.color,
            }}>{n.icon}</div>
            <div style={{ color:"var(--text)", fontSize:12, fontWeight:700, marginBottom:3 }}>{n.label}</div>
            <div style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:10 }}>{n.sub}</div>
          </div>
          {i < nodes.length-1 && (
            <div key={`arr-${i}`} style={{ flexShrink:0, padding:"0 4px", paddingBottom:28 }}>
              <svg width="48" height="24" viewBox="0 0 48 24">
                <line x1="0" y1="12" x2="36" y2="12" stroke="var(--border)" strokeWidth="1" strokeDasharray="4 3"/>
                <path d="M36 8L44 12L36 16" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="0" cy="12" r="3" fill="var(--accent)" opacity=".5">
                  <animate attributeName="cx" from="0" to="44" dur={`${1.2+i*0.3}s`} repeatCount="indefinite"/>
                  <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin="0s"/>
                </circle>
              </svg>
            </div>
          )}
        </>
      ))}
    </div>
  );
}

// ── Feature grid ──────────────────────────────────────────────────────────────
const FEATURES = [
  { icon:"🌐", color:"var(--blue)",   title:"Provider Agnostic",      body:"Razorpay, Stripe, PayU, PhonePe, or any custom gateway. One interface, all payment rails." },
  { icon:"🔐", color:"var(--accent)", title:"Replay-Proof On-Chain",  body:"canonical_id = provider:payment_id stored in Algorand box storage. Mathematically impossible to replay." },
  { icon:"⬡",  color:"var(--accent)", title:"Smart Contract Verified",body:"ed25519verify_bare on every call. No valid oracle signature = contract aborts. Zero trust in backend." },
  { icon:"📦", color:"var(--purple)", title:"TypeScript SDK",          body:"npm install @algopay/oracle-sdk. Full typings, typed errors, Razorpay + Stripe adapters included." },
  { icon:"🔑", color:"var(--amber)",  title:"Oracle Rotation",         body:"Register multiple oracle keys, rotate without downtime. No single point of failure." },
  { icon:"✦",  color:"var(--accent)", title:"APC-1 Credentials",      body:"Portable standardized proof format. Self-contained, cross-application, forward-versioned." },
];

// ── Trust model ────────────────────────────────────────────────────────────────
function TrustModel() {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, maxWidth:760, margin:"0 auto" }}>
      {[
        { label:"TRADITIONAL", color:"var(--red)", items:["Frontend","Backend checks DB","Backend says ✓","Frontend unlocks"], note:"Trust: your backend's word" },
        { label:"ALGOPAY ORACLE", color:"var(--accent)", items:["Payment Gateway","Oracle signs proof","Contract verifies sig","Action executes"], note:"Trust: Ed25519 cryptography" },
      ].map(({ label, color, items, note },i)=>(
        <div key={i} style={{
          padding:28, borderRadius:"var(--rl)",
          background: i===1 ? "var(--accent-dim)" : "rgba(248,113,113,.03)",
          border: `1px solid ${i===1 ? "var(--border)" : "rgba(248,113,113,.15)"}`,
          ...(i===1 ? { animation:"glow 3s ease infinite" } : {}),
        }}>
          <div style={{ color, fontFamily:"var(--mono)", fontSize:10, letterSpacing:"1.5px", marginBottom:18 }}>{label}</div>
          {items.map((s,j)=>(
            <div key={j} style={{ display:"flex", flexDirection:"column", marginBottom: j<items.length-1 ? 0 : 0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 0" }}>
                <div style={{ width:7, height:7, borderRadius:"50%", background:color, flexShrink:0, opacity: i===0 ? .4 : 1 }} />
                <span style={{ fontSize:13, color: i===1 ? "var(--text)" : "var(--text2)" }}>{s}</span>
              </div>
              {j < items.length-1 && <div style={{ width:1, height:12, background:color, opacity:.2, marginLeft:3 }} />}
            </div>
          ))}
          <div style={{ marginTop:16, padding:"8px 12px", borderRadius:7, background: i===1 ? "rgba(0,229,160,.06)" : "rgba(248,113,113,.06)", fontFamily:"var(--mono)", fontSize:11, color }}>{note}</div>
        </div>
      ))}
    </div>
  );
}

export default function LandingPage() {
  const [stats, setStats] = useState(null);
  useEffect(() => { fetch(`${API}/dashboard/stats`).then(r=>r.json()).then(setStats).catch(()=>{}); }, []);

  return (
    <div style={{ paddingTop:56 }}>

      {/* ── Hero ── */}
      <section className="grid-bg" style={{ minHeight:"90vh", display:"flex", alignItems:"center", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:"30%", left:"50%", transform:"translate(-50%,-50%)", width:700, height:700, borderRadius:"50%", background:"radial-gradient(circle,rgba(0,229,160,.05) 0%,transparent 65%)", pointerEvents:"none" }} />

        <div style={{ maxWidth:1160, margin:"0 auto", padding:"80px 40px", width:"100%" }}>
          <div style={{ textAlign:"center", maxWidth:780, margin:"0 auto" }}>
            <div className="fu" style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"5px 14px", border:"1px solid var(--border)", borderRadius:100, marginBottom:32 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:"var(--accent)", animation:"pulse 2s infinite" }} />
              <span style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:11, letterSpacing:"1px" }}>LIVE · ALGORAND TESTNET · APC-1 STANDARD</span>
            </div>

            <h1 className="fu" style={{ fontSize:"clamp(38px,5vw,72px)", fontWeight:800, lineHeight:1.06, letterSpacing:"-1.5px", marginBottom:24, animationDelay:".05s" }}>
              Payments verified on-chain.
              <br/>
              <span style={{ color:"var(--accent)" }}>Blockchain invisible to users.</span>
            </h1>

            <p className="fu" style={{ fontSize:18, color:"var(--text2)", lineHeight:1.7, maxWidth:580, margin:"0 auto 40px", animationDelay:".1s" }}>
              AlgoPay Oracle converts UPI, Razorpay, Stripe and any payment gateway into{" "}
              <span style={{ color:"var(--text)" }}>cryptographically signed APC-1 credentials</span>{" "}
              verified directly by Algorand smart contracts — without users ever touching crypto.
            </p>

            <div className="fu" style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap", animationDelay:".15s" }}>
              <a href="#/demo" style={{ padding:"13px 32px", background:"var(--accent)", color:"#040810", borderRadius:"var(--r)", fontWeight:700, fontSize:15, textDecoration:"none" }}>
                Live Demo →
              </a>
              <a href="#/dashboard" style={{ padding:"13px 24px", background:"transparent", color:"var(--text)", border:"1px solid var(--border)", borderRadius:"var(--r)", fontSize:15, textDecoration:"none" }}>
                Dashboard
              </a>
              <a href="https://github.com/PrathamKalburgi/AlgoPay-Oracle" target="_blank" rel="noreferrer" style={{ padding:"13px 20px", background:"transparent", color:"var(--text2)", border:"1px solid var(--border2)", borderRadius:"var(--r)", fontFamily:"var(--mono)", fontSize:13, textDecoration:"none" }}>
                GitHub ↗
              </a>
            </div>
          </div>

          {/* Stats pills */}
          {stats && (
            <div className="fu" style={{ display:"flex", gap:12, justifyContent:"center", marginTop:56, flexWrap:"wrap", animationDelay:".25s" }}>
              {[
                ["Verified On-chain", stats.total_verified],
                ["Active Oracles", stats.oracle_count],
                ["Network", stats.network || "TestNet"],
                ["App ID", stats.app_id ? `#${stats.app_id}` : "—"],
                ["APC Version", "1"],
              ].map(([l,v])=>(
                <div key={l} style={{ padding:"8px 20px", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:100 }}>
                  <span style={{ color:"var(--accent)", fontFamily:"var(--mono)", fontWeight:600 }}>{v}</span>
                  <span style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:11, marginLeft:8 }}>{l}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Architecture flow ── */}
      <section style={{ borderTop:"1px solid var(--border)", borderBottom:"1px solid var(--border)", padding:"48px 40px", background:"var(--surface)" }}>
        <div style={{ maxWidth:1000, margin:"0 auto" }}>
          <div style={{ textAlign:"center", fontFamily:"var(--mono)", fontSize:10, letterSpacing:"1.5px", color:"var(--text2)", marginBottom:32 }}>VERIFICATION PIPELINE</div>
          <ArchFlow />
        </div>
      </section>

      {/* ── Build vs AlgoPay ── */}
      <section style={{ maxWidth:1160, margin:"0 auto", padding:"96px 40px" }}>
        <div style={{ textAlign:"center", marginBottom:48 }}>
          <div style={{ fontFamily:"var(--mono)", fontSize:11, letterSpacing:"1.5px", color:"var(--text2)", marginBottom:12 }}>DEVELOPER EXPERIENCE</div>
          <h2 style={{ fontSize:38, fontWeight:800, letterSpacing:"-0.5px" }}>Build it yourself vs AlgoPay Oracle</h2>
        </div>
        <BuildToggle />
      </section>

      {/* ── Features ── */}
      <section style={{ background:"var(--surface)", borderTop:"1px solid var(--border)", borderBottom:"1px solid var(--border)" }}>
        <div style={{ maxWidth:1160, margin:"0 auto", padding:"96px 40px" }}>
          <div style={{ textAlign:"center", marginBottom:56 }}>
            <div style={{ fontFamily:"var(--mono)", fontSize:11, letterSpacing:"1.5px", color:"var(--text2)", marginBottom:12 }}>CAPABILITIES</div>
            <h2 style={{ fontSize:38, fontWeight:800, letterSpacing:"-0.5px" }}>Infrastructure that disappears<br/>into your product</h2>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
            {FEATURES.map((f,i)=>(
              <div key={i} className="fu" style={{
                padding:24, background:"var(--elevated)", border:"1px solid var(--border2)", borderRadius:"var(--rl)",
                animationDelay:`${i*.06}s`, transition:"border-color .2s, transform .2s",
              }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(0,229,160,.25)";e.currentTarget.style.transform="translateY(-2px)"}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border2)";e.currentTarget.style.transform="none"}}
              >
                <div style={{ fontSize:22, marginBottom:12 }}>{f.icon}</div>
                <div style={{ fontWeight:700, fontSize:14, marginBottom:8, color:"var(--text)" }}>{f.title}</div>
                <div style={{ color:"var(--text2)", fontSize:13, lineHeight:1.65 }}>{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust model ── */}
      <section style={{ maxWidth:1160, margin:"0 auto", padding:"96px 40px" }}>
        <div style={{ textAlign:"center", marginBottom:48 }}>
          <div style={{ fontFamily:"var(--mono)", fontSize:11, letterSpacing:"1.5px", color:"var(--text2)", marginBottom:12 }}>TRUST MODEL</div>
          <h2 style={{ fontSize:38, fontWeight:800, letterSpacing:"-0.5px" }}>The contract doesn't trust your backend.<br/>It trusts the proof.</h2>
        </div>
        <TrustModel />
      </section>

      {/* ── CTA ── */}
      <section style={{ borderTop:"1px solid var(--border)", background:"var(--surface)", padding:"80px 40px", textAlign:"center" }}>
        <div style={{ fontFamily:"var(--mono)", fontSize:11, letterSpacing:"1.5px", color:"var(--text2)", marginBottom:16 }}>GET STARTED</div>
        <h2 style={{ fontSize:36, fontWeight:800, marginBottom:12, letterSpacing:"-0.5px" }}>See it run on Algorand TestNet</h2>
        <p style={{ color:"var(--text2)", marginBottom:36, fontSize:16 }}>Real payment. Real oracle signature. Real smart contract execution.</p>
        <div style={{ display:"flex", gap:12, justifyContent:"center" }}>
          <a href="#/demo" style={{ padding:"14px 36px", background:"var(--accent)", color:"#040810", borderRadius:"var(--r)", fontWeight:700, fontSize:16, textDecoration:"none" }}>
            Live Demo →
          </a>
          <a href="#/dashboard" style={{ padding:"14px 24px", background:"transparent", color:"var(--text)", border:"1px solid var(--border)", borderRadius:"var(--r)", fontSize:15, textDecoration:"none" }}>
            Dashboard
          </a>
        </div>
      </section>

      <footer style={{ borderTop:"1px solid var(--border)", padding:"28px 40px" }}>
        <div style={{ maxWidth:1160, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:15 }}>⬡</span>
            <span style={{ fontWeight:700, fontSize:14 }}>AlgoPay Oracle</span>
            <span style={{ color:"var(--text2)", fontSize:12, fontFamily:"var(--mono)" }}>· MIT · APC-1 · Algorand</span>
          </div>
          <div style={{ display:"flex", gap:20 }}>
            {[["Demo","#/demo"],["Dashboard","#/dashboard"],["GitHub","https://github.com/PrathamKalburgi/AlgoPay-Oracle"]].map(([l,h])=>(
              <a key={l} href={h} style={{ color:"var(--text2)", textDecoration:"none", fontSize:13, fontFamily:"var(--mono)" }}>{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
