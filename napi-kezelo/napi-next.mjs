// Owner 2026-11-15 („egyszerűsíteni kell … gombos műveletet csináljuk meg most”): one "next step" box per case with a
// single button for the step that comes now. It only drives the existing, server-checked actions (same requests, same
// guards); every step asks once more in place ("Igen" is the real click, so a Google consent popup keeps the gesture).
export function nextStepFor(record,{sendable=false}={}){
 if(!record)return null;
 const b=record.booking,status=b?.status;
 const intent=typeof record.bookingIntent==='string'&&record.bookingIntent.length>0;
 // Owner 2026-11-15: the system's job ends when the booking is recorded in Previo. Checking/correcting it (e.g. the
 // cabin), the voucher, proforma, deposit invoice, final invoice and payment are done by hand in Previo.
 // Owner 2026-11-22: the case is closed („Lezárt”) when the deposit has arrived; the staff mark it with one button.
 if(status==='deposit_received')return {kind:'handoff',label:null,ask:null,
  info:'✅ A foglaló beérkezett – a foglalás lezárva'+(b?.unit?' ('+b.unit+'. egység)':'')+'. A többi (számla, módosítás, lemondás) a Previóban.'};
 if(status==='finalized'&&record.canMarkDeposit===true)return {kind:'deposit',label:'Foglaló beérkezett',
  ask:'Megérkezett a foglaló? A mai dátummal rögzítem, és a foglalás a „Lezárt foglalások” közé kerül.',
  info:'✅ A foglalás rögzítve a Previóban'+(b?.unit?' ('+b.unit+'. egység)':'')+'. Ha megérkezett a foglaló, nyomd meg a gombot.'};
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
