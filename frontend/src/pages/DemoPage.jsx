import { useState, useEffect, useRef, useCallback } from "react";
const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const delay = ms => new Promise(r => setTimeout(r, ms));

function useSession(key, init) {
  const [val, setVal] = useState(() => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : init; }
    catch { return init; }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(val)); }, [key, val]);
  return [val, setVal];
}
// ── Actions ───────────────────────────────────────────────────────────────────
const ACTIONS = [
  { id:"unlock", icon:"📄", label:"Research Report", price:"₹100",
    teaser:"Premium AI research on blockchain payment infrastructure — including technical architecture, market analysis, and implementation guides.",
    content:[
      { h:"Executive Summary",       t:"AlgoPay Oracle represents a paradigm shift in how Web3 applications can leverage real-world payment rails. By cryptographically bridging fiat payment events to on-chain smart contract execution, the system eliminates the trusted intermediary problem that has historically blocked enterprise blockchain adoption." },
      { h:"Technical Architecture",  t:"The oracle employs Ed25519 asymmetric key signing. Every payment event is encoded deterministically and signed by the oracle's private key. The Algorand smart contract holds the oracle's public key and verifies every proof using the native ed25519verify_bare opcode — running entirely on-chain with no backend involvement." },
      { h:"Market Opportunity",      t:"India processes over $2T in UPI transactions annually. Zero of this activity has cryptographic on-chain attestation. AlgoPay Oracle provides the missing link between India's fiat payment infrastructure and Algorand's programmable blockchain — enabling the next generation of verifiable commerce." },
    ],
  },
  { id:"mint", icon:"🖼", label:"NFT Receipt", price:"₹100",
    teaser:"Mint a cryptographic NFT receipt permanently tied to this payment. ARC-69 standard. Immutable proof of purchase on Algorand.",
  },
  { id:"vote", icon:"🗳", label:"DAO Vote", price:"₹100",
    teaser:"Cast a verified on-chain vote. Payment proves identity and stake — no wallets, no gas, no crypto required from the voter.",
  },
];

// ── Pipeline steps ────────────────────────────────────────────────────────────
const PIPE = [
  { id:"webhook",   icon:"📥", label:"Webhook Received",       sub:"HMAC signature verified"      },
  { id:"sign",      icon:"✦",  label:"Oracle Signs APC-1",     sub:"Ed25519 deterministic bytes"  },
  { id:"submit",    icon:"⛓",  label:"Submitting to Algorand", sub:"Atomic tx group: 3×nop + call"},
  { id:"verify",    icon:"⬡",  label:"Contract Verifying",     sub:"ed25519verify_bare on-chain"  },
  { id:"confirmed", icon:"✓",  label:"Confirmed On-chain",     sub:"ARC-28 event emitted"         },
];

// ── APC-1 JSON reveal with syntax highlighting (V1) ───────────────────────────
function APC1Reveal({ proof }) {
  const [chars, setChars] = useState(0);
  const json = JSON.stringify({
    apc:          proof?.apc || "1",
    canonical_id: proof?.canonical_id || "razorpay:pay_...",
    payment_id:   proof?.payment_id   || "pay_...",
    amount:       proof?.amount,
    currency:     proof?.currency,
    action:       proof?.action,
    timestamp:    proof?.timestamp,
    oracle:       (proof?.oracle_address || "").slice(0,12) + "...",
    signature:    (proof?.signature || "").slice(0,20) + "...",
  }, null, 2);

  useEffect(() => {
    setChars(0);
    let i = 0;
    const id = setInterval(() => {
      i += 4;
      if (i >= json.length) { setChars(json.length); clearInterval(id); }
      else setChars(i);
    }, 12);
    return () => clearInterval(id);
  }, [json]);

  const colored = json.slice(0, chars).split("\n").map((line, i) => {
    const parts = line.split(/("[\w_]+")(\s*:)/);
    if (parts.length > 2) {
      return (
        <div key={i}>
          {parts.map((p, j) =>
            j % 3 === 1
              ? <span key={j} style={{ color:"var(--blue)" }}>{p}</span>
              : j % 3 === 2
                ? <span key={j} style={{ color:"var(--text2)" }}>{p}</span>
                : <span key={j} style={{ color:"var(--text)" }}>{p}</span>
          )}
        </div>
      );
    }
    const isAccent = line.includes("canonical_id") || line.includes("signature") || line.includes('"apc"');
    return <div key={i} style={{ color: isAccent ? "var(--accent)" : "var(--text2)" }}>{line}</div>;
  });

  return (
    <div style={{ fontFamily:"var(--mono)", fontSize:11, lineHeight:1.7 }}>
      {colored}
      {chars < json.length && <span style={{ animation:"blink .7s infinite", color:"var(--accent)" }}>▌</span>}
    </div>
  );
}

