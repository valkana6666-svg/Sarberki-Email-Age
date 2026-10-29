// Server-only migration proof: fixed synthetic data, no provider or persistence.
// The public chatbot is not routed here and real messages are never accepted.
import {createOperatorCookieSession,OperatorSessionError} from '../../shared-core/operator-cookie-session.mjs';
import {replayServerChat} from '../../shared-core/server-chat-conversation.mjs';
import {buildChatInquiryReply,buildEmailInquiryDraft} from '../../shared-core/inquiry-channel-adapters.mjs';
const origin='https://leafy-chimera-2403e5.netlify.app';
const messages=Object.freeze({hu:'2027-06-10 - 2027-06-12, 2 felnőtt, Deluxe faház.',de:'2027-06-10 - 2027-06-12, 2 Erwachsene, Deluxe Hütte.',en:'2027-06-10 - 2027-06-12, 2 adults, Deluxe cabin.',si:'2027-06-10 - 2027-06-12, 2 odrasla, Deluxe hiška.'});
export function createDecisionParityHandler({env=process.env,fetchImpl=fetch,sessionFactory=createOperatorCookieSession}={}){
 return async event=>{
  const reply=(statusCode,body,cookie)=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...(cookie?{'Set-Cookie':cookie}:{})},body:JSON.stringify(body)});
  if(env.DECISION_PARITY_FIXTURE_ENABLED!=='true'||env.URL!==origin)return reply(503,{error:'FIXTURE_DISABLED'});
  if(event.httpMethod!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'});
  if(event.isBase64Encoded||Buffer.byteLength(event.body||'')>128||Object.keys(event.queryStringParameters||{}).length)return reply(400,{error:'INVALID_INPUT'});
  let input;try{input=JSON.parse(event.body||'');}catch{return reply(400,{error:'INVALID_INPUT'});}
  if(!input||Array.isArray(input)||!['language','language,scenario','scenario,language','language,scenario,step'].includes(Object.keys(input).join(','))||!Object.hasOwn(messages,input.language)||(input.scenario!==undefined&&(!['multi-turn','chat-step'].includes(input.scenario)||input.language!=='hu')))return reply(400,{error:'INVALID_INPUT'});
  if(input.scenario==='chat-step'&&![1,2].includes(input.step)||input.scenario!=='chat-step'&&input.step!==undefined)return reply(400,{error:'INVALID_INPUT'});
  let session;try{
   if(event.headers?.origin!==origin)return reply(403,{error:'FORBIDDEN'});
   session=await sessionFactory({env,fetchImpl}).protectedRead(event);
  }catch(error){return reply(error instanceof OperatorSessionError?error.status:503,{error:error instanceof OperatorSessionError?error.code:'SESSION_UNAVAILABLE'});}
  try{
   if(input.scenario==='chat-step'){
    const turns=['Van szabad Deluxe faház 2027.06.10-12 között?','2 felnőtt, gyermek nélkül.'];
    const result=replayServerChat({messages:turns.slice(0,input.step),language:'hu'},{clock:()=>new Date('2026-10-29T12:00:00Z')});
    return reply(200,{fixture:'fixed-synthetic-chat',step:input.step,text:result.text,language:result.language},session.setCookie);
   }
   if(input.scenario==='multi-turn'){
    const clock=()=>new Date('2026-10-29T12:00:00Z');
    const first='Van szabad Deluxe faház 2027.06.10-12 között?';
    const second='2 felnőtt, gyermek nélkül.';
    const complete=replayServerChat({messages:[first,second],language:'hu'},{clock});
    const isolated=replayServerChat({messages:[second],language:'hu'},{clock});
    return reply(200,{fixture:'fixed-synthetic-multi-turn',language:'hu',contextRetained:complete.text!==isolated.text},session.setCookie);
   }
   const message=messages[input.language];
   const options={message,language:input.language,now:new Date('2026-10-29T12:00:00Z'),tenantId:'sarberki-test'};
   const chat=buildChatInquiryReply(options),email=buildEmailInquiryDraft(options);
   const same=JSON.stringify(chat.decision)===JSON.stringify(email.decision);
   // Summary only; do not expose the decision object, rules, or a guest draft.
   return reply(200,{fixture:'fixed-synthetic',language:input.language,decisionsMatch:same,
    capacityStatus:chat.decision.capacity.status,priceVerified:chat.decision.pricing.verified,
    requiresApproval:chat.requiresApproval&&email.requiresApproval},session.setCookie);
  }catch{return reply(503,{error:'FIXTURE_UNAVAILABLE'},session.setCookie);}
 };
}
export const handler=createDecisionParityHandler();
