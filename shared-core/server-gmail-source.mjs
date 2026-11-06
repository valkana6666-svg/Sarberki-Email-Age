// Server-only (never published to the browser). Reads ONE test-mailbox message with the operator's
// transient Gmail token through the existing readonly reader, and builds the existing exact-receipt
// request shape from SERVER-read content. The token is neither stored nor returned. Not wired to any
// case write here: storing still requires the server-attested write path of the next work package.
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {readTestGmailInbox,gmailReadableBody,TEST_GMAIL_ACCOUNT,isTestPairInquiry,senderAddress,TEST_GUEST_SENDER} from '../gmail-policy.mjs';
import {automatedMailReason} from './automated-mail-filter.mjs';
import {enabledMailboxProfile} from './server-mailbox-profiles.mjs';
import {TEST_DEPLOYMENT} from './server-deployment.mjs';

// The only enabled profile; its values must match the existing test-account policy and attestation scope.
const PROFILE=enabledMailboxProfile('sarberki-test');
if(PROFILE.account!==TEST_GMAIL_ACCOUNT||PROFILE.sourceScope!=='test-mailbox-source-v1')throw Error('MAILBOX_PROFILE_MISMATCH');
export const TEST_MAILBOX_SOURCE_SCOPE=PROFILE.sourceScope;
const MAILBOX_ID=PROFILE.mailboxId,MAX_TEXT=20000;
const fail=code=>{const error=Error(code);error.code=code;throw error;};
// Owner test 2026-11-06: a mail WITHOUT subject must be saveable. Attestation and database need a non-empty
// field, so a missing/blank subject is stored as this fixed marker (the reply then uses a bare "Re:").
export const NO_SUBJECT='(nincs tárgy)';
const subjectOf=headers=>{const s=typeof headers.subject==='string'?headers.subject.replace(/[\r\n]+/g,' ').trim():'';return s||NO_SUBJECT;};
const address=value=>{const match=/<([^<>\s]+)>\s*$/.exec(value||'');return (match?match[1]:String(value||'').trim()).toLowerCase();};
function plainTextPart(part){
 if(part?.mimeType==='text/plain'&&part.body?.data)return part;
 for(const child of part?.parts||[]){const found=plainTextPart(child);if(found)return found;}
 return null;
}
// Fixed codes only: the reader's messages are never forwarded, so no token or Gmail text can leak.
function readerFailure(error){
 const text=String(error?.message||'');
 if(/(?:tesztfiók|postafiók) olvasható/.test(text))return 'WRONG_GMAIL_ACCOUNT';
 if(/\(429\)/.test(text))return 'GMAIL_RATE_LIMITED';
 if(/\((?:401|403)\)/.test(text))return 'GMAIL_AUTH_REQUIRED';
 return 'GMAIL_SOURCE_UNVERIFIED';
}

