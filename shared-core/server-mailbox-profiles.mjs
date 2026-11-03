// Server-only (never published to the browser). One place for the per-business mailbox settings of the existing Gmail read-only chain.
// Only the TEST profile is enabled. The live profile records the decided target (info@sarberkito.hu,
// Google Workspace) but stays disabled: enabling it needs the data controller's consent, its own
// tenant, store migration, source-attestation scope and a separate owner approval (AGENTS.md).
const profile=value=>Object.freeze(value);
export const MAILBOX_PROFILES=Object.freeze({
 'sarberki-test':profile({tenantId:'sarberki-test',mailboxId:'sarberki_gmail_test',account:'sarberkiprojecttest@gmail.com',
  sourceScope:'test-mailbox-source-v1',approvalScope:'test-mailbox-v1',requireTestSubject:true,blockOwnSender:false,notificationIncludesHeaders:true,enabled:true}),
 'sarberki-live':profile({tenantId:'sarberki-live',mailboxId:'sarberkito_info',account:'info@sarberkito.hu',
  sourceScope:'live-mailbox-source-v1',approvalScope:'live-mailbox-v1',requireTestSubject:false,blockOwnSender:true,notificationIncludesHeaders:false,enabled:false})
});
// Owner decision 2026-11-03: live notifications carry no guest data (no sender, no subject), so the
// notification provider never receives personal data. The TEST mailbox keeps its synthetic headers.
export function notificationText(profile,{from,subject}={}){
 if(profile?.notificationIncludesHeaders===true)return `Új levél érkezett a Sárberki tesztfiókba.\nFeladó: ${from}\nTárgy: ${subject}`;
 return 'Új érdeklődés érkezett. A részletek a napi kezelőben.';
}
// Known profile regardless of its switch: for pure checks (attestation format, ledger identity) whose
// tenant/mailbox pair the database also fences to its own deployment profile. Runtime entry points
// (reading a mailbox, ingest, notification) must use enabledMailboxProfile instead.
export function knownMailboxProfile(tenantId){
 const found=typeof tenantId==='string'&&Object.hasOwn(MAILBOX_PROFILES,tenantId)?MAILBOX_PROFILES[tenantId]:null;
 if(!found){const error=Error('MAILBOX_PROFILE_UNKNOWN');error.code='MAILBOX_PROFILE_UNKNOWN';throw error;}
 return found;
}
export function enabledMailboxProfile(tenantId){
 const found=knownMailboxProfile(tenantId);
 if(found.enabled!==true){const error=Error('MAILBOX_PROFILE_DISABLED');error.code='MAILBOX_PROFILE_DISABLED';throw error;}
 return found;
}
