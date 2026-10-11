import {verifyLocalExport} from './local-recovery.mjs';
const button=document.getElementById('export'),result=document.getElementById('result');
const allowed=location.origin==='https://leafy-chimera-2403e5.netlify.app';
if(!allowed){button.disabled=true;result.textContent='Ez az export kizárólag az eredeti Sárberki tesztoldal azonos webhelyén használható. Más webhely és más böngészőprofil adatait nem tudja olvasni.';}
button.addEventListener('click',async()=>{
 button.disabled=true;
 try{
  const a=document.getElementById('phrase'),b=document.getElementById('repeat');
  if(a.value!==b.value)throw Error('A két jelmondat nem egyezik.');
  result.textContent='Titkosítás és visszaolvasási ellenőrzés…';
  const r=await verifyLocalExport(localStorage,location.origin,a.value);a.value='';b.value='';
  if(!r.keyCount)throw Error('Ebben a böngészőprofilban nincs menthető Sárberki-ügytár vagy feldolgozási előzmény. Ez nem igazolt laptopmentés.');
  const url=URL.createObjectURL(new Blob([r.encrypted],{type:'application/octet-stream'}));
  const link=document.createElement('a');link.href=url;link.download='Sarberki_Local_2026-10-11.enc.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
  result.textContent='A titkosított fájl elkészült, a helyi visszafejtési ellenőrzés sikeres. Mentett kulcsok: '+r.keyCount+'\nSHA-256: '+r.sha256+'\nA letöltött .enc.json fájlt add át a Worknek. Jelmondatot ne küldj.';
 }catch(error){result.textContent=error.message;}finally{button.disabled=!allowed;}
});
