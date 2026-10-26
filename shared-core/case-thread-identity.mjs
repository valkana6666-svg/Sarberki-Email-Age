// Conservative Gmail conversation identity check. Do not infer identity from
// subject, sender or quoted email text alone.
const norm = value => typeof value === 'string' ? value.trim() : '';
const messageId = value => norm(value).replace(/^<|>$/g, '').toLowerCase();
const refs = value => (Array.isArray(value) ? value : norm(value).split(/\s+/))
  .map(messageId).filter(Boolean);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const stringList = value => Array.isArray(value) && Array.from(value).every(item => typeof item === 'string');
export function sameBookingConversation(existing={}, incoming={}){
  // Validate collection shapes before any early thread match. A string must
  // never be spread into individual message-ID characters, or bad data thrown.
  if(!record(existing)||!record(incoming)||
    (existing.messageIds!=null&&!stringList(existing.messageIds))||
    (incoming.references!=null&&typeof incoming.references!=='string'&&!stringList(incoming.references)))
    return {matched:false,reason:'INVALID_IDENTITY_DATA'};
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

