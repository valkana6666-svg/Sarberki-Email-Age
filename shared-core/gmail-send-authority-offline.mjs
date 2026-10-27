// Pure, fail-closed sender authority policy prototype. Not wired to live Auth or Gmail.
// Any production use needs a separately approved server-side DB role and fresh Auth.
export function offlineSendAuthority({environment,authenticated,tenant,caseId,subject,independentSendPermission,explicitOperatorConsent,csrfVerified}={}) {
  const denied=reason=>Object.freeze({authorized:false,role:null,tenant:null,reason});
  if(environment!=='TEST_ONLY_DISABLED_BY_DEFAULT')return denied('FEATURE_DISABLED');
  if(authenticated!==true||typeof subject!=='string'||!subject)return denied('AUTH_REQUIRED');
  if(tenant!=='sarberki-test'||caseId!=='13c8ecb7-f836-4e2c-9833-d58ee96f2dda')return denied('SCOPE_DENIED');
  if(independentSendPermission!==true)return denied('SEND_PERMISSION_REQUIRED');
  if(csrfVerified!==true)return denied('CSRF_REQUIRED');
  if(explicitOperatorConsent!==true)return denied('CONSENT_REQUIRED');
  return Object.freeze({authorized:true,role:'sender',tenant,reason:'OFFLINE_SIMULATION_ONLY'});
}
