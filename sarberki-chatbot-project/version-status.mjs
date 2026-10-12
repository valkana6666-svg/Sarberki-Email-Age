import {deployedCommit} from '../build-info.mjs';
export function initVersionStatus({documentRef=document,windowRef=window,request=fetch,bootCommit=deployedCommit,reload=()=>windowRef.location.reload()}={}){
 const label=documentRef.getElementById('deployed_version'),button=documentRef.getElementById('reload_version');
 if(!label||!button)return null;
 const valid=sha=>typeof sha==='string'&&/^[a-f0-9]{40}$/.test(sha);
 let epoch=0;
 const check=async()=>{
  const current=++epoch;
  try{
   const response=await request('/build-info.mjs',{method:'GET',cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw Error();
   const match=(await response.text()).match(/^export const deployedCommit = "([a-f0-9]{40})";\s*$/);
   if(!match||!valid(bootCommit))throw Error();if(current!==epoch)return;
   label.textContent=match[1]===bootCommit?'Tesztverzió: '+bootCommit.slice(0,12)+' · a telepített verzió egyezik.':'Új tesztverzió érhető el. Nyomd meg a Frissítés gombot; ez az oldal még a korábbi verzió.';
   label.dataset.versionState=match[1]===bootCommit?'current':'stale';
  }catch{if(current===epoch){label.textContent='A telepített verzió jelenleg nem ellenőrizhető. Aktuális szerveradat nem igazolt.';label.dataset.versionState='unavailable';}}
 };
 button.addEventListener('click',()=>{epoch++;reload();});
 windowRef.addEventListener('pageshow',event=>{if(event.persisted)check();});
 documentRef.addEventListener('visibilitychange',()=>{if(documentRef.visibilityState==='visible')check();});
 check();return {check};
}
if(typeof document!=='undefined')initVersionStatus();
