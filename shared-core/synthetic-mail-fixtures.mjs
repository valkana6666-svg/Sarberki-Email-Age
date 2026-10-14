// Closed fictional registry only. This is neither an arbitrary .invalid sender
// allowlist nor evidence of real inventory/prices. No credentials are embedded.
const texts={
 hu:'Jó napot! Deluxe faházat szeretnénk foglalni 2026-10-23 és 2026-10-25 között 2 felnőtt, 0 gyermek számára. Telefon: +36 00 000 0000.',
 de:'Guten Tag! Deluxe Ferienhaus 2026-10-23 bis 2026-10-25, 2 Erwachsene, 0 Kinder. Telefon: +36 00 000 0000.',
 si:'Pozdravljeni! Deluxe hiška 2026-10-23 do 2026-10-25, 2 odrasli, 0 otroci. Telefon: +36 00 000 0000.',
 en:'Hello! One Deluxe cabin from 2026-10-23 to 2026-10-25 for 2 adults and 0 children. Phone: +36 00 000 0000.'
};
export const syntheticMailLanguages=Object.freeze(Object.keys(texts));
export function syntheticMailEnvelope(language){
 if(!Object.hasOwn(texts,language))throw Error('INVALID_INPUT');
 return {sender:language+'@closed-mail-fixture.invalid',text:texts[language],
  mailbox_id:'sarberki_closed_mail_fixture',message_id:'sarberki-closed-mail-'+language+'-20261014-v1',
  thread_id:'sarberki-closed-thread-'+language+'-v1',received_at:'2026-10-14T06:00:00.000Z'};
}
export function closedSyntheticMailLanguage(envelope){
 if(!envelope||Array.isArray(envelope)||typeof envelope!=='object')return null;
 for(const language of syntheticMailLanguages){
  const expected=syntheticMailEnvelope(language),keys=Object.keys(expected);
  if(Object.keys(envelope).length===keys.length&&keys.every(key=>envelope[key]===expected[key]))return language;
 }return null;
}
export function matchesClosedSyntheticMailRecord(record){
 if(record?.tenantId!=='sarberki-test'||record.data?.tenantId!=='sarberki-test'||record.data.messages?.length!==1)return false;
 return syntheticMailLanguages.some(language=>{
  const expected=syntheticMailEnvelope(language);
  return record.data.sender===expected.sender&&Object.keys(expected).every(key=>record.data.messages[0][key]===expected[key]);
 });
}
export function syntheticMailMime(language){
 const envelope=syntheticMailEnvelope(language);
 // Browser UTF-8 base64url, also works in the offline Node/VM test harness.
 const bytes=new TextEncoder().encode(envelope.text);
 const binary=Array.from(bytes,value=>String.fromCharCode(value)).join('');
 return {id:envelope.message_id,threadId:envelope.thread_id,
  internalDate:String(Date.parse(envelope.received_at)),labelIds:['INBOX'],payload:{mimeType:'text/plain',
   headers:[{name:'From',value:'Synthetic '+language.toUpperCase()+' <'+envelope.sender+'>'},
    {name:'To',value:'test-inbox@synthetic.invalid'},{name:'Subject',value:'TESZT SÁRBERKI CLOSED '+language.toUpperCase()}],
   body:{data:btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}}};
}
export function closedMailRequestFromGmailRecord(record){
 if(record?.source?.provider!=='gmail')throw Error('INVALID_INPUT');
 const envelope={sender:record.source.from_email,text:record.original_message,
  mailbox_id:'sarberki_closed_mail_fixture',message_id:record.source.message_id,
  thread_id:record.source.thread_id,received_at:record.source.received_at};
 const language=closedSyntheticMailLanguage(envelope);
 if(!language||record.source.subject!=='TESZT SÁRBERKI CLOSED '+language.toUpperCase())throw Error('FORBIDDEN');
 return {tenantId:'sarberki-test',action:'ingest-and-draft',envelope,expectedRevision:0};
}

export function isClosedSyntheticMailUiRecord(record,currentMessage){
 try{return closedMailRequestFromGmailRecord(record).envelope.text===currentMessage;}catch{return false;}
}
