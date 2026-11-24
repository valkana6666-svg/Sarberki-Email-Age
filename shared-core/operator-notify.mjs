// Owner 2026-11-15: a Pushover note to the owner's phone whenever the system has written a booking into the Previo
// TEST (one-click / V2 auto). Same switch and keys as the chat-request note (INTAKE_NOTIFY=pushover,
// PUSHOVER_API_TOKEN, PUSHOVER_USER_KEY). No guest name, e-mail or phone in the note; best effort, never blocks.
const NAPI='https://leafy-chimera-2403e5.netlify.app/napi-kezelo/';
const day=iso=>/^\d{4}-\d{2}-\d{2}$/.test(String(iso||''))?iso.replaceAll('-','.')+'.':'';
export function previoBookingNote(saved){
 const d=saved?.data,b=d?.booking,v=d?.state?.values||{};
 if(!/^V2-\d+$/.test(String(b?.previo?.reference??b?.previoReference??''))||!['finalized','deposit_received'].includes(b?.status))return null;
 const guests=Number(v.adults||0)+Number(v.children||0);
 const parts=[String(v.unit||'').trim()||null,day(v.arrival)&&day(v.departure)?day(v.arrival)+'–'+day(v.departure):null,guests>0?guests+' fő':null].filter(Boolean);
 return 'Foglalás beíródott a Previo-tesztbe'+(parts.length?': '+parts.join(', '):'')+'.';
}
// caseId (optional, owner 2026-11-24): the link opens that booking in the daily view (after sign-in).
export async function notifyPushover(env,fetchImpl,message,{caseId=null}={}){
 if(env.INTAKE_NOTIFY!=='pushover'||typeof message!=='string'||!message)return false;
 const token=env.PUSHOVER_API_TOKEN?.trim(),user=env.PUSHOVER_USER_KEY?.trim();if(!token||!user)return false;
 try{
  const r=await fetchImpl('https://api.pushover.net/1/messages.json',{method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),
   headers:{'Content-Type':'application/json'},body:JSON.stringify({token,user,title:'Sárberki TEST',message,url:/^tm-[a-f0-9]{12,32}$/.test(String(caseId||''))?NAPI+'?case='+caseId:NAPI,url_title:'Napi kezelő'})});
  return r.ok;
 }catch{return false;}
}
