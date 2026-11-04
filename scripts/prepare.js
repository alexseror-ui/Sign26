// Builds www/index.html for the Android app from the root index.html
const fs = require('fs');
let s = fs.readFileSync('index.html', 'utf8');
function rep(a, b) { if (!s.includes(a)) throw new Error('missing: ' + a); s = s.replace(a, () => b); }
rep('/* ---------- sample ---------- */', `/* ---------- Android app ---------- */
  const native=window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform()?Capacitor.Plugins:null;
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
console.log('www/index.html', s.length);
