import { useState, useEffect, useRef } from "react";

const API = import.meta.env.VITE_API_URL;

// ─── Google Fonts ──────────────────────────────────────────────────────────
const fontLink = document.createElement("link");
fontLink.rel  = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=JetBrains+Mono:wght@400;500&display=swap";
document.head.appendChild(fontLink);

// ─── Global styles ─────────────────────────────────────────────────────────
const globalStyle = document.createElement("style");
globalStyle.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #07090F; }

  @keyframes fadeUp   { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
  @keyframes spin     { to   { transform:rotate(360deg); } }
  @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:.4} }
  @keyframes shimmer  { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
  @keyframes growBar  { from{width:0} to{width:100%} }
  @keyframes popIn    { 0%{opacity:0;transform:scale(.88)} 60%{transform:scale(1.04)} 100%{opacity:1;transform:scale(1)} }
  @keyframes checkDraw{ from{stroke-dashoffset:24} to{stroke-dashoffset:0} }
  @keyframes glow     { 0%,100%{box-shadow:0 0 12px rgba(0,229,160,.25)} 50%{box-shadow:0 0 32px rgba(0,229,160,.55)} }
  @keyframes scanline { 0%{top:-10%} 100%{top:110%} }

  .fade-up   { animation: fadeUp .45s cubic-bezier(.22,1,.36,1) both; }
  .fade-in   { animation: fadeIn .35s ease both; }
  .pop-in    { animation: popIn .5s cubic-bezier(.22,1,.36,1) both; }

  .btn-pay {
    background: #00E5A0;
    color: #07090F;
    border: none;
    padding: 17px 0;
    width: 100%;
    border-radius: 10px;
    font-family: 'Syne', sans-serif;
    font-weight: 700;
    font-size: 17px;
    cursor: pointer;
    letter-spacing: .4px;
    transition: transform .15s, box-shadow .15s, opacity .15s;
  }
  .btn-pay:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 28px rgba(0,229,160,.35); }
  .btn-pay:active:not(:disabled){ transform:translateY(0); }
  .btn-pay:disabled { opacity:.55; cursor:not-allowed; }

  .btn-ghost {
    background: transparent;
    color: #00E5A0;
    border: 1px solid rgba(0,229,160,.35);
    padding: 10px 22px;
    border-radius: 8px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    cursor: pointer;
    transition: border-color .2s, background .2s;
  }
  .btn-ghost:hover { border-color: #00E5A0; background: rgba(0,229,160,.07); }

  .select-action {
    background: #0E1117;
    border: 1px solid rgba(255,255,255,.1);
    color: #E8E8E8;
    border-radius: 8px;
    padding: 13px 16px;
    width: 100%;
    font-family: 'Syne', sans-serif;
    font-size: 15px;
    cursor: pointer;
    outline: none;
    appearance: none;
    transition: border-color .2s;
  }
  .select-action:focus { border-color: rgba(0,229,160,.5); }

  .step-row { display:flex; align-items:center; gap:14px; padding:12px 0; }
  .step-dot  {
    width:32px; height:32px; border-radius:50%; flex-shrink:0;
    display:flex; align-items:center; justify-content:center;
    font-size:13px; font-weight:700; transition: all .4s;
  }
  .step-dot.done    { background:#00E5A0; color:#07090F; }
  .step-dot.active  { background:rgba(0,229,160,.12); border:2px solid #00E5A0; animation: glow 1.5s ease infinite; }
  .step-dot.pending { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.12); color:#444; }

  .proof-row {
    display:flex; justify-content:space-between; align-items:center;
    padding:9px 0; border-bottom:1px solid rgba(255,255,255,.05);
  }
  .proof-row:last-child { border-bottom:none; }

  .nft-card {
    border-radius:12px; overflow:hidden; border:1px solid rgba(0,229,160,.2);
    animation: popIn .6s cubic-bezier(.22,1,.36,1) both;
  }
  .nft-shimmer {
    height:180px;
    background: linear-gradient(135deg, #0E1B1B 25%, #0A2E2A 50%, #0E1B1B 75%);
    background-size:400px 400px;
    animation: shimmer 2s linear infinite;
    position:relative; overflow:hidden;
  }
  .nft-shimmer::after {
    content:''; position:absolute; inset:0;
    background:linear-gradient(90deg,transparent,rgba(0,229,160,.06),transparent);
    animation: shimmer 1.8s linear infinite;
  }

  .content-reveal { transition: filter .7s ease, opacity .7s ease; }

  .vote-bar-track { height:8px; background:rgba(255,255,255,.07); border-radius:4px; overflow:hidden; }
  .vote-bar-fill  { height:100%; background:linear-gradient(90deg,#00E5A0,#00BFD8); border-radius:4px; animation:growBar 1.4s cubic-bezier(.22,1,.36,1) both; animation-delay:.2s; }

  .scan-line {
    position:absolute; left:0; right:0; height:2px;
    background:linear-gradient(90deg,transparent,rgba(0,229,160,.4),transparent);
    animation:scanline 2s linear infinite;
    pointer-events:none;
  }
`;
document.head.appendChild(globalStyle);

// ─── Constants ─────────────────────────────────────────────────────────────
const ACTIONS = [
  { id: "unlock", label: "🔓 Unlock Premium Content", desc: "Access gated research & docs" },
  { id: "mint",   label: "🖼  Mint NFT Receipt",       desc: "On-chain proof-of-payment NFT" },
  { id: "vote",   label: "🗳  DAO Vote",                desc: "Record vote on Algorand" },
];

const STEPS = [
  { id: "payment",  label: "Payment Verified",       sub: "UPI confirmation" },
  { id: "oracle",   label: "Oracle Signed Proof",    sub: "Ed25519 signature committed"  },
  { id: "chain",    label: "On-chain Verification",  sub: "Algorand smart contract pass" },
];

// ─── Razorpay loader ───────────────────────────────────────────────────────
function loadRazorpay() {
  return new Promise(resolve => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

// ─── Check icon ───────────────────────────────────────────────────────────
function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <polyline points="3,8 7,12 13,4" stroke="#07090F" strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray="24" strokeDashoffset="0"
        style={{ animation: "checkDraw .35s ease both" }} />
    </svg>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────
function Spinner({ size = 14, color = "#00E5A0" }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      border: `2px solid rgba(0,229,160,.2)`,
      borderTop: `2px solid ${color}`,
      animation: "spin .7s linear infinite", flexShrink: 0,
    }} />
  );
}

// ─── Step row ─────────────────────────────────────────────────────────────
function StepRow({ step, status, delay }) {
  return (
    <div className="step-row fade-up" style={{ animationDelay: `${delay}ms` }}>
      <div className={`step-dot ${status}`}>
        {status === "done"   ? <Check /> :
         status === "active" ? <Spinner size={13} /> :
         <span style={{ color: "#555", fontSize: 12 }}>{step.id === "payment" ? "1" : step.id === "oracle" ? "2" : "3"}</span>}
      </div>
      <div>
        <div style={{ color: status === "pending" ? "#555" : "#E8E8E8", fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: 14, transition: "color .3s" }}>
          {step.label}
        </div>
        <div style={{ color: "#444", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, marginTop: 2 }}>
          {step.sub}
        </div>
      </div>
    </div>
  );
}

// ─── Action result cards ───────────────────────────────────────────────────
function UnlockResult() {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setRevealed(true), 300); return () => clearTimeout(t); }, []);
  return (
    <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid rgba(0,229,160,.18)", position: "relative" }}>
      <div style={{ background: "#0A0F1A", padding: "20px 20px 16px" }}>
        <div style={{ color: "#00E5A0", fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: "1.5px", marginBottom: 10 }}>UNLOCKED · PREMIUM ACCESS</div>
        <div className="content-reveal" style={{ filter: revealed ? "none" : "blur(8px)", opacity: revealed ? 1 : 0.3 }}>
          <div style={{ color: "#E8E8E8", fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
            AlgoPay Oracle — Technical Deep Dive
          </div>
          <div style={{ color: "#6B7280", fontSize: 13, lineHeight: 1.7 }}>
            The oracle holds an Ed25519 keypair. Every verified payment is signed and anchored on-chain via a NoOp app call to the AlgoPayOracle contract. The contract runs <code style={{ color: "#00E5A0", fontSize: 12 }}>ed25519verify_bare</code> — no valid oracle key, no action. Payment IDs are stored in box storage, making replays cryptographically impossible.
          </div>
        </div>
      </div>
      {!revealed && <div className="scan-line" />}
    </div>
  );
}

function MintResult({ txId }) {
  return (
    <div className="nft-card">
      <div className="nft-shimmer" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⬡</div>
          <div style={{ color: "#00E5A0", fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: "2px" }}>ALGOPAY · NFT</div>
        </div>
      </div>
      <div style={{ background: "#0A1410", padding: "14px 16px" }}>
        <div style={{ color: "#E8E8E8", fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
          UPI Receipt NFT
        </div>
        <div style={{ color: "#4B5563", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
          Token ID · {txId ? txId.slice(0,10) : "—"}
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          {["UPINFT","ARC-69","Testnet"].map(tag => (
            <span key={tag} style={{ background: "rgba(0,229,160,.08)", color: "#00E5A0", border: "1px solid rgba(0,229,160,.2)", borderRadius: 4, padding: "2px 8px", fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>{tag}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function VoteResult() {
  return (
    <div style={{ background: "#0A0F1A", border: "1px solid rgba(0,229,160,.15)", borderRadius: 10, padding: "18px 18px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ color: "#E8E8E8", fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14 }}>Proposal #AIP-42</div>
        <span style={{ background: "rgba(0,229,160,.1)", color: "#00E5A0", border: "1px solid rgba(0,229,160,.25)", borderRadius: 20, padding: "3px 12px", fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>RECORDED</span>
      </div>
      <div style={{ color: "#6B7280", fontSize: 12, fontFamily: "'JetBrains Mono',monospace", marginBottom: 14 }}>"Enable oracle-gated DAO actions on Algorand"</div>
      <div style={{ marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "#9CA3AF", fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>FOR</span>
        <span style={{ color: "#00E5A0", fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>73%</span>
      </div>
      <div className="vote-bar-track"><div className="vote-bar-fill" style={{ width: "73%" }} /></div>
      <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "#4B5563", fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>Your vote added on-chain</span>
        <span style={{ color: "#4B5563", fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>238 votes</span>
      </div>
    </div>
  );
}

// ─── Proof verification panel ──────────────────────────────────────────────
function ProofPanel({ txId }) {
  const [verifying, setVerifying] = useState(false);
  const [result,    setResult]    = useState(null);

  const verify = async () => {
    setVerifying(true);
    try {
      const r = await fetch(`${API}/verify-proof/${txId}`).then(r => r.json());
      setResult(r);
    } catch { setResult({ valid: false, reason: "network error" }); }
    setVerifying(false);
  };

  return (
    <div style={{ background: "#080C14", border: "1px solid rgba(255,255,255,.06)", borderRadius: 10, padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: result ? 14 : 0 }}>
        <span style={{ color: "#9CA3AF", fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 600 }}>Proof Verification</span>
        <button className="btn-ghost" onClick={verify} disabled={verifying}>
          {verifying ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Spinner size={11} />Verifying</span> : "Verify Proof"}
        </button>
      </div>

      {result && (
        <div className="fade-up">
          <ProofRow label="Signature" value={result.valid ? "✓ Valid" : "✗ Invalid"} accent={result.valid} />
          {result.valid && result.proof && (
            <>
              <ProofRow label="Amount"    value={`₹${result.proof.amount} ${result.proof.currency}`} />
              <ProofRow label="Action"    value={result.proof.action} />
              <ProofRow label="Oracle"    value={result.proof.oracle_address?.slice(0,12) + "..."} />
              <ProofRow label="Timestamp" value={new Date(result.proof.timestamp * 1000).toLocaleTimeString()} />
            </>
          )}
          {!result.valid && <div style={{ color: "#EF4444", fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginTop: 8 }}>{result.reason}</div>}
        </div>
      )}
    </div>
  );
}

function ProofRow({ label, value, accent }) {
  return (
    <div className="proof-row">
      <span style={{ color: "#555", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{label}</span>
      <span style={{ color: accent ? "#00E5A0" : "#9CA3AF", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{value}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [screen,  setScreen]  = useState("landing");   // landing | processing | success
  const [action,  setAction]  = useState("unlock");
  const [stepIdx, setStepIdx] = useState(-1);           // which step is active (-1 = none)
  const [done,    setDone]    = useState([]);           // completed step ids
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState("");
  const stepTimer = useRef(null);

  const selectedAction = ACTIONS.find(a => a.id === action);

  // ── Step animation engine ────────────────────────────────────────────────
  const runSteps = (data) => {
    const delays = [0, 1400, 2800];
    setStepIdx(0);

    delays.forEach((delay, i) => {
      stepTimer.current = setTimeout(() => {
        setDone(prev => [...prev, STEPS[i].id]);
        if (i < STEPS.length - 1) setStepIdx(i + 1);
        else {
          setStepIdx(-1);
          setTimeout(() => { setResult(data); setScreen("success"); }, 500);
        }
      }, delay + 1000);
    });
  };

  // ── Razorpay flow ─────────────────────────────────────────────────────────
  const handlePay = async () => {
    setError("");

    // Load Razorpay script
    const loaded = await loadRazorpay();

    // Create order
    let orderData;
    try {
      orderData = await fetch(`${API}/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 100, currency: "INR" }),
      }).then(r => r.json());
    } catch (e) {
      setError("Backend unreachable — is it running?");
      return;
    }

    const afterPayment = async (razorpayFields) => {
      setScreen("processing");
      setDone([]);
      setStepIdx(0);

      try {
        const res = await fetch(`${API}/verify-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount:   100,
            currency: "INR",
            action,
            ...razorpayFields,
          }),
        }).then(r => r.json());

        if (!res.success) throw new Error(res.message || "Verification failed");
        runSteps(res);
      } catch (e) {
        setError(e.message);
        setScreen("landing");
      }
    };

    // Demo mode (no Razorpay keys configured)
    if (orderData.provider === "demo" || !loaded || !orderData.key_id) {
      await afterPayment({});
      return;
    }

    // Real Razorpay Checkout
    const rzp = new window.Razorpay({
      key:          orderData.key_id,
      amount:       10000,    // paise
      currency:     "INR",
      name:         "AlgoPay Oracle",
      description:  selectedAction.desc,
      order_id:     orderData.order_id,
      theme:        { color: "#00E5A0" },
      handler: async (response) => {
        await afterPayment({
          razorpay_order_id:   response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature:  response.razorpay_signature,
        });
      },
      modal: { ondismiss: () => {} },
    });
    rzp.open();
  };

  const reset = () => {
    clearTimeout(stepTimer.current);
    setScreen("landing"); setDone([]); setStepIdx(-1); setResult(null); setError("");
  };

  const stepStatus = (step) => {
    if (done.includes(step.id)) return "done";
    if (STEPS[stepIdx]?.id === step.id) return "active";
    return "pending";
  };

  // ──────────────────────────────────────────────────────────────────────────
  const c = {
    page: {
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#07090F", fontFamily: "'Syne', sans-serif", padding: "24px",
    },
    card: {
      width: "100%", maxWidth: 440,
      background: "#0C0F18",
      border: "1px solid rgba(255,255,255,.07)",
      borderRadius: 18,
      overflow: "hidden",
      boxShadow: "0 32px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(0,229,160,.04)",
    },
  };

  // ── LANDING ─────────────────────────────────────────────────────────────
  if (screen === "landing") return (
    <div style={c.page}>
      <div style={c.card} className="fade-up">

        {/* Header */}
        <div style={{ padding: "28px 28px 0", borderBottom: "1px solid rgba(255,255,255,.05)", paddingBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(0,229,160,.1)", border: "1px solid rgba(0,229,160,.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⬡</div>
            <span style={{ color: "#00E5A0", fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: "2px" }}>ALGOPAY ORACLE</span>
          </div>
          <h1 style={{ color: "#F0F0F0", fontSize: 26, fontWeight: 800, lineHeight: 1.2, marginBottom: 6 }}>
            Pay with UPI.<br />Trigger Web3 Actions.
          </h1>
          <p style={{ color: "#4B5563", fontSize: 13, lineHeight: 1.6 }}>
            Fiat payment → Ed25519 signed proof → Algorand smart contract.
          </p>
        </div>

        {/* Action selector */}
        <div style={{ padding: "22px 28px 0" }}>
          <div style={{ color: "#6B7280", fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: "1.5px", marginBottom: 8 }}>SELECT ACTION</div>
          <div style={{ position: "relative" }}>
            <select className="select-action" value={action} onChange={e => setAction(e.target.value)}>
              {ACTIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
            <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#555" }}>▾</div>
          </div>
          <div style={{ color: "#374151", fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginTop: 7 }}>
            {selectedAction.desc}
          </div>
        </div>

        {/* Pay button */}
        <div style={{ padding: "20px 28px 8px" }}>
          <button className="btn-pay" onClick={handlePay}>
            Pay ₹100 →
          </button>
        </div>

        {error && (
          <div style={{ margin: "0 28px 8px", padding: "10px 14px", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 8, color: "#EF4444", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
            {error}
          </div>
        )}

        {/* Footer note */}
        <div style={{ padding: "14px 28px 22px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00E5A0", animation: "pulse 2s ease infinite" }} />
          <span style={{ color: "#374151", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
            Powered by Algorand TestNet
          </span>
        </div>
      </div>
    </div>
  );

  // ── PROCESSING ───────────────────────────────────────────────────────────
  if (screen === "processing") return (
    <div style={c.page}>
      <div style={{ ...c.card, padding: "32px 28px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", border: "2px solid rgba(0,229,160,.2)", borderTop: "2px solid #00E5A0", animation: "spin .9s linear infinite", margin: "0 auto 18px" }} />
          <div style={{ color: "#E8E8E8", fontWeight: 700, fontSize: 18 }}>Verifying on-chain</div>
          <div style={{ color: "#4B5563", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, marginTop: 4 }}>
            {selectedAction.label}
          </div>
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,.05)", paddingTop: 20 }}>
          {STEPS.map((step, i) => (
            <StepRow key={step.id} step={step} status={stepStatus(step)} delay={i * 80} />
          ))}
        </div>
      </div>
    </div>
  );

  // ── SUCCESS ───────────────────────────────────────────────────────────────
  if (screen === "success" && result) return (
    <div style={c.page}>
      <div style={{ ...c.card }} className="fade-up">

        {/* Success header */}
        <div style={{ background: "linear-gradient(135deg, #080F0C 0%, #0A1510 100%)", padding: "28px 28px 22px", borderBottom: "1px solid rgba(0,229,160,.1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#00E5A0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <polyline points="4,10 8,14 16,6" stroke="#07090F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div style={{ color: "#00E5A0", fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: "1.5px" }}>VERIFIED ON-CHAIN</div>
              <div style={{ color: "#E8E8E8", fontWeight: 700, fontSize: 18, marginTop: 2 }}>{selectedAction.label}</div>
            </div>
          </div>

          {/* Tx details */}
          <div style={{ background: "rgba(0,0,0,.3)", borderRadius: 8, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            <ProofRow label="Payment ID" value={result.payment_id?.slice(-14)} />
            <ProofRow label="Algo Txn"   value={result.txId ? result.txId.slice(0,8) + "..." + result.txId.slice(-6) : "—"} />
            <ProofRow label="Network"    value="Algorand TestNet" accent />
          </div>

          {result.explorerUrl && (
            <a href={result.explorerUrl} target="_blank" rel="noreferrer"
              style={{ display: "block", marginTop: 12, textAlign: "center", color: "#00E5A0", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, textDecoration: "none", padding: "10px", background: "rgba(0,229,160,.07)", borderRadius: 8, border: "1px solid rgba(0,229,160,.15)", transition: "background .2s" }}
              onMouseOver={e => e.target.style.background = "rgba(0,229,160,.13)"}
              onMouseOut={e  => e.target.style.background = "rgba(0,229,160,.07)"}
            >
              🔗 View Transaction on Lora ↗
            </a>
          )}
        </div>

        {/* Action result */}
        <div style={{ padding: "20px 28px" }}>
          <div style={{ color: "#6B7280", fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: "1.5px", marginBottom: 12 }}>RESULT</div>
          {action === "unlock" && <UnlockResult />}
          {action === "mint"   && <MintResult txId={result.txId} />}
          {action === "vote"   && <VoteResult />}
        </div>

        {/* Proof verification */}
        <div style={{ padding: "0 28px 18px" }}>
          {result.txId && <ProofPanel txId={result.txId} />}
        </div>

        {/* Reset */}
        <div style={{ padding: "0 28px 24px" }}>
          <button className="btn-pay" style={{ background: "transparent", color: "#4B5563", border: "1px solid rgba(255,255,255,.08)", fontSize: 14 }} onClick={reset}>
            ← Try another action
          </button>
        </div>

      </div>
    </div>
  );

  return null;
}
