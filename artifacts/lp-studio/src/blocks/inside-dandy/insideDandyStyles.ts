// Shared CSS for all "Inside Dandy" (id-*) blocks. Injected once into the
// document head; subsequent block instances re-use the same <style> node.
// All selectors are namespaced under `.id-block` to prevent leakage.

import { useEffect } from "react";

const STYLE_ID = "inside-dandy-block-styles";

const CSS = `
.id-block { --id-teal:#003A30; --id-teal-deep:#001814; --id-cit:#C7E738; --id-green:#1AC065; --id-line:rgba(255,255,255,0.08); --id-display:'PT Serif','Crimson Text',Georgia,serif; --id-ease:cubic-bezier(0.7,0,0.18,1); --id-ease-out:cubic-bezier(0.16,1,0.3,1); color:#fff; box-sizing:border-box; }
.id-block *, .id-block *::before, .id-block *::after { box-sizing:border-box; }
.id-block .id-eyebrow { display:inline-flex; align-items:center; gap:14px; font-size:11px; letter-spacing:0.28em; text-transform:uppercase; color:var(--id-cit); font-weight:500; }
.id-block .id-eyebrow::before { content:""; width:24px; height:1px; background:var(--id-cit); }
.id-block em { font-style:italic; font-family:var(--id-display); color:var(--id-cit); }

/* HERO */
.id-hero { position:relative; min-height:100vh; overflow:hidden; background:var(--id-teal-deep); display:flex; align-items:center; padding:0 40px; }
.id-hero .id-hero-bg { position:absolute; inset:0; background-size:cover; background-position:center; opacity:0.45; }
.id-hero .id-hero-overlay { position:absolute; inset:0; background:radial-gradient(ellipse at 30% 50%, rgba(0,58,48,0.7) 0%, rgba(0,24,20,0.95) 70%); }
.id-hero .id-hero-grid { position:absolute; inset:0; background-image:linear-gradient(rgba(199,231,56,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(199,231,56,0.04) 1px,transparent 1px); background-size:48px 48px; mask-image:radial-gradient(ellipse at center, black 0%, transparent 70%); -webkit-mask-image:radial-gradient(ellipse at center, black 0%, transparent 70%); }
.id-hero .id-hero-orb { position:absolute; right:8%; top:50%; width:520px; height:520px; transform:translateY(-50%); border-radius:50%; background:radial-gradient(circle,rgba(199,231,56,0.18) 0%,rgba(199,231,56,0) 65%); filter:blur(20px); animation:idPulse 6s ease-in-out infinite; pointer-events:none; }
@keyframes idPulse { 0%,100% { transform:translateY(-50%) scale(1); opacity:0.6; } 50% { transform:translateY(-50%) scale(1.08); opacity:1; } }
.id-hero .id-hero-content { position:relative; z-index:5; max-width:1280px; margin:0 auto; width:100%; padding:140px 0; }
.id-hero .id-hero-eyebrow { font-size:11px; letter-spacing:0.32em; text-transform:uppercase; color:rgba(255,255,255,0.6); margin-bottom:32px; }
.id-hero h1 { font-family:var(--id-display); font-weight:400; font-size:clamp(56px,9.5vw,168px); line-height:0.92; letter-spacing:-0.03em; color:#fff; margin:0 0 40px; }
.id-hero h1 .id-line { display:block; }
.id-hero .id-lead { font-size:clamp(17px,1.5vw,21px); line-height:1.5; color:rgba(255,255,255,0.78); max-width:560px; font-weight:300; margin:0 0 44px; }
.id-hero .id-ctas { display:flex; gap:14px; flex-wrap:wrap; }
.id-hero .id-scroll-hint { position:absolute; bottom:32px; left:50%; transform:translateX(-50%); z-index:10; font-size:10px; letter-spacing:0.3em; text-transform:uppercase; color:rgba(255,255,255,0.5); display:flex; flex-direction:column; align-items:center; gap:14px; }
.id-hero .id-scroll-hint .id-scroll-line { width:1px; height:48px; background:linear-gradient(to bottom,var(--id-cit),transparent); animation:idScrollLine 2.4s ease-in-out infinite; }
@keyframes idScrollLine { 0%{transform:scaleY(0);transform-origin:top} 50%{transform:scaleY(1);transform-origin:top} 51%{transform:scaleY(1);transform-origin:bottom} 100%{transform:scaleY(0);transform-origin:bottom} }

/* BUTTONS */
.id-btn { display:inline-flex; align-items:center; gap:10px; padding:18px 32px; font-size:13px; letter-spacing:0.04em; font-weight:500; text-decoration:none; border-radius:999px; cursor:pointer; transition:transform 280ms var(--id-ease), box-shadow 280ms var(--id-ease), background 280ms var(--id-ease); border:1px solid transparent; font-family:inherit; }
.id-btn-primary { background:var(--id-cit); color:var(--id-teal-deep); }
.id-btn-primary:hover { transform:translateY(-2px); box-shadow:0 16px 40px rgba(199,231,56,0.3); }
.id-btn-ghost { background:transparent; color:#fff; border-color:rgba(255,255,255,0.2); }
.id-btn-ghost:hover { background:rgba(255,255,255,0.06); border-color:rgba(255,255,255,0.4); }

/* MARQUEE */
.id-marquee { position:relative; background:var(--id-teal-deep); border-top:1px solid var(--id-line); border-bottom:1px solid var(--id-line); padding:28px 0; overflow:hidden; }
.id-marquee .id-track { display:flex; gap:80px; white-space:nowrap; animation:idMarquee 40s linear infinite; font-family:var(--id-display); font-size:24px; letter-spacing:-0.01em; color:rgba(255,255,255,0.5); width:max-content; }
.id-marquee .id-track .id-item { display:inline-flex; align-items:center; gap:80px; }
.id-marquee .id-track .id-item::after { content:"·"; color:var(--id-cit); margin-left:80px; }
@keyframes idMarquee { to { transform:translateX(-50%); } }

/* INTRO */
.id-intro { padding:200px 40px; background:var(--id-teal-deep); position:relative; }
.id-intro .id-inner { max-width:1200px; margin:0 auto; }
.id-intro .id-eyebrow { margin-bottom:48px; }
.id-intro h2 { font-family:var(--id-display); font-weight:400; font-size:clamp(40px,5.6vw,84px); line-height:1.05; letter-spacing:-0.018em; color:#fff; max-width:18ch; margin:0; }
.id-intro h2 em { color:var(--id-cit); }

/* CINEMA PILLARS */
.id-cinema { position:relative; background:var(--id-teal-deep); }
.id-cinema-pillar { position:relative; min-height:100vh; padding:120px 60px; display:flex; align-items:flex-end; overflow:hidden; border-bottom:1px solid var(--id-line); }
.id-cinema-pillar:last-child { border-bottom:none; }
.id-cinema-pillar .id-cinema-bg { position:absolute; inset:0; pointer-events:none; }
.id-cinema-pillar.id-pillar-0 .id-cinema-bg { background:radial-gradient(ellipse at 30% 60%,#0A4A3E 0%,#001814 70%); }
.id-cinema-pillar.id-pillar-1 .id-cinema-bg { background:linear-gradient(135deg,#003A30 0%,#001814 100%); }
.id-cinema-pillar.id-pillar-2 .id-cinema-bg { background:#001814; }
.id-cinema-pillar.id-pillar-3 .id-cinema-bg { background:radial-gradient(ellipse at 70% 40%,#0A4A3E 0%,#001814 70%); }
.id-cinema-pillar .id-pillar-art { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; opacity:0.9; pointer-events:none; }
.id-cinema-pillar .id-pillar-meta { position:relative; z-index:5; display:flex; justify-content:space-between; align-items:flex-end; width:100%; gap:60px; flex-wrap:wrap; }
.id-cinema-pillar .id-pillar-num { font-family:var(--id-display); font-size:clamp(96px,18vw,260px); line-height:0.85; letter-spacing:-0.04em; color:rgba(255,255,255,0.08); font-feature-settings:"tnum"; }
.id-cinema-pillar .id-pillar-num em { color:var(--id-cit); opacity:0.4; }
.id-cinema-pillar .id-pillar-right { max-width:520px; text-align:right; margin-left:auto; }
.id-cinema-pillar .id-pillar-label { font-size:11px; letter-spacing:0.27em; text-transform:uppercase; color:var(--id-cit); font-weight:500; margin-bottom:16px; }
.id-cinema-pillar .id-pillar-right h3 { font-family:var(--id-display); font-size:clamp(40px,4.4vw,68px); line-height:1.05; letter-spacing:-0.018em; font-weight:400; margin:0 0 18px; color:#fff; }
.id-cinema-pillar .id-pillar-right h3 em { color:var(--id-cit); }
.id-cinema-pillar .id-pillar-right p { font-size:16px; line-height:1.55; color:rgba(255,255,255,0.7); font-weight:300; margin:0; }
/* art kits */
.id-art-scan { position:relative; width:600px; height:600px; max-width:90vw; max-height:90vw; }
.id-art-scan .id-ring { position:absolute; inset:0; border-radius:50%; border:1px dashed rgba(199,231,56,0.3); animation:idRotate 30s linear infinite; }
.id-art-scan .id-ring.id-r2 { inset:15%; animation-duration:24s; animation-direction:reverse; border-color:rgba(199,231,56,0.5); }
.id-art-scan .id-ring.id-r3 { inset:32%; animation-duration:18s; border-color:rgba(199,231,56,0.7); }
.id-art-scan .id-core { position:absolute; inset:30%; border-radius:50%; background:radial-gradient(circle,rgba(199,231,56,0.4),rgba(199,231,56,0) 70%); filter:blur(20px); animation:idPulse2 4s ease-in-out infinite; }
@keyframes idRotate { to { transform:rotate(360deg); } }
@keyframes idPulse2 { 0%,100% { transform:scale(0.9); opacity:0.7; } 50% { transform:scale(1.1); opacity:1; } }
.id-art-grid { position:relative; width:90vw; max-width:680px; height:480px; }
.id-art-grid .id-grid-floor { position:absolute; inset:0; background-image:linear-gradient(to right,rgba(199,231,56,0.18) 1px,transparent 1px),linear-gradient(to bottom,rgba(199,231,56,0.18) 1px,transparent 1px); background-size:40px 40px; transform:perspective(800px) rotateX(60deg) translateY(80px); transform-origin:center center; mask-image:linear-gradient(180deg,transparent 0%,black 60%,transparent 100%); -webkit-mask-image:linear-gradient(180deg,transparent 0%,black 60%,transparent 100%); }
.id-art-rail { position:relative; width:90vw; max-width:1200px; height:200px; display:flex; align-items:center; justify-content:space-between; }
.id-art-rail::before { content:""; position:absolute; left:0; right:0; top:50%; height:2px; background:linear-gradient(90deg,transparent 0%,var(--id-cit) 20%,var(--id-cit) 80%,transparent 100%); opacity:0.6; }
.id-art-rail .id-node { position:relative; width:64px; height:64px; border-radius:50%; border:1.5px solid rgba(199,231,56,0.4); background:rgba(199,231,56,0.05); display:flex; align-items:center; justify-content:center; }
.id-art-rail .id-node::before { content:""; width:14px; height:14px; border-radius:50%; background:var(--id-cit); box-shadow:0 0 24px var(--id-cit); animation:idNodePulse 2s ease-in-out infinite; }
.id-art-rail .id-node:nth-child(2)::before { animation-delay:0.3s; }
.id-art-rail .id-node:nth-child(3)::before { animation-delay:0.6s; }
.id-art-rail .id-node:nth-child(4)::before { animation-delay:0.9s; }
.id-art-rail .id-node:nth-child(5)::before { animation-delay:1.2s; }
@keyframes idNodePulse { 0%,100% { transform:scale(0.8); opacity:0.7; } 50% { transform:scale(1); opacity:1; } }
.id-art-bars { position:relative; width:90vw; max-width:760px; height:380px; display:grid; grid-template-columns:repeat(12,1fr); align-items:end; gap:8px; padding:0 20px; }
.id-art-bars .id-bar { background:linear-gradient(to top,var(--id-green) 0%,var(--id-cit) 100%); border-radius:2px 2px 0 0; opacity:0.85; }

/* PARALLAX SHOWCASE */
.id-showcase { position:relative; background:var(--id-teal-deep); padding:200px 0 240px; overflow:hidden; }
.id-showcase .id-head { max-width:1280px; margin:0 auto 120px; padding:0 40px; display:grid; grid-template-columns:1fr 1.4fr; gap:80px; align-items:end; }
.id-showcase .id-head .id-eyebrow { margin-bottom:24px; }
.id-showcase .id-head h2 { font-family:var(--id-display); font-weight:400; font-size:clamp(40px,5vw,76px); line-height:1.05; letter-spacing:-0.018em; color:#fff; margin:0; }
.id-showcase .id-head h2 em { color:var(--id-cit); }
.id-showcase .id-head .id-blurb { font-size:18px; line-height:1.55; color:rgba(255,255,255,0.65); max-width:50ch; font-weight:300; align-self:end; margin:0; }
.id-showcase .id-stack { position:relative; max-width:1480px; margin:0 auto; padding:0 40px; }
.id-showcase .id-frame { position:relative; margin:48px auto; border-radius:24px; overflow:hidden; box-shadow:0 60px 120px rgba(0,0,0,0.4); background:#0A4A3E; }
.id-showcase .id-frame.id-f1 { max-width:1100px; aspect-ratio:16/9; }
.id-showcase .id-frame.id-f2 { max-width:520px; aspect-ratio:3/4; margin-left:auto; margin-right:8%; margin-top:-180px; z-index:3; }
.id-showcase .id-frame.id-f3 { max-width:920px; aspect-ratio:16/10; margin-left:6%; margin-top:-100px; z-index:2; }
.id-showcase .id-frame .id-frame-img { position:absolute; inset:0; background-size:cover; background-position:center; }
.id-showcase .id-frame .id-frame-vignette { position:absolute; inset:0; background:linear-gradient(180deg,rgba(0,24,20,0) 0%,rgba(0,24,20,0.6) 100%); }
.id-showcase .id-frame .id-frame-caption { position:absolute; left:32px; bottom:28px; right:32px; display:flex; justify-content:space-between; align-items:flex-end; z-index:3; gap:24px; }
.id-showcase .id-frame .id-frame-label { font-size:10px; letter-spacing:0.28em; text-transform:uppercase; color:var(--id-cit); font-weight:500; }
.id-showcase .id-frame .id-frame-where { font-size:11px; letter-spacing:0.22em; text-transform:uppercase; color:rgba(255,255,255,0.5); font-weight:500; }
.id-showcase .id-frame .id-frame-caption h4 { font-family:var(--id-display); font-size:clamp(24px,2.6vw,40px); line-height:1.05; letter-spacing:-0.012em; color:#fff; font-weight:400; max-width:18ch; margin:12px 0 0; }
.id-showcase .id-frame .id-frame-caption h4 em { color:var(--id-cit); }

/* STATS */
.id-stats { position:relative; padding:160px 40px; background:var(--id-teal-deep); border-top:1px solid var(--id-line); }
.id-stats::before { content:""; position:absolute; inset:0; background-image:radial-gradient(circle,rgba(199,231,56,0.06) 1px,transparent 1.4px); background-size:32px 32px; mask-image:radial-gradient(ellipse at 50% 50%,black 0%,transparent 70%); -webkit-mask-image:radial-gradient(ellipse at 50% 50%,black 0%,transparent 70%); pointer-events:none; }
.id-stats .id-inner { position:relative; max-width:1400px; margin:0 auto; display:grid; grid-template-columns:repeat(4,1fr); gap:24px; }
.id-stats .id-stat { padding:48px 32px; border-left:1px solid var(--id-line); display:flex; flex-direction:column; justify-content:space-between; min-height:280px; }
.id-stats .id-stat:first-child { border-left:none; }
.id-stats .id-stat .id-num { font-family:var(--id-display); font-size:clamp(56px,5.6vw,96px); line-height:0.95; letter-spacing:-0.025em; color:#fff; font-feature-settings:"tnum"; }
.id-stats .id-stat .id-num em { color:var(--id-cit); }
.id-stats .id-stat .id-label { font-size:11px; letter-spacing:0.22em; text-transform:uppercase; color:rgba(255,255,255,0.55); margin-top:18px; font-weight:500; }
.id-stats .id-stat .id-desc { font-size:13px; line-height:1.5; color:rgba(255,255,255,0.65); margin-top:8px; font-weight:300; }

/* INVITATION */
.id-invite { position:relative; background:var(--id-teal); padding:200px 40px 220px; overflow:hidden; }
.id-invite::before { content:""; position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:140vh; height:140vh; border-radius:50%; background:radial-gradient(circle at 50% 50%,rgba(199,231,56,0.10) 0%,rgba(199,231,56,0) 60%); pointer-events:none; }
.id-invite::after { content:""; position:absolute; inset:0; background-image:radial-gradient(circle,var(--id-cit) 1.3px,transparent 1.8px); background-size:18px 18px; mask-image:radial-gradient(ellipse at 50% 80%,black 0%,black 12%,transparent 50%); -webkit-mask-image:radial-gradient(ellipse at 50% 80%,black 0%,black 12%,transparent 50%); opacity:0.5; pointer-events:none; }
.id-invite .id-inner { position:relative; max-width:1080px; margin:0 auto; text-align:center; z-index:2; }
.id-invite .id-eyebrow { margin-bottom:36px; justify-content:center; }
.id-invite h2 { font-family:var(--id-display); font-weight:400; font-size:clamp(48px,8vw,128px); line-height:0.96; letter-spacing:-0.025em; color:#fff; margin:0 0 32px; }
.id-invite h2 em { color:var(--id-cit); }
.id-invite .id-blurb { font-size:clamp(16px,1.4vw,20px); line-height:1.5; color:rgba(255,255,255,0.78); max-width:580px; margin:0 auto 48px; font-weight:300; }
.id-invite .id-ctas { display:flex; gap:14px; justify-content:center; flex-wrap:wrap; }
.id-invite .id-meta-row { display:flex; justify-content:center; gap:48px; margin-top:96px; padding-top:36px; border-top:1px solid var(--id-line); flex-wrap:wrap; }
.id-invite .id-meta-row .id-item { font-size:11px; letter-spacing:0.22em; text-transform:uppercase; color:rgba(255,255,255,0.5); font-weight:500; }
.id-invite .id-meta-row .id-item b { display:block; font-family:var(--id-display); font-size:24px; letter-spacing:-0.01em; color:var(--id-cit); font-weight:400; text-transform:none; margin-bottom:6px; }

@media (max-width:980px) {
  .id-showcase .id-head { grid-template-columns:1fr; }
  .id-stats .id-inner { grid-template-columns:repeat(2,1fr); }
  .id-stats .id-stat { border-left:none; border-top:1px solid var(--id-line); padding:32px 0; }
  .id-cinema-pillar .id-pillar-meta { flex-direction:column; align-items:flex-start; }
  .id-cinema-pillar .id-pillar-right { text-align:left; margin-left:0; }
  .id-showcase .id-frame.id-f2, .id-showcase .id-frame.id-f3 { margin-left:auto; margin-right:auto; margin-top:48px; }
}
`;

export function useInsideDandyStyles() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
}
