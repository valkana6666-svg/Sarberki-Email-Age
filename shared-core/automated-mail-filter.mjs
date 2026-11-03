// Shared, pure check used by the server re-read (authoritative) and the daily operator preview.
// Automated mail (booking-system confirmations, auto-replies, newsletters, bounces, our own sent
// copies) must never become a guest case. Header names are lower-case; values are raw strings.
// Returns a fixed reason code, or null for a mail that may be a human inquiry.
const SYSTEM_LOCAL=/^(?:no-?reply|do-?not-?reply|donotreply|mailer-daemon|postmaster|bounces?|notifications?|automated)(?:[+._-].*)?$/i;
// Previo sends in the business's name (SPF include:_spf.previo.cz), so its mail may carry the
// business's own From address; the own-sender rule below covers that case on the live mailbox.
const BOOKING_SYSTEM_DOMAINS=['previo.cz','previo.app','previo.hu','previo.sk','previo.eu'];
const addressOf=value=>{
 const text=String(value??'').trim();
 const match=/<([^<>\s]+)>\s*$/.exec(text);
 return (match?match[1]:text).toLowerCase();
};
const domainOf=email=>email.includes('@')?email.slice(email.lastIndexOf('@')+1):'';
const isDomainOrSub=(domain,list)=>list.some(d=>domain===d||domain.endsWith('.'+d));

export function automatedMailReason(headers,{ownAddresses=[],blockOwnSender=false}={}){
 const h=headers&&typeof headers==='object'?headers:{};
 const get=name=>typeof h[name]==='string'?h[name].trim():'';
 const auto=get('auto-submitted').toLowerCase();
 if(auto&&auto!=='no')return 'AUTO_SUBMITTED';
 if(/^(?:bulk|list|junk|auto_reply)$/i.test(get('precedence')))return 'BULK_OR_LIST';
 if(get('list-id')||get('list-unsubscribe'))return 'BULK_OR_LIST';
 if(get('x-autoreply')||get('x-autorespond')||/^(?:all|oof|autoreply)$/i.test(get('x-auto-response-suppress')))return 'AUTO_REPLY';
 const from=addressOf(h.from),fromLocal=from.includes('@')?from.slice(0,from.indexOf('@')):from;
 if(SYSTEM_LOCAL.test(fromLocal))return 'SYSTEM_SENDER';
 for(const value of [h.from,h.sender,h['reply-to'],h['return-path']]){
  if(isDomainOrSub(domainOf(addressOf(value)),BOOKING_SYSTEM_DOMAINS))return 'BOOKING_SYSTEM_SENDER';
 }
 if(blockOwnSender&&ownAddresses.map(a=>String(a).toLowerCase()).includes(from))return 'OWN_MAILBOX_SENDER';
 return null;
}
