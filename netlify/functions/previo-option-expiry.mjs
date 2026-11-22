// Scheduled (every 15 minutes). Owner 2026-11-22 (PERM-20261122-OPTION-EXPIRY-CANCEL): expired options the system
// created are cancelled in Previo TEST 73521. Off unless OPTION_EXPIRY_CANCEL=test-only and the V2 writer switches
// are on; the live property is never touched (the writer refuses anything but 73521). No public input, no guest data
// in the log (booking id and number only).
import {cancelExpiredOptions} from '../../shared-core/server-previo-option-expiry.mjs';

export default async()=>{
 const r=await cancelExpiredOptions({env:process.env,log:line=>console.log(line)});
 return new Response(JSON.stringify({status:r.status,checked:r.checked??0}),{status:200,headers:{'content-type':'application/json','cache-control':'no-store'}});
};
export const config={schedule:'*/15 * * * *'};
