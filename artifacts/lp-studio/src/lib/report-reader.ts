/**
 * Report reader — turns a paginated HTML report into a reading experience.
 *
 * Report document contract (kept deliberately small so any designed report can
 * be dropped in):
 *   - A normal HTML document (its own <head>, fonts, <style>, scripts).
 *   - Each page is a `<section class="page">`, designed at 816×1056 CSS px
 *     (US Letter at 96dpi) for the magazine view.
 *   - The viewer puts `rr-mag` or `rr-scroll` on <html>, so a report can ship
 *     a fixed-page layout (`html.rr-mag …`) and a reflowed reading layout
 *     (`html.rr-scroll …`). A report that only styles fixed pages still works
 *     in scroll view: pages are scaled to fit the width.
 *   - Links with `data-cp` open the page's Chili Piper modal; `data-form` opens
 *     the lead form modal (same bridge as the custom-html block).
 *
 * The document is rendered ONLY via `srcdoc` into a sandbox WITHOUT
 * `allow-same-origin` (see BlockReportReader), exactly like custom-html.
 */

export type ReportView = "auto" | "magazine" | "scroll";

export interface ReportViewerConfig {
  title: string;
  pdfUrl: string;
  view: ReportView;
  allowViewToggle: boolean;
}

/** postMessage key the frame uses to report its height to the parent. */
export const REPORT_HEIGHT_KEY = "__lpReportHeight";

/** Hard ceiling on the frame height a (sandboxed) report may request. */
export const REPORT_MAX_HEIGHT = 80000;

/** Only fetch report documents from http(s) or same-origin relative URLs. */
export function isAllowedReportSrc(src: string): boolean {
  const s = src.trim();
  if (!s) return false;
  if (s.startsWith("/") && !s.startsWith("//")) return true;
  return /^https?:\/\//i.test(s);
}

function safeHref(url: string): string {
  const u = url.trim();
  if (!u) return "";
  if (u.startsWith("/") && !u.startsWith("//")) return u;
  return /^https?:\/\//i.test(u) ? u : "";
}

const VIEWER_CSS = `
html.rr,html.rr body{margin:0}
.rr-bar{position:relative;z-index:5;display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:14px clamp(16px,4vw,40px);background:#040C09;color:#FAF8F3;font:500 13px/1.3 Inter,system-ui,sans-serif;border-bottom:1px solid rgba(255,255,255,.12)}
.rr-bar .rr-t{font-weight:600;letter-spacing:.12em;text-transform:uppercase;font-size:11.5px;color:rgba(250,248,243,.7);margin-right:auto}
.rr-seg{display:inline-flex;border:1px solid rgba(250,248,243,.3);border-radius:999px;padding:3px}
.rr-seg button{appearance:none;border:0;background:transparent;color:rgba(250,248,243,.8);font:inherit;padding:7px 14px;border-radius:999px;cursor:pointer}
.rr-seg button[aria-pressed=true]{background:#FAF8F3;color:#040C09}
.rr-pdf{color:#040C09;background:#C7E738;text-decoration:none;font-weight:600;padding:9px 14px;border-radius:2px}
.rr-mode-mag{background:radial-gradient(1200px 700px at 50% 20%,rgba(0,90,70,.35),transparent 70%),#040C09;padding:24px 0 28px}
.rr-stage{position:relative;margin:0 auto;perspective:2600px}
.rr-book{position:absolute;left:0;top:0;width:1632px;height:1056px;transform-origin:0 0;transform-style:preserve-3d;transition:transform .9s cubic-bezier(.3,.7,.2,1)}
.rr-spine{position:absolute;left:815px;top:0;width:2px;height:1056px;background:linear-gradient(90deg,rgba(0,0,0,.35),rgba(255,255,255,.08));z-index:999;pointer-events:none;opacity:0;transition:opacity .4s}
.rr-book.rr-open .rr-spine{opacity:1}
.rr-leaf{position:absolute;left:816px;top:0;width:816px;height:1056px;transform-origin:0 50%;transform-style:preserve-3d;transition:transform 1s cubic-bezier(.45,.05,.25,1)}
.rr-leaf.rr-fl{transform:rotateY(-180deg)}
.rr-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;overflow:hidden;background:#fff;box-shadow:0 18px 40px -22px rgba(0,0,0,.55)}
.rr-face.rr-b{transform:rotateY(180deg)}
.rr-face:after{content:"";position:absolute;inset:0;pointer-events:none}
.rr-face.rr-f:after{background:linear-gradient(90deg,rgba(0,0,0,.18),rgba(0,0,0,0) 6%)}
.rr-face.rr-b:after{background:linear-gradient(270deg,rgba(0,0,0,.18),rgba(0,0,0,0) 6%)}
.rr-ctl{display:flex;align-items:center;justify-content:center;gap:18px;margin-top:22px;color:#FAF8F3;font:500 13px Inter,system-ui,sans-serif}
.rr-ctl button{width:52px;height:52px;border-radius:50%;border:1px solid rgba(250,248,243,.35);background:rgba(250,248,243,.04);color:#FAF8F3;display:grid;place-items:center;cursor:pointer}
.rr-ctl button:hover{background:#C7E738;border-color:#C7E738;color:#003A30}
.rr-ctl button:disabled{opacity:.25;pointer-events:none}
.rr-ctl svg{width:18px;height:18px}
.rr-pg{min-width:120px;text-align:center;letter-spacing:.14em;text-transform:uppercase;color:rgba(250,248,243,.75)}
.rr-pg b{font-size:20px;letter-spacing:0;color:#FAF8F3;font-weight:400}
.rr-hint{text-align:center;font:12px Inter,system-ui,sans-serif;color:rgba(250,248,243,.5);margin-top:10px}
.rr-mode-scroll .rr-fit{margin:0 auto;overflow:hidden}
.rr-mode-scroll .rr-fit>section.page{transform-origin:0 0}
@media (prefers-reduced-motion:reduce){.rr-leaf,.rr-book{transition:none!important}}
`;

