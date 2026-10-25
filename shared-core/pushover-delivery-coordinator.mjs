// Pure, test-branch-only coordinator: NOT wired to any Netlify or Gmail endpoint.
// Fail closed unless an operator-provided ledger implements an ATOMIC claimOnce.
// Local simulation tests do not prove durable PostgreSQL isolation.
const ID=/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,255}$/u;
function validIdentity(v) {
  return v&&typeof v==='object'&&!Array.isArray(v)&&
    ['tenantId','messageId','notificationType'].every(k=>typeof v[k]==='string'&&ID.test(v[k]))&&
    typeof v.mailbox==='string'&&
    Object.keys(v).length===4&&
    v.mailbox==='sarberkiprojecttest@gmail.com'&&v.notificationType==='gmail-new-message';
}
const result=(status,code)=>Object.freeze({status,code,deliveryConfirmed:false});
// The host must provide durable, atomic claimOnce and terminal transitions.
// claimOnce must never regrant a claim for SENDING, SENT or OUTCOME_UNKNOWN,
// including after worker restart, crash, or lease expiry. Operator review
// is required to resolve an uncertain send outcome.
export function createPushoverDeliveryCoordinator({ledger=null,sender=null,enabled=false}={}) {
  const ready=ledger&&typeof ledger.claimOnce==='function'&&
    typeof ledger.markSent==='function'&&typeof ledger.markUnknown==='function'&&
    typeof sender==='function';
  return Object.freeze({
    async process(identity) {
      if(!validIdentity(identity))return result('blocked','INVALID_IDENTITY');
      if(enabled!==true)return result('disabled','NOT_ENABLED');
      if(!ready)return result('blocked','LEDGER_OR_SENDER_MISSING');
      const key=Object.freeze({...identity});
      let claim;
      try{claim=await ledger.claimOnce(key);}catch{return result('blocked','CLAIM_FAILED');}
      if(claim?.status==='duplicate')return result('suppressed','ALREADY_CLAIMED');
      if(claim?.status!=='claimed'||typeof claim.claimId!=='string'||!ID.test(claim.claimId))
        return result('blocked','INVALID_CLAIM');
      const receipt=claim.claimId;
      // Any failure after acquiring a claim becomes OUTCOME_UNKNOWN. Never
      // retry a provider request merely because the response was lost.
      let sent=false;
      try {
        const acknowledgement=await sender(key);
        if(acknowledgement?.accepted!==true)throw Error('PROVIDER_OUTCOME_UNVERIFIED');
        sent=true;
        if(await ledger.markSent(key,receipt)===false)throw Error('LEDGER_REJECTED_TRANSITION');
        // API acceptance is not proof of delivery to a physical iPhone.
        return Object.freeze({status:'accepted',code:'PROVIDER_ACCEPTED',deliveryConfirmed:false});
      } catch {
        try{if(await ledger.markUnknown(key,receipt)===false)throw Error('LEDGER_REJECTED_TRANSITION');}catch{
          // Persistently claiming before dispatch is essential here.
          return result('review','LEDGER_TRANSITION_FAILED');
        }
        return result('review',sent?'SENT_BUT_RECORD_FAILED':'PROVIDER_OUTCOME_UNKNOWN');
      }
    }
  });
}
