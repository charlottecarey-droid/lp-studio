// Shared CSS for all "Inside Dandy" (id-*) blocks. Injected once into the
// document head; subsequent block instances re-use the same <style> node.
// All selectors are namespaced under `.id-block` to prevent leakage.

import { useEffect } from "react";

const STYLE_ID = "inside-dandy-block-styles";

const CSS = `
.id-block { --id-teal:#003A30; --id-teal-deep:#001814; --id-cit:#C7E738; --id-green:#1AC065; --id-line:rgba(255,255,255,0.08); --id-display:'Bagoss Standard',Georgia,serif; --id-ease:cubic-bezier(0.7,0,0.18,1); --id-ease-out:cubic-bezier(0.16,1,0.3,1); color:#fff; box-sizing:border-box; }
.id-block *, .id-block *::before, .id-block *::after { box-sizing:border-box; }
.id-block .id-eyebrow { display:inline-flex; align-items:center; gap:14px; font-size:11px; letter-spacing:0.28em; text-transform:uppercase; color:var(--id-cit); font-weight:500; }
.id-block .id-eyebrow::before { content:""; width:24px; height:1px; background:var(--id-cit); }
.id-block em { font-style:italic; font-family:var(--id-display); color:var(--id-cit); }
.id-block h1, .id-block h2, .id-block h3, .id-block h4 { font-family:var(--id-display); font-weight:400; }
.id-block h1 em, .id-block h2 em, .id-block h3 em, .id-block h4 em { font-style:italic; }

/* Scroll reveal: elements animate in when their container has .id-in-view */
.id-reveal { opacity:0; transform:translateY(40px); transition:opacity 1100ms var(--id-ease-out), transform 1100ms var(--id-ease-out); will-change:opacity,transform; }
.id-in-view .id-reveal { opacity:1; transform:none; }
.id-in-view .id-reveal-d1 { transition-delay:120ms; }
.id-in-view .id-reveal-d2 { transition-delay:240ms; }
.id-in-view .id-reveal-d3 { transition-delay:360ms; }
.id-in-view .id-reveal-d4 { transition-delay:480ms; }

/* HERO — centered cinematic with concentric signal-orb + smoky photo */
.id-hero { position:relative; min-height:100vh; height:auto; display:flex; align-items:center; justify-content:center; overflow:hidden; background:var(--id-teal-deep); padding:120px 0 200px; }
.id-hero .id-hero-bg { position:absolute; inset:-5%; background-size:cover; background-position:center; opacity:0; transform:scale(1.15); transition:opacity 1800ms var(--id-ease-out), transform 16000ms linear; filter:saturate(0.55) contrast(1.05); }
.id-hero.id-ready .id-hero-bg { opacity:0.32; transform:scale(1); }
.id-hero .id-hero-overlay { position:absolute; inset:0; z-index:2; background:radial-gradient(ellipse at 50% 70%,rgba(0,58,48,0.4) 0%,rgba(0,24,20,0.92) 60%),linear-gradient(180deg,rgba(0,24,20,0.6) 0%,rgba(0,24,20,0.3) 40%,rgba(0,24,20,0.95) 100%); }
.id-hero .id-hero-grid { position:absolute; inset:0; z-index:3; background-image:linear-gradient(to right,rgba(199,231,56,0.04) 1px,transparent 1px),linear-gradient(to bottom,rgba(199,231,56,0.04) 1px,transparent 1px); background-size:80px 80px; mask-image:radial-gradient(ellipse at 50% 50%,black 0%,transparent 80%); -webkit-mask-image:radial-gradient(ellipse at 50% 50%,black 0%,transparent 80%); }
.id-hero .id-signal-orb { position:absolute; left:50%; top:50%; width:1100px; height:1100px; max-width:120vmin; max-height:120vmin; border-radius:50%; z-index:3; pointer-events:none; opacity:0; transform:translate(-50%,-50%) scale(0.6); transition:opacity 2000ms 400ms var(--id-ease-out), transform 2400ms 200ms var(--id-ease-out); background:radial-gradient(circle at 50% 50%,rgba(199,231,56,0) 30%,rgba(199,231,56,0.06) 30.5%,rgba(199,231,56,0.06) 31%,rgba(199,231,56,0) 31%),radial-gradient(circle at 50% 50%,rgba(199,231,56,0) 42%,rgba(199,231,56,0.10) 42%,rgba(199,231,56,0.10) 42.4%,rgba(199,231,56,0) 42.4%),radial-gradient(circle at 50% 50%,rgba(255,255,255,0) 56%,rgba(255,255,255,0.07) 56%,rgba(255,255,255,0.07) 56.3%,rgba(255,255,255,0) 56.3%); }
.id-hero.id-ready .id-signal-orb { opacity:1; transform:translate(-50%,-50%) scale(1); }
.id-hero .id-signal-orb::before { content:""; position:absolute; inset:18%; border-radius:50%; background:radial-gradient(circle at 50% 40%,rgba(26,192,101,0.18),rgba(26,192,101,0) 70%); filter:blur(40px); animation:idHeroPulse 6s ease-in-out infinite; }
@keyframes idHeroPulse { 0%,100%{opacity:0.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.05)} }
.id-hero .id-hero-content { position:relative; z-index:10; text-align:center; max-width:1100px; padding:0 40px; margin:0 auto; width:100%; }
.id-hero .id-hero-eyebrow { display:inline-flex; align-items:center; gap:10px; margin:0 0 32px; padding:8px 18px; border:1px solid var(--id-line); border-radius:999px; background:rgba(0,0,0,0.2); color:rgba(255,255,255,0.72); font-size:11px; letter-spacing:0.28em; text-transform:uppercase; font-weight:500; opacity:0; transform:translateY(12px); transition:opacity 1000ms 100ms var(--id-ease-out), transform 1000ms 100ms var(--id-ease-out); }
.id-hero .id-hero-eyebrow::before { content:""; width:6px; height:6px; border-radius:50%; background:var(--id-cit); box-shadow:0 0 12px var(--id-cit); flex-shrink:0; }
.id-hero.id-ready .id-hero-eyebrow { opacity:1; transform:translateY(0); }
.id-hero h1 { font-family:var(--id-display); font-weight:400; font-size:calc(clamp(48px,8vw,140px) * var(--id-hero-h1-scale, 1)); line-height:0.94; letter-spacing:-0.028em; color:#fff; margin:0; overflow-wrap:break-word; word-break:normal; hyphens:auto; }
/* Each line uses a clip-path that only crops top/bottom — wide text can still
   bleed sideways without being chopped, while the translateY entrance animation
   stays hidden behind the clip. */
.id-hero h1 .id-line { display:block; clip-path:inset(0 -100vw 0 -100vw); padding:0.18em 0 0.22em; margin:-0.18em 0 -0.22em; }
.id-hero h1 .id-line .id-line-inner { display:block; transform:translateY(140%); transition:transform 1100ms var(--id-ease-out); will-change:transform; }
.id-hero.id-ready h1 .id-line:nth-child(1) .id-line-inner { transform:translateY(0); transition-delay:200ms; }
.id-hero.id-ready h1 .id-line:nth-child(2) .id-line-inner { transform:translateY(0); transition-delay:340ms; }
.id-hero.id-ready h1 .id-line:nth-child(3) .id-line-inner { transform:translateY(0); transition-delay:480ms; }
.id-hero .id-lead { font-size:clamp(16px,1.5vw,21px); line-height:1.5; color:rgba(255,255,255,0.78); max-width:640px; margin:36px auto 48px; font-weight:300; opacity:0; transform:translateY(12px); transition:opacity 1100ms 720ms var(--id-ease-out), transform 1100ms 720ms var(--id-ease-out); }
.id-hero.id-ready .id-lead { opacity:1; transform:translateY(0); }
.id-hero .id-ctas { display:flex; gap:14px; justify-content:center; flex-wrap:wrap; opacity:0; transform:translateY(12px); transition:opacity 1100ms 880ms var(--id-ease-out), transform 1100ms 880ms var(--id-ease-out); }
.id-hero.id-ready .id-ctas { opacity:1; transform:translateY(0); }
.id-hero .id-scroll-hint { position:absolute; bottom:32px; left:50%; transform:translateX(-50%); z-index:10; font-size:10px; letter-spacing:0.3em; text-transform:uppercase; color:rgba(255,255,255,0.5); display:flex; flex-direction:column; align-items:center; gap:14px; opacity:0; transition:opacity 1500ms 1400ms var(--id-ease-out); pointer-events:none; }
/* Right-aligned hero variant — text, lead and CTAs hug the right edge. */
.id-hero.id-hero-align-right .id-hero-content { text-align:right; }
.id-hero.id-hero-align-right .id-lead { margin-left:auto; margin-right:0; }
.id-hero.id-hero-align-right .id-ctas { justify-content:flex-end; }
.id-hero.id-ready .id-scroll-hint { opacity:1; }
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

/* INTRO — word-by-word brighten on scroll progress (set as inline style on each word) */
.id-intro { padding:200px 40px; background:var(--id-teal-deep); position:relative; }
.id-intro .id-inner { max-width:1200px; margin:0 auto; }
.id-intro .id-eyebrow { margin-bottom:48px; }
.id-intro h2 { font-size:clamp(40px,5.6vw,84px); line-height:1.15; letter-spacing:-0.018em; color:#fff; max-width:18ch; margin:0; }
.id-intro h2 em { color:var(--id-cit); font-feature-settings:"ss01"; }
.id-intro h2 .id-word { display:inline-block; white-space:nowrap; }
.id-intro h2 .id-em-word { color:var(--id-cit); font-style:italic; font-feature-settings:"ss01"; }
.id-intro h2 .id-letter { display:inline-block; opacity:0.14; transition:opacity 480ms var(--id-ease-out), color 480ms var(--id-ease-out); }
.id-intro h2 .id-letter.id-lit { opacity:1; }

/* CINEMA — single sticky container with cross-fading layers + scroll-driven step switcher */
.id-cinema { position:relative; background:var(--id-teal-deep); }
.id-cinema-sticky { position:sticky; top:0; height:100vh; overflow:hidden; }
.id-cinema-bg { position:absolute; inset:0; transition:background 1200ms var(--id-ease); pointer-events:none; }
.id-cinema-bg[data-bg="0"] { background:radial-gradient(ellipse at 30% 60%,#0A4A3E 0%,#001814 70%); }
.id-cinema-bg[data-bg="1"] { background:linear-gradient(135deg,#003A30 0%,#001814 100%); }
.id-cinema-bg[data-bg="2"] { background:#001814; }
.id-cinema-bg[data-bg="3"] { background:radial-gradient(ellipse at 70% 40%,#0A4A3E 0%,#001814 70%); }
/* film grain overlay */
.id-cinema-sticky::after { content:""; position:absolute; inset:0; background-image:url("data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.06 0'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>"); opacity:0.5; mix-blend-mode:overlay; pointer-events:none; z-index:6; }
.id-cinema-stepper { position:absolute; left:60px; top:50%; transform:translateY(-50%); display:flex; flex-direction:column; gap:20px; z-index:8; }
.id-cinema-stepper .id-step { display:flex; align-items:center; gap:14px; font-size:11px; letter-spacing:0.22em; text-transform:uppercase; color:rgba(255,255,255,0.35); font-weight:500; transition:color 400ms var(--id-ease); }
.id-cinema-stepper .id-step .id-dot { width:8px; height:8px; border-radius:50%; background:rgba(255,255,255,0.2); transition:background 400ms var(--id-ease), transform 400ms var(--id-ease); }
.id-cinema-stepper .id-step.id-active { color:#fff; }
.id-cinema-stepper .id-step.id-active .id-dot { background:var(--id-cit); transform:scale(1.4); box-shadow:0 0 16px var(--id-cit); }
.id-cinema-art { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; z-index:2; }
.id-cinema-art .id-layer { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; opacity:0; transform:scale(1.05); transition:opacity 900ms var(--id-ease), transform 1400ms var(--id-ease); pointer-events:none; }
.id-cinema-art .id-layer.id-active { opacity:1; transform:scale(1); }
/* Video art: fills the layer; let the .id-cinema-bg radial gradient bleed
   through the top/edges for cinematic mood. The video itself is full-bleed
   while the layer's parent (.id-cinema-art) keeps the panel text readable
   via the .id-cinema-text overlay above. */
.id-art-video { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; pointer-events:none; }
.id-art-video-empty { background:repeating-linear-gradient(45deg,rgba(199,231,56,0.06) 0 12px,transparent 12px 24px); border:1px dashed rgba(199,231,56,0.3); }
/* ───────── id-spotlight: single split-panel video feature ───────── */
.id-spotlight { position:relative; padding:140px 0 160px; overflow:hidden; }
.id-spotlight-bg { position:absolute; inset:0; background:#001814 radial-gradient(ellipse 80% 60% at 70% 50%, rgba(10,74,62,0.55), transparent 70%); pointer-events:none; }
.id-spotlight-grid { position:relative; z-index:1; max-width:1400px; margin:0 auto; padding:0 60px; display:grid; grid-template-columns:minmax(280px, 32%) 1fr; gap:48px; align-items:center; }
.id-spotlight-text { color:#fff; padding-right:16px; }
.id-spotlight-eyebrow { font:500 11px/1.6 var(--id-mono, ui-monospace, monospace); letter-spacing:0.2em; text-transform:uppercase; color:rgba(255,255,255,0.55); margin-bottom:24px; }
.id-spotlight-h { font-family:var(--id-display, "Bagoss Standard", Georgia, serif); font-weight:300; font-size:clamp(36px, 4vw, 56px); line-height:1.05; letter-spacing:-0.01em; margin:0 0 20px; color:#fff; }
.id-spotlight-h em { font-style:italic; color:var(--id-cit, #C7E738); font-weight:300; }
.id-spotlight-body { font:400 16px/1.55 var(--id-body, system-ui, sans-serif); color:rgba(255,255,255,0.7); margin:0; max-width:34ch; }
.id-spotlight-stage { position:relative; min-height:520px; display:flex; align-items:center; justify-content:center; }
.id-spotlight-media { position:relative; width:100%; aspect-ratio:16/10; border-radius:16px; overflow:hidden; }
.id-spotlight-video { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block; }
.id-spotlight-empty { background:repeating-linear-gradient(45deg, rgba(199,231,56,0.06) 0 12px, transparent 12px 24px); border:1px dashed rgba(199,231,56,0.3); }
.id-spotlight-card { position:absolute; left:50%; bottom:6%; transform:translateX(-25%); width:min(360px, 60%); background:rgba(15,28,26,0.92); backdrop-filter:blur(12px); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:18px 18px 14px; box-shadow:0 24px 60px -20px rgba(0,0,0,0.7); color:#fff; z-index:2; }
.id-sp-card-title { display:flex; align-items:center; gap:8px; font:500 11px/1 var(--id-mono, ui-monospace, monospace); letter-spacing:0.18em; text-transform:uppercase; color:rgba(255,255,255,0.65); }
.id-sp-card-glyph { width:14px; height:14px; border-radius:50%; border:1.5px solid var(--id-cit, #C7E738); position:relative; flex:0 0 auto; }
.id-sp-card-glyph::after { content:""; position:absolute; inset:3px; background:var(--id-cit, #C7E738); border-radius:50%; opacity:0.4; }
.id-sp-card-subtitle { font-family:var(--id-display, Georgia, serif); font-weight:500; font-size:18px; margin-top:6px; margin-bottom:14px; color:#fff; }
.id-sp-results { display:flex; flex-direction:column; gap:10px; }
.id-sp-result { display:flex; gap:10px; background:#fff; color:#0A1F1B; border-radius:10px; padding:12px 12px; }
.id-sp-result + .id-sp-result { background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.85); }
.id-sp-dot { width:8px; height:8px; border-radius:50%; flex:0 0 auto; margin-top:6px; }
.id-sp-tone-alert .id-sp-dot { background:#E5484D; box-shadow:0 0 0 3px rgba(229,72,77,0.18); }
.id-sp-tone-warn  .id-sp-dot { background:#F5A524; box-shadow:0 0 0 3px rgba(245,165,36,0.18); }
.id-sp-tone-ok    .id-sp-dot { background:#30A46C; box-shadow:0 0 0 3px rgba(48,164,108,0.18); }
.id-sp-tone-info  .id-sp-dot { background:#3E63DD; box-shadow:0 0 0 3px rgba(62,99,221,0.18); }
.id-sp-result-text { flex:1; min-width:0; }
.id-sp-result-title { font:600 13px/1.3 var(--id-body, system-ui, sans-serif); margin-bottom:2px; }
.id-sp-result-body { font:400 12px/1.4 var(--id-body, system-ui, sans-serif); color:inherit; opacity:0.7; }
.id-sp-result-action { display:inline-block; font:500 12px/1.4 var(--id-body, system-ui, sans-serif); color:#0A1F1B; text-decoration:underline; text-underline-offset:2px; margin-top:6px; }
.id-sp-result + .id-sp-result .id-sp-result-action { color:var(--id-cit, #C7E738); }
.id-spotlight-stepper { position:absolute; right:-8px; top:50%; transform:translateY(-50%); display:flex; flex-direction:column; gap:18px; list-style:none; padding:0; margin:0; z-index:2; }
.id-sp-step { display:flex; align-items:center; gap:14px; justify-content:flex-end; font:500 10px/1 var(--id-mono, ui-monospace, monospace); letter-spacing:0.22em; text-transform:uppercase; color:rgba(255,255,255,0.35); }
.id-sp-step.id-active { color:#fff; }
.id-sp-step-dot { width:6px; height:6px; border-radius:50%; background:rgba(255,255,255,0.3); transition:all 240ms var(--id-ease); }
.id-sp-step.id-active .id-sp-step-dot { background:var(--id-cit, #C7E738); box-shadow:0 0 12px var(--id-cit, #C7E738); transform:scale(1.4); }
@media (max-width: 900px) {
  .id-spotlight { padding:80px 0 100px; }
  .id-spotlight-grid { grid-template-columns:1fr; gap:32px; padding:0 24px; }
  .id-spotlight-stage { min-height:auto; }
  .id-spotlight-card { position:static; transform:none; width:100%; margin-top:16px; }
  .id-spotlight-stepper { position:static; transform:none; flex-direction:row; justify-content:flex-start; gap:14px; margin-top:16px; }
  .id-sp-step { gap:6px; }
}
.id-cinema-text { position:absolute; inset:0; padding:0 60px 80px; z-index:5; pointer-events:none; }
.id-cinema-text .id-panel { position:absolute; inset:0; display:flex; align-items:flex-end; padding:80px 60px; opacity:0; transform:translateY(40px); transition:opacity 900ms var(--id-ease), transform 900ms var(--id-ease); }
.id-cinema-text .id-panel:nth-child(1) { transform:translateY(40px); }
.id-cinema-text .id-panel:nth-child(2) { transform:translateX(-60px); }
.id-cinema-text .id-panel:nth-child(3) { transform:scale(0.94); }
.id-cinema-text .id-panel:nth-child(4) { transform:translateX(60px); }
.id-cinema-text .id-panel.id-active { opacity:1; transform:translate(0,0) scale(1); pointer-events:auto; }
.id-cinema-text .id-meta { display:flex; justify-content:space-between; align-items:flex-end; width:100%; gap:60px; flex-wrap:wrap; }
.id-cinema-text .id-num { font-family:var(--id-display); font-size:clamp(96px,18vw,260px); line-height:0.85; letter-spacing:-0.04em; color:rgba(255,255,255,0.08); font-feature-settings:"tnum"; }
.id-cinema-text .id-num em { font-style:italic; color:var(--id-cit); opacity:0.4; }
.id-cinema-text .id-right { max-width:520px; text-align:right; margin-left:auto; }
.id-cinema-text .id-right .id-label { font-size:11px; letter-spacing:0.27em; text-transform:uppercase; color:var(--id-cit); font-weight:500; margin-bottom:16px; }
.id-cinema-text .id-right h3 { font-family:var(--id-display); font-size:clamp(40px,4.4vw,68px); line-height:1.05; letter-spacing:-0.018em; font-weight:400; margin:0 0 18px; color:#fff; }
.id-cinema-text .id-right h3 em { font-style:italic; color:var(--id-cit); }
.id-cinema-text .id-right p { font-size:16px; line-height:1.55; color:rgba(255,255,255,0.7); font-weight:300; margin:0; }
.id-cinema-spacer { height:100vh; }
/* EDITOR fallback: stacked vertical layout so each panel is editable in the builder */
.id-cinema.id-cinema-editor .id-cinema-sticky { position:relative; height:auto; min-height:auto; }
.id-cinema.id-cinema-editor .id-cinema-bg { display:none; }
.id-cinema.id-cinema-editor .id-cinema-stepper { display:none; }
.id-cinema.id-cinema-editor .id-cinema-art { display:none; }
.id-cinema.id-cinema-editor .id-cinema-text { position:relative; inset:auto; padding:0; display:flex; flex-direction:column; pointer-events:auto; }
.id-cinema.id-cinema-editor .id-cinema-text .id-panel { position:relative; inset:auto; opacity:1; transform:none; padding:120px 60px; min-height:80vh; border-bottom:1px solid var(--id-line); background:var(--id-teal-deep); pointer-events:auto; }
.id-cinema.id-cinema-editor .id-cinema-text .id-panel:nth-child(1) { background:radial-gradient(ellipse at 30% 60%,#0A4A3E 0%,#001814 70%); }
.id-cinema.id-cinema-editor .id-cinema-text .id-panel:nth-child(2) { background:linear-gradient(135deg,#003A30 0%,#001814 100%); }
.id-cinema.id-cinema-editor .id-cinema-text .id-panel:nth-child(3) { background:#001814; }
.id-cinema.id-cinema-editor .id-cinema-text .id-panel:nth-child(4) { background:radial-gradient(ellipse at 70% 40%,#0A4A3E 0%,#001814 70%); }
.id-cinema.id-cinema-editor .id-cinema-spacer { display:none; }
/* art kits — SCAN: dashed concentric rings + radial dots + glowing core */
.id-art-scan { position:relative; width:600px; height:600px; max-width:90vmin; max-height:90vmin; }
.id-art-scan .id-ring { position:absolute; inset:0; border-radius:50%; border:1px dashed rgba(199,231,56,0.3); animation:idRotate 30s linear infinite; }
.id-art-scan .id-ring.id-r2 { inset:15%; animation-duration:24s; animation-direction:reverse; border-color:rgba(199,231,56,0.5); }
.id-art-scan .id-ring.id-r3 { inset:32%; animation-duration:18s; border-color:rgba(199,231,56,0.7); }
.id-art-scan .id-dots { position:absolute; inset:0; border-radius:50%; background-image:radial-gradient(circle,rgba(199,231,56,0.4) 1px,transparent 1.4px); background-size:18px 18px; mask-image:radial-gradient(circle at center,black 30%,transparent 70%); -webkit-mask-image:radial-gradient(circle at center,black 30%,transparent 70%); }
.id-art-scan .id-core { position:absolute; inset:30%; border-radius:50%; background:radial-gradient(circle,rgba(199,231,56,0.4),rgba(199,231,56,0) 70%); filter:blur(20px); animation:idPulse2 4s ease-in-out infinite; }
@keyframes idRotate { to { transform:rotate(360deg); } }
@keyframes idPulse2 { 0%,100% { transform:scale(0.9); opacity:0.7; } 50% { transform:scale(1.1); opacity:1; } }
/* DESIGN: perspective grid floor + AI-gradient wireframe */
.id-art-design { position:relative; width:90vw; max-width:680px; height:480px; }
.id-art-design .id-grid-floor { position:absolute; inset:0; background-image:linear-gradient(to right,rgba(199,231,56,0.18) 1px,transparent 1px),linear-gradient(to bottom,rgba(199,231,56,0.18) 1px,transparent 1px); background-size:40px 40px; transform:perspective(800px) rotateX(60deg) translateY(80px); transform-origin:center center; mask-image:linear-gradient(180deg,transparent 0%,black 60%,transparent 100%); -webkit-mask-image:linear-gradient(180deg,transparent 0%,black 60%,transparent 100%); }
.id-art-design svg { position:absolute; inset:0; width:100%; height:100%; overflow:visible; }
/* MAKE: rail with traveler */
.id-art-make { position:relative; width:90vw; max-width:1200px; height:200px; }
.id-art-make .id-rail { position:absolute; left:0; right:0; top:50%; height:2px; background:linear-gradient(90deg,transparent 0%,var(--id-cit) 20%,var(--id-cit) 80%,transparent 100%); opacity:0.6; }
.id-art-make .id-node { position:absolute; top:50%; transform:translate(-50%,-50%); width:64px; height:64px; border-radius:50%; border:1.5px solid rgba(199,231,56,0.4); background:rgba(199,231,56,0.05); display:flex; align-items:center; justify-content:center; }
.id-art-make .id-node::before { content:""; width:14px; height:14px; border-radius:50%; background:var(--id-cit); box-shadow:0 0 24px var(--id-cit); animation:idNodePulse 2s ease-in-out infinite; }
.id-art-make .id-node:nth-child(2) { left:8%; }
.id-art-make .id-node:nth-child(3) { left:30%; }
.id-art-make .id-node:nth-child(4) { left:52%; }
.id-art-make .id-node:nth-child(5) { left:74%; }
.id-art-make .id-node:nth-child(6) { left:92%; }
.id-art-make .id-node:nth-child(3)::before { animation-delay:0.3s; }
.id-art-make .id-node:nth-child(4)::before { animation-delay:0.6s; }
.id-art-make .id-node:nth-child(5)::before { animation-delay:0.9s; }
.id-art-make .id-node:nth-child(6)::before { animation-delay:1.2s; }
.id-art-make .id-traveler { position:absolute; left:0; top:50%; transform:translateY(-50%); width:24px; height:24px; border-radius:50%; background:radial-gradient(circle,var(--id-cit),rgba(199,231,56,0)); filter:blur(2px); animation:idTravel 6s linear infinite; }
@keyframes idNodePulse { 0%,100% { transform:scale(0.8); opacity:0.7; } 50% { transform:scale(1); opacity:1; } }
@keyframes idTravel { 0%{left:0%;opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{left:100%;opacity:0} }
/* DATA: rising bars */
.id-art-bars { position:relative; width:90vw; max-width:760px; height:380px; display:grid; grid-template-columns:repeat(12,1fr); align-items:end; gap:8px; padding:0 20px; }
.id-art-bars .id-bar { background:linear-gradient(to top,var(--id-green) 0%,var(--id-cit) 100%); border-radius:2px 2px 0 0; opacity:0.85; animation:idBarRise 1.4s var(--id-ease) backwards; }
.id-art-bars .id-bar:nth-child(1){animation-delay:0.05s}
.id-art-bars .id-bar:nth-child(2){animation-delay:0.10s}
.id-art-bars .id-bar:nth-child(3){animation-delay:0.15s}
.id-art-bars .id-bar:nth-child(4){animation-delay:0.20s}
.id-art-bars .id-bar:nth-child(5){animation-delay:0.25s}
.id-art-bars .id-bar:nth-child(6){animation-delay:0.30s}
.id-art-bars .id-bar:nth-child(7){animation-delay:0.35s}
.id-art-bars .id-bar:nth-child(8){animation-delay:0.40s}
.id-art-bars .id-bar:nth-child(9){animation-delay:0.45s}
.id-art-bars .id-bar:nth-child(10){animation-delay:0.50s}
.id-art-bars .id-bar:nth-child(11){animation-delay:0.55s}
.id-art-bars .id-bar:nth-child(12){animation-delay:0.60s}
@keyframes idBarRise { from { transform:scaleY(0); transform-origin:bottom; opacity:0; } to { transform:scaleY(1); opacity:0.85; } }

/* PARALLAX SHOWCASE */
.id-showcase { position:relative; background:var(--id-teal-deep); padding:200px 0 240px; overflow:hidden; }
.id-showcase .id-head { max-width:1280px; margin:0 auto 120px; padding:0 40px; display:grid; grid-template-columns:1fr 1.4fr; gap:80px; align-items:end; }
.id-showcase .id-head .id-eyebrow { margin-bottom:24px; }
.id-showcase .id-head h2 { font-size:clamp(40px,5vw,76px); line-height:1.05; letter-spacing:-0.018em; color:#fff; margin:0; }
.id-showcase .id-head h2 em { color:var(--id-cit); }
.id-showcase .id-head .id-blurb { font-size:18px; line-height:1.55; color:rgba(255,255,255,0.65); max-width:50ch; font-weight:300; align-self:end; margin:0; }
.id-showcase .id-stack { position:relative; max-width:1480px; margin:0 auto; padding:0 40px; }
.id-showcase .id-frame { position:relative; margin:48px auto; border-radius:24px; overflow:hidden; box-shadow:0 60px 120px rgba(0,0,0,0.4); background:#0A4A3E; }
.id-showcase .id-frame.id-f1 { max-width:1100px; aspect-ratio:16/9; }
.id-showcase .id-frame.id-f2 { max-width:520px; aspect-ratio:3/4; margin-left:auto; margin-right:8%; margin-top:-180px; z-index:3; }
.id-showcase .id-frame.id-f3 { max-width:920px; aspect-ratio:16/10; margin-left:6%; margin-top:-100px; z-index:2; }
.id-showcase .id-frame .id-frame-img { position:absolute; inset:0; background-size:cover; background-position:center; transition:transform 1600ms var(--id-ease-out); transform:scale(var(--id-parallax-start, 1.08)); }
.id-showcase .id-frame.id-in-view .id-frame-img { transform:scale(1); }
.id-showcase .id-frame .id-frame-vignette { position:absolute; inset:0; background:linear-gradient(180deg,rgba(0,24,20,0) 0%,rgba(0,24,20,0.6) 100%); }
.id-showcase .id-frame .id-frame-caption { position:absolute; left:32px; bottom:28px; right:32px; display:flex; justify-content:space-between; align-items:flex-end; z-index:3; gap:24px; }
.id-showcase .id-frame .id-frame-label { font-size:10px; letter-spacing:0.28em; text-transform:uppercase; color:var(--id-cit); font-weight:500; }
.id-showcase .id-frame .id-frame-where { font-size:11px; letter-spacing:0.22em; text-transform:uppercase; color:rgba(255,255,255,0.5); font-weight:500; }
.id-showcase .id-frame .id-frame-caption h4 { font-size:clamp(24px,2.6vw,40px); line-height:1.05; letter-spacing:-0.012em; color:#fff; max-width:18ch; margin:12px 0 0; }
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
.id-invite h2 { font-size:clamp(48px,8vw,128px); line-height:0.96; letter-spacing:-0.025em; color:#fff; margin:0 0 32px; }
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
  .id-cinema-text .id-meta { flex-direction:column; align-items:flex-start; gap:24px; }
  .id-cinema-text .id-right { text-align:left; margin-left:0; }
  .id-cinema-stepper { display:none; }
  .id-showcase .id-frame.id-f2, .id-showcase .id-frame.id-f3 { margin-left:auto; margin-right:auto; margin-top:48px; }
}

@media (prefers-reduced-motion: reduce) {
  .id-block .id-reveal,
  .id-hero .id-hero-bg,
  .id-hero .id-hero-eyebrow,
  .id-hero h1 .id-line .id-line-inner,
  .id-hero .id-lead,
  .id-hero .id-ctas,
  .id-hero .id-scroll-hint,
  .id-hero .id-signal-orb,
  .id-art-bars .id-bar,
  .id-showcase .id-frame .id-frame-img,
  .id-intro h2 .id-word { opacity:1 !important; transform:none !important; transition:none !important; animation:none !important; }
}
`;

export function useInsideDandyStyles() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    // Bagoss Standard is loaded by the host app's index.css @font-face — we
    // just consume the family name from --id-display.
    if (!document.getElementById(STYLE_ID)) {
      const el = document.createElement("style");
      el.id = STYLE_ID;
      el.textContent = CSS;
      document.head.appendChild(el);
    }
  }, []);
}

/**
 * IntersectionObserver helper that adds `id-in-view` to an element the first
 * time it enters the viewport. Used by cinema pillars + showcase frames to
 * trigger their entrance animations once on scroll.
 */
export function useIdInView<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  opts: IntersectionObserverInit = { threshold: 0.25 },
) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      node.classList.add("id-in-view");
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add("id-in-view");
            obs.unobserve(entry.target);
          }
        }
      },
      opts,
    );
    obs.observe(node);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