const ARROW_L = '<svg viewBox="0 0 16 16" fill="none"><path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" stroke-width="1.6"/></svg>';
const ARROW_R = '<svg viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6"/></svg>';

/**
 * Viewer runtime injected into the report document. Plain ES5 so it runs in
 * any browser without a build step. It owns: the toolbar, magazine view (3D
 * page turns, buttons, keys, swipe), scroll view, CTA bridge and height
 * reporting.
 */
const VIEWER_JS = `(function(){
var C=window.__RR||{};var D=document,H=D.documentElement;H.classList.add('rr');
var pages=[].slice.call(D.querySelectorAll('section.page'));
pages.forEach(function(p){if(p.parentNode)p.parentNode.removeChild(p)});
var root=D.createElement('div');root.className='rr-root';D.body.appendChild(root);
function post(){try{var h=Math.max(D.body.scrollHeight,H.scrollHeight);parent.postMessage({${REPORT_HEIGHT_KEY}:h},'*')}catch(_){}}
function bar(){if(!C.title&&!C.pdfUrl&&!C.allowViewToggle)return null;var b=D.createElement('div');b.className='rr-bar';
 var t=D.createElement('span');t.className='rr-t';t.textContent=C.title||'';b.appendChild(t);
 if(C.allowViewToggle){var s=D.createElement('div');s.className='rr-seg';s.setAttribute('role','group');s.setAttribute('aria-label','View');
  [['mag','Magazine'],['scroll','Scroll']].forEach(function(o){var x=D.createElement('button');x.type='button';x.textContent=o[1];x.dataset.v=o[0];x.onclick=function(){manual=true;show(o[0])};s.appendChild(x)});b.appendChild(s)}
 if(C.pdfUrl){var a=D.createElement('a');a.className='rr-pdf';a.href=C.pdfUrl;a.target='_blank';a.rel='noopener';a.textContent='Download PDF';b.appendChild(a)}
 return b}
var topBar=bar(),mode=null,manual=false,view=null;
function clear(){pages.forEach(function(p){p.style.transform='';if(p.parentNode)p.parentNode.removeChild(p)});root.innerHTML='';if(topBar)root.appendChild(topBar)}
function pressed(){if(!topBar)return;[].forEach.call(topBar.querySelectorAll('.rr-seg button'),function(x){x.setAttribute('aria-pressed',String(x.dataset.v===mode))})}
function scrollView(){var wrap=D.createElement('div');wrap.className='rr-mode-scroll';root.appendChild(wrap);
 var fits=[];pages.forEach(function(p){var f=D.createElement('div');f.className='rr-fit';f.appendChild(p);wrap.appendChild(f);fits.push(f)});
 function size(){fits.forEach(function(f){var p=f.firstChild;var fixed=getComputedStyle(p).width==='816px';if(!fixed){p.style.transform='';f.style.width='';f.style.height='';return}
  var w=Math.min(H.clientWidth-24,1100),s=w/816;p.style.transform='scale('+s+')';f.style.width=w+'px';f.style.height=(1056*s)+'px';f.style.marginTop='12px'});post()}
 size();return{resize:size}}
function magView(){var wrap=D.createElement('div');wrap.className='rr-mode-mag';root.appendChild(wrap);
 var stage=D.createElement('div');stage.className='rr-stage';var book=D.createElement('div');book.className='rr-book';book.innerHTML='<div class="rr-spine"></div>';stage.appendChild(book);wrap.appendChild(stage);
 var list=pages.slice();if(list.length%2)list.push(null);var L=list.length/2,leaves=[];
 for(var i=0;i<L;i++){var lf=D.createElement('div');lf.className='rr-leaf';lf.style.zIndex=L-i;
  ['rr-f','rr-b'].forEach(function(k,j){var fc=D.createElement('div');fc.className='rr-face '+k;var pg=list[i*2+j];if(pg)fc.appendChild(pg);lf.appendChild(fc)});book.appendChild(lf);leaves.push(lf)}
 var ctl=D.createElement('div');ctl.className='rr-ctl';ctl.innerHTML='<button type="button" aria-label="Previous page">${ARROW_L}</button><div class="rr-pg" aria-live="polite"></div><button type="button" aria-label="Next page">${ARROW_R}</button>';wrap.appendChild(ctl);
 var hint=D.createElement('p');hint.className='rr-hint';hint.textContent='Use the arrows, your keyboard or swipe to turn the page.';wrap.appendChild(hint);
 var prev=ctl.children[0],pgl=ctl.children[1],next=ctl.children[2],cur=0,busy=false,s=1,N=pages.length;
 var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 function fit(){var w=Math.min(H.clientWidth-48,1500),h=Math.max(420,Math.min((screen.availHeight||900)-240,980));s=Math.min(w/1632,h/1056);stage.style.width=(1632*s)+'px';stage.style.height=(1056*s)+'px';place();post()}
 function place(){var x=cur===0?-408:(cur===L?408:0);book.style.transform='translateX('+(x*s)+'px) scale('+s+')';book.classList.toggle('rr-open',cur>0&&cur<L)}
 function label(){if(cur===0)pgl.innerHTML='<b>Cover</b>';else if(cur===L)pgl.innerHTML='<b>End</b>';else pgl.innerHTML='<b>'+(cur*2)+'&ndash;'+Math.min(cur*2+1,N)+'</b> / '+N;prev.disabled=cur===0;next.disabled=cur===L}
 function go(d){if(busy)return;var t=cur+d;if(t<0||t>L)return;busy=true;var ms=reduce?0:1000;
  if(d>0){var i0=cur,a=leaves[i0];a.style.zIndex=1000;a.classList.add('rr-fl');setTimeout(function(){a.style.zIndex=i0+1},ms)}
  else{var t0=t,b=leaves[t0];b.style.zIndex=1000;b.classList.remove('rr-fl');setTimeout(function(){b.style.zIndex=L-t0},ms)}
  cur=t;place();label();setTimeout(function(){busy=false},reduce?0:650)}
 prev.onclick=function(){go(-1)};next.onclick=function(){go(1)};
 leaves.forEach(function(l,i){l.children[0].addEventListener('click',function(e){if(e.target.closest('a,button'))return;if(cur===i)go(1)});l.children[1].addEventListener('click',function(e){if(e.target.closest('a,button'))return;if(cur===i+1)go(-1)})});
 var sx=null;stage.addEventListener('touchstart',function(e){sx=e.touches[0].clientX},{passive:true});stage.addEventListener('touchend',function(e){if(sx===null)return;var dx=e.changedTouches[0].clientX-sx;if(Math.abs(dx)>40)go(dx<0?1:-1);sx=null});
 fit();label();return{resize:fit,key:function(k){if(k==='ArrowRight')go(1);if(k==='ArrowLeft')go(-1)}}}
function pick(){return C.view==='magazine'?'mag':C.view==='scroll'?'scroll':(H.clientWidth>=900?'mag':'scroll')}
function show(m){if(m===mode)return;mode=m;clear();H.classList.toggle('rr-mag',m==='mag');H.classList.toggle('rr-scroll',m==='scroll');view=m==='mag'?magView():scrollView();pressed();post()}
D.addEventListener('keydown',function(e){if(view&&view.key)view.key(e.key)});
window.addEventListener('resize',function(){if(C.view==='auto'&&!manual){var m=pick();if(m!==mode){show(m);return}}if(view)view.resize()});
D.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('[data-cp],[data-form]');if(!a)return;e.preventDefault();try{parent.postMessage({__lpOpenCta:{mode:a.hasAttribute('data-form')?'form':'chilipiper'}},'*')}catch(_){}});
show(pick());
try{if(typeof ResizeObserver!=='undefined')new ResizeObserver(post).observe(D.body)}catch(_){}
window.addEventListener('load',post);setTimeout(post,300);setTimeout(post,1200);
})();`;

