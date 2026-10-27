import {simulateStoredClarification,EXACT_CASE,TEST_DESTINATION} from './gmail-send-dry-run.mjs';

// SERVER-SIDE DRY RUN ONLY. No network, secrets, send API or UI-controlled approval record.
// The trusted server must inject its existing authenticated read and authoritative role verification.
export function createVerifiedGmailSendPreview({getCase,requireSender}={}) {
  if(typeof getCase!=='function'||typeof requireSender!=='function') throw Error('TRUSTED_READ_DEPENDENCIES_REQUIRED');
  return async ({tenantId,caseId,destination=TEST_DESTINATION,sourceAccount=TEST_DESTINATION}={})=>{
    const deny=reason=>Object.freeze({eligible:false,simulation:true,willSend:false,reason});
    if(tenantId!=='sarberki-test'||caseId!==EXACT_CASE)return deny('SCOPE_DENIED');
    if(destination!==TEST_DESTINATION||sourceAccount!==TEST_DESTINATION)return deny('DESTINATION_DENIED');
    let authority,record;
    try{
      authority=await requireSender({tenantId});
      if(!authority||authority.authorized!==true||authority.role!=='sender'||authority.tenant!==tenantId)return deny('SENDER_AUTH_REQUIRED');
      record=await getCase({tenantId,caseId});
    }catch{return deny('TRUSTED_READ_FAILED');}
    if(!record||record.tenantId!==tenantId||record.caseId!==caseId)return deny('RECORD_NOT_FOUND');
    return simulateStoredClarification(record,{destination,sourceAccount,operator:authority});
  };
}
