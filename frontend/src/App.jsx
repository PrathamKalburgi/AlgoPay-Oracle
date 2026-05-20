import { useState, useEffect } from "react";
import Navbar    from "./components/Navbar";
import Landing   from "./pages/LandingPage";
import Demo      from "./pages/DemoPage";
import Dashboard from "./pages/DashboardPage";

const G = document.createElement("style");
G.textContent = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#040810;--surface:#07101E;--elevated:#0B1628;--card:#0F1E35;
  --border:rgba(0,229,160,.1);--border2:rgba(255,255,255,.06);
  --accent:#00E5A0;--accent-dim:rgba(0,229,160,.07);--accent-glow:rgba(0,229,160,.22);
  --blue:#38BDF8;--amber:#FBBF24;--red:#F87171;--purple:#A78BFA;
  --text:#DDE8F4;--text2:#5C7094;--text3:#1E2D44;
  --mono:'JetBrains Mono',monospace;--sans:'Syne',sans-serif;
  --r:10px;--rl:16px;
}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--text);font-family:var(--sans);-webkit-font-smoothing:antialiased;overflow-x:hidden}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:var(--surface)}::-webkit-scrollbar-thumb{background:var(--text3);border-radius:3px}
::selection{background:var(--accent-dim);color:var(--accent)}
.grid-bg{background-image:linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px);background-size:56px 56px}
@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes glow{0%,100%{box-shadow:0 0 10px var(--accent-glow)}50%{box-shadow:0 0 28px var(--accent-glow),0 0 60px var(--accent-dim)}}
@keyframes flowLine{0%{stroke-dashoffset:400}100%{stroke-dashoffset:0}}
@keyframes typeChar{from{opacity:0}to{opacity:1}}
@keyframes slideRight{from{transform:translateX(-8px);opacity:0}to{transform:none;opacity:1}}
@keyframes scaleIn{from{transform:scale(.92);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes blink{50%{opacity:0}}
.nav-link{transition:all .15s ease}.nav-link:hover{color:var(--accent)!important;border-color:var(--border)!important}
@media(max-width:768px){.hide-on-mobile{display:none!important}}
.fu{animation:fadeUp .5s cubic-bezier(.22,1,.36,1) both}
.dash-grid{display:grid;grid-template-columns:200px 1fr}
@media(max-width:800px){
  .dash-grid{grid-template-columns:1fr !important}
  .dash-sidebar{display:none !important}
}

.nav-link{transition:all .15s ease}
.nav-link:hover{color:var(--accent) !important;border-color:var(--border) !important}
@media(max-width:768px){.hide-on-mobile{display:none !important}}
.fi{animation:fadeIn .4s ease both}
.si{animation:scaleIn .4s cubic-bezier(.22,1,.36,1) both}
`;
document.head.appendChild(G);

function useRoute() {
  const [r, set] = useState(location.hash || "#/");
  useEffect(() => {
    const h = () => { set(location.hash || "#/"); window.scrollTo(0,0); };
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  return r;
}

export default function App() {
  const route = useRoute();
  const page  = route.startsWith("#/dashboard") ? "dashboard"
              : route.startsWith("#/demo")       ? "demo"
              : "landing";

  return (
    <>
      <Navbar page={page} />
      {page === "landing"   && <Landing />}
      {page === "demo"      && <Demo />}
      {page === "dashboard" && <Dashboard />}
    </>
  );
}