function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * Build the srcdoc for the sandboxed frame: the report document with the
 * viewer's CSS, config and runtime spliced in. Returns "" for empty input.
 */
export function buildReportSrcDoc(reportHtml: string, config: ReportViewerConfig): string {
  const raw = (reportHtml || "").trim();
  if (!raw) return "";
  const cfg: ReportViewerConfig = {
    title: config.title || "",
    pdfUrl: safeHref(config.pdfUrl || ""),
    view: config.view === "magazine" || config.view === "scroll" ? config.view : "auto",
    allowViewToggle: !!config.allowViewToggle,
  };
  const head = `<base target="_top"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${VIEWER_CSS}</style>`;
  const tail = `<script>window.__RR=${escapeScriptJson(cfg)};</script><script>${VIEWER_JS}</script>`;

  let doc = raw;
  if (/<head[^>]*>/i.test(doc)) doc = doc.replace(/<head([^>]*)>/i, `<head$1>${head}`);
  else if (/<html[^>]*>/i.test(doc)) doc = doc.replace(/<html([^>]*)>/i, `<html$1><head>${head}</head>`);
  else doc = `<!DOCTYPE html><html><head>${head}</head><body>${doc}</body></html>`;

  const idx = doc.toLowerCase().lastIndexOf("</body>");
  return idx === -1 ? doc + tail : doc.slice(0, idx) + tail + doc.slice(idx);
}
