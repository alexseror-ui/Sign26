// Builds www/ for the Android app from the root index.html, with a current PDF.js and hardening
const fs = require('fs');
let s = fs.readFileSync('index.html', 'utf8');
function rep(a, b) { if (!s.includes(a)) throw new Error('missing: ' + a); s = s.replace(a, () => b); }

// 1. Replace the old bundled PDF.js with a current one, stored as separate files
const open = '<script>', close = '</script>';
const a = s.indexOf(open);
const b = s.indexOf(close, s.indexOf(open, a + 1)) + close.length;
if (a < 0 || b <= a) throw new Error('pdf.js blocks not found');
if (!s.slice(a, a + 3000).includes('pdfjs') && !s.slice(a, a + 3000).includes('PDFJS')) throw new Error('first script is not pdf.js');
s = s.slice(0, a) + `<script type="module">
import * as lib from './pdf.min.js';
lib.GlobalWorkerOptions.workerSrc = './pdf.worker.min.js';
window.pdfjsLib = lib;
</script>` + s.slice(b);
rep("if(!window.pdfjsLib||!window.PDFLib){", "if(!window.PDFLib){");

// 2. Block everything the app does not need
rep('<style>', `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data: blob:; worker-src 'self' blob:; connect-src 'self' data: blob:; base-uri 'none'; form-action 'none'"><style>`);

// 3. Clean file names before saving
rep("state.outName=state.name.replace(/\\.pdf$/i,'')+' - חתום.pdf';", "state.outName=state.name.replace(/\\.pdf$/i,'').replace(/[\\/\\\\:*?\"<>|\\u0000-\\u001f]/g,'_').replace(/^\\.+/,'').slice(0,120)+' - חתום.pdf';");

// 4. Do not remember typed text such as names or ID numbers
rep("$('textIn').value=store.get('sign26.text')||'';", "store.del('sign26.text');$('textIn').value='';");
rep("store.set('sign26.text',t);", "");

// 5. Saving the signature is the user's choice, and off by default
rep('<p id="sigHint">', '<label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" id="keepSig">לשמור את החתימה במכשיר לפעם הבאה (לא מוצפנת)</label><p id="sigHint">');
rep("store.set('sign26.sig',JSON.stringify(s)); placeSig(s);", "if($('keepSig').checked) store.set('sign26.sig',JSON.stringify(s)); placeSig(s);");
rep("const s={src:o.toDataURL('image/png'),aspect:o.height/o.width};store.set('sign26.sig',JSON.stringify(s));placeSig(s);", "const s={src:o.toDataURL('image/png'),aspect:o.height/o.width};if($('keepSig').checked)store.set('sign26.sig',JSON.stringify(s));placeSig(s);");

// 6. Android: real save and share, with no document copies left behind
rep('/* ---------- sample ---------- */', `/* ---------- Android app ---------- */
  const native=window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform()?Capacitor.Plugins:null;
  async function clearShared(){ if(!native) return; try{ await native.Filesystem.rmdir({path:'share',directory:'CACHE',recursive:true}); }catch(e){} }
  clearShared();
  async function outBase64(){
    const b=new Uint8Array(await state.out.arrayBuffer());let r='';
    for(let i=0;i<b.length;i+=32766) r+=btoa(String.fromCharCode.apply(null,b.subarray(i,i+32766)));
    return r;
  }
  async function nativeSave(){
    const data=await outBase64();let name=state.outName;
    try{ await native.Filesystem.writeFile({path:'Sign26/'+name,data,directory:'DOCUMENTS',recursive:true}); }
    catch(e){ name=name.replace(/\\.pdf$/i,'')+' '+Date.now()+'.pdf'; await native.Filesystem.writeFile({path:'Sign26/'+name,data,directory:'DOCUMENTS',recursive:true}); }
    return name;
  }
  async function nativeShare(){
    await clearShared();
    const data=await outBase64();
    const w=await native.Filesystem.writeFile({path:'share/'+state.outName,data,directory:'CACHE',recursive:true});
    await native.Share.share({title:state.outName,files:[w.uri]});
  }
  if(native){
    const sh=$('doneShare'),sv=$('doneSave');
    new MutationObserver(()=>{ sh.hidden=false; }).observe($('doneScrim'),{attributes:true,attributeFilter:['hidden']});
    sh.onclick=async()=>{ try{ await nativeShare(); state.dirty=false; }catch(e){ if(!/cancel/i.test(String(e&&e.message))) toast('השליחה לא הצליחה. שמור את הקובץ ושלח אותו ידנית.',4000); } };
    sv.onclick=async()=>{ try{ const n=await nativeSave(); state.dirty=false; toast('נשמר בתיקיית Documents/Sign26 בשם: '+n,6000); }catch(e){ toast('השמירה נכשלה. נסה לשלוח את הקובץ בוואטסאפ או במייל.',5000); } };
  }
  /* ---------- sample ---------- */`);

fs.mkdirSync('www', { recursive: true });
fs.writeFileSync('www/index.html', s);
const dir = 'node_modules/pdfjs-dist/legacy/build/';
fs.copyFileSync(dir + 'pdf.min.mjs', 'www/pdf.min.js');
fs.copyFileSync(dir + 'pdf.worker.min.mjs', 'www/pdf.worker.min.js');
console.log('www ready', s.length, JSON.parse(fs.readFileSync('node_modules/pdfjs-dist/package.json')).version);
