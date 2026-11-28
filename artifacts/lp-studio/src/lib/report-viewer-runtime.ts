/**
 * Report reader — the viewer runtime injected into the sandboxed report frame.
 *
 * VIEWER_CSS and VIEWER_JS are plain strings (ES5, no build step) spliced
 * into the report document by `buildReportSrcDoc`. The runtime owns the
 * toolbar (contents, share, full screen, view toggle, PDF), the magazine view
 * (3D page curl), the scroll view, the personal cover letter, interactive
 * assessments, video links, PDF-mode page images and page-level reading
 * telemetry. It talks to the parent block only through postMessage:
 *
 *   frame → parent
 *     { __lpReportHeight: px }                      frame height
 *     { __lpOpenCta: { mode } }                     CTA bridge (custom-html contract)
 *     { __lpReportEvent: { a, v?, d? } }            engagement event (see report-tracking)
 *     { __lpReportVideo: { url, title } }           open a video in the page's player
 *     { __lpReportScroll: { y } }                   scroll the page to y px inside the frame
 *     { __lpReportReady: 1 }                        PDF mode: ready for page images
 *     { __lpReportGate: 1 }                         open the email gate form
 *   parent → frame
 *     { __lpReportViewport: { top, bottom } }       the part of the frame on screen (frame px)
 *     { __lpReportPdfPage: { i, blob, links } }     PDF mode: one rendered page
 *     { __lpReportUnlock: 1 }                       email gate passed: show every page
 *
 * Keep it free of backticks and "${" — it lives in a template literal.
 */

const ICONS = {
  l: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" stroke-width="1.6"/></svg>',
  r: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6"/></svg>',
  toc: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" stroke-width="1.5"/></svg>',
  share: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6.5 9.5l3-3M5 7.5L3.6 8.9a2.5 2.5 0 003.5 3.5L8.5 11M11 8.5l1.4-1.4a2.5 2.5 0 00-3.5-3.5L7.5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  fs: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" stroke="currentColor" stroke-width="1.5"/></svg>',
};

