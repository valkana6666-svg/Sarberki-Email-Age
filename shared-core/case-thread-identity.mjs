// Conservative Gmail conversation identity check. Do not infer identity from
// subject, sender or quoted email text alone.
const norm = value => typeof value === 'string' ? value.trim() : '';
const messageId = value => norm(value).replace(/^<|>$/g, '').toLowerCase();
const refs = value => (Array.isArray(value) ? value : norm(value).split(/\s+/))
  .map(messageId).filter(Boolean);
export function sameBookingConversation(existing={}, incoming={}){
  const a=norm(existing.threadId), b=norm(incoming.threadId);
  if(a && b && a===b) return {matched:true,reason:'THREAD_ID'};
  if(a && b && a!==b) return {matched:false,reason:'THREAD_MISMATCH'};
  const known=new Set([existing.messageId,...(existing.messageIds||[])].map(messageId).filter(Boolean));
  const related=[incoming.inReplyTo,...refs(incoming.references)].map(messageId).filter(Boolean);
  if(known.size && related.some(id=>known.has(id))) return {matched:true,reason:'MESSAGE_REFERENCE'};
  return {matched:false,reason:'NOT_VERIFIED'};
}
