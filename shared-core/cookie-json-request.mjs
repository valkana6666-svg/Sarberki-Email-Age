// Browser cookie JSON endpoints only. Timeout is uncertainty, never rollback or retry.
export function createCookieJsonRequest({request=fetch,timeoutMs=15000,setTimer=setTimeout,clearTimer=clearTimeout}={}){
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
  try{return await Promise.race([operation(),deadline]);}
  finally{clearTimer(timer);}
 };
}
