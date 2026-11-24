// Server-only. Owner 2026-11-24: Pushover to the owner's phone (for now) 48 hours before a deposit deadline, and once
// more when the deadline has passed without the deposit marked. The hourly job reads only type, dates and deadline
// (sc_deposit_alerts, intake account) – the message carries no guest name, e-mail or phone. Without writing anything,
// each alert fires exactly once by its time slot: "soon" in the run where 47 h < time left <= 48 h, "overdue" in the
// run where 0 <= time past < 1 h. A deposit marked received (status no longer 'finalized') is never in the list.
// Later (Previo Hotel.getPayments right): a payment recorded in Previo will also close the case and skip the alert.
const HOUR=3600000;
const dot=d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d||''))?String(d).replaceAll('-','.')+'.':null;
const when=ms=>new Date(ms).toLocaleString('hu-HU',{timeZone:'Europe/Budapest',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});

export function depositAlerts(rows,nowMs=Date.now()){
 const out=[];
 for(const r of Array.isArray(rows)?rows:[]){
  const t=Date.parse(r?.deadlineUtc||'');if(Number.isNaN(t))continue;
  const left=t-nowMs;
  const kind=left>47*HOUR&&left<=48*HOUR?'soon':left<=0&&left>-HOUR?'overdue':null;
  if(!kind)continue;
  const stay=[String(r.unit||'').slice(0,30),dot(r.arrival)&&dot(r.departure)?dot(r.arrival)+' – '+dot(r.departure):null].filter(Boolean).join(', ');
  out.push({caseId:String(r.caseId||''),kind,text:kind==='soon'
   ?`⏳ A foglaló 2 nap múlva lejár – ${stay}${stay.endsWith('.')?'':'.'} Határidő: ${when(t)}. Ha megjött, a napi kezelőben: „Foglaló beérkezett”; ha nem, küldhetsz emlékeztetőt a vendégnek.`
   :`⚠️ Lejárt a foglaló határideje (${when(t)}) – ${stay}${stay.endsWith('.')?'':'.'} Még nincs megjelölve: ellenőrizd az utalást, vagy egyeztess a vendéggel.`});
 }
 return out;
}
