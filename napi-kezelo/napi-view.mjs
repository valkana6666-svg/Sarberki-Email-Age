// Simple / full view switch for the daily operator page (owner request 2026-11-04: the live operator view
// should be as simple as possible). Simple view only HIDES explanations and rarely used controls via CSS
// (body.simple); every function, permission and server check is unchanged. The choice is a per-device
// convenience in localStorage; without storage the page falls back to the simple view.
const KEY='sarberki-napi-view';
export function initViewSwitch(doc=globalThis.document,storage=()=>globalThis.localStorage){
 const button=doc?.getElementById?.('view-toggle');
 const body=doc?.body;
 if(!button||!body?.classList)return null;
 let mode='simple';
 try{if(storage()?.getItem(KEY)==='full')mode='full';}catch{}
 const apply=()=>{
  body.classList.toggle('simple',mode==='simple');
  button.textContent=mode==='simple'?'Teljes nézet':'Egyszerű nézet';
  button.setAttribute('aria-pressed',String(mode==='full'));
 };
 button.addEventListener('click',()=>{
  mode=mode==='simple'?'full':'simple';
  try{storage()?.setItem(KEY,mode);}catch{}
  apply();
 });
 apply();
 return {mode:()=>mode};
}
initViewSwitch();
