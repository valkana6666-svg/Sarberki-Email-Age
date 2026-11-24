// Owner 2026-11-15 („egyszerűsíteni kell … gombos műveletet csináljuk meg most”): one "next step" box per case with a
// single button for the step that comes now. It only drives the existing, server-checked actions (same requests, same
// guards); every step asks once more in place ("Igen" is the real click, so a Google consent popup keeps the gesture).
// Owner 2026-11-23: the deposit deadline at a glance. 'soon' = within 2 days (the guest reminder is due), 'overdue' =
// the deadline passed and the deposit is not marked. Hungarian time in the text.
export function depositNotice(deadlineUtc,nowMs=Date.now()){
 const t=Date.parse(deadlineUtc||'');if(Number.isNaN(t))return null;
 const when=new Date(t).toLocaleString('hu-HU',{timeZone:'Europe/Budapest',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
 const left=t-nowMs,day=86400000;
 if(left<0)return {level:'overdue',short:'⚠️ foglaló határideje lejárt',text:`⚠️ A foglaló határideje lejárt (${when}), és még nincs megjelölve. Ellenőrizd az utalást, vagy egyeztess a vendéggel.`};
 if(left<=2*day)return {level:'soon',short:'⏳ foglaló 2 napon belül lejár',text:`⏳ A foglaló határideje közeleg: ${when}.`};
 return {level:'ok',short:null,text:`Foglaló határideje: ${when}.`};
}
export function nextStepFor(record,{sendable=false,now=Date.now()}={}){
 if(!record)return null;
 const b=record.booking,status=b?.status;
 const intent=typeof record.bookingIntent==='string'&&record.bookingIntent.length>0;
 // Owner 2026-11-15: the system's job ends when the booking is recorded in Previo. Checking/correcting it (e.g. the
 // cabin), the voucher, proforma, deposit invoice, final invoice and payment are done by hand in Previo.
 // Owner 2026-11-22: the case is closed („Lezárt”) when the deposit has arrived; the staff mark it with one button.
 if(status==='deposit_received')return {kind:'handoff',label:null,ask:null,
  info:'✅ A foglaló beérkezett – a foglalás lezárva'+(b?.unit?' ('+b.unit+'. egység)':'')+'. A többi (számla, módosítás, lemondás) a Previóban.'};
 // Owner 2026-11-23: in the last 2 days before the deadline the guest gets a reminder (one click, e-mail needed).
 // Owner 2026-11-24: two reminders – 2 days before and on the deadline day.
 const fin=record.reminderKind==='final';
 if(status==='finalized'&&record.reminderDue===true&&sendable)return {kind:'reminder',label:fin?'Utolsó emlékeztető küldése (ma lejár)':'Emlékeztető küldése a vendégnek',
  ask:fin?'Elküldöd a vendégnek az utolsó emlékeztetőt, hogy ma lejár a foglaló határideje?':'Elküldöd a vendégnek az emlékeztetőt, hogy 2 napon belül lejár a foglaló határideje?',
  info:(fin?'⚠️ Ma lejár a foglaló határideje, és még nincs megjelölve. Küldd el az utolsó emlékeztetőt a vendégnek.':'⏳ 2 napon belül lejár a foglaló határideje, és még nincs megjelölve. Küldj emlékeztetőt a vendégnek.')+
   (depositNotice(b?.deposit?.deadlineUtc,now)?'\n'+depositNotice(b.deposit.deadlineUtc,now).text:'')+'\nHa a foglaló már megjött: „Teljes nézet” → Foglaló beérkezett.'};
 if(status==='finalized'&&record.canMarkDeposit===true)return {kind:'deposit',label:'Foglaló beérkezett',
  ask:'Megérkezett a foglaló? A mai dátummal rögzítem, és a foglalás a „Lezárt foglalások” közé kerül.',
  info:'✅ A foglalás rögzítve a Previóban'+(b?.unit?' ('+b.unit+'. egység)':'')+'. Ha megérkezett a foglaló, nyomd meg a gombot.'+
   (depositNotice(b?.deposit?.deadlineUtc,now)?'\n'+depositNotice(b.deposit.deadlineUtc,now).text:'')+(record.reminderSent?'\n📧 1. emlékeztető elküldve.':'')+(record.reminderFinalSent?'\n📧 Utolsó emlékeztető elküldve.':'')};
 if(status==='finalized')return {kind:'handoff',label:null,ask:null,
  info:'✅ A foglalás rögzítve a Previóban'+(b?.unit?' ('+b.unit+'. egység)':'')+'. Innen a Previóban folytasd: adatok ellenőrzése/javítása, voucher, díjbekérő, előleg- és végszámla.'};
 if(record.canOneClick===true&&!['finalized','deposit_received','cancelled'].includes(status)&&intent)
  // Owner 2026-11-19: with a guest e-mail the one button books in Previo AND sends the confirmation (one approval).
  return sendable?{kind:'book',label:'Foglalás jóváhagyása',ask:null,send:true}:{kind:'book',label:'Foglalás (előnézet)',ask:null};
 // Owner test 2026-11-18 (Nagy Márton): price first – the reply must not be approved without the price.
 if(record.approval==='pending'&&record.priceable===true)
  return {kind:'price',label:'Ár kiszámítása',ask:null};
 if(record.approval==='pending'&&record.canDecide===true)
  return sendable?{kind:'approveSend',label:'Válasz jóváhagyása és küldése',ask:'Jóváhagyod, és elküldöd a választ a vendégnek?'}
   :{kind:'approve',label:'Válasz jóváhagyása',ask:'Jóváhagyod a választ?'};
 if(record.approval==='approved_internal'&&sendable)
  return {kind:'send',label:'Válasz küldése',ask:'Elküldöd a levelet a vendégnek? (Ha már elment, a rendszer nem küldi el újra.)'};
 return null;
}