// followup:true (owner decision 2026-11-06): a guest's reply in an existing case thread is read for appending to
// that case; the database then requires the same thread and the same guest. Same mailbox/sender/automated gates.
export async function readVerifiedTestMailboxMessage({token,messageId,fetchImpl=globalThis.fetch,setTimeoutImpl,clearTimeoutImpl,deployment=TEST_DEPLOYMENT,followup=false}={}){
 // TEST: the fictional test mailbox and the test-pair sender gate (unchanged). LIVE (reachable only when the
 // live mailbox profile is enabled, i.e. after the data controller's consent): the deployment's mailbox, any
 // real sender, automated/own mail refused, and only NEW inquiries become cases – a guest's reply or a forward
 // stays in Gmail for the operator (REPLY_HANDLED_IN_GMAIL) until a reviewed follow-up path exists.
 const live=deployment!==TEST_DEPLOYMENT;
 if(live&&(deployment?.environment!=='live'||deployment.mailbox?.enabled!==true||deployment.mailbox?.account!=='info@sarberkito.hu'))fail('LIVE_MAILBOX_READER_PENDING');
 const account=live?deployment.mailbox.account:TEST_GMAIL_ACCOUNT,mailboxId=live?deployment.mailbox.mailboxId:MAILBOX_ID;
 if(typeof token!=='string'||!/^[A-Za-z0-9._~+/-]{20,4096}={0,2}$/.test(token))fail('GMAIL_AUTH_REQUIRED');
 if(typeof messageId!=='string'||!/^[a-f0-9]{12,32}$/.test(messageId))fail('INVALID_INPUT');
 let messages;
 try{
  messages=await readTestGmailInbox(token,{fetchImpl,account,search:'?'+new URLSearchParams({syntheticGmailMessageId:messageId}),
   ...(setTimeoutImpl?{setTimeoutImpl}:{}),...(clearTimeoutImpl?{clearTimeoutImpl}:{})});
 }catch(error){fail(readerFailure(error));}
 const message=messages?.[0];
 if(messages?.length!==1||message?.id!==messageId)fail('GMAIL_SOURCE_UNVERIFIED');
 const headers=Object.fromEntries((message.payload?.headers||[]).map(h=>[String(h.name).toLowerCase(),h.value]));
 // A follow-up is a real Gmail reply (In-Reply-To/References), never a forward. A new inquiry has neither
 // reply headers nor a reply/forward subject prefix.
 const replyHeaders=Boolean(headers['in-reply-to']||headers.references),subject=String(headers.subject??'');
 const isForward=/^\s*(?:fwd?|fw|wg|tr)\s*:/iu.test(subject);
 if(followup&&(!replyHeaders||isForward))fail('NOT_A_FOLLOWUP');
 if(live){
  if(!followup&&(replyHeaders||/^\s*(?:re|aw|sv|odg|fwd?|fw|wg|tr|vs)\s*:/iu.test(subject)))fail('REPLY_HANDLED_IN_GMAIL');
  if(automatedMailReason(headers,{ownAddresses:[account],blockOwnSender:true}))fail('AUTOMATED_MESSAGE');
  // The mailbox must be a direct recipient (To or Cc); BCC/list copies are not inquiries to us.
  const direct=[headers.to,headers.cc].flatMap(v=>String(v||'').split(',')).map(address);
  if(!direct.includes(account))fail('NOT_ADDRESSED_TO_TEST_MAILBOX');
 }else if(followup){
  if(senderAddress(headers.from)!==TEST_GUEST_SENDER)fail('NOT_TEST_PAIR_INQUIRY');
  if(automatedMailReason(headers,{ownAddresses:[PROFILE.account],blockOwnSender:PROFILE.blockOwnSender}))fail('AUTOMATED_MESSAGE');
  if(address(headers.to)!==TEST_GMAIL_ACCOUNT||String(headers.to).includes(','))fail('NOT_ADDRESSED_TO_TEST_MAILBOX');
 }else{
  if(headers['in-reply-to']||headers.references)fail('REPLY_NOT_ALLOWED');
  if(!isTestPairInquiry(headers))fail('NOT_TEST_PAIR_INQUIRY');
  if(automatedMailReason(headers,{ownAddresses:[PROFILE.account],blockOwnSender:PROFILE.blockOwnSender}))fail('AUTOMATED_MESSAGE');
  if(address(headers.to)!==TEST_GMAIL_ACCOUNT||String(headers.to).includes(','))fail('NOT_ADDRESSED_TO_TEST_MAILBOX');
 }
 const fromEmail=address(headers.from);
 if(!/^[^@\s<>,]+@[^@\s<>,]+\.[^@\s<>,]+$/.test(fromEmail))fail('INVALID_SENDER');
 const rfcMessageId=headers['message-id'];
 if(typeof rfcMessageId!=='string'||!rfcMessageId||rfcMessageId.length>2000)fail('MESSAGE_ID_REQUIRED');
 if(typeof message.threadId!=='string'||!/^[A-Za-z0-9_-]{1,256}$/.test(message.threadId))fail('GMAIL_SOURCE_UNVERIFIED');
 // HTML-only mail needs a browser parser; the server accepts only an explicit text/plain part.
 if(!plainTextPart(message.payload))fail('TEXT_PART_REQUIRED');
 let text;try{text=gmailReadableBody(message.payload);}catch{fail('UNREADABLE_TEXT');}
 if(typeof text!=='string'||!text.trim())fail('EMPTY_TEXT');
 if(text.length>MAX_TEXT)fail('TEXT_TOO_LONG');
 const received=new Date(Number(message.internalDate)).toISOString();
 const refs=followup?String(headers.references||'').match(/<[^<>\s]+>/g)||[]:[];
 const source={provider:'gmail',mailbox_id:mailboxId,message_id:message.id,thread_id:message.threadId,rfc_message_id:rfcMessageId,
  in_reply_to:followup?(String(headers['in-reply-to']||'').match(/<[^<>\s]+>/)?.[0]??null):null,references:refs,subject:subjectOf(headers),from:headers.from,from_email:fromEmail,to:account,received_at:received};
 const envelope={sender:fromEmail,text,mailbox_id:mailboxId,message_id:message.id,thread_id:message.threadId,rfc_message_id:rfcMessageId,references:[],received_at:received};
 return Object.freeze({source:Object.freeze(source),envelope:Object.freeze(envelope),bodySha256:createHash('sha256').update(text,'utf8').digest('hex')});
}

