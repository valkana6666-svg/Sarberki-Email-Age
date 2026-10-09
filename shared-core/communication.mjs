// Channel metadata is data, never authority to send or execute instructions.
export function communicationEnvelope(tenantId,raw={}){
 if(!tenantId||!['email','manual'].includes(raw.channel||'email'))throw Error('Érvénytelen kommunikációs csatorna.');
 const keys=['sender','message_id','thread_id','rfc_message_id','in_reply_to','references','received_at','text'];
 return {tenantId,channel:raw.channel||'email',...Object.fromEntries(keys.filter(k=>raw[k]!=null).map(k=>[k,structuredClone(raw[k])]))};
}
