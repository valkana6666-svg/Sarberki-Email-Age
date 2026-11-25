// Scheduled (hourly). Owner 2026-11-24: Pushover to the owner's phone 48 hours before a deposit deadline and when it
// has passed without the deposit marked. Off unless DEPOSIT_ALERTS=test-only, the existing Pushover switch
// (INTAKE_NOTIFY=pushover) and the TEST project. Reads with the existing intake account through the narrow
// sc_deposit_alerts function (type, dates, deadline only). Writes nothing; no public input; no guest data in the log.
import {createSupabaseTransport} from '../../shared-core/supabase-case-repository.mjs';
import {depositAlerts} from '../../shared-core/server-deposit-alerts.mjs';
import {notifyPushover} from '../../shared-core/operator-notify.mjs';

const TEST_PROJECT='https://mojnqizbcaczstguikpv.supabase.co',TENANT='sarberki-test';

export async function runDepositAlerts({env=process.env,fetchImpl=globalThis.fetch,now=()=>Date.now(),notify=notifyPushover}={}){
 if(env.DEPOSIT_ALERTS!=='test-only'||env.INTAKE_NOTIFY!=='pushover'||env.SUPABASE_URL!==TEST_PROJECT)return {status:'off'};
 let token;
 try{
  const r=await fetchImpl(TEST_PROJECT+'/auth/v1/token?grant_type=password',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
   headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:env.INTAKE_ACCOUNT_EMAIL,password:env.INTAKE_ACCOUNT_PASSWORD})});
  if(!r.ok)return {status:'auth_failed'};
  token=(await r.json())?.access_token;
 }catch{return {status:'auth_failed'};}
 if(typeof token!=='string'||!token)return {status:'auth_failed'};
 let rows;
 try{const transport=createSupabaseTransport({url:TEST_PROJECT+'/',publishableKey:env.SUPABASE_PUBLISHABLE_KEY,token,fetchImpl});
  rows=await transport('/rest/v1/rpc/sc_deposit_alerts',{method:'POST',body:{p_tenant:TENANT}});}
 catch{return {status:'read_failed'};}
 const alerts=depositAlerts(rows,now());
 let sent=0;
 for(const a of alerts){if(await notify(env,fetchImpl,a.text,{caseId:a.caseId,view:'finance'}))sent++;}
 return {status:'ran',checked:Array.isArray(rows)?rows.length:0,alerts:alerts.length,sent};
}

export default async()=>{
 const r=await runDepositAlerts();
 console.log('deposit-alerts',JSON.stringify(r));
 return new Response(JSON.stringify(r),{status:200,headers:{'content-type':'application/json','cache-control':'no-store'}});
};
export const config={schedule:'7 * * * *'};
