// Private server configuration only. Never import into a browser module.
// This matches a user-device export; it does not attest server Google access.
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
const sourceKeys=['provider','mailbox_id','message_id','thread_id','rfc_message_id','in_reply_to','references','subject','to','from','from_email','received_at'];
const messageKeys=['sender','text','mailbox_id','message_id','thread_id','rfc_message_id','references','received_at'];
const keys=(value,expected)=>value&&typeof value==='object'&&!Array.isArray(value)&&isDeepStrictEqual(Object.keys(value).sort(),[...expected].sort());
export function createExactGmailReceipt(env){
 if(env.CASE_EXACT_RECEIPT_ENABLED!=='sarberki-test-one-receipt'||env.URL!=='https://leafy-chimera-2403e5.netlify.app'||env.SUPABASE_URL!=='https://mojnqizbcaczstguikpv.supabase.co')return null;
 try{
  const config=JSON.parse(env.CASE_EXACT_RECEIPT_PRIVATE_JSON||'null');
  if(!keys(config,['caseId','source','envelope','bodySha256'])||typeof config.caseId!=='string'||!/^[-a-zA-Z0-9_]{4,128}$/.test(config.caseId))return null;
  const {source:s,envelope:m}=config;
  if(!keys(s,sourceKeys)||!keys(m,messageKeys)||s.provider!=='gmail'||s.in_reply_to!==null||!isDeepStrictEqual(s.references,[])||!isDeepStrictEqual(m.references,[]))return null;
  if(sourceKeys.filter(k=>!['references','in_reply_to'].includes(k)).some(k=>typeof s[k]!=='string'||!s[k]||s[k].length>2000)||messageKeys.filter(k=>k!=='references').some(k=>typeof m[k]!=='string'||!m[k]||m[k].length>20000))return null;
  if(!/^[^@\s]+@[^@\s]+$/.test(s.from_email)||s.from_email!==s.from_email.toLowerCase()||!Number.isFinite(Date.parse(s.received_at))||!/^[-a-zA-Z0-9_]{1,128}$/.test(s.mailbox_id)||!/^[-a-zA-Z0-9_]{1,256}$/.test(s.message_id))return null;
  if(m.sender!==s.from_email||['mailbox_id','message_id','thread_id','rfc_message_id','received_at'].some(k=>m[k]!==s[k])||createHash('sha256').update(m.text,'utf8').digest('hex')!==config.bodySha256)return null;
  return Object.freeze({caseId:config.caseId,
   matches:(envelope,source)=>isDeepStrictEqual(envelope,m)&&isDeepStrictEqual(source,s),
   matchesRecord:record=>record?.tenantId==='sarberki-test'&&record.caseId===config.caseId&&record.data?.sender===m.sender&&isDeepStrictEqual(record.data?.messages,[m])&&isDeepStrictEqual(record.data?.sourceReceipt,s)});
 }catch{return null;}
}
