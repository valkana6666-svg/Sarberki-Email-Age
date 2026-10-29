// Server-only bounded conversation replay. Client messages are untrusted and
// cannot supply facts, evidence, tenant, authorization or provider results.
// Stateless replay avoids process-local sessions in a serverless environment.
import {createChatInquirySession} from '../sarberki-chatbot-project/chat-session.mjs';
const languages=new Set(['auto','hu','de','en','si']);
export function replayServerChat({messages,language='auto'}={}, {clock=()=>new Date()}={}){
 if(!Array.isArray(messages)||messages.length<1||messages.length>30||!languages.has(language)||
    messages.some(m=>typeof m!=='string'||m.length<1||m.length>1000)||
    messages.reduce((sum,m)=>sum+m.length,0)>12000)throw Error('INVALID_CHAT_INPUT');
 const current=clock();if(!(current instanceof Date)||!Number.isFinite(current.getTime()))throw Error('INVALID_CLOCK');
 const session=createChatInquirySession({language,clock:()=>new Date(current)});
 let result;
 for(const message of messages)result=session.reply(message);
 // Guest-facing output only. Internal decision, extracted facts, operator
 // review, and raw messages are never returned by this adapter.
 return Object.freeze({text:result.text,language:session.language});
}