// Domain-separated HMAC (own scope as first field) with the existing server attestation key, in the
// newline-joined form the database helper sc_isolated_approval_mac can recompute.
// The attested tenant is the deployment's single tenant (TEST: sarberki-test; LIVE: sarberki-live), the same
// field list the database recomputes in sc_tm_create.
function canonical({tenantId,source,envelope,checkedAt,bodySha256,deployment=TEST_DEPLOYMENT}){
 if(tenantId!==deployment?.tenantId||!source||!envelope||!Number.isFinite(Date.parse(checkedAt))||new Date(checkedAt).toISOString()!==checkedAt)fail('INVALID_EVIDENCE');
 if(['message_id','thread_id','rfc_message_id','received_at','mailbox_id'].some(k=>source[k]!==envelope[k])||envelope.sender!==source.from_email)fail('INVALID_EVIDENCE');
 const values=[TEST_MAILBOX_SOURCE_SCOPE,tenantId,source.mailbox_id,source.message_id,source.thread_id,source.rfc_message_id,
  source.from_email,source.to,source.subject,source.received_at,bodySha256,checkedAt];
 if(values.some(v=>typeof v!=='string'||!v||/[\r\n]/.test(v)))fail('INVALID_EVIDENCE');
 return values.join('\n');
}
const keyBytes=key=>{if(typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key))fail('SETUP_REQUIRED');return Buffer.from(key,'hex');};
const bodyHash=envelope=>createHash('sha256').update(String(envelope?.text??''),'utf8').digest('hex');

export function attestTestMailboxSource({key,tenantId,source,envelope,checkedAt,deployment=TEST_DEPLOYMENT}){
 const secret=keyBytes(key),bodySha256=bodyHash(envelope);
 const attestation=createHmac('sha256',secret).update(canonical({tenantId,source,envelope,checkedAt,bodySha256,deployment})).digest('hex');
 return {scope:TEST_MAILBOX_SOURCE_SCOPE,checkedAt,bodySha256,attestation};
}

export function verifyTestMailboxAttestation({key,tenantId,source,envelope,proof,deployment=TEST_DEPLOYMENT}){
 try{
  if(proof?.scope!==TEST_MAILBOX_SOURCE_SCOPE||!/^[a-f0-9]{64}$/.test(proof.attestation||''))return false;
  const expected=attestTestMailboxSource({key,tenantId,source,envelope,checkedAt:proof.checkedAt,deployment});
  return expected.bodySha256===proof.bodySha256&&timingSafeEqual(Buffer.from(expected.attestation,'hex'),Buffer.from(proof.attestation,'hex'));
 }catch{return false;}
}
