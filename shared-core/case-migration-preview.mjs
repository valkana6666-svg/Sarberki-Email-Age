// Local, operator-triggered review only. Never uploads, clears or changes storage.
export function exportCaseSnapshot(cases,tenantId,now=new Date().toISOString()){
 if(!Array.isArray(cases)||cases.length>1000)throw Error('INVALID_EXPORT');
 const snapshot={schema:'sarberki-case-export-v1',tenantId,exportedAt:now,cases:structuredClone(cases)};
 previewCaseSnapshot(snapshot,tenantId);return snapshot;
}
export function previewCaseSnapshot(snapshot,tenantId,existingIds=[]){
 if(snapshot?.schema!=='sarberki-case-export-v1'||snapshot.tenantId!==tenantId||!Array.isArray(snapshot.cases)||snapshot.cases.length>1000)throw Error('INVALID_EXPORT');
 const seen=new Set();const rows=[];
 for(const c of snapshot.cases){
  if(!c||!/^[a-zA-Z0-9_-]{4,128}$/.test(c.id)||c.tenantId!==tenantId||!c.state?.values||!Array.isArray(c.messages)||!Array.isArray(c.drafts)||JSON.stringify(c).length>262144)throw Error('INVALID_CASE');
  if(seen.has(c.id))throw Error('DUPLICATE_CASE');seen.add(c.id);
  rows.push({caseId:c.id,messageCount:c.messages.length,draftCount:c.drafts.length,duplicate:existingIds.includes(c.id),requiresIdentityReview:c.messages.some(m=>!m.mailbox_id||!m.message_id),evidenceWillRequireRecheck:true});
 }
 return {tenantId,rows,uploadAllowed:false,reason:'Owner privacy review, backup and controlled import required; no automatic migration.'};
}
