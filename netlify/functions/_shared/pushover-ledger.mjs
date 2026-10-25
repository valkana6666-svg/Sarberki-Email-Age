// Server-only adapter. Inject a protected Supabase client's rpc method.
// No credentials, network defaults, retries or notification dispatch here.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function identity(k){if(!k||k.tenantId!=='sarberki-test'||k.mailbox!=='sarberkiprojecttest@gmail.com'||k.notificationType!=='gmail-new-message'||!/^[A-Za-z0-9_-]{5,128}$/.test(k.messageId))throw Error('INVALID_LEDGER_IDENTITY');}
export function createPushoverLedger({rpc,timeoutMs=10000}={}){
 if(typeof rpc!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>15000)throw Error('INVALID_LEDGER_CONFIGURATION');
 async function call(name,args){let timer;try{
  const result=await Promise.race([Promise.resolve().then(()=>rpc(name,args)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('LEDGER_TIMEOUT')),timeoutMs);})]);
  if(!result||result.error)throw Error('LEDGER_RPC_FAILED');return result.data;
 }catch{throw Error('LEDGER_UNAVAILABLE');}finally{clearTimeout(timer);}}
 function claimId(v){if(typeof v!=='string'||!UUID.test(v))throw Error('INVALID_CLAIM_ID');}
 return Object.freeze({
  async claimOnce(k){identity(k);const data=await call('sc_pushover_claim_once',{p_tenant:k.tenantId,p_mailbox:k.mailbox,p_message:k.messageId,p_kind:k.notificationType});
   if(data?.status==='duplicate')return Object.freeze({status:'duplicate'});
   if(data?.status!=='claimed')throw Error('INVALID_CLAIM_RESPONSE');claimId(data.claimId);return Object.freeze({status:'claimed',claimId:data.claimId});},
  async markSent(k,id,requestId){identity(k);claimId(id);if(typeof requestId!=='string'||!requestId||requestId.length>128)throw Error('INVALID_PROVIDER_RECEIPT');
   const data=await call('sc_pushover_mark_sent',{p_claim:id,p_provider_request_id:requestId});if(typeof data!=='boolean')throw Error('INVALID_TRANSITION_RESPONSE');return data;},
  async markUnknown(k,id){identity(k);claimId(id);const data=await call('sc_pushover_mark_unknown',{p_claim:id});if(typeof data!=='boolean')throw Error('INVALID_TRANSITION_RESPONSE');return data;}
 });
}