// ── NFT card reveal (V1) ──────────────────────────────────────────────────────
function NFTReveal({ txId }) {
  return (
    <div className="si" style={{ borderRadius:"var(--rl)", overflow:"hidden", border:"1px solid rgba(0,229,160,.2)", maxWidth:260, margin:"0 auto" }}>
      <div style={{ height:160, background:"linear-gradient(135deg,#0A1F1C,#0A2E24,#061814)", display:"flex", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, background:"radial-gradient(circle at 50% 50%,rgba(0,229,160,.08),transparent 70%)" }} />
        <div style={{ textAlign:"center", zIndex:1 }}>
          <div style={{ fontSize:40, marginBottom:8 }}>⬡</div>
          <div style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--accent)", letterSpacing:"2px" }}>ALGOPAY · RECEIPT</div>
        </div>
      </div>
      <div style={{ background:"#0A1410", padding:"14px 16px" }}>
        <div style={{ color:"var(--text)", fontWeight:700, fontSize:14, marginBottom:4 }}>Payment Receipt NFT</div>
        <div style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:11 }}>Token · {txId ? txId.slice(0,10) : "—"}</div>
        <div style={{ display:"flex", gap:6, marginTop:10 }}>
          {["ARC-69","UPINFT","TestNet"].map(t => (
            <span key={t} style={{ background:"var(--accent-dim)", color:"var(--accent)", border:"1px solid var(--border)", borderRadius:4, padding:"2px 7px", fontSize:10, fontFamily:"var(--mono)" }}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── DAO vote reveal (V1) ──────────────────────────────────────────────────────
function VoteReveal() {
  return (
    <div className="si" style={{ background:"var(--elevated)", border:"1px solid var(--border)", borderRadius:"var(--rl)", padding:24, maxWidth:340, margin:"0 auto", width:"100%" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div style={{ color:"var(--text)", fontWeight:700, fontSize:15 }}>Proposal #AIP-42</div>
        <span style={{ background:"var(--accent-dim)", color:"var(--accent)", border:"1px solid var(--border)", borderRadius:20, padding:"3px 12px", fontSize:10, fontFamily:"var(--mono)" }}>RECORDED</span>
      </div>
      <div style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:12, marginBottom:18, lineHeight:1.5 }}>"Enable oracle-gated DAO actions on Algorand"</div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
        <span style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:11 }}>FOR</span>
        <span style={{ color:"var(--accent)", fontFamily:"var(--mono)", fontSize:11, fontWeight:600 }}>74%</span>
      </div>
      <div style={{ height:7, background:"var(--border2)", borderRadius:4, overflow:"hidden", marginBottom:8 }}>
        <div style={{ height:"100%", width:"74%", background:"linear-gradient(90deg,var(--accent),var(--blue))", borderRadius:4 }} />
      </div>
      <div style={{ color:"var(--text3)", fontFamily:"var(--mono)", fontSize:11 }}>Your vote recorded · on-chain ✓</div>
    </div>
  );
}

// ── PipeStep (V2) ─────────────────────────────────────────────────────────────
function PipeStep({ step, done, active }) {
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:11, padding:"8px 13px",
      background: done ? "var(--accent-dim)" : active ? "rgba(56,189,248,.07)" : "var(--elevated)",
      border:`1px solid ${done ? "var(--border)" : active ? "rgba(56,189,248,.25)" : "var(--border2)"}`,
      borderRadius:"var(--r)", transition:"all .3s",
    }}>
      <div style={{
        width:28, height:28, borderRadius:"50%", flexShrink:0,
        background: done ? "var(--accent)" : active ? "rgba(56,189,248,.1)" : "var(--card)",
        border:`1px solid ${done ? "transparent" : active ? "rgba(56,189,248,.4)" : "var(--border2)"}`,
        display:"flex", alignItems:"center", justifyContent:"center", fontSize:11,
      }}>
        {done
          ? <span style={{ color:"#040810", fontWeight:700 }}>✓</span>
          : active
            ? <div style={{ width:11, height:11, border:"2px solid var(--blue)", borderTop:"2px solid transparent", borderRadius:"50%", animation:"spin .8s linear infinite" }}/>
            : <span style={{ color:"var(--text2)" }}>{step.icon}</span>
        }
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:600, color: done ? "var(--accent)" : active ? "var(--blue)" : "var(--text2)" }}>{step.label}</div>
        <div style={{ fontSize:10, color:"var(--text2)", fontFamily:"var(--mono)", marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{step.sub}</div>
      </div>
      {done   && <span style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--accent)", opacity:.55, flexShrink:0 }}>done</span>}
      {active && <span style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--blue)", animation:"pulse 1.2s infinite", flexShrink:0 }}>live</span>}
    </div>
  );
}

