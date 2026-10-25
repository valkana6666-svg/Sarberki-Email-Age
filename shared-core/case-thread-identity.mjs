// Conservative Gmail conversation identity check. Do not infer identity from
// subject, sender or quoted email text alone.
const norm = value => typeof value === 'string' ? value.trim() : '';
const messageId = value => norm(value).replace(/^<|>$/g, '').toLowerCase();
const refs = value => (Array.isArray(value) ? value : norm(value).split(/\s+/))
  .map(messageId).filter(Boolean);
export function sameBookingConversation(existing={}, incoming={}){
  const previousSender=norm(existing.from_email||existing.sender).toLowerCase();
  const replySender=norm(incoming.from_email||incoming.sender).toLowerCase();
  if(!previousSender || !replySender) return {matched:false,reason:'SENDER_UNVERIFIED'};
  if(previousSender!==replySender) return {matched:false,reason:'SENDER_MISMATCH'};
  const a=norm(existing.threadId||existing.thread_id), b=norm(incoming.threadId||incoming.thread_id);
  if(a && b && a===b) return {matched:true,reason:'THREAD_ID'};
  if(a && b && a!==b) return {matched:false,reason:'THREAD_MISMATCH'};
  const known=new Set([existing.messageId,existing.rfc_message_id,...(existing.messageIds||[])].map(messageId).filter(Boolean));
  const related=[incoming.inReplyTo,incoming.in_reply_to,...refs(incoming.references)].map(messageId).filter(Boolean);
  if(known.size && related.some(id=>known.has(id))) return {matched:true,reason:'MESSAGE_REFERENCE'};
  return {matched:false,reason:'NOT_VERIFIED'};
}
