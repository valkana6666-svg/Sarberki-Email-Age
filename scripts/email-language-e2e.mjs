// Owner 2026-11-25 (#9 7162176483): the same 100 four-language conversations as e-mail threads (2–5 letters each),
// run through the SERVER's own e-mail chain in-process – extractServerMessage → booking case store (follow-up merge)
// → serverInquiryOptions → emailDraftWithCapacity (the shared engine). Gmail, the database and sending are not
// involved (no network): this proves channel parity of the engine, not live mail delivery.
// Usage: node scripts/email-language-e2e.mjs [out.json]
import {createBookingCaseStore} from '../booking-cases.mjs';
import {extractServerMessage} from '../shared-core/server-message-extraction.mjs';
import {serverInquiryOptions} from '../shared-core/server-inquiry-options.mjs';
import {emailDraftWithCapacity} from '../shared-core/server-capacity-draft.mjs';
import {scope} from '../shared-core/server-test-mailbox-case.mjs';
import {replyQuestions,languageFromText} from '../sarberki-core.mjs';
import {buildConversations,checkFacts} from './chat-language-e2e.mjs';
import {writeFileSync} from 'node:fs';

const TENANT='sarberki-test',SENDER='kitalalt.vendeg@example.test';
const SIGN={hu:'\n\nÜdvözlettel:\nTeszt Vendég',de:'\n\nMit freundlichen Grüßen\nTest Gast',en:'\n\nBest regards,\nTest Guest',si:'\n\nLep pozdrav,\nTestni Gost'};
// Letters: the guest writes several chat-sized thoughts in one e-mail; small talk ("ok", "thanks") is dropped.
export function lettersOf(conv){
 const keep=conv.turns.filter(t=>!/^(?:thanks|slang|switch-back)$/.test(t.tag||'')&&!(t.tag||'').startsWith('language-switch'));
 // A correction ("rather June 12-15", "actually 3 adults") opens a new letter: a guest who changes the stay writes again.
 const out=[];let cur=[];const size=[2,2,3,2,3];
 for(const t of keep){if(cur.length&&(cur.length>=size[out.length%size.length]||/^change-/.test(t.tag||''))){out.push(cur);cur=[];}cur.push(t);}
 if(cur.length)out.push(cur);
 return out.map(g=>g.map(t=>t.text).join('\n')+SIGN[conv.lang]);
}
const VALUE_TO_FACTS=v=>({dates:v.arrival&&v.departure?{arrival:v.arrival,departure:v.departure}:null,adults:v.adults?Number(v.adults):undefined,
 children:v.children!==undefined&&v.children!==''?Number(v.children):0,cabin:v.unit||undefined,
 ...(v.child_ages?{child_ages:String(v.child_ages).split(',').map(s=>Number(s.trim())).filter(Number.isFinite)}:{})});
const QUESTIONS=Object.fromEntries(['hu','de','en','si'].map(l=>[l,{dates:replyQuestions(l,{needDates:true})[0],adults:replyQuestions(l,{needAdults:true})[0],cabin:replyQuestions(l,{needCabin:true})[0],cabin2:replyQuestions(l,{needCabin:true,guests:2})[0]}]));
const HOUSE_NO=/\b(?:7|8|9|10)\/[ABC]\b|(?:ház|haus|house|hiška)\s*(?:#|nr\.?)\s*\d/iu;

export async function runEmail(convs){
 const results=[];
 for(const c of convs){
  const caseId='tm-'+Buffer.from(c.id).toString('hex').padEnd(16,'0').slice(0,16);let current=null,clockMs=Date.parse('2026-11-25T08:00:00Z');
  const letters=lettersOf(c),log=[],issues=[];
  for(const [n,text] of letters.entries()){
   clockMs+=3600000;const at=new Date(clockMs).toISOString(),clock=()=>at;
   const envelope={sender:SENDER,text,mailbox_id:'sarberkiprojecttest@gmail.com',message_id:`syn-${c.id}-${n}`,thread_id:`thr-${c.id}`,rfc_message_id:`<${c.id}-${n}@example.test>`,references:[],received_at:at};
   let saved;
   const store=createBookingCaseStore({storage:{getItem:()=>JSON.stringify(current?[current]:[]),setItem:(_,v)=>{saved=JSON.parse(v);}},tenantId:TENANT,clock,id:()=>caseId});
   const before=current?{...current.state.values}:{};
   store.ingest(scope(envelope),extractServerMessage(envelope,current?{previous:current.state?.values}:undefined),{approvedCaseId:current?caseId:null});
   const data=saved?.find(x=>x.id===caseId);
   if(!data){issues.push(`levél ${n+1}: nem került az ügybe`);break;}
   data.sender=SENDER;current=data;
   const plan=await emailDraftWithCapacity(serverInquiryOptions({tenantId:TENANT,caseId,data},new Date(at)),null,{clock:()=>clockMs});
   const lang=String(data.state.values.language||'hu').toLowerCase().replace(/^sl$/,'si'),draft=plan.text||'';
   log.push({letter:text,draft,lang,requiresApproval:plan.requiresApproval});
   if(plan.requiresApproval!==true)issues.push(`levél ${n+1}: jóváhagyás nélküli terv`);
   if(lang!==c.lang)issues.push(`levél ${n+1}: nyelv ${lang}, várt ${c.lang}`);
   const q=QUESTIONS[lang]||QUESTIONS.hu,changed=k=>JSON.stringify(before[k])!==JSON.stringify(data.state.values[k]);
   if(before.arrival&&draft.includes(q.dates)&&!changed('arrival'))issues.push(`levél ${n+1}: újrakérdezi a dátumot`);
   if(before.adults&&draft.includes(q.adults)&&!changed('adults'))issues.push(`levél ${n+1}: újrakérdezi a felnőttek számát`);
   if(before.unit&&(draft.includes(q.cabin)||draft.includes(q.cabin2))&&!changed('unit'))issues.push(`levél ${n+1}: újrakérdezi a háztípust`);
   if(HOUSE_NO.test(draft))issues.push(`levél ${n+1}: belső házszám`);
   if(/undefined|NaN|\[object/.test(draft))issues.push(`levél ${n+1}: hibás szövegdarab`);
  }
  const facts=current?VALUE_TO_FACTS(current.state.values):{};
  const want={...c.want};
  const factIssues=checkFacts(facts,want);
  results.push({id:c.id,lang:c.lang,letters:letters.length,factIssues,issues,ok:!factIssues.length&&!issues.length,log});
 }
 return results;
}

if(import.meta.url===`file://${process.argv[1]}`){
 const res=await runEmail(buildConversations());
 if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(res,null,1));
 for(const l of ['hu','de','en','si']){const x=res.filter(r=>r.lang===l);console.log(l.toUpperCase(),'levélváltás',x.length,'levél',x.reduce((s,r)=>s+r.letters,0),'PASS',x.filter(r=>r.ok).length,'FAIL',x.filter(r=>!r.ok).length);}
 for(const r of res.filter(r=>!r.ok))console.log('❌',r.id,[...r.factIssues,...r.issues].join(' | '));
}
