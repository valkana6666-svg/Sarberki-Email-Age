// Owner 2026-11-15 („egyszerűsíteni kell … gombos műveletet csináljuk meg most”): one "next step" box per case with a
// single button for the step that comes now. It only drives the existing, server-checked actions (same requests, same
// guards); every step asks once more in place ("Igen" is the real click, so a Google consent popup keeps the gesture).
export function nextStepFor(record,{sendable=false}={}){
 if(!record)return null;
 const b=record.booking,status=b?.status;
 const intent=typeof record.bookingIntent==='string'&&record.bookingIntent.length>0;
 if(record.canMarkDeposit===true)return {kind:'deposit',label:'Foglaló beérkezett (ma)',ask:'A foglaló a teljes összegben beérkezett a bankszámlára?'};
 if(record.canOneClick===true&&!['finalized','deposit_received','cancelled'].includes(status)&&intent)
  return {kind:'book',label:'Foglalás (előnézet)',ask:null};
 if(record.approval==='pending'&&record.canDecide===true)
  return sendable?{kind:'approveSend',label:'Válasz jóváhagyása és küldése',ask:'Jóváhagyod, és elküldöd a választ a vendégnek?'}
   :{kind:'approve',label:'Válasz jóváhagyása',ask:'Jóváhagyod a választ?'};
 if(record.approval==='approved_internal'&&sendable)
  return {kind:'send',label:['finalized','deposit_received'].includes(status)?'Visszaigazolás küldése':'Válasz küldése',ask:'Elküldöd a levelet a vendégnek? (Ha már elment, a rendszer nem küldi el újra.)'};
 return null;
}