export const VIEWER_CSS = `
html.rr,html.rr body{margin:0}
html.rr{--rr-w:816px;--rr-h:1056px;--rr-ink:#040C09;--rr-paper:#FAF8F3;--rr-accent:#C7E738;--rr-deep:#003A30}
html.rr-fs{background:#040C09;overflow:auto}
.rr-root{position:relative}
.rr-bar{position:relative;z-index:50;display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px clamp(14px,4vw,40px);background:#040C09;color:#FAF8F3;font:500 13px/1.3 Inter,system-ui,sans-serif;border-bottom:1px solid rgba(255,255,255,.12);will-change:transform}
html.rr-fs .rr-bar{position:sticky;top:0;transform:none!important}
.rr-bar .rr-t{font-weight:600;letter-spacing:.12em;text-transform:uppercase;font-size:11.5px;color:rgba(250,248,243,.7);margin-right:auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rr-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.rr-ib{appearance:none;display:inline-flex;align-items:center;gap:7px;border:1px solid rgba(250,248,243,.28);background:transparent;color:#FAF8F3;font:inherit;padding:8px 12px;border-radius:999px;cursor:pointer}
.rr-ib:hover,.rr-ib[aria-expanded=true]{border-color:#FAF8F3;background:rgba(250,248,243,.08)}
.rr-ib svg{width:15px;height:15px;flex:none}
.rr-seg{display:inline-flex;border:1px solid rgba(250,248,243,.3);border-radius:999px;padding:3px}
.rr-seg button{appearance:none;border:0;background:transparent;color:rgba(250,248,243,.8);font:inherit;padding:6px 13px;border-radius:999px;cursor:pointer}
.rr-seg button[aria-pressed=true]{background:#FAF8F3;color:#040C09}
.rr-pdf{color:#040C09;background:#C7E738;text-decoration:none;font-weight:600;padding:9px 14px;border-radius:2px}
@media (max-width:720px){.rr-ib span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}.rr-ib{padding:8px}.rr-bar .rr-t{flex-basis:100%}}
.rr-tocp{position:absolute;right:clamp(14px,4vw,40px);top:calc(100% + 8px);width:min(380px,calc(100vw - 28px));max-height:min(70vh,560px);overflow:auto;background:#FAF8F3;color:#040C09;border-radius:6px;box-shadow:0 24px 60px -20px rgba(0,0,0,.6);padding:10px;z-index:60}
.rr-tocp h4{margin:6px 10px 8px;font:600 11px/1 Inter,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(4,12,9,.55)}
.rr-tocp button{display:flex;gap:12px;width:100%;text-align:left;appearance:none;border:0;background:transparent;font:500 14px/1.35 Inter,system-ui,sans-serif;color:#040C09;padding:9px 10px;border-radius:4px;cursor:pointer}
.rr-tocp button:hover,.rr-tocp button.rr-on{background:rgba(0,58,48,.08)}
.rr-tocp button em{font-style:normal;color:rgba(4,12,9,.45);min-width:24px;font-variant-numeric:tabular-nums}
.rr-toast{position:absolute;right:clamp(14px,4vw,40px);top:calc(100% + 8px);background:#C7E738;color:#040C09;font:600 13px/1.3 Inter,system-ui,sans-serif;padding:10px 14px;border-radius:4px;box-shadow:0 14px 30px -14px rgba(0,0,0,.55);z-index:61;max-width:min(460px,calc(100vw - 28px))}
.rr-toast input{display:block;width:100%;margin-top:6px;border:0;padding:6px;font:12px ui-monospace,monospace;background:#fff;color:#040C09}
.rr-mode-mag{background:radial-gradient(1200px 700px at 50% 20%,rgba(0,90,70,.35),transparent 70%),#040C09;padding:24px 0 28px}
.rr-stage{position:relative;margin:0 auto;perspective:2600px}
.rr-book{position:absolute;left:0;top:0;width:calc(var(--rr-w) * 2);height:var(--rr-h);transform-origin:0 0;transform-style:preserve-3d;transition:transform .9s cubic-bezier(.3,.7,.2,1)}
.rr-spine{position:absolute;left:calc(var(--rr-w) - 1px);top:0;width:2px;height:var(--rr-h);background:linear-gradient(90deg,rgba(0,0,0,.35),rgba(255,255,255,.08));z-index:999;pointer-events:none;opacity:0;transition:opacity .4s}
.rr-book.rr-open .rr-spine{opacity:1}
.rr-leaf{position:absolute;left:var(--rr-w);top:0;width:var(--rr-w);height:var(--rr-h);transform-origin:0 50%;transform-style:preserve-3d}
.rr-leaf.rr-fl{transform:rotateY(-180deg)}
.rr-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;overflow:hidden;background:#fff;box-shadow:0 18px 40px -22px rgba(0,0,0,.55)}
.rr-face.rr-b{transform:rotateY(180deg)}
.rr-face:after{content:"";position:absolute;inset:0;pointer-events:none}
.rr-face.rr-f:after{background:linear-gradient(90deg,rgba(0,0,0,.18),rgba(0,0,0,0) 6%)}
.rr-face.rr-b:after{background:linear-gradient(270deg,rgba(0,0,0,.18),rgba(0,0,0,0) 6%)}
.rr-leaf.rr-af{animation:rrTurnF 1.05s cubic-bezier(.45,.05,.3,1) both}
.rr-leaf.rr-ab{animation:rrTurnB 1.05s cubic-bezier(.45,.05,.3,1) both}
@keyframes rrTurnF{0%{transform:rotateY(0) skewY(0)}28%{transform:rotateY(-42deg) skewY(-7deg) scaleX(.97)}55%{transform:rotateY(-100deg) skewY(-3deg)}80%{transform:rotateY(-158deg) skewY(2deg)}100%{transform:rotateY(-180deg) skewY(0)}}
@keyframes rrTurnB{0%{transform:rotateY(-180deg) skewY(0)}28%{transform:rotateY(-138deg) skewY(7deg) scaleX(.97)}55%{transform:rotateY(-80deg) skewY(3deg)}80%{transform:rotateY(-22deg) skewY(-2deg)}100%{transform:rotateY(0) skewY(0)}}
.rr-shade{position:absolute;inset:0;pointer-events:none;opacity:0;z-index:5;background-size:300% 100%;background-repeat:no-repeat}
.rr-f .rr-shade{background-image:linear-gradient(90deg,rgba(0,0,0,0) 30%,rgba(0,0,0,.22) 42%,rgba(255,255,255,.45) 50%,rgba(0,0,0,.28) 58%,rgba(0,0,0,0) 70%)}
.rr-b .rr-shade{background-image:linear-gradient(270deg,rgba(0,0,0,0) 30%,rgba(0,0,0,.22) 42%,rgba(255,255,255,.45) 50%,rgba(0,0,0,.28) 58%,rgba(0,0,0,0) 70%)}
.rr-af .rr-f .rr-shade,.rr-ab .rr-b .rr-shade{animation:rrSheenOut 1.05s ease-in both}
.rr-af .rr-b .rr-shade,.rr-ab .rr-f .rr-shade{animation:rrSheenIn 1.05s ease-out both}
@keyframes rrSheenOut{0%{opacity:0;background-position:100% 0}20%{opacity:1}100%{opacity:1;background-position:0 0}}
@keyframes rrSheenIn{0%{opacity:1;background-position:100% 0}80%{opacity:1}100%{opacity:0;background-position:0 0}}
.rr-cast{position:absolute;inset:0;pointer-events:none;z-index:4;opacity:0}
.rr-f .rr-cast{background:linear-gradient(90deg,rgba(0,0,0,.45),rgba(0,0,0,.12) 35%,rgba(0,0,0,0) 70%)}
.rr-b .rr-cast{background:linear-gradient(270deg,rgba(0,0,0,.45),rgba(0,0,0,.12) 35%,rgba(0,0,0,0) 70%)}
.rr-cast.rr-reveal{animation:rrReveal 1.05s ease-out both}
.rr-cast.rr-cover{animation:rrCover 1.05s ease-in both}
@keyframes rrReveal{0%{opacity:1}100%{opacity:0}}
@keyframes rrCover{0%{opacity:0}100%{opacity:.9}}
.rr-corner{position:absolute;bottom:0;width:150px;height:150px;z-index:6;cursor:pointer;display:none}
.rr-f .rr-corner{right:0}.rr-b .rr-corner{left:0}
.rr-face.rr-vis .rr-corner{display:block}
.rr-curl{position:absolute;bottom:0;width:38px;height:38px;transition:width .35s cubic-bezier(.3,.7,.2,1),height .35s cubic-bezier(.3,.7,.2,1);filter:drop-shadow(-3px -3px 5px rgba(0,0,0,.22))}
.rr-f .rr-curl{right:0;border-top-left-radius:22% 30%;background:linear-gradient(to top left,#040c09 0,#1a2f29 49.6%,#ffffff 50.4%,#f1eee6 72%,#d6d1c3 100%)}
.rr-b .rr-curl{left:0;border-top-right-radius:22% 30%;filter:drop-shadow(3px -3px 5px rgba(0,0,0,.22));background:linear-gradient(to top right,#040c09 0,#1a2f29 49.6%,#ffffff 50.4%,#f1eee6 72%,#d6d1c3 100%)}
.rr-corner:hover .rr-curl{width:120px;height:120px}
.rr-turning .rr-corner,.rr-face:has(.rr-gatep) .rr-corner{display:none!important}
.rr-ctl{display:flex;align-items:center;justify-content:center;gap:18px;margin-top:22px;color:#FAF8F3;font:500 13px Inter,system-ui,sans-serif}
.rr-ctl button{width:52px;height:52px;border-radius:50%;border:1px solid rgba(250,248,243,.35);background:rgba(250,248,243,.04);color:#FAF8F3;display:grid;place-items:center;cursor:pointer}
.rr-ctl button:hover{background:#C7E738;border-color:#C7E738;color:#003A30}
.rr-ctl button:disabled{opacity:.25;pointer-events:none}
.rr-ctl svg{width:18px;height:18px}
.rr-pg{min-width:120px;text-align:center;letter-spacing:.14em;text-transform:uppercase;color:rgba(250,248,243,.75)}
.rr-pg b{font-size:20px;letter-spacing:0;color:#FAF8F3;font-weight:400}
.rr-hint{text-align:center;font:12px Inter,system-ui,sans-serif;color:rgba(250,248,243,.5);margin:10px 0 0}
.rr-mode-scroll .rr-fit{margin:0 auto;overflow:hidden}
.rr-mode-scroll .rr-fit>section.page{transform-origin:0 0}
section.page.rr-pdfp{position:relative;width:var(--rr-w);height:var(--rr-h);background:#fff;overflow:hidden;box-sizing:border-box}
.rr-pdfp img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:contain}
.rr-pdfp:not(.rr-ready):before{content:"";position:absolute;inset:0;background:linear-gradient(100deg,#f3f1ec 30%,#ffffff 50%,#f3f1ec 70%) 0 0/300% 100%;animation:rrShim 1.4s linear infinite}
@keyframes rrShim{to{background-position:-150% 0}}
.rr-plink{position:absolute;z-index:3;display:block;border-radius:2px}
.rr-plink:hover{background:rgba(199,231,56,.28);outline:1px solid rgba(0,58,48,.35)}
section.page.rr-letter{position:relative;width:var(--rr-w);height:var(--rr-h);box-sizing:border-box;background:var(--rr-paper);color:var(--rr-ink);font-family:Inter,system-ui,sans-serif;overflow:hidden}
.rr-letter:before{content:"";position:absolute;left:0;top:0;bottom:0;width:10px;background:var(--rr-accent)}
.rr-l-in{position:absolute;inset:96px 96px 88px 104px;display:flex;flex-direction:column}
.rr-l-eb{margin:0 0 56px;font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--rr-deep)}
.rr-l-h{margin:0 0 30px;font-size:44px;line-height:1.05;letter-spacing:-.02em;font-weight:500}
.rr-l-p{margin:0 0 18px;font-size:17px;line-height:1.6;color:rgba(4,12,9,.82);max-width:560px}
.rr-l-sig{margin-top:auto;display:flex;align-items:center;gap:16px;padding-top:28px;border-top:1px solid rgba(4,12,9,.14)}
.rr-l-img{width:56px;height:56px;border-radius:50%;object-fit:cover}
html.rr-scroll section.page.rr-letter{width:auto;height:auto;max-width:1080px;margin:0 auto}
html.rr-scroll .rr-l-in{position:static;padding:clamp(48px,8vw,104px) clamp(24px,6vw,96px) clamp(40px,6vw,80px) clamp(30px,6vw,104px)}
html.rr-scroll .rr-l-eb{margin-bottom:28px}html.rr-scroll .rr-l-h{font-size:clamp(30px,4.4vw,48px)}
.rr-l-sig b{display:block;font-size:16px;font-weight:600}
.rr-l-sig span{display:block;font-size:13.5px;color:rgba(4,12,9,.6);margin-top:2px}
.rra{font-family:Inter,system-ui,sans-serif;color:inherit}
.rra-q{margin:0 0 12px}
.rra-ql{font-size:14px;font-weight:600;line-height:1.35;margin:0 0 6px}
.rra-n{display:inline-block;min-width:1.6em;font-variant-numeric:tabular-nums;opacity:.5;font-weight:500}
.rra-o{display:flex;flex-wrap:wrap;gap:6px}
.rra-opt{display:inline-flex;align-items:center;gap:7px;border:1px solid rgba(4,12,9,.2);border-radius:999px;padding:6px 12px 6px 9px;font-size:12.5px;cursor:pointer;background:#fff}
.rra-opt:has(input:checked){background:var(--rr-deep);border-color:var(--rr-deep);color:#fff}
.rra-opt input{margin:0;accent-color:var(--rr-accent)}
.rra-go,.rra-cta{display:inline-block;margin-top:8px;appearance:none;border:0;background:var(--rr-accent);color:var(--rr-ink);font:600 14px Inter,system-ui,sans-serif;padding:12px 18px;border-radius:2px;cursor:pointer;text-decoration:none}
.rra-go:disabled{opacity:.4;cursor:default}
.rra-again{appearance:none;border:0;background:none;color:inherit;opacity:.65;font:500 13px Inter,system-ui,sans-serif;text-decoration:underline;margin-left:14px;cursor:pointer}
.rra-score{margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;opacity:.7}
.rra-t{margin:0 0 10px;font-size:30px;line-height:1.1;letter-spacing:-.01em;font-weight:500}
.rra-b{margin:0 0 14px;font-size:15px;line-height:1.55;max-width:560px}
[data-rr-video]{cursor:pointer}
html.rr section.page.rr-gatep{position:relative;width:var(--rr-w);height:var(--rr-h);box-sizing:border-box;overflow:hidden;color:#FAF8F3;font-family:Inter,system-ui,sans-serif;background:radial-gradient(700px 520px at 85% 8%,rgba(199,231,56,.16),transparent 60%),linear-gradient(160deg,#0B4A3D,#003A30 55%,#04201A)}
html.rr .rr-g-in{position:absolute;inset:104px 88px 92px;display:flex;flex-direction:column}
html.rr .rr-g-eb{margin:0 0 22px;font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--rr-accent)}
html.rr .rr-g-h{color:#FAF8F3;font-family:inherit;margin:0 0 20px;font-size:54px;line-height:1.02;letter-spacing:-.025em;font-weight:500;max-width:600px}
html.rr .rr-g-p{margin:0 0 30px;font-size:18px;line-height:1.55;color:rgba(250,248,243,.82);max-width:560px}
html.rr .rr-g-k{margin:0 0 12px;font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:rgba(250,248,243,.6)}
html.rr .rr-g-l{list-style:none;margin:0 0 34px;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:10px 28px;font-size:15px;line-height:1.35}
html.rr .rr-g-l li{position:relative;padding-left:18px;color:#FAF8F3}.rr-g-l li:before{content:"";position:absolute;left:0;top:.5em;width:7px;height:7px;background:var(--rr-accent)}
html.rr .rr-g-row{margin-top:auto;display:flex;align-items:center;gap:18px;flex-wrap:wrap}
html.rr .rr-g-btn{appearance:none;border:0;background:var(--rr-accent);color:#040C09;font:600 17px Inter,system-ui,sans-serif;padding:17px 26px;border-radius:2px;cursor:pointer;box-shadow:0 14px 30px -14px rgba(0,0,0,.6)}
html.rr .rr-g-btn:hover{filter:brightness(1.06)}
html.rr .rr-g-n{font-size:14px;color:rgba(250,248,243,.65)}
html.rr.rr-scroll section.page.rr-gatep{width:auto;height:auto;max-width:1080px;margin:0 auto}
html.rr.rr-scroll .rr-g-in{position:static;padding:clamp(48px,8vw,104px) clamp(24px,6vw,88px)}
html.rr.rr-scroll .rr-g-h{font-size:clamp(32px,5vw,54px)}
@media (max-width:640px){html.rr.rr-scroll .rr-g-l{grid-template-columns:1fr}}
.rr-tocp button.rr-lk span{opacity:.6}
.rr-tocp button i{margin-left:auto;font-style:normal;font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:rgba(4,12,9,.45)}
@media (prefers-reduced-motion:reduce){.rr-leaf,.rr-book{transition:none!important;animation:none!important}.rr-shade,.rr-cast,.rr-curl,.rr-pdfp:before{animation:none!important;transition:none!important}}
`;

