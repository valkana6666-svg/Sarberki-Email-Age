// Owner 2026-11-27 („Nagyon fontos, hogy napi kezelőben a teljes beszélgetés szövege megjelenjen”): the whole phone
// conversation – the assistant's and the caller's sentences – goes to the case, at the booking and after it.
// Source: the ElevenLabs dynamic variable system__conversation_history, passed by the agent with each tool call
// (verified on the owner's call 11-27 14:54: {"x-elevenlabs-history":true,"entries":[{role,message}|{role,tool_requests}|…]}).
// Only the spoken sentences are kept – tool calls and their results (and the caller number in them) are dropped.
import {createHash,createHmac} from 'node:crypto';

export const TRANSCRIPT_SCOPE='intake-transcript-v1';
const MAX_LINES=300,MAX_LINE=1500,MAX_TOTAL=60000;
const fail=code=>{const e=Error(code);e.code=code;throw e;};

export function callTranscript(history){
 let h=history;
 if(typeof h==='string'){if(!h.trim()||h.length>2000000)return [];try{h=JSON.parse(h);}catch{return [];}}
 const entries=Array.isArray(h)?h:Array.isArray(h?.entries)?h.entries:[];
 const lines=[];let total=0;
 for(const e of entries){
  if(!e||typeof e.message!=='string')continue;
  const role=e.role==='agent'?'agent':e.role==='user'?'caller':null;
  const text=e.message.replace(/\s+/g,' ').trim();
  if(!role||!text||text==='""')continue;
  const t=text.length>MAX_LINE?text.slice(0,MAX_LINE-1)+'…':text;
  if(lines.length>=MAX_LINES||total+t.length>MAX_TOTAL)break;
  lines.push({role,text:t});total+=t.length;
 }
 return lines;
}
export function validTranscript(lines){
 return Array.isArray(lines)&&lines.length>0&&lines.length<=MAX_LINES&&lines.every(l=>l&&['agent','caller'].includes(l.role)&&typeof l.text==='string'&&l.text.length>0&&l.text.length<=MAX_LINE);
}
export function transcriptText(lines){return (lines||[]).map(l=>(l.role==='agent'?'Asszisztens: ':'Hívó: ')+l.text).join('\n');}

export function attestTranscript({key,tenantId,caseId,text,checkedAt}){
 if(typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key))fail('SETUP_REQUIRED');
 const textSha256=createHash('sha256').update(text,'utf8').digest('hex');
 const fields=[TRANSCRIPT_SCOPE,tenantId,caseId,textSha256,checkedAt];
 if(fields.some(x=>typeof x!=='string'||!x||/[\r\n]/.test(x)))fail('INVALID_EVIDENCE');
 return {scope:TRANSCRIPT_SCOPE,checkedAt,textSha256,attestation:createHmac('sha256',Buffer.from(key,'hex')).update(fields.join('\n')).digest('hex')};
}
// After the booking: replace the case's transcript with the longer one (the database keeps only a longer, phone case).
export async function saveTranscript({transport,tenantId,caseId,lines,attestationKey,clock=()=>new Date().toISOString()}){
 if(typeof transport!=='function'||!/^tm-[a-f0-9]{24}$/.test(caseId||'')||!validTranscript(lines))fail('INVALID_INPUT');
 const at=clock(),text=JSON.stringify({updatedAt:at,lines});
 const proof=attestTranscript({key:attestationKey,tenantId,caseId,text,checkedAt:at});
 return transport('/rest/v1/rpc/sc_intake_phone_transcript',{method:'POST',body:{p_tenant:tenantId,p_case:caseId,p_text:text,p_proof:proof}});
}
