import { useState, useEffect, useRef } from "react";
const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

// ── Shared primitives ─────────────────────────────────────────────────────────
const Pill = ({ children, color = "var(--accent)" }) => (
  <span style={{ padding:"2px 9px", background:`${color}12`, color, border:`1px solid ${color}28`, borderRadius:12, fontFamily:"var(--mono)", fontSize:10, whiteSpace:"nowrap" }}>
    {children}
  </span>
);

const Card = ({ children, style }) => (
  <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--rl)", ...style }}>
    {children}
  </div>
);

const StatCard = ({ label, value, sub, accent }) => (
  <Card style={{ padding:"18px 20px" }}>
    <div style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:10, letterSpacing:"1px", marginBottom:8 }}>{label}</div>
    <div style={{ fontSize:28, fontWeight:700, color: accent || "var(--text)", fontFamily:"var(--mono)", marginBottom:4 }}>{value ?? "—"}</div>
    {sub && <div style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:11 }}>{sub}</div>}
  </Card>
);

function Spinner({ size = 16 }) {
  return <div style={{ width:size, height:size, border:"2px solid var(--border)", borderTop:"2px solid var(--accent)", borderRadius:"50%", animation:"spin .8s linear infinite", flexShrink:0 }} />;
}

// ── Tab nav ───────────────────────────────────────────────────────────────────
const TABS = [
  { id:"txns",    label:"Transactions"         },
  { id:"explorer",label:"Verification Explorer"},
  { id:"oracle",  label:"Oracle"               },
  { id:"logs",    label:"Live Logs"            },
  { id:"sdk",     label:"SDK Setup"            },
];