export const VIEWER_JS = String.raw`(function(){
var C=window.__RR||{},D=document,H=D.documentElement,W=window;H.classList.add('rr');
var PW=+C.pageWidth||816,PH=+C.pageHeight||1056;H.style.setProperty('--rr-w',PW+'px');H.style.setProperty('--rr-h',PH+'px');
var IC=__ICONS__;
function send(o){try{parent.postMessage(o,'*')}catch(_){}}
function post(){send({__lpReportHeight:Math.ceil(Math.max(D.body.scrollHeight,H.scrollHeight))})}
function ev(a,v,d){var o={a:a};if(typeof v==='number'&&isFinite(v))o.v=Math.max(0,Math.round(v));if(d)o.d=String(d).slice(0,190);send({__lpReportEvent:o})}
function el(t,c,x){var e=D.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function clean(s){return String(s==null?'':s).replace(/\s+/g,' ').trim()}
function fsEl(){return D.fullscreenElement||D.webkitFullscreenElement||null}
var uid=0;

/* ---------- assessments (wired before pages are detached) ---------- */
function assessment(box){var cfg;try{var sc=box.querySelector('script[type="application/json"]');cfg=JSON.parse(sc?sc.textContent:'')}catch(_){return}
 if(!cfg||!cfg.questions||!cfg.questions.length)return;uid++;var Q=cfg.questions,ans=[];box.innerHTML='';box.classList.add('rra');
 var form=el('form','rra-f');form.setAttribute('novalidate','');
 Q.forEach(function(q,qi){var fs=el('div','rra-q'),ql=el('p','rra-ql');ql.id='rraq'+uid+'_'+qi;ql.appendChild(el('span','rra-n',String(qi+1)));ql.appendChild(D.createTextNode(clean(q.q)));fs.appendChild(ql);var o=el('div','rra-o');o.setAttribute('role','radiogroup');o.setAttribute('aria-labelledby',ql.id);
  (q.options||[]).forEach(function(op,oi){var lb=el('label','rra-opt'),r=el('input');r.type='radio';r.name='rra'+uid+'_'+qi;r.value=String(oi);
   r.onchange=function(){ans[qi]=+op.score||0;upd()};lb.appendChild(r);lb.appendChild(el('span',null,clean(op.label)));o.appendChild(lb)});fs.appendChild(o);form.appendChild(fs)});
 var go=el('button','rra-go',clean(cfg.submit)||'See my result');go.type='submit';go.disabled=true;form.appendChild(go);
 var out=el('div','rra-out');out.hidden=true;
 function upd(){var n=0;for(var i=0;i<Q.length;i++)if(typeof ans[i]==='number')n++;go.disabled=n<Q.length}
 form.onsubmit=function(e){e.preventDefault();if(go.disabled)return;var s=0,mx=0;ans.forEach(function(v){s+=v});
  Q.forEach(function(q){var m=0;(q.options||[]).forEach(function(op){m=Math.max(m,+op.score||0)});mx+=m});
  var res=(cfg.results||[]).slice().sort(function(a,b){return(+b.min||0)-(+a.min||0)}).filter(function(r){return s>=(+r.min||0)})[0]||{};
  out.innerHTML='';out.appendChild(el('p','rra-score',(clean(cfg.scoreLabel)||'Your score')+': '+s+' / '+mx));
  if(res.title)out.appendChild(el('h3','rra-t',clean(res.title)));if(res.body)out.appendChild(el('p','rra-b',clean(res.body)));
  var row=el('div');if(res.cta){var c=el('a','rra-cta',clean(res.cta));c.href='#';c.setAttribute(res.ctaAction==='form'?'data-form':'data-cp','');row.appendChild(c)}
  var ag=el('button','rra-again','Retake');ag.type='button';ag.onclick=function(){form.reset();ans=[];upd();out.hidden=true;form.hidden=false;post()};row.appendChild(ag);out.appendChild(row);
  form.hidden=true;out.hidden=false;ev('assessment',s,clean(res.title)||('Score '+s));post()};
 box.appendChild(form);box.appendChild(out)}
[].forEach.call(D.querySelectorAll('[data-rr-assessment]'),assessment);

/* ---------- personal cover letter ---------- */
function letterPage(L){if(!L)return null;var tok=/\{\{[^}]*\}\}/,f=[L.eyebrow,L.greeting,L.body,L.signName,L.signTitle];
 if(!L.showUnresolved)for(var i=0;i<f.length;i++)if(tok.test(f[i]||''))return null;
 if(!clean(L.greeting)&&!clean(L.body))return null;
 var s=el('section','page rr-letter');s.setAttribute('data-rr-letter','');s.setAttribute('data-toc',clean(L.tocLabel)||'A note for you');s.setAttribute('data-title',clean(L.tocLabel)||'Cover letter');
 var w=el('div','rr-l-in');s.appendChild(w);
 if(clean(L.eyebrow))w.appendChild(el('p','rr-l-eb',clean(L.eyebrow)));
 if(clean(L.greeting))w.appendChild(el('h2','rr-l-h',clean(L.greeting)));
 String(L.body||'').split(/\n\s*\n/).forEach(function(p){p=clean(p);if(p)w.appendChild(el('p','rr-l-p',p))});
 if(clean(L.signName)||clean(L.signTitle)){var g=el('div','rr-l-sig');
  if(L.signImage&&/^(https:\/\/|\/(?!\/))/.test(String(L.signImage))){var im=el('img','rr-l-img');im.src=String(L.signImage);im.alt='';g.appendChild(im)}
  var who=el('div');if(clean(L.signName))who.appendChild(el('b',null,clean(L.signName)));if(clean(L.signTitle))who.appendChild(el('span',null,clean(L.signTitle)));g.appendChild(who);w.appendChild(g)}
 return s}

/* ---------- pages, numbering, contents, gate ---------- */
var ALL=[].slice.call(D.querySelectorAll('section.page'));
var letter=ALL.length?letterPage(C.coverLetter):null;if(letter)ALL.splice(1,0,letter);
ALL.forEach(function(p){if(p.parentNode)p.parentNode.removeChild(p)});
var allNums=[],k0=0;ALL.forEach(function(p,i){allNums[i]=p.hasAttribute('data-rr-letter')?0:++k0});
function numIdxAll(n){for(var i=0;i<ALL.length;i++)if(allNums[i]===n)return i;return -1}
var toc=[];
if(C.toc&&C.toc.length){C.toc.forEach(function(t){var n=+t.page;if(numIdxAll(n)>=0&&clean(t.title))toc.push({t:clean(t.title).slice(0,120),n:n})});if(letter)toc.push({t:letter.getAttribute('data-toc'),n:0})}
else ALL.forEach(function(p,i){var t=clean(p.getAttribute('data-toc'));if(t)toc.push({t:t.slice(0,120),n:allNums[i]})});
toc.sort(function(a,b){return numIdxAll(a.n)-numIdxAll(b.n)});
/* Email gate: only the first previewPages pages (plus a gate page) are in the
   book until the parent says the visitor unlocked ({ __lpReportUnlock: 1 }). */
var G=C.gate||null,locked=!!(G&&G.locked),cut=ALL.length,gatePage=null,gateSeen=false;
function buildGate(){var s=el('section','page rr-gatep');s.setAttribute('data-rr-gate','');s.setAttribute('data-noturn','');var w=el('div','rr-g-in');s.appendChild(w);
 w.appendChild(el('p','rr-g-eb',clean(G.eyebrow)||'Keep reading'));
 w.appendChild(el('h2','rr-g-h',clean(G.title)||'Get the full report'));
 if(clean(G.body))w.appendChild(el('p','rr-g-p',clean(G.body)));
 var rest=toc.filter(function(t){return numIdxAll(t.n)>=cut});
 if(rest.length){w.appendChild(el('p','rr-g-k','Still to come'));var ul=el('ul','rr-g-l');rest.slice(0,10).forEach(function(t){ul.appendChild(el('li',null,t.t))});w.appendChild(ul)}
 var row=el('div','rr-g-row'),bt=el('button','rr-g-btn',clean(G.button)||'Unlock the full report');bt.type='button';bt.setAttribute('data-rr-unlock','');row.appendChild(bt);
 var more=k0-(allNums[cut-1]||0);if(more>0)row.appendChild(el('span','rr-g-n',more+' more page'+(more===1?'':'s')));w.appendChild(row);
 return s}
if(locked){var pv=Math.max(1,Math.floor(+G.previewPages||4));cut=0;for(var gi=0;gi<ALL.length;gi++){if(allNums[gi]>pv)break;cut=gi+1}if(cut>=ALL.length)locked=false;else gatePage=buildGate()}
var pages,N,nums;
function setPages(){pages=locked?ALL.slice(0,cut).concat([gatePage]):ALL.slice();N=pages.length;nums=pages.map(function(p){return p===gatePage?-1:allNums[ALL.indexOf(p)]})}
setPages();
function idxOfNum(n){for(var i=0;i<N;i++)if(nums[i]===n)return i;return locked&&n>0&&numIdxAll(n)>=cut?N-1:-1}
function allIdx(i){var p=pages[i];return p===gatePage?cut:ALL.indexOf(p)}
function labelOf(i){var p=pages[i];if(p===gatePage)return'Email gate';var t=clean(p.getAttribute('data-title'));if(!t){var h=p.querySelector('h1,h2');t=h?clean(h.textContent):''}
 if(!t){var ai=allIdx(i);for(var k=toc.length-1;k>=0;k--)if(numIdxAll(toc[k].n)<=ai){t=toc[k].t;break}}return(t||('Page '+nums[i])).slice(0,100)}
function pid(i){var n=nums[i];if(n==null||n<0)return'';return(n<10?'0':'')+n+'|'+labelOf(i)}
var pdfMap={};ALL.forEach(function(p){var k=p.getAttribute('data-rr-pdf');if(k!=null)pdfMap[+k]=p});
function openGate(why){if(!locked)return;send({__lpReportGate:1});ev('gate',undefined,why||'clicked')}
function unlock(){if(!locked)return;flush();locked=false;setPages();cur=[];var m=mode;mode=null;show(m||pick());if(view)view.goTo(cut,true);say('Unlocked. The full report is yours.')}

/* ---------- reading telemetry ---------- */
var cur=[],since=0,shown=!D.hidden,inView=true,maxPct=0,vpTop=0,vpBot=900;
function reading(){return shown&&inView&&cur.length>0}
function flush(){if(since){var s=Math.round((Date.now()-since)/1000);if(s>=2){s=Math.min(s,600);cur.forEach(function(i){var d=pid(i);if(d)ev('page',s,d)})}}since=reading()?Date.now():0}
function track(list){list=list.filter(function(i){return i>=0&&i<N});if(list.join()===cur.join())return;flush();cur=list;since=reading()?Date.now():0;
 var real=list.filter(function(i){return nums[i]>=0});
 if(real.length){var mx=Math.max.apply(null,real.map(allIdx)),pct=Math.round((mx+1)/ALL.length*100),m=0;[25,50,75,100].forEach(function(x){if(pct>=x)m=x});if(m>maxPct){maxPct=m;ev('progress',m)}}
 if(locked&&!gateSeen&&list.some(function(i){return pages[i]===gatePage})){gateSeen=true;ev('gate',undefined,'shown')}
 if(tocPanel)markToc()}
function wake(){if(!since&&reading())since=Date.now()}
D.addEventListener('visibilitychange',function(){shown=!D.hidden;if(shown)wake();else flush()});
W.addEventListener('pagehide',flush);

/* ---------- toolbar ---------- */
var root=el('div','rr-root');D.body.appendChild(root);
var bar=el('div','rr-bar'),tools=el('div','rr-tools'),tocBtn=null,tocPanel=null,toast=null,toastT=0,mode=null,manual=false,view=null;
bar.appendChild(el('span','rr-t',C.title||''));bar.appendChild(tools);
function tbtn(label,icon,fn){var b=el('button','rr-ib');b.type='button';b.title=label;b.innerHTML=icon+'<span></span>';b.lastChild.textContent=label;b.setAttribute('aria-label',label);b.onclick=fn;tools.appendChild(b);return b}
if(toc.length&&C.showContents!==false){tocBtn=tbtn('Contents',IC.toc,function(e){e.stopPropagation();toggleToc()});tocBtn.setAttribute('aria-expanded','false')}
if(C.shareUrl)tbtn('Share page',IC.share,share);
if(C.allowFullscreen!==false&&(D.fullscreenEnabled||D.webkitFullscreenEnabled))tbtn('Full screen',IC.fs,fullscreen);
if(C.allowViewToggle){var seg=el('div','rr-seg');seg.setAttribute('role','group');seg.setAttribute('aria-label','View');
 [['mag','Magazine'],['scroll','Scroll']].forEach(function(o){var x=el('button',null,o[1]);x.type='button';x.setAttribute('data-v',o[0]);x.onclick=function(){manual=true;show(o[0])};seg.appendChild(x)});tools.appendChild(seg)}
if(C.pdfUrl){var dl=el('a','rr-pdf','Download PDF');dl.href=C.pdfUrl;dl.target='_blank';dl.rel='noopener';dl.onclick=function(e){if(locked){e.preventDefault();openGate('download');return}ev('download')};tools.appendChild(dl)}
var hasBar=!!(C.title||tools.children.length);
function pressed(){[].forEach.call(bar.querySelectorAll('.rr-seg button'),function(x){x.setAttribute('aria-pressed',String(x.getAttribute('data-v')===mode))})}
function say(msg,url){if(!hasBar)return;if(toast&&toast.parentNode)toast.parentNode.removeChild(toast);toast=el('div','rr-toast',msg);toast.setAttribute('role','status');
 if(url){var inp=el('input');inp.readOnly=true;inp.value=url;toast.appendChild(inp);setTimeout(function(){try{inp.select()}catch(_){}},30)}
 bar.appendChild(toast);clearTimeout(toastT);toastT=setTimeout(function(){if(toast&&toast.parentNode)toast.parentNode.removeChild(toast)},url?9000:2600)}
function legacyCopy(t){try{var x=el('textarea');x.value=t;x.style.position='fixed';x.style.opacity='0';D.body.appendChild(x);x.select();var ok=D.execCommand('copy');D.body.removeChild(x);return ok}catch(_){return false}}
function copy(t,cb){try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(function(){cb(true)},function(){cb(legacyCopy(t))});return}}catch(_){}cb(legacyCopy(t))}
function share(){var i=cur.length?cur[0]:0,n=nums[i]>0?nums[i]:1,u=C.shareUrl+'#report-p'+n;copy(u,function(ok){if(ok)say('Link to page '+n+' copied');else say('Copy this link to page '+n+':',u)});ev('share',undefined,pid(idxOfNum(n)>=0?idxOfNum(n):i))}
function fullscreen(){if(fsEl()){var x=D.exitFullscreen||D.webkitExitFullscreen;if(x)x.call(D)}else{var r=H.requestFullscreen||H.webkitRequestFullscreen;if(r){try{var p=r.call(H);if(p&&p.catch)p.catch(function(){})}catch(_){}}}}
function fsChange(){var on=!!fsEl();H.classList.toggle('rr-fs',on);if(on){ev('fullscreen');if(mode!=='mag'&&W.innerWidth>=700)show('mag')}if(view)view.resize();post()}
D.addEventListener('fullscreenchange',fsChange);D.addEventListener('webkitfullscreenchange',fsChange);
function markToc(){if(!tocPanel)return;var at=allIdx(cur.length?cur[cur.length-1]:0),on=-1;toc.forEach(function(t,k){if(numIdxAll(t.n)<=at)on=k});[].forEach.call(tocPanel.querySelectorAll('button'),function(b,k){b.classList.toggle('rr-on',k===on)})}
function closeToc(){if(tocPanel&&tocPanel.parentNode)tocPanel.parentNode.removeChild(tocPanel);tocPanel=null;if(tocBtn)tocBtn.setAttribute('aria-expanded','false')}
function toggleToc(){if(tocPanel){closeToc();return}tocPanel=el('div','rr-tocp');tocPanel.appendChild(el('h4',null,'Contents'));
 toc.forEach(function(t){var b=el('button');b.type='button';var em=el('em',null,t.n?String(t.n):'');b.appendChild(em);b.appendChild(el('span',null,t.t));
  var lk=locked&&numIdxAll(t.n)>=cut;if(lk){b.classList.add('rr-lk');b.appendChild(el('i',null,'Locked'))}
  b.onclick=function(e){e.stopPropagation();closeToc();var i=idxOfNum(t.n);if(view&&i>=0)view.goTo(i,true);ev('section',undefined,t.t);if(lk&&locked)openGate('contents')};tocPanel.appendChild(b)});
 bar.appendChild(tocPanel);tocBtn.setAttribute('aria-expanded','true');markToc()}
D.addEventListener('click',function(e){if(tocPanel&&!tocPanel.contains(e.target))closeToc()});
/* In scroll view the frame has no scrollbar of its own, so the bar follows the
   visible window the parent reports (a "sticky" bar inside a full-height frame). */
function floatBar(){if(!hasBar)return;var y=0;if(mode==='scroll'&&!fsEl()){y=Math.max(0,Math.min(vpTop,H.scrollHeight-bar.offsetHeight-60))}bar.style.transform=y?'translateY('+y+'px)':''}
function clear(){pages.forEach(function(p){p.style.transform='';if(p.parentNode)p.parentNode.removeChild(p)});closeToc();root.innerHTML='';if(hasBar)root.appendChild(bar);bar.style.transform=''}

/* ---------- scroll view ---------- */
function scrollView(){var wrap=el('div','rr-mode-scroll');root.appendChild(wrap);var fits=[];
 pages.forEach(function(p){var f=el('div','rr-fit');f.appendChild(p);wrap.appendChild(f);fits.push(f)});
 function topOf(n){return n.getBoundingClientRect().top+(W.pageYOffset||0)}
 function size(){fits.forEach(function(f){var p=f.firstChild;p.style.transform='';var fixed=Math.abs(parseFloat(getComputedStyle(p).width)-PW)<1;
  if(!fixed){f.style.width='';f.style.height='';f.style.marginTop='';return}
  var w=Math.min(H.clientWidth-24,PW*1.35),s=w/PW;p.style.transform='scale('+s+')';f.style.width=w+'px';f.style.height=(PH*s)+'px';f.style.marginTop='12px'});post();vp()}
 function vp(){var top=vpTop,bot=vpBot;if(fsEl()){top=W.pageYOffset||0;bot=top+W.innerHeight}var mid=top+Math.max(0,bot-top)*0.4,best=-1;
  for(var i=0;i<fits.length;i++){var t=topOf(fits[i]),h=fits[i].offsetHeight;if(mid>=t&&mid<t+h){best=i;break}}
  track(best>=0?[best]:[]);floatBar()}
 function goTo(i){var f=fits[i];if(!f)return;var y=topOf(f)-(hasBar?bar.offsetHeight:0)-8;if(fsEl())W.scrollTo(0,y);else send({__lpReportScroll:{y:Math.max(0,y)}})}
 size();return{resize:size,vp:vp,goTo:goTo,scroll:function(){if(fsEl())vp()}}}

/* ---------- magazine view ---------- */
function magView(){var wrap=el('div','rr-mode-mag');root.appendChild(wrap);
 var stage=el('div','rr-stage'),book=el('div','rr-book');book.innerHTML='<div class="rr-spine"></div>';stage.appendChild(book);wrap.appendChild(stage);
 var list=pages.slice();if(list.length%2)list.push(null);var L=list.length/2,leaves=[];
 for(var i=0;i<L;i++){var lf=el('div','rr-leaf');lf.style.zIndex=L-i;
  ['rr-f','rr-b'].forEach(function(k,j){var fc=el('div','rr-face '+k),pg=list[i*2+j];if(pg)fc.appendChild(pg);fc.insertAdjacentHTML('beforeend','<div class="rr-shade"></div><div class="rr-cast"></div><div class="rr-corner" aria-hidden="true"><div class="rr-curl"></div></div>');lf.appendChild(fc)});book.appendChild(lf);leaves.push(lf)}
 var ctl=el('div','rr-ctl');ctl.innerHTML='<button type="button" aria-label="Previous page">'+IC.l+'</button><div class="rr-pg" aria-live="polite"></div><button type="button" aria-label="Next page">'+IC.r+'</button>';wrap.appendChild(ctl);
 wrap.appendChild(el('p','rr-hint','Use the arrows, your keyboard or swipe to turn the page.'));
 var prev=ctl.children[0],pgl=ctl.children[1],next=ctl.children[2],at=0,busy=false,s=1;
 var reduce=W.matchMedia&&W.matchMedia('(prefers-reduced-motion: reduce)').matches;
 function fit(){var fs=!!fsEl(),w=Math.min(H.clientWidth-48,fs?4000:1500),h=fs?Math.max(320,W.innerHeight-(hasBar?bar.offsetHeight:0)-150):Math.max(420,Math.min((screen.availHeight||900)-240,980));
  s=Math.min(w/(PW*2),h/PH);stage.style.width=(PW*2*s)+'px';stage.style.height=(PH*s)+'px';place();post()}
 function place(){var x=at===0?-PW/2:(at===L?PW/2:0);book.style.transform='translateX('+(x*s)+'px) scale('+s+')';book.classList.toggle('rr-open',at>0&&at<L)}
 function lab(i){var n=nums[i];return n>0?String(n):n===0?'Note':'More'}
 function lastAt(){return locked?Math.ceil((N-1)/2):L}
 function label(){var a=2*at-1,b=2*at;if(at===0)pgl.innerHTML='<b>Cover</b>';else if(at===L)pgl.innerHTML='<b>End</b>';else pgl.innerHTML='<b>'+lab(a)+(b<N&&nums[b]>=0?'&ndash;'+lab(b):'')+'</b> / '+k0;prev.disabled=at===0;next.disabled=!locked&&at===L}
 function face(i,k){var l=leaves[i];return l?l.children[k]:null}
 function visible(){var a=[];if(at>0&&2*at-1<N)a.push(2*at-1);if(at<L&&2*at<N)a.push(2*at);return a}
 function vis(){[].forEach.call(book.querySelectorAll('.rr-vis'),function(f){f.classList.remove('rr-vis')});var r=face(at,0),l=face(at-1,1);if(r&&r.querySelector('section.page'))r.classList.add('rr-vis');if(l&&l.querySelector('section.page'))l.classList.add('rr-vis')}
 function fx(n,c,ms){if(!n)return;var x=n.querySelector('.rr-cast');x.classList.remove('rr-reveal','rr-cover');void x.offsetWidth;x.classList.add(c);setTimeout(function(){x.classList.remove(c)},ms)}
 function go(d){if(busy)return;if(d>0&&locked&&at>=lastAt()){openGate('next');return}var t=at+d;if(t<0||t>L)return;busy=true;var ms=reduce?0:1050;book.classList.add('rr-turning');
  var lf=d>0?leaves[at]:leaves[t],idx=d>0?at:t;lf.style.zIndex=1000;
  if(!reduce){lf.classList.remove('rr-af','rr-ab');void lf.offsetWidth;lf.classList.add(d>0?'rr-af':'rr-ab');
   if(d>0){fx(face(idx+1,0),'rr-reveal',ms);fx(face(idx-1,1),'rr-cover',ms)}else{fx(face(idx-1,1),'rr-reveal',ms);fx(face(idx+1,0),'rr-cover',ms)}}
  lf.classList.toggle('rr-fl',d>0);
  setTimeout(function(){lf.classList.remove('rr-af','rr-ab');lf.style.zIndex=d>0?idx+1:L-idx;book.classList.remove('rr-turning');vis()},ms);
  at=t;place();label();track(visible());setTimeout(function(){busy=false},reduce?0:700)}
 function goTo(i,bring){var t=Math.max(0,Math.min(lastAt(),Math.ceil(i/2)));if(t!==at){if(Math.abs(t-at)===1&&!busy)go(t-at);else{
   leaves.forEach(function(lf,j){lf.classList.remove('rr-af','rr-ab');lf.classList.toggle('rr-fl',j<t);lf.style.zIndex=j<t?j+1:L-j});book.classList.remove('rr-turning');busy=false;at=t;place();label();vis();track(visible())}}
  if(bring!==false&&!fsEl()){var r=wrap.getBoundingClientRect(),top=r.top+(W.pageYOffset||0);if(vpTop>top+40||vpBot<top+stage.offsetHeight*0.6)send({__lpReportScroll:{y:hasBar?0:top}})}}
 prev.onclick=function(){go(-1)};next.onclick=function(){go(1)};
 var NOTURN='a,button,input,label,select,textarea,summary,[data-noturn],[data-rr-assessment],.rra';
 leaves.forEach(function(l,i){l.children[0].addEventListener('click',function(e){if(e.target.closest(NOTURN))return;if(at===i)go(1)});l.children[1].addEventListener('click',function(e){if(e.target.closest(NOTURN))return;if(at===i+1)go(-1)})});
 var sx=null,sy=null;stage.addEventListener('touchstart',function(e){sx=e.touches[0].clientX;sy=e.touches[0].clientY},{passive:true});
 stage.addEventListener('touchend',function(e){if(sx===null)return;var dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy))go(dx<0?1:-1);sx=null});
 fit();label();vis();track(visible());
 return{resize:fit,goTo:goTo,key:function(k){if(k==='ArrowRight')go(1);if(k==='ArrowLeft')go(-1)}}}

/* ---------- mode switching ---------- */
function pick(){if(fsEl())return'mag';return C.view==='magazine'?'mag':C.view==='scroll'?'scroll':(H.clientWidth>=900?'mag':'scroll')}
function show(m){if(m===mode)return;var keep=cur.length?cur[0]:-1;mode=m;clear();H.classList.toggle('rr-mag',m==='mag');H.classList.toggle('rr-scroll',m==='scroll');
 view=m==='mag'?magView():scrollView();pressed();post();if(keep>0&&view.goTo)view.goTo(keep,false)}
D.addEventListener('keydown',function(e){if(e.key==='Escape')closeToc();var t=e.target;if(t&&/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))return;if(view&&view.key)view.key(e.key)});
W.addEventListener('resize',function(){if(C.view==='auto'&&!manual&&!fsEl()){var m=pick();if(m!==mode){show(m);return}}if(view)view.resize()});
W.addEventListener('scroll',function(){if(view&&view.scroll)view.scroll()},{passive:true});

/* ---------- clicks: video, in-report links, CTA bridge (capture: before page turns) ---------- */
D.addEventListener('click',function(e){var t=e.target;if(!t||!t.closest)return;
 var u=t.closest('[data-rr-unlock]');if(u){e.preventDefault();e.stopPropagation();openGate('clicked');return}
 var v=t.closest('[data-rr-video]');if(v){e.preventDefault();e.stopPropagation();var u=v.getAttribute('data-rr-video')||v.getAttribute('href')||'',ttl=clean(v.getAttribute('data-title')||v.textContent).slice(0,120);
  send({__lpReportVideo:{url:u,title:ttl}});ev('play',undefined,ttl||u);return}
 var g=t.closest('[data-rr-goto]');if(g){e.preventDefault();e.stopPropagation();var i=idxOfNum(+g.getAttribute('data-rr-goto'));if(i>=0&&view)view.goTo(i,true);return}
 var a=t.closest('[data-cp],[data-form]');if(a){e.preventDefault();e.stopPropagation();send({__lpOpenCta:{mode:a.hasAttribute('data-form')?'form':'chilipiper'}});ev('cta',undefined,clean(a.textContent).slice(0,80))}},true);

/* ---------- parent → frame ---------- */
function pc(v){v=+v;return(isFinite(v)?Math.max(0,Math.min(1,v))*100:0)+'%'}
function pdfPage(m){if(!m||typeof m.i!=='number')return;var p=pdfMap[m.i];if(!p)return;var img=p.querySelector('img');
 var src='';if(typeof Blob!=='undefined'&&m.blob instanceof Blob){try{src=URL.createObjectURL(m.blob)}catch(_){}}else if(typeof m.src==='string'&&/^data:image\/(png|jpeg|webp);/.test(m.src))src=m.src;if(!src)return;
 if(!img){img=el('img');img.alt='Page '+(m.i+1);img.decoding='async';p.appendChild(img)}img.src=src;p.classList.add('rr-ready');
 [].forEach.call(p.querySelectorAll('.rr-plink'),function(x){x.parentNode.removeChild(x)});
 (m.links||[]).slice(0,60).forEach(function(l){if(!l)return;var a=el('a','rr-plink');a.style.left=pc(l.x);a.style.top=pc(l.y);a.style.width=pc(l.w);a.style.height=pc(l.h);
  if(typeof l.page==='number'){a.href='#';a.setAttribute('data-rr-goto',String(l.page));a.setAttribute('aria-label','Go to page '+l.page)}
  else if(typeof l.url==='string'&&/^(https?:|mailto:)/i.test(l.url)){a.href=l.url;a.target='_blank';a.rel='noopener';a.setAttribute('aria-label',l.url)}else return;p.appendChild(a)})}
W.addEventListener('message',function(e){if(e.source!==parent)return;var d=e.data;if(!d||typeof d!=='object')return;
 if(d.__lpReportViewport&&typeof d.__lpReportViewport==='object'){vpTop=+d.__lpReportViewport.top||0;vpBot=+d.__lpReportViewport.bottom||0;var iv=vpBot-vpTop>80;
  if(iv!==inView){inView=iv;if(iv)wake();else flush()}if(view&&view.vp)view.vp();else floatBar()}
 if(d.__lpReportPdfPage)pdfPage(d.__lpReportPdfPage);
 if(d.__lpReportUnlock)unlock()});

show(pick());
if(C.startPage){var si=idxOfNum(+C.startPage);if(si>=0)setTimeout(function(){if(view)view.goTo(si,true)},80)}
if(C.pdfMode)send({__lpReportReady:1});
try{if(typeof ResizeObserver!=='undefined')new ResizeObserver(post).observe(D.body)}catch(_){}
W.addEventListener('load',post);setTimeout(post,300);setTimeout(post,1200);
})();`.replace("__ICONS__", () => JSON.stringify(ICONS));
