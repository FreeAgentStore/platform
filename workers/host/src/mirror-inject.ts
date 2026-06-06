/**
 * Platform-level mobile mirror injection.
 *
 * Injects a floating mirror button + panel into every agent page served
 * at /a/{slug}/. The injected script is a self-contained IIFE with:
 *   - Floating purple button (bottom-right)
 *   - Mirror panel with QR code (inline SVG generator), copyable URL,
 *     connection status, room info
 *   - DOM observer that detects agent output and relays via /v1/mirror/:roomId
 *
 * QR encoder handles byte-mode, ECC Level L, versions 1-6 (up to 134 bytes).
 * Sufficient for mirror URLs (~70-80 chars).
 */

export function injectMirror(html: string, agentSlug: string): string {
  if (!html.includes('</body>')) return html;

  const escaped = agentSlug.replace(/['"\\]/g, '');
  const script = getMirrorSnippet(escaped);
  return html.replace('</body>', `${script}\n</body>`);
}

function getMirrorSnippet(agentSlug: string): string {
  return `<style>
#fags-mirror-btn{position:fixed;bottom:20px;right:20px;z-index:99999;width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#6d28d9);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 4px 12px rgba(124,58,237,0.4);transition:transform .2s,box-shadow .2s}
#fags-mirror-btn:hover{transform:scale(1.1);box-shadow:0 6px 20px rgba(124,58,237,0.6)}
#fags-mirror-btn.active{animation:fagsPulse 2s infinite}
@keyframes fagsPulse{0%,100%{box-shadow:0 4px 12px rgba(124,58,237,0.4)}50%{box-shadow:0 4px 24px rgba(124,58,237,0.8)}}
#fags-mirror-panel{position:fixed;bottom:76px;right:20px;z-index:99998;width:320px;max-width:calc(100vw - 40px);background:#171717;border:1px solid #262626;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.5);padding:20px;display:none;font-family:'Manrope',system-ui,sans-serif;color:#fafafa}
#fags-mirror-panel.open{display:block}
#fags-mirror-panel h3{font-size:14px;font-weight:700;margin:0 0 8px;display:flex;align-items:center;gap:8px}
#fags-mirror-panel .fm-desc{font-size:12px;color:#a3a3a3;margin:0 0 12px;line-height:1.4}
#fags-mirror-panel .fm-qr{text-align:center;margin:0 0 12px;background:#fff;border-radius:12px;padding:16px}
#fags-mirror-panel .fm-url-row{display:flex;gap:6px;margin:0 0 10px}
#fags-mirror-panel .fm-url{flex:1;padding:8px 10px;border-radius:8px;border:1px solid #262626;background:#0a0a0a;color:#a78bfa;font-size:11px;font-family:monospace;outline:none}
#fags-mirror-panel .fm-copy{padding:8px 14px;border-radius:8px;background:#7c3aed;color:#fff;border:none;cursor:pointer;font-size:11px;font-weight:600;font-family:inherit;white-space:nowrap}
#fags-mirror-panel .fm-copy:hover{background:#6d28d9}
#fags-mirror-panel .fm-status{font-size:11px;color:#737373;margin:0 0 6px}
#fags-mirror-panel .fm-status.connected{color:#4ade80}
#fags-mirror-panel .fm-close{position:absolute;top:12px;right:12px;background:none;border:none;color:#737373;cursor:pointer;font-size:18px;line-height:1;padding:4px}
#fags-mirror-panel .fm-close:hover{color:#fafafa}
#fags-mirror-panel .fm-info{font-size:10px;color:#525252;margin-top:6px;line-height:1.4}
</style>
<div id="fags-mirror-btn" title="Mirror to mobile">&#x1f4f1;</div>
<div id="fags-mirror-panel">
<button class="fm-close" id="fags-mirror-close">&times;</button>
<h3>&#x1f4f1; Mirror to Mobile</h3>
<p class="fm-desc">Scan the QR code or open the link on your phone to see this agent's output in real-time.</p>
<div class="fm-qr" id="fags-mirror-qr"></div>
<div class="fm-url-row">
<input class="fm-url" id="fags-mirror-url" readonly/>
<button class="fm-copy" id="fags-mirror-copy">Copy</button>
</div>
<div class="fm-status" id="fags-mirror-status">Click to activate mirror</div>
<div class="fm-info">Messages auto-expire after 5 minutes. Your data stays between your devices.</div>
</div>
<script>
(function(){
var AGENT='${agentSlug}';
var roomId=null,pollTimer=null,active=false;
var btn=document.getElementById('fags-mirror-btn');
var panel=document.getElementById('fags-mirror-panel');
var closeBtn=document.getElementById('fags-mirror-close');
var urlInput=document.getElementById('fags-mirror-url');
var copyBtn=document.getElementById('fags-mirror-copy');
var statusEl=document.getElementById('fags-mirror-status');
var qrEl=document.getElementById('fags-mirror-qr');

function genRoom(){var c='abcdefghjkmnpqrstuvwxyz23456789';var a=crypto.getRandomValues(new Uint8Array(8));return Array.from(a).map(function(b){return c[b%c.length]}).join('')}

btn.addEventListener('click',function(){
if(!roomId){
roomId=genRoom();
var url=location.origin+'/mirror/?room='+roomId+'&agent='+AGENT;
urlInput.value=url;
renderQR(url);
active=true;
btn.classList.add('active');
statusEl.textContent='Waiting for mobile to connect...';
statusEl.className='fm-status';
startPolling();
startObserving();
}
panel.classList.toggle('open');
});

closeBtn.addEventListener('click',function(){panel.classList.remove('open')});
copyBtn.addEventListener('click',function(){
navigator.clipboard.writeText(urlInput.value).then(function(){
copyBtn.textContent='Copied!';
setTimeout(function(){copyBtn.textContent='Copy'},1500);
});
});

function startPolling(){
if(pollTimer)return;
pollTimer=setInterval(function(){
fetch('/v1/mirror/'+roomId+'?since=0').then(function(r){return r.json()}).then(function(d){
if(d.peers>1){statusEl.textContent='Mobile connected ('+d.peers+' devices)';statusEl.className='fm-status connected'}
}).catch(function(){});
},5000);
}

function startObserving(){
var last='',lastT=0;
var obs=new MutationObserver(function(){
if(!active||!roomId)return;
if(Date.now()-lastT<3000)return;
lastT=Date.now();
var el=document.querySelector('main')||document.querySelector('[role="main"]')||document.body;
var nodes=el.querySelectorAll('[class*="assistant"],[class*="output"],[class*="result"],[class*="response"],[class*="message"]');
if(nodes.length>0){
var txt=nodes[nodes.length-1].textContent.trim().slice(0,2000);
if(txt&&txt!==last){
last=txt;
fetch('/v1/mirror/'+roomId,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'result',data:{text:txt,agent:AGENT},from:'desktop'})}).catch(function(){});
}
}
});
obs.observe(document.body,{childList:true,subtree:true,characterData:true});
}

function renderQR(text){
qrEl.innerHTML='<div style="padding:16px;text-align:center"><div style="color:#666;font-size:11px">Loading QR...</div></div>';
var img=document.createElement('img');
img.src='/v1/qr?data='+encodeURIComponent(text);
img.alt='QR Code';
img.style.cssText='width:180px;height:180px;border-radius:8px';
img.onload=function(){qrEl.innerHTML='';qrEl.appendChild(img)};
img.onerror=function(){qrEl.innerHTML='<div style="padding:16px;text-align:center"><p style="color:#666;font-size:12px">Open the link below on your phone</p></div>'};
}

/* QR generation handled server-side via /v1/qr?data=URL */

})();
<\/script>`;
}
