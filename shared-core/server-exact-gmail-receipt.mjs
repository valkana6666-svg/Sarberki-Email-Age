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
   diagnose:(envelope,source)=>{
    const envelopeFields=messageKeys.filter(k=>!isDeepStrictEqual(envelope?.[k],m[k]));
    const sourceFields=sourceKeys.filter(k=>!isDeepStrictEqual(source?.[k],s[k]));
    return envelopeFields.length?{category:'ENVELOPE_MISMATCH',fields:envelopeFields}:
     sourceFields.length?{category:'SOURCE_RECEIPT_MISMATCH',fields:sourceFields}:{category:'MATCH',fields:[]};
   },
   matchesRecord:record=>record?.tenantId==='sarberki-test'&&record.caseId===config.caseId&&record.data?.sender===m.sender&&isDeepStrictEqual(record.data?.messages,[m])&&isDeepStrictEqual(record.data?.sourceReceipt,s)});
 }catch{return null;}
}

// Call only AFTER fresh cookie Auth, same-origin/CSRF and Writer checks.
// Output is a fixed vocabulary: never values, hashes, private config or caller keys.
export function diagnoseExactGmailReceiptRequest(env,input){
 const receipt=createExactGmailReceipt(env);
 if(!receipt)return {category:'CONFIG_INVALID',fields:[]};
 if(!keys(input,['tenantId','action','expectedRevision','envelope','sourceReceipt']))return {category:'REQUEST_SHAPE_INVALID',fields:['request']};
 const invalid=[];
 if(input.tenantId!=='sarberki-test')invalid.push('tenantId');
 if(!['ingest-and-draft','diagnose-exact-receipt'].includes(input.action))invalid.push('action');
 if(input.expectedRevision!==0)invalid.push('expectedRevision');
 if(!keys(input.envelope,messageKeys))invalid.push('envelope');
 if(!keys(input.sourceReceipt,sourceKeys))invalid.push('sourceReceipt');
 if(invalid.length)return {category:'REQUEST_SHAPE_INVALID',fields:invalid};
 return receipt.diagnose(input.envelope,input.sourceReceipt);
}

// Existing user transport + sc_audit RLS only. The PostgreSQL text cast avoids
// inventing a JavaScript imitation of the DB's jsonb::text audit hash format.
export async function readExactReceiptAudit({record,exactReceipt,transport}){
 if(!exactReceipt?.matchesRecord(record)||record.data.state?.approval!=='pending'||record.data.serverApproval)return null;
 try{
  const scope={tenant_id:'eq.sarberki-test',case_id:'eq.'+record.caseId,revision:'eq.'+record.revision,limit:'2'};
  const snapshots=await transport('/rest/v1/sc_cases?'+new URLSearchParams({...scope,select:'tenant_id,case_id,revision,updated_by,data::text'}));
  if(!Array.isArray(snapshots)||snapshots.length!==1)return null;
  const snapshot=snapshots[0];
  if(snapshot.tenant_id!==record.tenantId||snapshot.case_id!==record.caseId||snapshot.revision!==record.revision||snapshot.updated_by!==record.updatedBy||typeof snapshot.data!=='string'||!isDeepStrictEqual(JSON.parse(snapshot.data),record.data))return null;
  const rows=await transport('/rest/v1/sc_audit?'+new URLSearchParams({...scope,select:'tenant_id,case_id,revision,actor,kind,data_hash'}));
  if(!Array.isArray(rows)||rows.length!==1)return null;
  const row=rows[0],kind=record.revision===1?'insert':'update';
  if(row.tenant_id!==record.tenantId||row.case_id!==record.caseId||row.revision!==record.revision||row.actor!==record.updatedBy||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(row.actor||'')||row.kind!==kind||
    !/^[a-f0-9]{64}$/.test(row.data_hash||'')||createHash('sha256').update(snapshot.data,'utf8').digest('hex')!==row.data_hash)return null;
  return {verified:true,scope:'stored-case-write',tenantId:record.tenantId,caseId:record.caseId,revision:record.revision,actor:row.actor,kind,dataHash:row.data_hash};
 }catch{return null;}
}
