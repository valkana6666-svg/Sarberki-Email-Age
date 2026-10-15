import {createSafeTranslator} from './safe-translation-adapter.mjs';
import {assertClosedTranslation} from './shared-core/incoming-translation-policy.mjs';
// Explicit button use only. Session identity is checked around every await.
export function createIncomingTranslator({globalRef=globalThis.window,request=globalThis.fetch}={}){
 let current=null,cache=new Map();
 return createSafeTranslator({enabled:true,transport:async input=>{
  assertClosedTranslation(input);
  const session=globalRef?.SarberkiCaseStoreSession;
  if(!session||typeof session.getCsrfToken!=='function')throw Error('AUTH_REQUIRED');
  if(current!==session){current=session;cache=new Map();}
  const key=JSON.stringify(input);
  if(!cache.has(key))cache.set(key,(async()=>{
   const csrf=await session.getCsrfToken();
   if(globalRef.SarberkiCaseStoreSession!==session)throw Error('SESSION_CHANGED');
   if(!/^[a-f0-9]{64}$/.test(csrf||''))throw Error('AUTH_REQUIRED');
   const response=await request('/.netlify/functions/translate-incoming',{method:'POST',cache:'no-store',credentials:'same-origin',redirect:'error',
    signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json','X-Sarberki-Operator':'1','X-CSRF-Token':csrf},body:JSON.stringify(input)});
   const result=await response.json();
   if(globalRef.SarberkiCaseStoreSession!==session)throw Error('SESSION_CHANGED');
   if(!response.ok)throw Error(['TRANSLATION_DISABLED','FORBIDDEN','AUTH_REQUIRED','INVALID_INPUT'].includes(result?.error)?result.error:'TRANSLATION_UNAVAILABLE');
   return result;
  })());
  const result=await cache.get(key);
  if(globalRef.SarberkiCaseStoreSession!==session)throw Error('SESSION_CHANGED');
  return result;
 }});
}
