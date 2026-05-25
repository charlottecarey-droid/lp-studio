// Shared CSS for all "Inside Dandy" (id-*) blocks. Injected once into the
// document head; subsequent block instances re-use the same <style> node.
// All selectors are namespaced under `.id-block` to prevent leakage.

import { useEffect } from "react";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "../../lib/brand-fonts";

const STYLE_ID = "inside-dandy-block-styles";

const CSS = `
.id-block { --id-teal:#003A30; --id-teal-deep:#001814; --id-cit:#C7E738; --id-green:#1AC065; --id-line:rgba(255,255,255,0.08); --id-display: ${BRAND_DISPLAY_FONT}, Georgia, serif; --id-body: ${BRAND_BODY_FONT}; --id-ease:cubic-bezier(0.7,0,0.18,1); --id-ease-out:cubic-bezier(0.16,1,0.3,1); color:#fff; box-sizing:border-box; }
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

/* HERO — editorial cinematic. Toned down from the original "AI demo" look:
   no concentric pulsing rings, no chrome pill eyebrow, no rounded-pill CTAs,
   no centered "Scroll" pip. Replaces those with a single soft halo, a hairline
   editorial caption, sharp rectangular CTAs, and a corner index marker. */
.id-hero { position:relative; min-height:100vh; height:auto; display:flex; align-items:center; justify-content:center; overflow:hidden; background:var(--id-teal-deep); padding:120px 0 200px; }
.id-hero .id-hero-bg { position:absolute; inset:-5%; background-size:cover; background-position:center; opacity:0; transform:scale(1.12); transition:opacity 1800ms var(--id-ease-out), transform 16000ms linear; filter:saturate(0.42) contrast(1.04) brightness(0.88); }
.id-hero.id-ready .id-hero-bg { opacity:0.22; transform:scale(1); }
/* Single restrained vignette + bottom fade. Drops the previous double-radial
   stack that made the page feel CGI. */
.id-hero .id-hero-overlay { position:absolute; inset:0; z-index:2; background:linear-gradient(180deg,rgba(0,24,20,0.55) 0%,rgba(0,24,20,0.18) 38%,rgba(0,24,20,0.92) 100%),radial-gradient(ellipse at 50% 100%,rgba(0,58,48,0.55) 0%,rgba(0,24,20,0) 65%); }
/* Architectural hairline grid — neutral white instead of lime, larger cell,
   masked toward the edges so it reads as structure not pattern. */
.id-hero .id-hero-grid { position:absolute; inset:0; z-index:3; background-image:linear-gradient(to right,rgba(255,255,255,0.022) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.022) 1px,transparent 1px); background-size:140px 140px; mask-image:radial-gradient(ellipse at 50% 60%,black 0%,transparent 78%); -webkit-mask-image:radial-gradient(ellipse at 50% 60%,black 0%,transparent 78%); }
/* Single soft backlit halo — no pulsing rings, no concentric stencils. */
.id-hero .id-signal-orb { position:absolute; left:50%; top:54%; width:780px; height:780px; max-width:100vmin; max-height:100vmin; border-radius:50%; z-index:3; pointer-events:none; opacity:0; transform:translate(-50%,-50%) scale(0.86); transition:opacity 2200ms 300ms var(--id-ease-out), transform 2400ms 200ms var(--id-ease-out); background:radial-gradient(circle at 50% 50%,rgba(199,231,56,0.07) 0%,rgba(199,231,56,0.022) 38%,rgba(199,231,56,0) 65%); filter:blur(24px); }
.id-hero.id-ready .id-signal-orb { opacity:1; transform:translate(-50%,-50%) scale(1); }
/* Drop the pulsing inner glow — that breathing animation was the loudest
   "made by AI" signal in the original hero. */
.id-hero .id-signal-orb::before { content:none; }

.id-hero .id-hero-content { position:relative; z-index:10; text-align:center; max-width:1100px; padding:0 40px; margin:0 auto; width:100%; }
/* Editorial caption — no pill chrome, no glowing dot. A short hairline rule
   on each side flanks the label, mimicking a magazine kicker. */
.id-hero .id-hero-eyebrow { display:inline-flex; align-items:center; justify-content:center; gap:14px; margin:0 0 36px; padding:0; border:0; border-radius:0; background:transparent; color:rgba(255,255,255,0.62); font-size:11px; letter-spacing:0.22em; text-transform:uppercase; font-weight:500; opacity:0; transform:translateY(8px); transition:opacity 1000ms 100ms var(--id-ease-out), transform 1000ms 100ms var(--id-ease-out); }
.id-hero .id-hero-eyebrow::before { content:""; width:24px; height:1px; border-radius:0; background:var(--id-cit); box-shadow:none; flex-shrink:0; }
.id-hero .id-hero-eyebrow::after { content:""; width:24px; height:1px; background:rgba(255,255,255,0.18); flex-shrink:0; }
.id-hero.id-ready .id-hero-eyebrow { opacity:1; transform:translateY(0); }

.id-hero h1 { font-family:var(--id-display); font-weight:400; font-size:calc(clamp(48px,8vw,140px) * var(--id-hero-h1-scale, 1)); line-height:0.94; letter-spacing:-0.032em; color:#fff; margin:0; overflow-wrap:break-word; word-break:normal; hyphens:auto; }
/* Headline reveal: the whole h1 fades in as one block, timed to overlap
   the bg image's 1800ms opacity entrance (scale-down keeps running for
   16s after). Uses a linear curve — ease-out curves frontload opacity
   changes so the headline reads as "popped in" rather than "faded in";
   linear keeps the rise uniform so the eye actually perceives the fade.
   Duration bumped to 2400ms + 400ms delay so the entrance lingers long
   enough to feel intentional alongside the bg settling in behind. */
.id-hero h1 { opacity:0; transition:opacity 2400ms 400ms linear; will-change:opacity; }
.id-hero h1 .id-line { display:block; }
.id-hero h1 .id-line .id-line-inner { display:block; }
.id-hero.id-ready h1 { opacity:1; }
/* Slightly tighter, narrower lead — feels like editorial body copy not
   marketing landing-page filler. */
.id-hero .id-lead { font-size:clamp(15px,1.3vw,18px); line-height:1.65; color:rgba(255,255,255,0.72); max-width:560px; margin:40px auto 52px; font-weight:350; letter-spacing:0.005em; opacity:0; transform:translateY(8px); transition:opacity 1100ms 720ms var(--id-ease-out), transform 1100ms 720ms var(--id-ease-out); }
.id-hero.id-ready .id-lead { opacity:1; transform:translateY(0); }
.id-hero .id-ctas { display:flex; gap:24px; justify-content:center; align-items:center; flex-wrap:wrap; opacity:0; transform:translateY(8px); transition:opacity 1100ms 880ms var(--id-ease-out), transform 1100ms 880ms var(--id-ease-out); }
.id-hero.id-ready .id-ctas { opacity:1; transform:translateY(0); }

/* Left-aligned hero variant — text, lead and CTAs hug the left edge. */
.id-hero.id-hero-align-left .id-hero-content { text-align:left; }
.id-hero.id-hero-align-left .id-hero-eyebrow { justify-content:flex-start; }
.id-hero.id-hero-align-left .id-lead { margin-left:0; margin-right:auto; }
.id-hero.id-hero-align-left .id-ctas { justify-content:flex-start; }

/* Bottom-right corner index marker. The original centered "Scroll" pip with
   an animated lime gradient line read as stock template; this anchors the
   composition like a magazine folio. */
.id-hero .id-scroll-hint { position:absolute; bottom:36px; right:40px; left:auto; top:auto; transform:none; z-index:10; font-size:10px; letter-spacing:0.28em; text-transform:uppercase; color:rgba(255,255,255,0.42); display:flex; flex-direction:column; align-items:flex-end; gap:14px; opacity:0; transition:opacity 1500ms 1400ms var(--id-ease-out); pointer-events:none; }
.id-hero.id-ready .id-scroll-hint { opacity:1; }
.id-hero .id-scroll-hint .id-scroll-line { width:1px; height:64px; background:linear-gradient(to bottom,rgba(255,255,255,0.45),transparent); animation:idScrollLine 2.6s ease-in-out infinite; }
@keyframes idScrollLine { 0%{transform:scaleY(0);transform-origin:top} 50%{transform:scaleY(1);transform-origin:top} 51%{transform:scaleY(1);transform-origin:bottom} 100%{transform:scaleY(0);transform-origin:bottom} }

/* BUTTONS */
.id-btn { display:inline-flex; align-items:center; gap:10px; padding:18px 32px; font-size:13px; letter-spacing:0.04em; font-weight:500; text-decoration:none; border-radius:999px; cursor:pointer; transition:transform 280ms var(--id-ease), box-shadow 280ms var(--id-ease), background 280ms var(--id-ease); border:1px solid transparent; font-family:inherit; }
.id-btn-primary { background:var(--id-cit); color:var(--id-teal-deep); }
.id-btn-primary:hover { transform:translateY(-2px); box-shadow:0 16px 40px rgba(199,231,56,0.3); }
.id-btn-ghost { background:transparent; color:#fff; border-color:rgba(255,255,255,0.2); }
.id-btn-ghost:hover { background:rgba(255,255,255,0.06); border-color:rgba(255,255,255,0.4); }

/* Hero-only CTA refinements — sharper rectangular geometry and an editorial
   text-link as the secondary action. Scoped to .id-hero so other blocks
   keep the existing pill defaults. */
.id-hero .id-btn { padding:16px 26px; border-radius:6px; font-size:13px; letter-spacing:0.06em; gap:12px; }
.id-hero .id-btn-primary { background:var(--id-cit); color:var(--id-teal-deep); box-shadow:0 1px 0 rgba(255,255,255,0.35) inset, 0 12px 32px rgba(199,231,56,0.18); }
.id-hero .id-btn-primary:hover { transform:translateY(-1px); box-shadow:0 1px 0 rgba(255,255,255,0.4) inset, 0 18px 40px rgba(199,231,56,0.28); }
/* The literal "→" character in the JSX lives inside an aria-hidden span — we
   shrink it and slide it on hover so it reads as a refined cue, not a glyph. */
.id-hero .id-btn-primary > [aria-hidden] { display:inline-block; transform:translateX(0); transition:transform 280ms var(--id-ease); font-size:14px; line-height:1; opacity:0.9; }
.id-hero .id-btn-primary:hover > [aria-hidden] { transform:translateX(4px); opacity:1; }
/* Ghost CTA → editorial text link with an animated underline rule. */
.id-hero .id-btn-ghost { background:transparent; border:0; color:rgba(255,255,255,0.78); padding:16px 4px; border-radius:0; position:relative; }
.id-hero .id-btn-ghost::after { content:""; position:absolute; left:4px; right:4px; bottom:10px; height:1px; background:rgba(255,255,255,0.32); transform-origin:left center; transition:background 280ms var(--id-ease), transform 320ms var(--id-ease); }
.id-hero .id-btn-ghost:hover { background:transparent; color:#fff; transform:none; box-shadow:none; }
.id-hero .id-btn-ghost:hover::after { background:var(--id-cit); transform:scaleX(1.04); }

/* MARQUEE */
.id-marquee { position:relative; background:var(--id-teal-deep); border-top:1px solid var(--id-line); border-bottom:1px solid var(--id-line); padding:28px 0; overflow:hidden; }
.id-marquee .id-track { display:flex; gap:80px; white-space:nowrap; animation:idMarquee 40s linear infinite; font-family:var(--id-display); font-size:24px; letter-spacing:-0.01em; color:rgba(255,255,255,0.5); width:max-content; }
.id-marquee .id-track .id-item { display:inline-flex; align-items:center; gap:80px; }
.id-marquee .id-track .id-item::after { content:"·"; color:var(--id-cit); margin-left:80px; }
@keyframes idMarquee { to { transform:translateX(-50%); } }

/* INTRO — word-by-word brighten on scroll progress (set as inline style on each word) */
.id-intro { padding:200px 40px; background:var(--id-teal-deep); position:relative; }
.id-intro.id-intro--flush { padding-bottom:0; }
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
/* Layer crossfade is now driven by a per-layer --p (0..1) CSS variable
   that the JS scroll handler writes every rAF tick. No fixed transitions
   here — the browser interpolates smoothly because --p itself is updated
   continuously as the user scrolls. */
.id-cinema-art .id-layer { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; opacity:var(--p,0); transform:scale(calc(1 + 0.05 * (1 - var(--p,0)))); pointer-events:none; will-change:opacity,transform; }
/* Keep the .id-active class as a no-op fallback for environments where
   the JS hasn't run (SSR / first paint / reduced motion users). */
.id-cinema-art .id-layer.id-active { opacity:1; }
@media (prefers-reduced-motion: reduce) {
  .id-cinema-art .id-layer { transform:none; }
}
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
.id-spotlight-card { position:absolute; left:50%; bottom:6%; transform:translateX(-25%); width:min(360px, 60%); background:rgba(15,28,26,0.92); backdrop-filter:blur(12px); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:18px 18px 14px; box-shadow:0 24px 60px -20px rgba(0,0,0,0.7); color:#fff; z-index:2; opacity:1; transition:opacity 1100ms var(--id-ease-out), transform 1100ms var(--id-ease-out); will-change:opacity, transform; }
.id-spotlight-card.id-sp-card-hidden { opacity:0; transform:translateX(-25%) translateY(12px); pointer-events:none; }
.id-sp-result-anim { animation:id-sp-result-in 900ms var(--id-ease-out) both; }
@keyframes id-sp-result-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
.id-sp-step { transition:color 360ms var(--id-ease-out); }
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
.id-spotlight-stepper { position:absolute; right:24px; top:50%; transform:translateY(-50%); display:flex; flex-direction:column; gap:18px; list-style:none; padding:0; margin:0; z-index:3; pointer-events:none; text-shadow:0 1px 6px rgba(0,0,0,0.65); }
.id-sp-step { display:flex; align-items:center; gap:14px; justify-content:flex-end; font:500 10px/1 var(--id-mono, ui-monospace, monospace); letter-spacing:0.22em; text-transform:uppercase; color:rgba(255,255,255,0.35); }
.id-sp-step.id-active { color:#fff; }
.id-sp-step-dot { width:6px; height:6px; border-radius:50%; background:rgba(255,255,255,0.3); transition:all 240ms var(--id-ease); }
.id-sp-step.id-active .id-sp-step-dot { background:var(--id-cit, #C7E738); box-shadow:0 0 12px var(--id-cit, #C7E738); transform:scale(1.4); }
@media (max-width: 900px) {
  .id-spotlight { padding:80px 0 100px; }
  .id-spotlight-grid { grid-template-columns:1fr; gap:32px; padding:0 24px; }
  /* On phones the floating card, stepper, and dark video void overlap
   * each other awkwardly — there isn't room for the editorial split-
   * panel layout to breathe. Hide the entire stage on small screens
   * so the section reads as a clean headline + body feature; the
   * desktop layout is unchanged. */
  .id-spotlight-stage { display:none; }
  /* Stepper is positioned absolutely against .id-spotlight-grid, not the
     stage — when the stage is display:none on phones the stepper would
     otherwise float over the next block as 3-4 dim mono labels reading
     as "random lines" above whatever block follows (e.g. the id-grid
     numbered cards). Hide it alongside the stage on mobile. */
  .id-spotlight-stepper { display:none; }
}
.id-cinema-text { position:absolute; inset:0; padding:0 60px 80px; z-index:5; pointer-events:none; }
/* Panels use the same scroll-driven --p (0..1) variable as the layers,
   tweening their entrance offset toward 0 as the panel becomes active.
   The .id-active class is still toggled by React (cheaply) so the active
   panel can receive pointer events; opacity/transform are continuous. */
.id-cinema-text .id-panel { position:absolute; inset:0; display:flex; align-items:flex-end; padding:80px 60px; opacity:var(--p,0); pointer-events:none; will-change:opacity,transform; }
.id-cinema-text .id-panel:nth-child(1) { transform:translateY(calc(40px * (1 - var(--p,0)))); }
.id-cinema-text .id-panel:nth-child(2) { transform:translateX(calc(-60px * (1 - var(--p,0)))); }
.id-cinema-text .id-panel:nth-child(3) { transform:scale(calc(1 - 0.06 * (1 - var(--p,0)))); }
.id-cinema-text .id-panel:nth-child(4) { transform:translateX(calc(60px * (1 - var(--p,0)))); }
/* Mirror the .id-layer no-JS fallback: keep the active panel visible
   for SSR / first paint / reduced motion users before the rAF loop has
   had a chance to write --p. */
.id-cinema-text .id-panel.id-active { pointer-events:auto; opacity:1; }
@media (prefers-reduced-motion: reduce) {
  .id-cinema-text .id-panel { transform:none !important; }
}
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
/* FLAT mode — toggle off the cinematic sticky scroll: stacked sections, normal scroll */
.id-cinema.id-cinema-flat .id-cinema-sticky { position:static; height:auto; min-height:auto; overflow:visible; }
.id-cinema.id-cinema-flat .id-cinema-sticky::after { display:none; }
.id-cinema.id-cinema-flat .id-cinema-bg { display:none; }
.id-cinema.id-cinema-flat .id-cinema-stepper { display:none; }
.id-cinema.id-cinema-flat .id-cinema-art { display:none; }
.id-cinema.id-cinema-flat .id-cinema-text { position:relative; inset:auto; padding:0; display:flex; flex-direction:column; pointer-events:auto; }
/* Flat mode: each panel is a self-contained 100vh stage where the text
   overlays the video — same composition as the sticky/stacked mode, just
   one panel per scroll page instead of a cross-fading sticky stack. */
.id-cinema.id-cinema-flat .id-cinema-text .id-panel { position:relative; inset:auto; opacity:1; transform:none; display:block; padding:0; min-height:100vh; border-bottom:1px solid var(--id-line); pointer-events:auto; overflow:hidden; background:#001814; }
.id-cinema.id-cinema-flat .id-panel-art { position:absolute; inset:0; width:100%; height:100%; max-width:none; margin:0; aspect-ratio:auto; overflow:hidden; border-radius:0; background:#001814; z-index:1; }
.id-cinema.id-cinema-flat .id-panel-art > * { position:absolute; inset:0; width:100%; height:100%; opacity:1; transform:none; display:flex; align-items:center; justify-content:center; }
.id-cinema.id-cinema-flat .id-panel-art .id-art-video { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
/* Subtle darkening so light copy stays legible over the video, mirroring
   the radial bg + noise overlay the sticky mode gets from .id-cinema-bg. */
.id-cinema.id-cinema-flat .id-panel-art::after { content:""; position:absolute; inset:0; background:linear-gradient(180deg,rgba(0,24,20,0.35) 0%,rgba(0,24,20,0.15) 40%,rgba(0,24,20,0.75) 100%); pointer-events:none; z-index:1; }
.id-cinema.id-cinema-flat .id-cinema-text .id-panel .id-meta { position:relative; z-index:2; min-height:100vh; padding:96px 60px; display:flex; justify-content:space-between; align-items:flex-end; gap:60px; flex-wrap:wrap; }
.id-cinema.id-cinema-flat .id-cinema-spacer { display:none; }
@media (max-width: 768px) {
  .id-cinema.id-cinema-flat .id-cinema-text .id-panel .id-meta { padding:64px 24px; }
}
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
/* Default state: bars sit collapsed so the entrance animation reads as
   "growing up from zero" each time the layer activates. The animation rule
   is gated on the .id-layer.id-active selector below; when the layer loses
   .id-active the rule no longer applies and the bars snap back to this
   collapsed base, so the next activation re-plays the staggered rise. */
.id-art-bars .id-bar { position:relative; background:linear-gradient(to top,var(--id-green) 0%,var(--id-cit) 100%); border-radius:3px 3px 0 0; opacity:0; transform:scaleY(0); transform-origin:bottom; box-shadow:0 0 0 rgba(199,231,56,0); }
/* Premium entrance: each bar rises individually (~1.1s) with a wide 0.22s
   stagger so the columns read as a deliberate one-by-one measurement
   instead of a single wave. Soft overshoot at the top (settle, not
   bounce) plus a brief glow that fades after the bar lands. */
.id-cinema-art .id-layer.id-active .id-art-bars .id-bar,
.id-cinema.id-cinema-flat .id-panel-art .id-art-bars .id-bar { animation:idBarRise 1.1s cubic-bezier(0.22, 1.4, 0.36, 1) both; }
.id-art-bars .id-bar:nth-child(1){animation-delay:0.10s}
.id-art-bars .id-bar:nth-child(2){animation-delay:0.32s}
.id-art-bars .id-bar:nth-child(3){animation-delay:0.54s}
.id-art-bars .id-bar:nth-child(4){animation-delay:0.76s}
.id-art-bars .id-bar:nth-child(5){animation-delay:0.98s}
.id-art-bars .id-bar:nth-child(6){animation-delay:1.20s}
.id-art-bars .id-bar:nth-child(7){animation-delay:1.42s}
.id-art-bars .id-bar:nth-child(8){animation-delay:1.64s}
.id-art-bars .id-bar:nth-child(9){animation-delay:1.86s}
.id-art-bars .id-bar:nth-child(10){animation-delay:2.08s}
.id-art-bars .id-bar:nth-child(11){animation-delay:2.30s}
.id-art-bars .id-bar:nth-child(12){animation-delay:2.52s}
@keyframes idBarRise {
  0%   { transform:scaleY(0);     opacity:0;    box-shadow:0 0 0 rgba(199,231,56,0); }
  55%  { opacity:0.85; }
  78%  { transform:scaleY(1.06);  opacity:0.95; box-shadow:0 -8px 28px rgba(199,231,56,0.32); }
  90%  { transform:scaleY(0.985); }
  100% { transform:scaleY(1);     opacity:0.85; box-shadow:0 0 0 rgba(199,231,56,0); }
}

/* PARALLAX SHOWCASE */
.id-showcase { position:relative; background:var(--id-teal-deep); padding:200px 0 240px; overflow:hidden; }
.id-showcase.id-showcase--flush-bottom { padding-bottom:0; }
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
.id-showcase .id-frame .id-frame-spatial { position:absolute; inset:0; pointer-events:none; z-index:2; }
/* Corner brackets — outer L plus a short inner tick that hooks back
   toward the center, giving the bracket a sculpted, instrument-like
   weight rather than a flat single line. */
.id-showcase .id-frame .id-frame-spatial-corner { position:absolute; width:clamp(32px,3.8vw,58px); height:clamp(32px,3.8vw,58px); border:0 solid var(--id-cit); filter:drop-shadow(0 0 8px rgba(199,231,56,0.45)); }
.id-showcase .id-frame .id-frame-spatial-corner::before, .id-showcase .id-frame .id-frame-spatial-corner::after { content:""; position:absolute; background:var(--id-cit); opacity:0.85; box-shadow:0 0 6px rgba(199,231,56,0.5); }
.id-showcase .id-frame .id-frame-spatial-corner::before { width:10px; height:1px; }
.id-showcase .id-frame .id-frame-spatial-corner::after { width:1px; height:10px; }
.id-showcase .id-frame .id-frame-spatial-corner--tl { top:clamp(14px,1.6vw,24px); left:clamp(14px,1.6vw,24px); border-top-width:1.5px; border-left-width:1.5px; }
.id-showcase .id-frame .id-frame-spatial-corner--tl::before { top:8px; left:-1px; }
.id-showcase .id-frame .id-frame-spatial-corner--tl::after { top:-1px; left:8px; }
.id-showcase .id-frame .id-frame-spatial-corner--tr { top:clamp(14px,1.6vw,24px); right:clamp(14px,1.6vw,24px); border-top-width:1.5px; border-right-width:1.5px; }
.id-showcase .id-frame .id-frame-spatial-corner--tr::before { top:8px; right:-1px; }
.id-showcase .id-frame .id-frame-spatial-corner--tr::after { top:-1px; right:8px; }
.id-showcase .id-frame .id-frame-spatial-corner--bl { bottom:clamp(14px,1.6vw,24px); left:clamp(14px,1.6vw,24px); border-bottom-width:1.5px; border-left-width:1.5px; }
.id-showcase .id-frame .id-frame-spatial-corner--bl::before { bottom:8px; left:-1px; }
.id-showcase .id-frame .id-frame-spatial-corner--bl::after { bottom:-1px; left:8px; }
.id-showcase .id-frame .id-frame-spatial-corner--br { bottom:clamp(14px,1.6vw,24px); right:clamp(14px,1.6vw,24px); border-bottom-width:1.5px; border-right-width:1.5px; }
.id-showcase .id-frame .id-frame-spatial-corner--br::before { bottom:8px; right:-1px; }
.id-showcase .id-frame .id-frame-spatial-corner--br::after { bottom:-1px; right:8px; }

/* Reticle stack — a faint outer ring, a solid inner ring with a soft
   radial wash, four cardinal hash ticks, the crosshair, and a center
   pip. The breathing animation keeps it from feeling static. */
.id-showcase .id-frame .id-frame-spatial-reticle { position:absolute; left:50%; top:50%; width:clamp(120px,17vw,220px); height:clamp(120px,17vw,220px); border:1.5px solid var(--id-cit); border-radius:50%; transform:translate(-50%,-50%); box-shadow:0 0 28px rgba(199,231,56,0.22), inset 0 0 32px rgba(199,231,56,0.08); background:radial-gradient(circle at center, rgba(199,231,56,0.07) 0%, rgba(199,231,56,0.02) 55%, transparent 75%); animation:id-reticle-breathe 4.8s ease-in-out infinite; }
@keyframes id-reticle-breathe { 0%, 100% { box-shadow:0 0 28px rgba(199,231,56,0.22), inset 0 0 32px rgba(199,231,56,0.08); } 50% { box-shadow:0 0 38px rgba(199,231,56,0.32), inset 0 0 40px rgba(199,231,56,0.12); } }
.id-showcase .id-frame .id-frame-spatial-reticle::before { content:""; position:absolute; left:50%; top:50%; width:calc(100% + 18px); height:calc(100% + 18px); border:1px dashed rgba(199,231,56,0.35); border-radius:50%; transform:translate(-50%,-50%); }
.id-showcase .id-frame .id-frame-spatial-reticle::after { content:""; position:absolute; left:50%; top:50%; width:38%; height:38%; border:1px solid rgba(199,231,56,0.45); border-radius:50%; transform:translate(-50%,-50%); }
.id-showcase .id-frame .id-frame-spatial-cross { position:absolute; left:50%; top:50%; width:18px; height:18px; transform:translate(-50%,-50%); }
.id-showcase .id-frame .id-frame-spatial-cross::before, .id-showcase .id-frame .id-frame-spatial-cross::after { content:""; position:absolute; left:50%; top:50%; background:var(--id-cit); box-shadow:0 0 6px rgba(199,231,56,0.6); }
.id-showcase .id-frame .id-frame-spatial-cross::before { width:18px; height:1.5px; transform:translate(-50%,-50%); }
.id-showcase .id-frame .id-frame-spatial-cross::after { width:1.5px; height:18px; transform:translate(-50%,-50%); }
.id-showcase .id-frame .id-frame-spatial-pip { position:absolute; left:50%; top:50%; width:4px; height:4px; background:var(--id-cit); border-radius:50%; transform:translate(-50%,-50%); box-shadow:0 0 8px rgba(199,231,56,0.9); }
.id-showcase .id-frame .id-frame-spatial-tick { position:absolute; background:var(--id-cit); box-shadow:0 0 4px rgba(199,231,56,0.55); }
.id-showcase .id-frame .id-frame-spatial-tick--n { left:50%; top:calc(50% - clamp(78px,11vw,142px)); width:1.5px; height:10px; transform:translateX(-50%); }
.id-showcase .id-frame .id-frame-spatial-tick--s { left:50%; top:calc(50% + clamp(68px,10vw,132px)); width:1.5px; height:10px; transform:translateX(-50%); }
.id-showcase .id-frame .id-frame-spatial-tick--e { left:calc(50% + clamp(68px,10vw,132px)); top:50%; width:10px; height:1.5px; transform:translateY(-50%); }
.id-showcase .id-frame .id-frame-spatial-tick--w { left:calc(50% - clamp(78px,11vw,142px)); top:50%; width:10px; height:1.5px; transform:translateY(-50%); }

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

/* CENTERED NUMBERED GRID — premium variant of the invitation pattern.
   Centered eyebrow / heading / subheading at the top, followed by a fixed
   2x2 grid of numbered cards. Built with the same teal background, citron
   accents, Bagoss display type, and hairline dividers as the rest of the
   ID suite. */
.id-grid { position:relative; background:var(--id-teal-deep); padding:200px 40px 220px; overflow:hidden; }
.id-grid.id-grid-flush-bottom { padding-bottom:0; }
.id-grid::before { content:""; position:absolute; left:50%; top:-10%; transform:translateX(-50%); width:120vh; height:120vh; border-radius:50%; background:radial-gradient(circle at 50% 50%,rgba(199,231,56,0.06) 0%,rgba(199,231,56,0) 60%); pointer-events:none; z-index:0; }
.id-grid .id-inner { position:relative; z-index:1; max-width:1240px; margin:0 auto; }
.id-grid .id-grid-intro { text-align:center; max-width:820px; margin:0 auto 120px; display:flex; flex-direction:column; align-items:center; gap:32px; }
.id-grid .id-grid-intro .id-eyebrow { justify-content:center; margin:0; }
.id-grid .id-grid-intro h2 { font-size:clamp(40px,5.4vw,80px); line-height:1.02; letter-spacing:-0.022em; color:#fff; margin:0; max-width:18ch; }
.id-grid .id-grid-intro h2 em { color:var(--id-cit); }
.id-grid .id-grid-intro .id-grid-sub { font-size:clamp(16px,1.4vw,20px); line-height:1.55; color:rgba(255,255,255,0.72); max-width:58ch; margin:0; font-weight:300; }
.id-grid .id-grid-cards { display:grid; grid-template-columns:repeat(2,1fr); gap:0; border-top:1px solid var(--id-line); border-left:1px solid var(--id-line); }
.id-grid .id-grid-card { position:relative; padding:64px 56px 56px; border-right:1px solid var(--id-line); border-bottom:1px solid var(--id-line); display:flex; flex-direction:column; gap:20px; min-height:340px; background:transparent; transition:background 320ms var(--id-ease); }
.id-grid .id-grid-card:hover { background:rgba(199,231,56,0.025); }
.id-grid .id-grid-card .id-grid-num { font-family:var(--id-display); font-size:18px; line-height:1; letter-spacing:0.04em; color:var(--id-cit); font-feature-settings:"tnum"; font-weight:400; }
.id-grid .id-grid-card .id-grid-eyebrow { font-size:10px; letter-spacing:0.28em; text-transform:uppercase; color:rgba(255,255,255,0.55); font-weight:500; }
.id-grid .id-grid-card .id-grid-chip { display:inline-flex; align-items:center; gap:6px; align-self:flex-start; padding:4px 9px 4px 8px; margin-top:-4px; border:1px solid rgba(199,231,56,0.35); border-radius:999px; font-size:10px; letter-spacing:0.14em; text-transform:uppercase; color:var(--id-cit); font-weight:500; background:rgba(199,231,56,0.04); }
.id-grid .id-grid-card .id-grid-chip::before { content:""; width:5px; height:5px; border-radius:50%; background:var(--id-cit); box-shadow:0 0 6px rgba(199,231,56,0.7); }
@keyframes idHeroLivePulse { 0% { box-shadow:0 0 0 0 rgba(199,231,56,0.55); } 70% { box-shadow:0 0 0 8px rgba(199,231,56,0); } 100% { box-shadow:0 0 0 0 rgba(199,231,56,0); } }
.id-grid .id-grid-card .id-grid-headline { font-family:var(--id-display); font-weight:400; font-size:clamp(24px,2.2vw,32px); line-height:1.12; letter-spacing:-0.012em; color:#fff; margin:0; }
.id-grid .id-grid-card .id-grid-headline em { color:var(--id-cit); font-style:italic; }
.id-grid .id-grid-card .id-grid-body { font-size:15px; line-height:1.55; color:rgba(255,255,255,0.7); margin:0; font-weight:300; }
.id-grid .id-grid-card .id-grid-cta { margin-top:auto; display:inline-flex; align-items:center; gap:10px; font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:var(--id-cit); text-decoration:none; font-weight:500; padding-top:8px; transition:gap 280ms var(--id-ease), color 280ms var(--id-ease); align-self:flex-start; }
.id-grid .id-grid-card .id-grid-cta::after { content:"→"; display:inline-block; transition:transform 280ms var(--id-ease); }
.id-grid .id-grid-card:hover .id-grid-cta { gap:14px; }
.id-grid .id-grid-card:hover .id-grid-cta::after { transform:translateX(4px); }
@media (max-width:780px) {
  .id-grid { padding:120px 24px 140px; }
  .id-grid.id-grid-flush-bottom { padding-bottom:0; }
  .id-grid .id-grid-intro { margin-bottom:64px; gap:24px; }
  .id-grid .id-grid-cards { grid-template-columns:1fr; border-left:none; border-top:1px solid var(--id-line); }
  .id-grid .id-grid-card { padding:48px 8px 40px; min-height:0; border-right:none; }
}

@media (max-width:980px) {
  .id-showcase .id-head { grid-template-columns:1fr; }
  .id-stats .id-inner { grid-template-columns:repeat(2,1fr); }
  .id-stats .id-stat { border-left:none; border-top:1px solid var(--id-line); padding:32px 0; }
  .id-cinema-text .id-meta { flex-direction:column; align-items:flex-start; gap:24px; }
  .id-cinema-text .id-num em { font-style:normal; }
  .id-cinema-text .id-right { text-align:left; margin-left:0; }
  .id-cinema-stepper { display:none; }
  /* Network Analytics (bars) pillar: stack art on top, text below so the
     headline / label / body don't overlap the animated bars. Other pillars
     keep their default centered art + bottom text overlay. */
  .id-cinema-art .id-layer.id-pillar-bars { align-items:flex-start; padding-top:64px; }
  .id-cinema-art .id-layer.id-pillar-bars .id-art-bars { height:200px; max-width:92vw; padding:0 12px; }
  .id-cinema-text .id-panel.id-pillar-bars { align-items:flex-end; padding-bottom:48px; }
  .id-showcase .id-frame.id-f2, .id-showcase .id-frame.id-f3 { margin-left:auto; margin-right:auto; margin-top:48px; }
}

/* Headline fade-on-scroll. BlockIdHero writes --id-hero-scroll (0..1) to the
   .id-hero section as the viewport scrolls past it. We fade & gently shrink
   the headline + lead so the next section feels like the payoff instead of
   a comedown (Apple product-page trick). Pure CSS off the var — no React
   re-renders. Disabled in reduced-motion via the clause below. */
.id-hero h1 {
  opacity:calc(1 - var(--id-hero-scroll, 0) * 0.85);
  transform:scale(calc(1 - var(--id-hero-scroll, 0) * 0.06)) translateY(calc(var(--id-hero-scroll, 0) * -16px));
  transform-origin:50% 30%;
  transition:opacity 120ms linear, transform 120ms linear;
  will-change:opacity, transform;
}
.id-hero .id-lead,
.id-hero .id-hero-eyebrow,
.id-hero .id-ctas {
  opacity:calc(1 - var(--id-hero-scroll, 0) * 1.15);
}
.id-hero .id-scroll-hint { opacity:calc(1 - var(--id-hero-scroll, 0) * 2); }

/* Cursor-tracking signal orb. BlockIdHero writes eased --id-orb-x / --id-orb-y
   (px offsets) on the .id-hero section so the lime halo drifts gently toward
   the cursor while at rest, then settles back to center. Pure-CSS consumption
   — keeps the existing entrance transform (translate -50% / -50%) intact and
   just composes the parallax offset on top via the var defaults. */
.id-hero.id-ready .id-signal-orb {
  transform:translate(calc(-50% + var(--id-orb-x, 0px)), calc(-50% + var(--id-orb-y, 0px))) scale(1);
}

/* Hero background micro-zoom. CSS rule: 'animation' shorthand wins over
   'transition' on the same property, so we can't keep the original 16s
   scale(1.12)→scale(1) transition AND add a breathe animation on transform
   — the animation would clobber the entrance. Instead we bake both into a
   single keyframes: start at the entrance scale, glide to 1 over the first
   ~30%, then continuously breathe between 1 and 1.045. Total cycle 30s so
   the entrance feels deliberate, then breathe takes over invisibly. */
@keyframes idHeroBreathe {
  0%   { transform:scale(1.12); }
  30%  { transform:scale(1.00); }
  65%  { transform:scale(1.045); }
  100% { transform:scale(1.00); }
}
.id-hero.id-ready .id-hero-bg {
  animation:idHeroBreathe 30s cubic-bezier(0.22, 1, 0.36, 1) infinite;
}

/* Id-grid reveal-on-scroll. BlockIdGrid adds .id-grid-revealed once the
   block enters the viewport. Cards stagger in (intro → 4 cards) using
   transition-delay on nth-child. Same visual language as the hero h1
   reveal (translateY + opacity, cinematic easing). */
.id-grid .id-grid-intro,
.id-grid .id-grid-card {
  opacity:0;
  transform:translateY(28px);
  transition:opacity 900ms var(--id-ease-out), transform 900ms var(--id-ease-out);
  will-change:opacity, transform;
}
.id-grid.id-grid-revealed .id-grid-intro { opacity:1; transform:none; transition-delay:0ms; }
.id-grid.id-grid-revealed .id-grid-card { opacity:1; transform:none; }
.id-grid.id-grid-revealed .id-grid-card:nth-child(1) { transition-delay:180ms; }
.id-grid.id-grid-revealed .id-grid-card:nth-child(2) { transition-delay:300ms; }
.id-grid.id-grid-revealed .id-grid-card:nth-child(3) { transition-delay:420ms; }
.id-grid.id-grid-revealed .id-grid-card:nth-child(4) { transition-delay:540ms; }

/* Cinema-pillar video fade-in. Each <video> mounts with opacity:0 until
   BlockIdCinemaPillars receives the loadeddata event and toggles
   .id-video-ready — fades the first frame in instead of flashing in
   mid-decode. The crossfade between active pillars (driven by --p on the
   parent .id-layer) is unaffected. */
.id-art-video { opacity:0; transition:opacity 600ms var(--id-ease-out); }
.id-art-video.id-video-ready { opacity:1; }

/* Page-wide scroll-progress bar. BlockIdHero writes --scroll-progress on
   <html>. Rendered as a 2px fixed line at the top of the viewport that
   scales horizontally from 0 to 1 as the visitor reads (Apple/Linear
   style). Scoped via :has(.id-block) so non-Inside-Dandy pages don't get
   it. z-index 60 sits above the sticky-header (z-50) but below modals. */
[data-lp-page]:has(.id-block)::after {
  content:"";
  position:fixed;
  top:0; left:0; right:0;
  height:2px;
  z-index:60;
  background:linear-gradient(90deg, var(--brand-accent, #C7E738) 0%, #1AC065 100%);
  transform-origin:0 0;
  transform:scaleX(var(--scroll-progress, 0));
  transition:transform 80ms linear;
  pointer-events:none;
  box-shadow:0 0 12px rgba(199,231,56,0.5);
  opacity:calc(0.3 + var(--scroll-progress, 0) * 0.7);
}
@media (prefers-reduced-motion: reduce) {
  [data-lp-page]:has(.id-block)::after { display:none; }
}

@media (prefers-reduced-motion: reduce) {
  .id-block .id-reveal,
  .id-hero .id-hero-bg,
  .id-hero .id-hero-eyebrow,
  .id-hero h1,
  .id-hero .id-lead,
  .id-hero .id-ctas,
  .id-hero .id-scroll-hint,
  .id-hero .id-scroll-hint .id-scroll-line,
  .id-hero .id-btn-primary > [aria-hidden],
  .id-hero .id-btn-ghost::after,
  .id-hero .id-signal-orb,
  .id-hero.id-ready .id-hero-bg,
  .id-grid .id-grid-intro,
  .id-grid .id-grid-card,
  .id-art-bars .id-bar,
  .id-showcase .id-frame .id-frame-img,
  .id-intro h2 .id-word { opacity:1 !important; transform:none !important; transition:none !important; animation:none !important; }
}

/* ============================================================
 * PAGE-WIDE POLISH (auto-applies to any landing page that
 * contains an .id-block — scoped via :has() so non-Inside-Dandy
 * pages are untouched).
 * ============================================================ */

/* Subtle film grain across the whole page. The same SVG noise the
   cinema block uses, promoted to a fixed full-viewport overlay so
   every Inside Dandy section shares the same grading. */
/* z-index sits below the LP viewer's UI chrome (preview banner, sticky
   nav, ChiliPiper modal, template marketplace dialog — all at z-50+).
   pointer-events:none anyway, but keeping the visual tint off chrome
   matters too. */
[data-lp-page]:has(.id-block)::before {
  content:"";
  position:fixed;
  inset:0;
  z-index:40;
  pointer-events:none;
  background-image:url("data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.05 0'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>");
  opacity:0.35;
  mix-blend-mode:overlay;
}

/* Editorial top scroll-progress bar in the brand citron. Pure CSS,
   driven by the new scroll-driven animations API. Browsers without
   support (older Safari) silently get nothing — pure enhancement. */
@supports (animation-timeline: scroll()) {
  [data-lp-page]:has(.id-block)::after {
    /* When scroll-timeline is available, prefer it: zero JS, perfectly
       smooth, no rAF cost. Visual properties match the JS-driven version
       above (gradient + glow + z-index 60 above the sticky header). */
    background:linear-gradient(90deg, var(--brand-accent, #C7E738) 0%, #1AC065 100%);
    box-shadow:0 0 12px rgba(199,231,56,0.5);
    z-index:60;
    transform:scaleX(0);
    transform-origin:0 0;
    animation:idScrollProgress linear both;
    animation-timeline:scroll(root);
    transition:none;
  }
  @keyframes idScrollProgress { to { transform:scaleX(1); } }
}

@media (prefers-reduced-motion: reduce) {
  [data-lp-page]:has(.id-block)::before { display:none; }
  [data-lp-page]:has(.id-block)::after { display:none; }
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
