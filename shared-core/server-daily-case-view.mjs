// Presentation of persisted state only. No availability or business decisions.
export function dailyCaseCategory(record){
 const data=record?.data,state=data?.state,draft=data?.drafts?.at(-1);
 // Internal approval is not closure, sending, or a confirmed booking.
 if(state?.approval==='internally_approved')return 'progress';
 if(state?.approval!=='pending')return 'progress';
 if(!draft)return 'incoming';
 return draft.revision===state.revision&&draft.basedOnMessageCount===data.messages?.length&&
  draft.synthetic===true&&draft.reviewStatus==='internal_review_required'?'approval':'progress';
}
export function dailyCaseSummary(record){
 return {tenantId:record.tenantId,caseId:record.caseId,revision:record.revision,category:dailyCaseCategory(record)};
}
