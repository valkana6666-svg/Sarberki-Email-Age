// Server-only (excluded from dist by the server- prefix). Sends the INTERNALLY APPROVED reply of one
// test-mailbox case as a Gmail reply in the original thread. Owner permission 2026-11-03 (AGENTS.md
// "TESZT-LEVÉLKÜLDÉSI ENGEDÉLY"): only sarberkiprojecttest@gmail.com -> sarberkito@gmail.com,
// fictional content only. The text comes from the stored case (never from the browser) and must be the
// exact draft the independent approver approved. The operator's transient Gmail token is used once and
// never stored or returned. Duplicate protection: the reply carries X-Sarberki-Reply: <case>:<hash>, and
// the thread is checked for it before sending. With a `ledger` (DB, deployment/test-mailbox/send-ledger.sql)
// the send is also claimed atomically first: one approved draft -> at most one Gmail send; a refused send
// (4xx) is released for a new attempt, an unknown outcome (timeout/5xx) is never retried automatically.
import {createHash} from 'node:crypto';
import {TEST_GMAIL_ACCOUNT} from '../gmail-policy.mjs';

export const ALLOWED_TEST_REPLY_RECIPIENTS=Object.freeze(['sarberkito@gmail.com']);
const GMAIL='https://gmail.googleapis.com/gmail/v1/users/me';
const fail=code=>{const error=Error(code);error.code=code;throw error;};
const sha=text=>createHash('sha256').update(String(text),'utf8').digest('hex');
const b64=text=>Buffer.from(text,'utf8').toString('base64');
const b64url=text=>Buffer.from(text,'utf8').toString('base64url');
// Gmail answered 4xx: the request was refused, nothing was sent (a ledger claim may be released).
const refused=code=>{const error=Error(code);error.code=code;error.notSent=true;throw error;};
const headerSafe=value=>typeof value==='string'&&value.length>0&&value.length<=2000&&!/[\r\n]/.test(value);

// Pure checks on the stored case: approved, approved hash == latest draft, fixed test pair, valid thread.
export function approvedTestMailboxReply(record){
 const data=record?.data,latest=data?.drafts?.at?.(-1),src=data?.sourceReceipt;
 if(data?.state?.approval!=='approved_internal'||data?.internalApproval?.scope!=='test-mailbox-v1')fail('NOT_APPROVED');
 if(typeof latest?.text!=='string'||!latest.text.trim()||data.internalApproval.draftHash!==sha(latest.text))fail('NOT_APPROVED');
 const recipient=String(src?.from_email||'').toLowerCase();
 if(!ALLOWED_TEST_REPLY_RECIPIENTS.includes(recipient)||src?.to!==TEST_GMAIL_ACCOUNT)fail('RECIPIENT_NOT_ALLOWED');
 if(!/^[A-Za-z0-9_-]{1,256}$/.test(String(src.thread_id||''))||!headerSafe(src.rfc_message_id)||!headerSafe(src.subject||'x'))fail('SOURCE_UNVERIFIED');
 const marker=record.caseId+':'+sha(latest.text);
 // Reply to the guest's latest message (a follow-up sets latestReceipt), same thread.
 const inReplyTo=headerSafe(data.latestReceipt?.rfc_message_id)?data.latestReceipt.rfc_message_id:src.rfc_message_id;
 return {recipient,text:latest.text,threadId:src.thread_id,inReplyTo,subject:String(src.subject||''),marker,draftHash:sha(latest.text)};
}

export function replyMime({recipient,text,subject,inReplyTo,marker}){
 const reSubject=/^re:/i.test(subject.trim())?subject.trim():'Re: '+subject.trim();
 return ['From: '+TEST_GMAIL_ACCOUNT,'To: '+recipient,'Subject: =?UTF-8?B?'+b64(reSubject)+'?=','In-Reply-To: '+inReplyTo,'References: '+inReplyTo,
  'X-Sarberki-Reply: '+marker,'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',
  b64(text.replace(/\r?\n/g,'\r\n')).replace(/.{76}/g,'$&\r\n')].join('\r\n');
}

export async function sendApprovedTestMailboxReply({record,token,fetchImpl=globalThis.fetch,timeoutMs=10000,ledger=null}={}){
 if(typeof token!=='string'||!/^[A-Za-z0-9._~+/-]{20,4096}={0,2}$/.test(token))fail('GMAIL_AUTH_REQUIRED');
 const reply=approvedTestMailboxReply(record);
 const call=async(path,options={})=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const response=await fetchImpl(GMAIL+path,{...options,headers:{Authorization:'Bearer '+token,...(options.body?{'Content-Type':'application/json'}:{})},cache:'no-store',redirect:'error',signal:controller.signal});
   if(response.status===401||response.status===403)refused('GMAIL_AUTH_REQUIRED');
   if(response.status===429)refused('GMAIL_RATE_LIMITED');
   if(response.status>=400&&response.status<500)refused('SEND_FAILED');
   if(!response.ok)fail('SEND_FAILED');
   return await response.json();
  }catch(error){if(error?.code)throw error;fail('SEND_FAILED');}finally{clearTimeout(timer);}
 };
 const profile=await call('/profile');
 if(String(profile?.emailAddress||'').toLowerCase()!==TEST_GMAIL_ACCOUNT)fail('WRONG_GMAIL_ACCOUNT');
 const thread=await call('/threads/'+encodeURIComponent(reply.threadId)+'?format=metadata&metadataHeaders=X-Sarberki-Reply');
 const already=(thread?.messages||[]).some(m=>(m?.payload?.headers||[]).some(h=>String(h?.name).toLowerCase()==='x-sarberki-reply'&&h.value===reply.marker));
 if(already)return {status:'already_sent'};
 let claimId=null;
 if(ledger){
  const claim=await ledger.claim({draftHash:reply.draftHash}).catch(error=>fail(error?.code==='FORBIDDEN'?'FORBIDDEN':'STORAGE_FAILURE'));
  if(!claim)fail('CASE_CONFLICT');
  if(claim.status==='sent')return {status:'already_sent'};
  if(claim.status!=='claimed'||typeof claim.claimId!=='string')fail('SEND_OUTCOME_UNKNOWN');
  claimId=claim.claimId;
 }
 let sent;
 try{
  sent=await call('/messages/send',{method:'POST',body:JSON.stringify({raw:b64url(replyMime(reply)),threadId:reply.threadId})});
  if(typeof sent?.id!=='string')fail('SEND_FAILED');
 }catch(error){
  // Best effort: a failed finish leaves the row in 'sending', which also blocks any automatic resend.
  if(claimId)await ledger.finish({claimId,status:error?.notSent?'failed':'outcome_unknown'}).catch(()=>{});
  throw error;
 }
 if(claimId)await ledger.finish({claimId,status:'sent',gmailMessageId:sent.id}).catch(()=>{});
 return {status:'sent'};
}
