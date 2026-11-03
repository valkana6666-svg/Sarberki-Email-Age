// Server-only (never published to the browser). Reads ONE test-mailbox message with the operator's
// transient Gmail token through the existing readonly reader, and builds the existing exact-receipt
// request shape from SERVER-read content. The token is neither stored nor returned. Not wired to any
// case write here: storing still requires the server-attested write path of the next work package.
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {readTestGmailInbox,gmailReadableBody,TEST_GMAIL_ACCOUNT} from '../gmail-policy.mjs';
import {isMarkedTestSubject} from '../gmail-subject.mjs';
import {automatedMailReason} from './automated-mail-filter.mjs';
import {enabledMailboxProfile,MAILBOX_PROFILES} from './server-mailbox-profiles.mjs';

// The only enabled profile; its values must match the existing test-account policy and attestation scope.
const PROFILE=enabledMailboxProfile('sarberki-test');
if(PROFILE.account!==TEST_GMAIL_ACCOUNT||PROFILE.sourceScope!=='test-mailbox-source-v1')throw Error('MAILBOX_PROFILE_MISMATCH');
export const TEST_MAILBOX_SOURCE_SCOPE=PROFILE.sourceScope;
const MAILBOX_ID=PROFILE.mailboxId,MAX_TEXT=20000;
const fail=code=>{const error=Error(code);error.code=code;throw error;};
const address=value=>{const match=/<([^<>\s]+)>\s*$/.exec(value||'');return (match?match[1]:String(value||'').trim()).toLowerCase();};
function plainTextPart(part){
 if(part?.mimeType==='text/plain'&&part.body?.data)return part;
 for(const child of part?.parts||[]){const found=plainTextPart(child);if(found)return found;}
 return null;
}
// Fixed codes only: the reader's messages are never forwarded, so no token or Gmail text can leak.
function readerFailure(error){
 const text=String(error?.message||'');
 if(/tesztfiók olvasható/.test(text))return 'WRONG_GMAIL_ACCOUNT';
 if(/\(429\)/.test(text))return 'GMAIL_RATE_LIMITED';
 if(/\((?:401|403)\)/.test(text))return 'GMAIL_AUTH_REQUIRED';
 return 'GMAIL_SOURCE_UNVERIFIED';
}

export async function readVerifiedTestMailboxMessage({token,messageId,fetchImpl=globalThis.fetch,setTimeoutImpl,clearTimeoutImpl}={}){
 if(typeof token!=='string'||!/^[A-Za-z0-9._~+/-]{20,4096}={0,2}$/.test(token))fail('GMAIL_AUTH_REQUIRED');
 if(typeof messageId!=='string'||!/^[a-f0-9]{12,32}$/.test(messageId))fail('INVALID_INPUT');
 let messages;
 try{
  messages=await readTestGmailInbox(token,{fetchImpl,search:'?'+new URLSearchParams({syntheticGmailMessageId:messageId}),
   ...(setTimeoutImpl?{setTimeoutImpl}:{}),...(clearTimeoutImpl?{clearTimeoutImpl}:{})});
 }catch(error){fail(readerFailure(error));}
 const message=messages?.[0];
 if(messages?.length!==1||message?.id!==messageId)fail('GMAIL_SOURCE_UNVERIFIED');
 const headers=Object.fromEntries((message.payload?.headers||[]).map(h=>[String(h.name).toLowerCase(),h.value]));
 if(!isMarkedTestSubject(headers.subject))fail('NOT_MARKED_TEST_MESSAGE');
 if(headers['in-reply-to']||headers.references)fail('REPLY_NOT_ALLOWED');
 if(automatedMailReason(headers,{ownAddresses:[PROFILE.account],blockOwnSender:PROFILE.blockOwnSender}))fail('AUTOMATED_MESSAGE');
 if(address(headers.to)!==TEST_GMAIL_ACCOUNT||String(headers.to).includes(','))fail('NOT_ADDRESSED_TO_TEST_MAILBOX');
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
 const source={provider:'gmail',mailbox_id:MAILBOX_ID,message_id:message.id,thread_id:message.threadId,rfc_message_id:rfcMessageId,
  in_reply_to:null,references:[],subject:headers.subject,from:headers.from,from_email:fromEmail,to:TEST_GMAIL_ACCOUNT,received_at:received};
 const envelope={sender:fromEmail,text,mailbox_id:MAILBOX_ID,message_id:message.id,thread_id:message.threadId,rfc_message_id:rfcMessageId,references:[],received_at:received};
 return Object.freeze({source:Object.freeze(source),envelope:Object.freeze(envelope),bodySha256:createHash('sha256').update(text,'utf8').digest('hex')});
}

// Domain-separated HMAC (own scope as first field) with the existing server attestation key, in the
// newline-joined form the database helper sc_isolated_approval_mac can recompute.
// The scope and tenant come from a known mailbox profile (default: TEST). Attesting performs no mailbox read;
// whether a profile may be used for reading or storing is decided by enabledMailboxProfile and the database.
const knownProfile=profile=>Object.values(MAILBOX_PROFILES).includes(profile)?profile:fail('MAILBOX_PROFILE_UNKNOWN');
function canonical({profile,tenantId,source,envelope,checkedAt,bodySha256}){
 if(tenantId!==profile.tenantId||source?.to!==profile.account||!source||!envelope||!Number.isFinite(Date.parse(checkedAt))||new Date(checkedAt).toISOString()!==checkedAt)fail('INVALID_EVIDENCE');
 if(['message_id','thread_id','rfc_message_id','received_at','mailbox_id'].some(k=>source[k]!==envelope[k])||envelope.sender!==source.from_email)fail('INVALID_EVIDENCE');
 const values=[profile.sourceScope,tenantId,source.mailbox_id,source.message_id,source.thread_id,source.rfc_message_id,
  source.from_email,source.to,source.subject,source.received_at,bodySha256,checkedAt];
 if(values.some(v=>typeof v!=='string'||!v||/[\r\n]/.test(v)))fail('INVALID_EVIDENCE');
 return values.join('\n');
}
const keyBytes=key=>{if(typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key))fail('SETUP_REQUIRED');return Buffer.from(key,'hex');};
const bodyHash=envelope=>createHash('sha256').update(String(envelope?.text??''),'utf8').digest('hex');

export function attestMailboxSource({profile=PROFILE,key,tenantId,source,envelope,checkedAt}){
 profile=knownProfile(profile);
 const secret=keyBytes(key),bodySha256=bodyHash(envelope);
 const attestation=createHmac('sha256',secret).update(canonical({profile,tenantId,source,envelope,checkedAt,bodySha256})).digest('hex');
 return {scope:profile.sourceScope,checkedAt,bodySha256,attestation};
}
export function attestTestMailboxSource(input){return attestMailboxSource({...input,profile:PROFILE});}

export function verifyMailboxAttestation({profile=PROFILE,key,tenantId,source,envelope,proof}){
 try{
  profile=knownProfile(profile);
  if(proof?.scope!==profile.sourceScope||!/^[a-f0-9]{64}$/.test(proof.attestation||''))return false;
  const expected=attestMailboxSource({profile,key,tenantId,source,envelope,checkedAt:proof.checkedAt});
  return expected.bodySha256===proof.bodySha256&&timingSafeEqual(Buffer.from(expected.attestation,'hex'),Buffer.from(proof.attestation,'hex'));
 }catch{return false;}
}
export function verifyTestMailboxAttestation(input){return verifyMailboxAttestation({...input,profile:PROFILE});}