// ─────────────────────────────────────────────────────────────────────────────
//  TAB 1 — Transactions
// ─────────────────────────────────────────────────────────────────────────────
function TxnsTab({ stats }) {
  const [txns,    setTxns]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState({ provider:"", search:"" });
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/dashboard/transactions?limit=50`)
      .then(r => r.json())
      .then(d => { setTxns(d.transactions || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = txns.filter(t => {
    if (filter.provider && t.provider !== filter.provider) return false;
    if (filter.search) {
      const s = filter.search.toLowerCase();
      return t.canonical_id?.toLowerCase().includes(s) || t.txId?.toLowerCase().includes(s) || t.payment_id?.toLowerCase().includes(s);
    }
    return true;
  });

  const providers = [...new Set(txns.map(t => t.provider).filter(Boolean))];

  const providerColor = p => p === "razorpay" ? "var(--blue)" : p === "demo" ? "var(--purple)" : p === "stripe" ? "var(--amber)" : "var(--text2)";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {/* Stats row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        <StatCard label="TOTAL VERIFIED"  value={stats?.total_verified ?? "—"} accent="var(--accent)" sub="on Algorand TestNet" />
        <StatCard label="THIS SESSION"    value={txns.length}                  sub="loaded from indexer" />
        <StatCard label="ACTIVE ORACLES"  value={stats?.oracle_count ?? "—"}   sub="registered keys" />
        <StatCard label="CONTRACT"        value={stats?.app_id ? `#${stats.app_id}` : "—"} sub={stats?.network || "testnet"} />
      </div>

      {/* Filters */}
      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
        <input
          placeholder="Search by payment_id, canonical_id, txId…"
          value={filter.search}
          onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
          style={{ flex:1, padding:"9px 14px", background:"var(--elevated)", border:"1px solid var(--border)", borderRadius:"var(--r)", color:"var(--text)", fontFamily:"var(--mono)", fontSize:12, outline:"none" }}
        />
        <select
          value={filter.provider}
          onChange={e => setFilter(f => ({ ...f, provider: e.target.value }))}
          style={{ padding:"9px 14px", background:"var(--elevated)", border:"1px solid var(--border)", borderRadius:"var(--r)", color:"var(--text)", fontFamily:"var(--mono)", fontSize:12, outline:"none" }}
        >
          <option value="">All providers</option>
          {providers.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={() => { setLoading(true); fetch(`${API}/dashboard/transactions?limit=50`).then(r=>r.json()).then(d=>{setTxns(d.transactions||[]);setLoading(false)}).catch(()=>setLoading(false)); }}
          style={{ padding:"9px 16px", background:"var(--elevated)", border:"1px solid var(--border)", borderRadius:"var(--r)", color:"var(--text2)", fontFamily:"var(--mono)", fontSize:12, cursor:"pointer" }}>
          ↻ Refresh
        </button>
      </div>

      {/* Table */}
      <Card style={{ overflow:"hidden" }}>
        {/* Table header */}
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 80px 80px 1fr 90px", gap:0, padding:"10px 18px", borderBottom:"1px solid var(--border)", background:"var(--elevated)" }}>
          {["Canonical ID","Provider","Amount","Action","Tx ID","Time"].map(h => (
            <div key={h} style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:10, letterSpacing:"1px" }}>{h}</div>
          ))}
        </div>

        {loading && (
          <div style={{ padding:32, display:"flex", alignItems:"center", justifyContent:"center", gap:12 }}>
            <Spinner /> <span style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:12 }}>Loading from indexer…</span>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ padding:32, textAlign:"center", color:"var(--text2)", fontFamily:"var(--mono)", fontSize:12 }}>
            {txns.length === 0 ? "No verified transactions yet — run a demo payment first" : "No results match the filter"}
          </div>
        )}

        {!loading && filtered.map((t, i) => (
          <div key={t.txId} onClick={() => setSelected(selected?.txId === t.txId ? null : t)}
            style={{
              display:"grid", gridTemplateColumns:"2fr 1fr 80px 80px 1fr 90px", gap:0,
              padding:"12px 18px", borderBottom: i < filtered.length-1 ? "1px solid var(--border2)" : "none",
              cursor:"pointer", transition:"background .15s",
              background: selected?.txId === t.txId ? "var(--accent-dim)" : "transparent",
            }}
            onMouseEnter={e => { if (selected?.txId !== t.txId) e.currentTarget.style.background = "var(--elevated)"; }}
            onMouseLeave={e => { if (selected?.txId !== t.txId) e.currentTarget.style.background = "transparent"; }}
          >
            <div style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--accent)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", paddingRight:12 }}>{t.canonical_id}</div>
            <div><Pill color={providerColor(t.provider)}>{t.provider || "—"}</Pill></div>
            <div style={{ fontFamily:"var(--mono)", fontSize:12, color:"var(--text)" }}>₹{t.amount}</div>
            <div style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--text2)" }}>{t.action}</div>
            <div style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--text2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              <a href={t.explorer_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color:"var(--blue)", textDecoration:"none" }}>
                {t.txId?.slice(0,10)}…
              </a>
            </div>
            <div style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--text2)" }}>
              {t.timestamp ? new Date(t.timestamp * 1000).toLocaleTimeString("en-IN", { hour12:false }) : "—"}
            </div>
          </div>
        ))}
      </Card>

      {/* Transaction detail drawer */}
      {selected && (
        <Card style={{ padding:0, overflow:"hidden" }}>
          <div style={{ padding:"12px 18px", borderBottom:"1px solid var(--border)", background:"var(--elevated)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--accent)", letterSpacing:"1px" }}>TRANSACTION DETAIL</span>
            <button onClick={() => setSelected(null)} style={{ background:"transparent", border:"none", color:"var(--text2)", cursor:"pointer", fontSize:16 }}>×</button>
          </div>
          <div style={{ padding:20, display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
            <div>
              <div style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:10, letterSpacing:"1px", marginBottom:12 }}>PROOF FIELDS</div>
              {[
                ["payment_id",  selected.payment_id],
                ["canonical_id",selected.canonical_id],
                ["amount",      `₹${selected.amount} ${selected.currency}`],
                ["action",      selected.action],
                ["provider",    selected.provider],
                ["apc_version", selected.apc_version || "1"],
              ].map(([k,v]) => (
                <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid var(--border2)" }}>
                  <span style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:11 }}>{k}</span>
                  <span style={{ color:"var(--text)", fontFamily:"var(--mono)", fontSize:11 }}>{v}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:10, letterSpacing:"1px", marginBottom:12 }}>ON-CHAIN DATA</div>
              {[
                ["txId",    selected.txId],
                ["round",   selected.round?.toString()],
                ["time",    selected.timestamp ? new Date(selected.timestamp*1000).toLocaleString("en-IN") : "—"],
                ["network", "Algorand TestNet"],
              ].map(([k,v]) => (
                <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid var(--border2)" }}>
                  <span style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:11 }}>{k}</span>
                  <span style={{ color:"var(--text)", fontFamily:"var(--mono)", fontSize:11, maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", textAlign:"right" }}>{v}</span>
                </div>
              ))}
              <div style={{ marginTop:14 }}>
                <a href={selected.explorer_url} target="_blank" rel="noreferrer" style={{ display:"block", padding:"9px 0", background:"var(--accent-dim)", border:"1px solid var(--border)", borderRadius:"var(--r)", fontFamily:"var(--mono)", fontSize:12, color:"var(--accent)", textDecoration:"none", textAlign:"center" }}>
                  View on Lora Explorer ↗
                </a>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  TAB 2 — Verification Explorer
// ─────────────────────────────────────────────────────────────────────────────
function ExplorerTab() {
  const [txId,    setTxId]    = useState("");
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const verify = async () => {
    const input = txId.trim();
    if (!input) return;
    setLoading(true); setResult(null); setError("");
    try {
      if (input.startsWith("{")) {
        // Off-chain JSON proof verification — no indexer needed
        let proof;
        try { proof = JSON.parse(input); }
        catch { setError("Invalid JSON — check the pasted APC-1 block"); setLoading(false); return; }
        const data = await fetch(`${API}/dashboard/verify-offchain`, {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ proof }),
        }).then(r => r.json());
        setResult(data);
      } else {
        // Standard TXID → indexer lookup
        const data = await fetch(`${API}/dashboard/verify/${input}`).then(r => r.json());
        setResult(data);
      }
    } catch(e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const proof = result?.proof;
  const isJsonProof = txId.trim().startsWith("{");

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20, maxWidth:780 }}>
      <Card style={{ padding:24 }}>
        <div style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:10, letterSpacing:"1px", marginBottom:16 }}>ENTER TXID OR PASTE APC-1 JSON</div>
        <div style={{ display:"flex", gap:10 }}>
          <textarea
            value={txId} onChange={e => setTxId(e.target.value)}
            placeholder={"TXID (52-char Algorand transaction ID)\n\n— or —\n\nPaste a copied APC-1 JSON block here to verify offline"}
            rows={4}
            style={{ flex:1, padding:"11px 16px", background:"var(--elevated)", border:"1px solid var(--border)", borderRadius:"var(--r)", color:"var(--text)", fontFamily:"var(--mono)", fontSize:12, outline:"none", resize:"vertical", lineHeight:1.6 }}
          />
          <button onClick={verify} disabled={loading || !txId.trim()} style={{ padding:"11px 24px", background:"var(--accent)", color:"#040810", border:"none", borderRadius:"var(--r)", fontFamily:"var(--sans)", fontWeight:700, fontSize:13, cursor: loading ? "default" : "pointer", opacity: loading ? .6 : 1 }}>
            {loading ? "Verifying…" : "Verify Proof"}
          </button>
        </div>
        {error && <div style={{ marginTop:12, color:"var(--red)", fontFamily:"var(--mono)", fontSize:12 }}>{error}</div>}
      </Card>

      {result && (
        <Card style={{ overflow:"hidden" }}>
          {/* Status banner */}
          <div style={{ padding:"14px 20px", background: result.valid ? "var(--accent-dim)" : "rgba(248,113,113,.05)", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:32, height:32, borderRadius:"50%", background: result.valid ? "var(--accent)" : "var(--red)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <span style={{ color:"#040810", fontWeight:700, fontSize:14 }}>{result.valid ? "✓" : "✗"}</span>
            </div>
            <div>
              <div style={{ fontWeight:700, fontSize:14, color: result.valid ? "var(--accent)" : "var(--red)" }}>
                {result.valid ? "Proof Valid — On-chain Verified" : "Proof Invalid"}
              </div>
              <div style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:11, marginTop:2 }}>
                {result.valid ? `APC-${result.verified_apc_version || "1"} · Ed25519 signature verified` : result.reason}
              </div>
            </div>
          </div>

          {proof && (
            <div style={{ padding:20, display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
              <div>
                <div style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:10, letterSpacing:"1px", marginBottom:12 }}>CREDENTIAL FIELDS</div>
                {[
                  ["payment_id",   proof.payment_id],
                  ["canonical_id", proof.canonical_id],
                  ["amount",       `₹${proof.amount} ${proof.currency}`],
                  ["action",       proof.action],
                  ["provider",     proof.provider || "—"],
                  ["apc_version",  proof.apc || "1"],
                ].map(([k,v]) => (
                  <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid var(--border2)" }}>
                    <span style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:11 }}>{k}</span>
                    <span style={{ color: k==="canonical_id" ? "var(--accent)" : "var(--text)", fontFamily:"var(--mono)", fontSize:11, maxWidth:220, overflow:"hidden", textOverflow:"ellipsis", textAlign:"right" }}>{v}</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:10, letterSpacing:"1px", marginBottom:12 }}>CRYPTOGRAPHIC PROOF</div>
                {[
                  ["oracle_address", proof.oracle_address?.slice(0,20) + "…"],
                  ["timestamp",      proof.timestamp ? new Date(proof.timestamp*1000).toLocaleString("en-IN") : "—"],
                  ["signature",      proof.signature?.slice(0,24) + "…"],
                ].map(([k,v]) => (
                  <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid var(--border2)" }}>
                    <span style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:11 }}>{k}</span>
                    <span style={{ color:"var(--text)", fontFamily:"var(--mono)", fontSize:11 }}>{v}</span>
                  </div>
                ))}
                {!isJsonProof && (
  			<div style={{ marginTop:14 }}>
    			<a
      			href={`https://lora.algokit.io/testnet/transaction/${txId.trim()}`}
      			target="_blank"
      			rel="noreferrer"
      			style={{
        		display:"block",
        		padding:"9px 0",
        		background:"var(--accent-dim)",
        		border:"1px solid var(--border)",
        		borderRadius:"var(--r)",
        		color:"var(--accent)",
        		fontFamily:"var(--mono)",
        		fontSize:12,
        		textDecoration:"none",
        		textAlign:"center"
      			}}
    			>
      		  View on Lora ↗
    		 </a>
  		 </div>
		)}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  TAB 3 — Oracle
// ─────────────────────────────────────────────────────────────────────────────
function OracleTab({ stats }) {
  const [addAddr, setAddAddr]   = useState("");
  const [rmAddr,  setRmAddr]    = useState("");
  const [working, setWorking]   = useState(false);
  const [msg,     setMsg]       = useState(null);   // { type, text }
  const ADMIN = import.meta.env.VITE_ADMIN_KEY || "";

  const adminAction = async (endpoint, body) => {
    setWorking(true); setMsg(null);
    try {
      const res = await fetch(`${API}${endpoint}`, {
        method:"POST",
        headers:{ "Content-Type":"application/json", "x-admin-key": ADMIN },
        body: JSON.stringify(body),
      }).then(r => r.json());
      setMsg({ type: res.success ? "ok" : "err", text: res.success ? `txId: ${res.txId?.slice(0,20)}…` : (res.error || "Failed") });
    } catch(e) {
      setMsg({ type:"err", text: e.message });
    }
    setWorking(false);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20, maxWidth:720 }}>
      {/* Oracle status */}
      <Card style={{ padding:24 }}>
        <div style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:10, letterSpacing:"1px", marginBottom:16 }}>ORACLE STATUS</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {[
            ["Oracle Address", stats?.oracle_address || "—"],
            ["Public Key (b64)", stats?.pubkey_base64?.slice(0,28) + "…" || "—"],
            ["Network", stats?.network || "testnet"],
            ["App ID", stats?.app_id ? `#${stats.app_id}` : "anchor mode"],
            ["Total Verified", stats?.total_verified?.toString() || "0"],
            ["Registered Oracles", stats?.oracle_count?.toString() || "—"],
          ].map(([k,v]) => (
            <div key={k} style={{ padding:"12px 16px", background:"var(--elevated)", border:"1px solid var(--border2)", borderRadius:"var(--r)" }}>
              <div style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:10, letterSpacing:"1px", marginBottom:6 }}>{k}</div>
              <div style={{ color:"var(--text)", fontFamily:"var(--mono)", fontSize:12, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:16, padding:"10px 14px", background:"var(--accent-dim)", border:"1px solid var(--border)", borderRadius:"var(--r)", display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:"var(--accent)", animation:"pulse 2s infinite", flexShrink:0 }} />
          <span style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--text2)" }}>Oracle is active. Signatures are verified on-chain using registered Ed25519 public keys.</span>
        </div>
      </Card>

      {/* Rotation controls */}
      <Card style={{ padding:24 }}>
        <div style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:10, letterSpacing:"1px", marginBottom:6 }}>ORACLE ROTATION</div>
        <div style={{ color:"var(--text2)", fontSize:12, lineHeight:1.6, marginBottom:20 }}>
          Add or remove oracle signing keys without downtime. The contract accepts proofs from any registered oracle.
          Requires <code style={{ color:"var(--accent)", fontFamily:"var(--mono)", fontSize:11, background:"var(--elevated)", padding:"1px 5px", borderRadius:4 }}>X-Admin-Key</code> header (set{" "}
          <code style={{ color:"var(--accent)", fontFamily:"var(--mono)", fontSize:11, background:"var(--elevated)", padding:"1px 5px", borderRadius:4 }}>VITE_ADMIN_KEY</code> in{" "}
          <code style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:11 }}>.env</code>).
        </div>

        {msg && (
          <div style={{ marginBottom:16, padding:"10px 14px", background: msg.type==="ok" ? "var(--accent-dim)" : "rgba(248,113,113,.07)", border:`1px solid ${msg.type==="ok" ? "var(--border)" : "rgba(248,113,113,.2)"}`, borderRadius:"var(--r)", fontFamily:"var(--mono)", fontSize:12, color: msg.type==="ok" ? "var(--accent)" : "var(--red)" }}>
            {msg.text}
          </div>
        )}

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ display:"flex", gap:10 }}>
            <input value={addAddr} onChange={e => setAddAddr(e.target.value)} placeholder="Algorand address to add…"
              style={{ flex:1, padding:"10px 14px", background:"var(--elevated)", border:"1px solid var(--border)", borderRadius:"var(--r)", color:"var(--text)", fontFamily:"var(--mono)", fontSize:12, outline:"none" }} />
            <button onClick={() => addAddr && adminAction("/admin/oracle/add", { address: addAddr })} disabled={working || !addAddr}
              style={{ padding:"10px 20px", background:"var(--accent)", color:"#040810", border:"none", borderRadius:"var(--r)", fontFamily:"var(--sans)", fontWeight:700, fontSize:13, cursor:"pointer", opacity: working ? .6 : 1, whiteSpace:"nowrap" }}>
              Add Oracle
            </button>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <input value={rmAddr} onChange={e => setRmAddr(e.target.value)} placeholder="Algorand address to remove…"
              style={{ flex:1, padding:"10px 14px", background:"var(--elevated)", border:"1px solid var(--border)", borderRadius:"var(--r)", color:"var(--text)", fontFamily:"var(--mono)", fontSize:12, outline:"none" }} />
            <button onClick={() => rmAddr && adminAction("/admin/oracle/remove", { address: rmAddr })} disabled={working || !rmAddr}
              style={{ padding:"10px 20px", background:"transparent", color:"var(--red)", border:"1px solid rgba(248,113,113,.3)", borderRadius:"var(--r)", fontFamily:"var(--sans)", fontWeight:700, fontSize:13, cursor:"pointer", opacity: working ? .6 : 1, whiteSpace:"nowrap" }}>
              Remove Oracle
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  TAB 4 — Live Logs
// ─────────────────────────────────────────────────────────────────────────────
function LogsTab() {
  const [logs,    setLogs]    = useState([]);
  const [paused,  setPaused]  = useState(false);
  const [filter,  setFilter]  = useState("");
  const [status,  setStatus]  = useState("connecting");
  const logRef  = useRef(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    const es = new EventSource(`${API}/events`);

    es.onopen    = () => setStatus("connected");
    es.onerror   = () => setStatus("disconnected");
    es.onmessage = (e) => {
      if (pausedRef.current) return;
      try {
        const entry = JSON.parse(e.data);
        setLogs(p => [...p.slice(-300), entry]);
      } catch { /* non-JSON heartbeat */ }
    };

    return () => es.close();
  }, []);

  // Sync pausedRef to state (avoids stale closure in onmessage)
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // Auto-scroll when not paused
  useEffect(() => {
    if (!paused && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs, paused]);

  const levelColor = { info:"var(--text2)", warn:"var(--amber)", error:"var(--red)", system:"var(--blue)" };

  const visible = logs.filter(l => {
    if (!filter) return true;
    return JSON.stringify(l).toLowerCase().includes(filter.toLowerCase());
  });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, height:"calc(100vh - 200px)" }}>
      {/* Controls */}
      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background: status==="connected" ? "var(--accent)" : status==="connecting" ? "var(--amber)" : "var(--red)", animation: status==="connected" ? "pulse 2s infinite" : "none" }} />
          <span style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--text2)" }}>{status}</span>
        </div>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter logs…"
          style={{ flex:1, padding:"8px 13px", background:"var(--elevated)", border:"1px solid var(--border)", borderRadius:"var(--r)", color:"var(--text)", fontFamily:"var(--mono)", fontSize:11, outline:"none" }} />
        <button onClick={() => setPaused(p => !p)} style={{ padding:"8px 16px", background: paused ? "var(--accent-dim)" : "var(--elevated)", color: paused ? "var(--accent)" : "var(--text2)", border:`1px solid ${paused ? "var(--border)" : "var(--border2)"}`, borderRadius:"var(--r)", fontFamily:"var(--mono)", fontSize:11, cursor:"pointer" }}>
          {paused ? "▶ Resume" : "⏸ Pause"}
        </button>
        <button onClick={() => setLogs([])} style={{ padding:"8px 14px", background:"transparent", color:"var(--text2)", border:"1px solid var(--border2)", borderRadius:"var(--r)", fontFamily:"var(--mono)", fontSize:11, cursor:"pointer" }}>
          Clear
        </button>
        <span style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--text2)" }}>{visible.length} entries</span>
      </div>

      {/* Log stream */}
      <Card style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
        {/* Terminal header */}
        <div style={{ padding:"8px 16px", borderBottom:"1px solid var(--border)", background:"var(--elevated)", display:"flex", gap:7, alignItems:"center" }}>
          {["#EF4444","#FBBF24","#00E5A0"].map((c,i) => <div key={i} style={{ width:10, height:10, borderRadius:"50%", background:c, opacity:.6 }} />)}
          <span style={{ marginLeft:8, fontFamily:"var(--mono)", fontSize:11, color:"var(--text2)" }}>oracle.log — live stream</span>
        </div>

        <div ref={logRef} style={{ flex:1, overflowY:"auto", padding:"10px 16px", fontFamily:"var(--mono)", fontSize:11, lineHeight:1.85 }}>
          {visible.length === 0 && (
            <div style={{ color:"var(--text3)", padding:"20px 0" }}>
              {status === "connecting" ? "Connecting to backend…" : status === "disconnected" ? "Connection lost — is the backend running?" : "No log entries yet. Run a demo payment to see live logs here."}
            </div>
          )}
          {visible.map((l, i) => (
            <div key={i} style={{ display:"flex", gap:10, borderBottom:"1px solid var(--border2)", padding:"2px 0" }}>
              <span style={{ color:"var(--text3)", flexShrink:0 }}>{l.ts?.slice(11,19) || "--:--:--"}</span>
              <span style={{ color: levelColor[l.level] || "var(--text2)", flexShrink:0, width:40 }}>{(l.level || "INFO").toUpperCase().slice(0,4)}</span>
              <span style={{ color: l.level==="error" ? "var(--red)" : l.level==="warn" ? "var(--amber)" : "var(--text2)", flex:1 }}>{l.msg || l.message || JSON.stringify(l)}</span>
              {l.txId && <span style={{ color:"var(--accent)", flexShrink:0 }}>{l.txId.slice(0,10)}…</span>}
              {l.requestId && <span style={{ color:"var(--text3)", flexShrink:0, fontSize:10 }}>{l.requestId.slice(0,8)}</span>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  TAB 5 — SDK Setup
// ─────────────────────────────────────────────────────────────────────────────
const SDK_SNIPPETS = {
  node: `// npm install @algopay/oracle-sdk
const { AlgoPayClient } = require("@algopay/oracle-sdk");

const client = new AlgoPayClient({
  mnemonic: process.env.ORACLE_MNEMONIC,
  network:  "testnet",
  appId:    Number(process.env.ALGO_APP_ID),
});

// Verify and commit any payment
const result = await client.verifyAndCommit({
  payment_id: "pay_XXXXXXX",
  amount:     100,
  currency:   "INR",
  action:     "unlock",
  provider:   "razorpay",
});

console.log(result.txId);         // confirmed Algorand txn
console.log(result.apc1);         // APC-1 credential
console.log(result.explorerUrl);  // Lora link`,

  razorpay: `const { RazorpayAdapter, AlgoPayClient, createOrderStore } = require("@algopay/oracle-sdk");

const orderStore = createOrderStore();
const adapter    = new RazorpayAdapter({
  keyId:      process.env.RAZORPAY_KEY_ID,
  keySecret:  process.env.RAZORPAY_KEY_SECRET,
  orderStore,   // enforces server-side amount
});

// Razorpay sends this when payment.captured fires
app.post("/webhook/razorpay", async (req, res) => {
  const event = adapter.parseWebhook(
    req.rawBody,
    req.headers["x-razorpay-signature"]
  );
  if (!event) return res.status(401).end();

  const result = await client.verifyAndCommit(event);
  res.json({ txId: result.txId });
});`,

  custom: `// Implement PaymentAdapter for any gateway
class PayUAdapter {
  constructor({ merchantSalt }) { this.salt = merchantSalt; }

  parseWebhook(rawBody, signature) {
    if (!this.verify(rawBody, signature)) return null;
    const body = Object.fromEntries(new URLSearchParams(rawBody));
    if (body.status !== "success") return null;

    return {
      payment_id: body.txnid,
      amount:     Math.round(Number(body.amount)),
      currency:   "INR",
      action:     "unlock",
      provider:   "payu",   // enables canonical_id = "payu:txnid"
    };
  }
}

// Same call regardless of adapter
const result = await client.verifyAndCommit(event);`,
};

function SDKTab() {
  const [lang, setLang] = useState("node");

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20, maxWidth:820 }}>
      {/* Install */}
      <Card style={{ padding:24 }}>
        <div style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:10, letterSpacing:"1px", marginBottom:14 }}>INSTALL</div>
        <div style={{ display:"flex", alignItems:"center", gap:16, background:"var(--elevated)", border:"1px solid var(--border)", borderRadius:"var(--r)", padding:"13px 18px", fontFamily:"var(--mono)", fontSize:14 }}>
          <span style={{ color:"var(--accent)" }}>$</span>
          <span style={{ color:"var(--text)" }}>npm install @algopay/oracle-sdk</span>
        </div>
        <div style={{ marginTop:12, display:"flex", gap:10, flexWrap:"wrap" }}>
          {[["Node ≥18","✓"],["TypeScript","✓"],["CommonJS","✓"],["Zero gas for users","✓"],["MIT License","✓"]].map(([l,v])=>(
            <div key={l} style={{ display:"flex", alignItems:"center", gap:6, color:"var(--text2)", fontFamily:"var(--mono)", fontSize:11 }}>
              <span style={{ color:"var(--accent)" }}>{v}</span>{l}
            </div>
          ))}
        </div>
      </Card>

      {/* Code examples */}
      <Card style={{ overflow:"hidden" }}>
        <div style={{ display:"flex", borderBottom:"1px solid var(--border)" }}>
          {[["node","Node.js"],["razorpay","Razorpay"],["custom","Custom Adapter"]].map(([k,l])=>(
            <button key={k} onClick={() => setLang(k)} style={{
              padding:"10px 20px", border:"none", borderRight:"1px solid var(--border)",
              background: lang===k ? "var(--elevated)" : "transparent",
              color: lang===k ? "var(--accent)" : "var(--text2)",
              fontFamily:"var(--mono)", fontSize:12, cursor:"pointer",
              borderBottom: lang===k ? "2px solid var(--accent)" : "2px solid transparent",
              transition:"all .15s",
            }}>{l}</button>
          ))}
        </div>
        <div style={{ padding:"18px 20px", background:"var(--bg)", overflowX:"auto" }}>
          <pre style={{ fontFamily:"var(--mono)", fontSize:12, lineHeight:1.75, color:"var(--text2)", margin:0 }}>
            {SDK_SNIPPETS[lang]}
          </pre>
        </div>
      </Card>

      {/* Environment variables */}
      <Card style={{ padding:24 }}>
        <div style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:10, letterSpacing:"1px", marginBottom:14 }}>REQUIRED ENV VARS (.env)</div>
        {[
          ["ORACLE_MNEMONIC",    "required","25-word Algorand oracle account mnemonic"],
          ["ALGO_NETWORK",       "optional","localnet | testnet | mainnet  (default: testnet)"],
          ["ALGO_APP_ID",        "optional","Deployed AlgoPayOracle contract App ID"],
          ["ADMIN_API_KEY",      "production","Secret key for admin endpoints"],
          ["RAZORPAY_KEY_ID",    "optional","Razorpay API key ID (rzp_test_… or rzp_live_…)"],
          ["RAZORPAY_KEY_SECRET","optional","Razorpay key secret"],
          ["DEMO_MODE",          "dev only", "true — enables simulated payments without gateway"],
        ].map(([k,badge,desc])=>(
          <div key={k} style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 0", borderBottom:"1px solid var(--border2)" }}>
            <code style={{ color:"var(--accent)", fontFamily:"var(--mono)", fontSize:12, width:240, flexShrink:0 }}>{k}</code>
            <Pill color={badge==="required"?"var(--red)":badge==="production"?"var(--amber)":badge==="dev only"?"var(--purple)":"var(--text2)"}>{badge}</Pill>
            <span style={{ color:"var(--text2)", fontSize:12 }}>{desc}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  ROOT
// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [tab,   setTab]   = useState("txns");
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch(`${API}/dashboard/stats`).then(r => r.json()).then(setStats).catch(() => {});
    const id = setInterval(() => {
      fetch(`${API}/dashboard/stats`).then(r => r.json()).then(setStats).catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ paddingTop:56, minHeight:"100vh" }}>

      {/* Sidebar + content layout */}
      <div className="dash-grid" style={{ display:"grid", gridTemplateColumns:"200px 1fr", minHeight:"calc(100vh - 56px)" }}>

        {/* Sidebar */}
        <div className="dash-sidebar" style={{ borderRight:"1px solid var(--border)", background:"var(--surface)", padding:"24px 0" }}>
          <div style={{ padding:"0 16px 20px", borderBottom:"1px solid var(--border)", marginBottom:12 }}>
            <div style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:9, letterSpacing:"1.5px", marginBottom:10 }}>DEVELOPER DASHBOARD</div>
            <div style={{ display:"flex", alignItems:"center", gap:7 }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background: stats ? "var(--accent)" : "var(--text3)", animation: stats ? "pulse 2s infinite" : "none" }} />
              <span style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--text2)" }}>
                {stats ? (stats.network || "TestNet") : "Connecting…"}
              </span>
            </div>
          </div>

          <nav style={{ padding:"0 10px" }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                width:"100%", padding:"9px 12px", textAlign:"left",
                background: tab===t.id ? "var(--accent-dim)" : "transparent",
                color:      tab===t.id ? "var(--accent)" : "var(--text2)",
                border:     "1px solid " + (tab===t.id ? "var(--border)" : "transparent"),
                borderRadius:"var(--r)", fontFamily:"var(--mono)", fontSize:12,
                cursor:"pointer", marginBottom:3, transition:"all .15s",
              }}>
                {t.label}
              </button>
            ))}
          </nav>

          {/* Stats in sidebar */}
          {stats && (
            <div style={{ padding:"20px 16px 0", borderTop:"1px solid var(--border)", marginTop:16 }}>
              <div style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:9, letterSpacing:"1.5px", marginBottom:12 }}>QUICK STATS</div>
              {[
                ["Verified", stats.total_verified ?? "—"],
                ["Oracles",  stats.oracle_count   ?? "—"],
                ["App ID",   stats.app_id ? `#${stats.app_id}` : "—"],
              ].map(([l,v]) => (
                <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px solid var(--border2)" }}>
                  <span style={{ color:"var(--text2)", fontFamily:"var(--mono)", fontSize:10 }}>{l}</span>
                  <span style={{ color:"var(--accent)", fontFamily:"var(--mono)", fontSize:10, fontWeight:600 }}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main content */}
        <div style={{ padding:28, overflowY:"auto" }}>
          {tab === "txns"     && <TxnsTab stats={stats} />}
          {tab === "explorer" && <ExplorerTab />}
          {tab === "oracle"   && <OracleTab stats={stats} />}
          {tab === "logs"     && <LogsTab />}
          {tab === "sdk"      && <SDKTab />}
        </div>
      </div>
    </div>
  );
}
