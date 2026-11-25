// Server-only. Owner 2026-11-24: Pushover to the owner's phone (for now) 48 hours before a deposit deadline, and once
// more when the deadline has passed without the deposit marked. The hourly job reads only type, dates and deadline
// (sc_deposit_alerts, intake account) – the message carries no guest name, e-mail or phone. Without writing anything,
// each alert fires exactly once by its time slot: "soon" in the run between 08:00 and 09:00 Budapest two days before
// the deadline day (owner 2026-11-25), "today" in the morning run of the deadline day. A deposit marked received (status no longer 'finalized') is never in the list.
// Later (Previo Hotel.getPayments right): a payment recorded in Previo will also close the case and skip the alert.
const HOUR=3600000;
const dot=d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d||''))?String(d).replaceAll('-','.')+'.':null;
// 08:00 Budapest time on the Budapest calendar day of ms (DST-safe: find the UTC hour that is 8 o'clock there).
function budapestAt8(ms){
 const day=new Date(ms).toLocaleDateString('en-CA',{timeZone:'Europe/Budapest'});
 for(const h of [6,7]){const c=Date.parse(day+'T0'+h+':00:00Z');if(new Date(c).toLocaleString('en-GB',{timeZone:'Europe/Budapest',hour:'2-digit',hourCycle:'h23'})==='08')return c;}
 return Date.parse(day+'T07:00:00Z');
}
// Noon UTC of the Budapest calendar day two days before the day of ms (a safe point inside that day).
function twoDaysBefore(ms){const [y,m,d]=new Date(ms).toLocaleDateString('en-CA',{timeZone:'Europe/Budapest'}).split('-').map(Number);return Date.UTC(y,m-1,d-2,12);}
const when=ms=>new Date(ms).toLocaleString('hu-HU',{timeZone:'Europe/Budapest',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});

export function depositAlerts(rows,nowMs=Date.now()){
 const out=[];
 for(const r of Array.isArray(rows)?rows:[]){
  const t=Date.parse(r?.deadlineUtc||'');if(Number.isNaN(t))continue;
  const left=t-nowMs;
  // Owner 2026-11-24: the second alert on the deadline DAY so the staff can still send the same-day reminder: at
  // 08:00 Budapest that day, or 12 h before the deadline if it is earlier than 09:00.
  const morning=budapestAt8(t),dayAlert=t-morning>=HOUR?morning:t-12*HOUR;
  // Owner 2026-11-25 („állítsd át reggel 8-ra”): the first alert at 08:00 Budapest two calendar days before the
  // deadline day (not exactly 48 h before – that could be in the night).
  const soonAt=budapestAt8(twoDaysBefore(t));
  const kind=nowMs>=soonAt&&nowMs<soonAt+HOUR&&soonAt<dayAlert?'soon':nowMs>=dayAlert&&nowMs<dayAlert+HOUR?'today':null;
  if(!kind)continue;
  const stay=[String(r.unit||'').slice(0,30),dot(r.arrival)&&dot(r.departure)?dot(r.arrival)+' – '+dot(r.departure):null].filter(Boolean).join(', ');
  out.push({caseId:String(r.caseId||''),kind,text:kind==='soon'
   ?`⏳ A foglaló 2 nap múlva lejár – ${stay}${stay.endsWith('.')?'':'.'} Határidő: ${when(t)}. Ha megjött, a napi kezelőben: „Foglaló beérkezett”; ha nem, küldhetsz emlékeztetőt a vendégnek.`
   :`⚠️ Ma lejár a foglaló határideje (${when(t)}) – ${stay}${stay.endsWith('.')?'':'.'} Még nincs megjelölve. Ha megjött: „Foglaló beérkezett”; ha nem, küldd el a vendégnek az utolsó emlékeztetőt.`});
 }
 return out;
}
