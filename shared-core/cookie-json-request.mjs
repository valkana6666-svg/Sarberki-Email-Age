// Browser cookie JSON endpoints only. Timeout is uncertainty, never rollback or retry.
export function createCookieJsonRequest({request=fetch,timeoutMs=15000,setTimer=setTimeout,clearTimer=clearTimeout,lockManager=typeof window==='undefined'?null:globalThis.navigator?.locks}={}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw Error('INVALID_TIMEOUT');
 return async(url,options={})=>{
  const controller=new AbortController();let timer;
  const deadline=new Promise((_,reject)=>{
   timer=setTimer(()=>{controller.abort();reject(Error('SERVICE_UNAVAILABLE'));},timeoutMs);
  });
  const operation=async()=>{
   const response=await request(url,{...options,signal:controller.signal});
   const body=await response.json();
   // Buffer inside the deadline: response headers alone do not complete a JSON request.
   return {ok:response.ok,status:response.status,headers:response.headers,json:async()=>body};
  };
  // Web Locks coordinate the native cookie jar across tabs and both UIs.
  // The lock covers JSON completion/rotation; abort also cancels queued work.
  try{
   const pending=lockManager?.request?lockManager.request('sarberki-operator-cookie-request-v1',{mode:'exclusive',signal:controller.signal},()=>Promise.race([operation(),deadline])):operation();
   return await Promise.race([pending,deadline]);
  }
  finally{clearTimer(timer);}
 };
}
