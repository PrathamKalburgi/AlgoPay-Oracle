export default function Navbar({ page }) {
  const link = (active) => ({
    padding: "5px 14px", borderRadius: 8, cursor: "pointer",
    fontFamily: "var(--mono)", fontSize: 12, textDecoration: "none",
    color: active ? "var(--accent)" : "var(--text2)",
    background: active ? "var(--accent-dim)" : "transparent",
    border: `1px solid ${active ? "var(--border)" : "transparent"}`,
    transition: "all .15s",
  });
  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 200, height: 56,
      background: "rgba(4,8,16,.9)", backdropFilter: "blur(20px)",
      borderBottom: "1px solid var(--border)",
      display: "flex", alignItems: "center", padding: "0 24px", gap: 0,
      justifyContent: "space-between",
    }}>
      <a href="#/" style={{ display:"flex", alignItems:"center", gap:9, textDecoration:"none" }}>
        <div style={{ width:28, height:28, borderRadius:7, background:"var(--accent-dim)", border:"1px solid rgba(0,229,160,.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>⬡</div>
        <span style={{ color:"var(--text)", fontWeight:700, fontSize:15 }}>AlgoPay Oracle</span>
      </a>

      <div style={{ display:"flex", gap:4 }}>
        {[["Home","#/","landing"],["Demo","#/demo","demo"],["Dashboard","#/dashboard","dashboard"]].map(([l,h,p])=>(
          <a key={l} href={h} style={link(page===p)} className="nav-link">{l}</a>
        ))}
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, fontFamily:"var(--mono)", fontSize:11, color:"var(--text2)" }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:"var(--accent)", animation:"pulse 2s infinite" }} />
          TestNet
        </div>
        <a href="https://github.com/PrathamKalburgi/AlgoPay-Oracle" target="_blank" rel="noreferrer" style={{ ...link(false), color:"var(--text2)" }} className="nav-link hide-on-mobile">GitHub ↗</a>
        <a href="#/demo" style={{ padding:"6px 18px", background:"var(--accent)", color:"#040810", borderRadius:8, fontWeight:700, fontSize:13, textDecoration:"none", fontFamily:"var(--sans)" }}>
          Try Demo
        </a>
      </div>
    </nav>
  );
}
