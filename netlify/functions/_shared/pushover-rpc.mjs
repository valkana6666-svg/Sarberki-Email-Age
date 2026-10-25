// Protected server transport. Never import into browser or static build.
const ORIGIN='https://mojnqizbcaczstguikpv.supabase.co';
const NAMES=new Set(['sc_pushover_claim_once','sc_pushover_mark_sent','sc_pushover_mark_unknown']);
export function createPushoverRpc({url,key,send=fetch,timeoutMs=10000}={}){
 if(url!==ORIGIN||typeof key!=='string'||!key.trim()||/[\r\n]/.test(key)||typeof send!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>15000)throw Error('INVALID_RPC_CONFIGURATION');
 return async(name,args)=>{
  if(!NAMES.has(name)||!args||typeof args!=='object'||Array.isArray(args))throw Error('INVALID_RPC_OPERATION');
  const controller=new AbortController();let timer;
  try{
   const data=await Promise.race([(async()=>{
    const response=await send(ORIGIN+'/rest/v1/rpc/'+name,{method:'POST',redirect:'error',headers:{'content-type':'application/json',apikey:key,authorization:'Bearer '+key},body:JSON.stringify(args),signal:controller.signal});
    if(!response.ok)throw Error('RPC_REJECTED');return await response.json();
   })(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('RPC_TIMEOUT'));},timeoutMs);})]);
   return {data,error:null};
  }catch{throw Error('RPC_UNAVAILABLE');}finally{clearTimeout(timer);}
 };
}