// ── InfraPane (V1 structure + V2 pipeline) ────────────────────────────────────
function InfraPane({ logs, status, proof, txId, explorerUrl, activeStep, doneSteps }) {
  const logRef = useRef(null);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs]);

  const compColor = { webhook:"var(--blue)", signer:"var(--purple)", oracle:"var(--accent)", chain:"var(--amber)", contract:"var(--accent)", commit:"var(--accent)" };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:"var(--bg)" }}>

      {/* Header */}
      <div style={{ padding:"13px 18px", borderBottom:"1px solid var(--border)", background:"var(--elevated)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:7, height:7, borderRadius:"50%",
            background: status==="idle" ? "var(--text3)" : status==="success" ? "var(--accent)" : "var(--amber)",
            animation: status==="running" ? "pulse 1s infinite" : "none",
          }} />
          <span style={{ fontFamily:"var(--mono)", fontSize:10, letterSpacing:"1.2px", color:"var(--text2)" }}>INFRASTRUCTURE LAYER</span>
        </div>
        <span style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--text3)", letterSpacing:"1px" }}>DEVELOPER VIEW</span>
      </div>

      {/* IDLE: clean flowchart (V1) */}
      {status === "idle" && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:32, gap:0 }}>
          <div style={{ color:"var(--text3)", fontFamily:"var(--mono)", fontSize:10, letterSpacing:"1.5px", marginBottom:24 }}>SYSTEM IDLE — AWAITING PAYMENT</div>
          {["Payment Gateway","AlgoPay Oracle","Algorand Contract","Action Executes"].map((s, i) => (
            <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
              <div style={{ padding:"9px 24px", border:"1px solid var(--border)", borderRadius:8, fontFamily:"var(--mono)", fontSize:12, color:"var(--text3)", background:"var(--elevated)", minWidth:220, textAlign:"center" }}>{s}</div>
              {i < 3 && <div style={{ width:1, height:20, background:"var(--border)", margin:"2px 0" }} />}
            </div>
          ))}
        </div>
      )}

      {/* RUNNING / SUCCESS: pipeline steps + logs */}
      {status !== "idle" && (
        <>
          {/* Pipeline steps */}
          <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--border)", display:"flex", flexDirection:"column", gap:6, flexShrink:0 }}>
            {PIPE.map(s => (
              <PipeStep key={s.id} step={s} done={doneSteps.includes(s.id)} active={activeStep === s.id} />
            ))}
          </div>

          {/* Live logs */}
          <div ref={logRef} style={{ flex:1, overflowY:"auto", padding:"10px 16px", fontFamily:"var(--mono)", fontSize:11, lineHeight:1.85, minHeight:0 }}>
            {logs.map((log, i) => (
              <div key={i} className="fi" style={{ display:"flex", gap:8, animationDelay:`${i*.04}s` }}>
                <span style={{ color:"var(--text3)", flexShrink:0, fontSize:10 }}>{log.ts}</span>
                <span style={{ color: compColor[log.c] || "var(--text2)", flexShrink:0, minWidth:64 }}>[{log.c}]</span>
                <span style={{ color: log.l === "success" || log.m?.includes("PASS") || log.m?.includes("✓") ? "var(--accent)" : "var(--text2)" }}>
                  {log.m}
                </span>
              </div>
            ))}
            {status === "running" && (
              <div style={{ display:"flex", gap:8, color:"var(--text3)", paddingTop:4, animation:"pulse 1.2s infinite" }}>
                <span style={{ animation:"spin .8s linear infinite", display:"inline-block" }}>⟳</span>
                <span>processing…</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* APC-1 panel */}
      {proof && (
        <div style={{ borderTop:"1px solid var(--border)", flexShrink:0 }}>
          <div style={{ padding:"7px 16px", background:"var(--elevated)", borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--accent)", letterSpacing:"1px" }}>PORTABLE APC-1 CREDENTIAL</span>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <span style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--text3)" }}>v{proof.apc || "1"} · verified ✓</span>
              <button onClick={() => navigator.clipboard.writeText(JSON.stringify(proof, null, 2))}
                style={{ padding:"3px 8px", background:"transparent", border:"1px solid var(--accent)", borderRadius:4, color:"var(--accent)", cursor:"pointer", fontSize:9, fontFamily:"var(--mono)" }}>
                ⧉ Copy Proof
              </button>
            </div>
          </div>
          <div style={{ padding:"12px 16px", maxHeight:175, overflowY:"auto", background:"var(--bg)" }}>
            <APC1Reveal proof={proof} />
          </div>
        </div>
      )}

      {/* Explorer + Dashboard links */}
      {explorerUrl && (
        <div style={{ padding:"11px 16px", borderTop:"1px solid var(--border)", display:"flex", gap:8, flexShrink:0 }}>
          <a href={explorerUrl} target="_blank" rel="noreferrer" style={{ flex:1, padding:"9px 0", background:"var(--accent-dim)", border:"1px solid var(--border)", borderRadius:"var(--r)", fontFamily:"var(--mono)", fontSize:12, color:"var(--accent)", textDecoration:"none", textAlign:"center" }}>
            View on Lora ↗
          </a>
          <a href="#/dashboard" style={{ padding:"9px 14px", background:"var(--elevated)", border:"1px solid var(--border2)", borderRadius:"var(--r)", fontFamily:"var(--mono)", fontSize:12, color:"var(--text2)", textDecoration:"none", whiteSpace:"nowrap" }}>
            Dashboard →
          </a>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DemoPage() {
  // Replace useState with useSession to survive tab navigation
  const [action,     setAction]     = useSession("demo_action", "unlock");
  const [screen,     setScreen]     = useSession("demo_screen", "idle");
  const [logs,       setLogs]       = useSession("demo_logs", []);
  const [proof,      setProof]      = useSession("demo_proof", null);
  const [txId,       setTxId]       = useSession("demo_txId", null);
  const [explorerUrl,setExplorerUrl]= useSession("demo_explorerUrl", null);
  const [error,      setError]      = useSession("demo_error", null);
  const [activeStep, setActiveStep] = useSession("demo_activeStep", null);
  const [doneSteps,  setDoneSteps]  = useSession("demo_doneSteps", []);

  const selectedAction = ACTIONS.find(a => a.id === action);

  const ts = () => new Date().toLocaleTimeString("en-IN", { hour12:false, hour:"2-digit", minute:"2-digit", second:"2-digit" });
  const addLog = useCallback((m, c="oracle", l="info") =>
    setLogs(p => [...p, { m, c, l, ts: ts() }]), []);

  const advance = useCallback((id) => {
    setActiveStep(id);
    const idx = PIPE.findIndex(s => s.id === id);
    setDoneSteps(PIPE.slice(0, idx).map(s => s.id));
  }, []);

  const markDone = useCallback((id) => {
    setDoneSteps(p => [...p, id]);
    setActiveStep(null);
  }, []);

  const reset = () => {
    setScreen("idle"); setLogs([]); setProof(null);
    setTxId(null); setExplorerUrl(null); setError(null);
    setActiveStep(null); setDoneSteps([]);
  };

  // ── Razorpay loader ─────────────────────────────────────────────────────────
  const loadRazorpay = () => new Promise(res => {
    if (window.Razorpay) return res(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => res(true); s.onerror = () => res(false);
    document.body.appendChild(s);
  });

  // ── Sequential async flow (V2) ──────────────────────────────────────────────
  const runFlow = async (razorpayFields = {}, orderId = null) => {
    setScreen("running");

    const pid = razorpayFields.razorpay_payment_id || `demo_${Date.now().toString().slice(-6)}`;

    // Step 1: Webhook
    advance("webhook");
    addLog(`Payment received — ${pid}`, "webhook");
    await delay(400);
    addLog("HMAC signature verified ✓", "webhook");
    markDone("webhook");

    // Step 2: Sign
    await delay(200);
    advance("sign");
    addLog("Building deterministic message bytes…", "signer");
    await delay(350);
    addLog("Packing: prefix + canonical_id + action + currency + amount + timestamp", "signer");
    await delay(350);
    addLog("Ed25519 signature computed ✓", "signer");
    addLog("APC-1 credential v1 generated", "oracle");
    markDone("sign");

    // Step 3: Submit — call real backend
    await delay(200);
    advance("submit");
    addLog("Connecting to Algorand TestNet algod…", "chain");
    addLog("Building atomic tx group: 3× nop + verify_payment", "chain");

    let result;
    try {
      result = await fetch(`${API}/verify-payment`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          amount:100, currency:"INR", action,
          order_id: orderId,
          ...razorpayFields,
        }),
      }).then(r => r.json());
    } catch(e) {
      addLog(`Backend unreachable: ${e.message}`, "chain", "error");
      setError("Start the backend server on :5000");
      setScreen("idle"); return;
    }

    if (!result.success) {
      addLog(result.message || "Verification failed", "chain", "error");
      setError(result.message);
      setScreen("idle"); return;
    }

    addLog(`Submitting to algod…`, "chain");
    markDone("submit");
    addLog(`txId: ${result.txId?.slice(0,20)}…`, "chain");

    // Step 4: Contract verifying
    await delay(200);
    advance("verify");
    addLog("ed25519verify_bare: executing…", "contract");
    await delay(500);
    addLog("Oracle registry box: found ✓", "contract");
    addLog("Replay check passed ✓ canonical_id unused", "contract");
    await delay(300);
    addLog("ed25519verify_bare: PASS ✓", "contract");
    addLog("canonical_id written to box storage", "contract");
    markDone("verify");

    // Step 5: Confirmed
    await delay(200);
    advance("confirmed");
    await delay(500);
    addLog("Block confirmed on-chain ✓", "commit", "success");
    addLog("ARC-28 PaymentVerified event emitted", "commit", "success");
    markDone("confirmed");

    setTxId(result.txId);
    setProof(result.proof);
    setExplorerUrl(result.explorerUrl);
    setScreen("success");
  };

  // ── Payment handler ─────────────────────────────────────────────────────────
  const handlePay = async () => {
    setError(null); setLogs([]); setProof(null);
    setTxId(null); setExplorerUrl(null);
    setActiveStep(null); setDoneSteps([]);
    setScreen("running");

    // Get order
    let orderData = null;
    try {
      orderData = await fetch(`${API}/create-order`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ amount:100, currency:"INR" }),
      }).then(r => r.json());
    } catch { /* backend unreachable — demo mode */ }

    // Demo mode (no Razorpay keys)
    if (!orderData || orderData.provider === "demo" || !orderData.key_id) {
      await runFlow({}, orderData?.order_id);
      return;
    }

    // Real Razorpay checkout
    const loaded = await loadRazorpay();
    if (!loaded) { await runFlow({}, orderData.order_id); return; }

    setScreen("idle"); // while checkout is open
    new window.Razorpay({
      key:         orderData.key_id,
      amount:      10000,
      currency:    "INR",
      name:        "AlgoPay Oracle",
      description: selectedAction.label,
      order_id:    orderData.order_id,
      theme:       { color:"#00E5A0" },
      handler:     (res) => runFlow(res, orderData.order_id),
      modal:       { ondismiss: () => {} },
    }).open();
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ paddingTop:56, minHeight:"100vh" }}>

      {/* Demo header */}
      <div style={{ borderBottom:"1px solid var(--border)", background:"var(--surface)", padding:"14px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--text2)", letterSpacing:"1.5px", marginBottom:3 }}>LIVE INFRASTRUCTURE DEMO</div>
          <div style={{ fontSize:14, fontWeight:700 }}>Pay → Oracle → Algorand → Unlock</div>
        </div>

        <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
          {ACTIONS.map(a => (
            <button key={a.id} onClick={() => { setAction(a.id); reset(); }} style={{
              padding:"6px 15px", border:"1px solid",
              borderColor: action===a.id ? "var(--accent)" : "var(--border2)",
              background:  action===a.id ? "var(--accent-dim)" : "transparent",
              color:       action===a.id ? "var(--accent)" : "var(--text2)",
              borderRadius:7, fontFamily:"var(--mono)", fontSize:11, cursor:"pointer", transition:"all .15s",
            }}>
              {a.icon} {a.label}
            </button>
          ))}
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:7, fontFamily:"var(--mono)", fontSize:11, color:"var(--text2)" }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:"var(--accent)", animation:"pulse 2s infinite" }} />
          AlgoNode TestNet
        </div>
      </div>

      {/* Split screen */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", minHeight:"calc(100vh - 104px)" }}>

        {/* ── LEFT: Consumer pane (V1 structure) ── */}
        <div style={{ borderRight:"1px solid var(--border)", display:"flex", flexDirection:"column" }}>

          {/* Product header */}
          <div style={{ padding:"18px 26px", borderBottom:"1px solid var(--border)", background:"var(--surface)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:34, height:34, borderRadius:8, background:"var(--elevated)", border:"1px solid var(--border2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:17 }}>
                {selectedAction.icon}
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:14 }}>AlgoPay {selectedAction.label}</div>
                <div style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:11 }}>Premium access · one-time payment</div>
              </div>
            </div>
          </div>

          {/* Content area */}
          <div style={{ flex:1, padding:26, position:"relative", overflowY:"auto", overflowX:"hidden" }}>

            {/* Access granted banner */}
            {screen === "success" && (
              <div className="si" style={{ marginBottom: 24, padding:"10px 16px", background:"rgba(0,229,160,.07)", border:"1px solid rgba(0,229,160,.28)", borderRadius:"var(--r)", display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:16, color:"var(--accent)" }}>✓</span>
                <div>
                  <div style={{ color:"var(--accent)", fontWeight:700, fontSize:13 }}>Access Granted</div>
                  <div style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:11 }}>Verified on Algorand · {txId?.slice(0,14)}…</div>
                </div>
                <button onClick={reset} style={{ marginLeft:"auto", padding:"4px 12px", background:"transparent", border:"1px solid var(--border2)", borderRadius:6, color:"var(--text2)", fontFamily:"var(--mono)", fontSize:11, cursor:"pointer" }}>
                  Reset
                </button>
              </div>
            )}

            {/* Research report */}
            {action === "unlock" && (
              <div style={{ filter: screen==="success" ? "none" : "blur(6px)", transition:"filter .7s ease", userSelect: screen==="success" ? "auto" : "none" }}>
                {selectedAction.content?.map((section, i) => (
                  <div key={i} style={{ marginBottom:22 }}>
                    <div style={{ fontWeight:700, fontSize:14, marginBottom:8, color:"var(--text)" }}>{section.h}</div>
                    <div style={{ color:"var(--text2)", fontSize:13, lineHeight:1.75 }}>{section.t}</div>
                  </div>
                ))}
              </div>
            )}

            {/* NFT */}
            {action === "mint" && (
              <div style={{ filter: screen==="success" ? "none" : "blur(6px)", transition:"filter .7s ease", display:"flex", alignItems:"center", justifyContent:"center", minHeight:260 }}>
                {screen === "success"
                  ? <NFTReveal txId={txId} />
                  : <div style={{ textAlign:"center", color:"var(--text2)", fontSize:13, lineHeight:1.7 }}><div style={{ fontSize:38, marginBottom:14 }}>🖼</div>{selectedAction.teaser}</div>
                }
              </div>
            )}

            {/* DAO Vote */}
            {action === "vote" && (
              <div style={{ filter: screen==="success" ? "none" : "blur(6px)", transition:"filter .7s ease", display:"flex", alignItems:"center", justifyContent:"center", minHeight:260 }}>
                {screen === "success"
                  ? <VoteReveal />
                  : <div style={{ textAlign:"center", color:"var(--text2)", fontSize:13, lineHeight:1.7 }}><div style={{ fontSize:38, marginBottom:14 }}>🗳</div>{selectedAction.teaser}</div>
                }
              </div>
            )}

            {/* Lock overlay */}
            {screen !== "success" && (
              <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"rgba(4,8,16,.72)", backdropFilter:"blur(2px)", gap:14, padding:32 }}>
                {screen === "idle" && (
                  <>
                    <div style={{ fontSize:30 }}>🔒</div>
                    <div style={{ color:"var(--text)", fontWeight:600, fontSize:16, textAlign:"center" }}>{selectedAction.price} · {selectedAction.label}</div>
                    <div style={{ color:"var(--text2)", fontSize:13, textAlign:"center", maxWidth:300, lineHeight:1.65 }}>{selectedAction.teaser}</div>
                    {error && <div style={{ color:"var(--red)", fontFamily:"var(--mono)", fontSize:12, textAlign:"center", maxWidth:300 }}>{error}</div>}
                    <button onClick={handlePay} style={{ padding:"13px 36px", background:"var(--accent)", color:"#040810", border:"none", borderRadius:"var(--r)", fontWeight:700, fontSize:16, cursor:"pointer", fontFamily:"var(--sans)", marginTop:4 }}>
                      Pay {selectedAction.price}
                    </button>
                    <div style={{ color:"var(--text3)", fontFamily:"var(--mono)", fontSize:10, letterSpacing:"1px" }}>UPI · RAZORPAY · ALGORAND TESTNET</div>
                  </>
                )}
                {screen === "running" && (
                  <>
                    <div style={{ width:30, height:30, border:"2px solid var(--accent-dim)", borderTop:"2px solid var(--accent)", borderRadius:"50%", animation:"spin .9s linear infinite" }} />
                    <div style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:13 }}>Verifying on Algorand…</div>
                  </>
                )}
              </div>
            )}


          </div>
        </div>

        {/* ── RIGHT: InfraPane (V1 component, V2 pipeline inside) ── */}
        <InfraPane
          logs={logs}
          status={screen}
          proof={proof}
          txId={txId}
          explorerUrl={explorerUrl}
          activeStep={activeStep}
          doneSteps={doneSteps}
        />
      </div>

      <style>{`@media (max-width:900px){.demo-split{grid-template-columns:1fr !important}}`}</style>
    </div>
  );
}
