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

/* ── Minimal QR Code encoder ──────────────────────────────────────────────
 * Byte mode, ECC Level L, Versions 1-6. Renders as inline SVG.
 * Based on ISO/IEC 18004 with simplifications for short data (< 134 bytes).
 * Mask pattern 0 (checkerboard) for deterministic output.
 */
function renderQR(text){
var mods=encodeQR(text);
if(!mods){qrEl.innerHTML='<div style="padding:20px;text-align:center"><p style="color:#666;font-size:12px">Open the link below on your phone</p></div>';return}
var n=mods.length,cell=Math.floor(180/n),sz=cell*n;
var svg='<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 '+sz+' '+sz+'" xmlns="http://www.w3.org/2000/svg" style="border-radius:8px"><rect width="100%" height="100%" fill="white"/>';
for(var y=0;y<n;y++)for(var x=0;x<n;x++)if(mods[y][x])svg+='<rect x="'+(x*cell)+'" y="'+(y*cell)+'" width="'+cell+'" height="'+cell+'" fill="#7c3aed"/>';
svg+='</svg>';
qrEl.innerHTML=svg;
}

function encodeQR(data){
var bytes=[];
for(var i=0;i<data.length;i++){
var code=data.charCodeAt(i);
if(code<0x80)bytes.push(code);
else if(code<0x800){bytes.push(0xC0|(code>>6));bytes.push(0x80|(code&0x3F))}
else{bytes.push(0xE0|(code>>12));bytes.push(0x80|((code>>6)&0x3F));bytes.push(0x80|(code&0x3F))}
}
/* Version selection — byte capacity at ECC-L */
var caps=[0,17,32,53,78,106,134];
var ver=0;
for(var v=1;v<=6;v++){if(bytes.length<=caps[v]){ver=v;break}}
if(!ver)return null;
var sizes=[0,21,25,29,33,37,41];
var n=sizes[ver];
/* Total data codewords and EC codewords for ECC-L */
var totalCW=[0,26,44,70,100,134,172];
var ecCW=[0,7,10,15,20,26,36]; /* per block, 1 block for versions 1-6 L */
var dataCW=totalCW[ver]-ecCW[ver];
/* Build data bitstream: mode(4) + count(8) + data + terminator + padding */
var bits=[];
function pushBits(val,len){for(var j=len-1;j>=0;j--)bits.push((val>>j)&1)}
pushBits(4,4); /* byte mode indicator */
pushBits(bytes.length, ver>=1&&ver<=9?8:16);
for(var i=0;i<bytes.length;i++)pushBits(bytes[i],8);
/* terminator */
var maxBits=dataCW*8;
var termLen=Math.min(4,maxBits-bits.length);
for(var j=0;j<termLen;j++)bits.push(0);
/* byte-align */
while(bits.length%8!==0)bits.push(0);
/* padding codewords */
var pads=[236,17];
var pi=0;
while(bits.length<maxBits){pushBits(pads[pi],8);pi^=1}
/* Convert bits to codewords */
var dcw=[];
for(var i=0;i<bits.length;i+=8){
var b=0;for(var j=0;j<8;j++)b=(b<<1)|bits[i+j];
dcw.push(b);
}
/* Reed-Solomon error correction (GF(256), primitive poly 0x11D) */
var ecCount=ecCW[ver];
var ec=rsEncode(dcw,ecCount);
var allCW=dcw.concat(ec);
/* Create module grid */
var grid=[];var reserved=[];
for(var y=0;y<n;y++){grid[y]=[];reserved[y]=[];for(var x=0;x<n;x++){grid[y][x]=false;reserved[y][x]=false}}
/* Place finder patterns */
function placeFinder(row,col){
for(var dy=-1;dy<=7;dy++)for(var dx=-1;dx<=7;dx++){
var r=row+dy,c=col+dx;
if(r<0||r>=n||c<0||c>=n)continue;
var inOuter=(dy===-1||dy===7||dx===-1||dx===7);
var inBorder=(dy===0||dy===6||dx===0||dx===6);
var inInner=(dy>=2&&dy<=4&&dx>=2&&dx<=4);
grid[r][c]=!inOuter&&(inBorder||inInner);
reserved[r][c]=true;
}
}
placeFinder(0,0);placeFinder(0,n-7);placeFinder(n-7,0);
/* Timing patterns */
for(var i=8;i<n-8;i++){
grid[6][i]=(i%2===0);reserved[6][i]=true;
grid[i][6]=(i%2===0);reserved[i][6]=true;
}
/* Dark module */
grid[n-8][8]=true;reserved[n-8][8]=true;
/* Alignment pattern (versions 2+) */
if(ver>=2){
var alignPos=[0,0,18,22,26,30,34];
var ap=alignPos[ver];
/* Single alignment pattern for v2-6 */
for(var dy=-2;dy<=2;dy++)for(var dx=-2;dx<=2;dx++){
var r=ap+dy,c=ap+dx;
if(reserved[r][c])continue;
grid[r][c]=(Math.abs(dy)===2||Math.abs(dx)===2||(!dy&&!dx));
reserved[r][c]=true;
}
}
/* Reserve format info areas — row 8 and col 8 near finders + second copy */
for(var i=0;i<=8;i++){reserved[8][i]=true;reserved[i][8]=true}
for(var i=0;i<8;i++){reserved[8][n-1-i]=true;reserved[n-1-i][8]=true}
/* Place data bits in 2-column strips, right-to-left, zigzagging */
var bitIdx=0;
var allBits=[];
for(var i=0;i<allCW.length;i++)for(var j=7;j>=0;j--)allBits.push((allCW[i]>>j)&1);
var upward=true;
for(var right=n-1;right>=1;right-=2){
if(right===6)right=5; /* skip timing column */
for(var ri=0;ri<n;ri++){
var row=upward?(n-1-ri):ri;
for(var dx=0;dx<=1;dx++){
var col=right-dx;
if(col<0||col>=n)continue;
if(reserved[row][col])continue;
if(bitIdx<allBits.length)grid[row][col]=!!allBits[bitIdx];
bitIdx++;
}
}
upward=!upward;
}
/* Apply mask pattern 0: (row+col)%2===0 */
for(var y=0;y<n;y++)for(var x=0;x<n;x++){
if(!reserved[y][x])if((y+x)%2===0)grid[y][x]=!grid[y][x];
}
/* Format info: ECC L (01) + mask 0 (000), pre-computed per ISO 18004 Table C.1 */
var fmtBits=[1,1,1,0,1,1,1,1,1,0,0,0,1,0,0];
/* Copy 1: around top-left finder (Table 9) */
var c1=[
[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],
[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]
];
for(var i=0;i<15;i++)grid[c1[i][0]][c1[i][1]]=!!fmtBits[i];
/* Copy 2: along bottom-left vertical + top-right horizontal */
var c2=[
[n-1,8],[n-2,8],[n-3,8],[n-4,8],[n-5,8],[n-6,8],[n-7,8],
[8,n-8],[8,n-7],[8,n-6],[8,n-5],[8,n-4],[8,n-3],[8,n-2],[8,n-1]
];
for(var i=0;i<15;i++)grid[c2[i][0]][c2[i][1]]=!!fmtBits[i];
/* Version info not needed for v1-6 */
return grid;
}

/* Reed-Solomon encoding over GF(256) with primitive polynomial 0x11D */
function rsEncode(data,ecLen){
/* Build log/exp tables */
var exp=new Array(256),log=new Array(256);
var v=1;
for(var i=0;i<256;i++){exp[i]=v;log[v]=i;v<<=1;if(v>=256)v^=0x11D}
log[0]=255;
function gfMul(a,b){if(a===0||b===0)return 0;return exp[(log[a]+log[b])%255]}
/* Build generator polynomial */
var gen=[1];
for(var i=0;i<ecLen;i++){
var ng=new Array(gen.length+1);
for(var j=0;j<ng.length;j++)ng[j]=0;
for(var j=0;j<gen.length;j++){
ng[j]^=gfMul(gen[j],exp[i]);
ng[j+1]^=gen[j];
}
gen=ng;
}
/* Polynomial division */
var work=new Array(data.length+ecLen);
for(var i=0;i<work.length;i++)work[i]=i<data.length?data[i]:0;
for(var i=0;i<data.length;i++){
var coef=work[i];
if(coef===0)continue;
for(var j=0;j<gen.length;j++){
work[i+j]^=gfMul(gen[j],coef);
}
}
return work.slice(data.length);
}

})();
<\/script>`;
}
