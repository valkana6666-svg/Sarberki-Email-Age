import fs from 'node:fs';
import vm from 'node:vm';
import * as core from '../sarberki-core.mjs';
import { BUSINESS } from '../business-config.mjs';
import { fishingQuestion } from '../fishing-rules.mjs';
import { normalizeBookingInput } from '../booking-input.mjs';
import { NOW } from './email-stress-cases.mjs';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const gmail=fs.readFileSync(new URL('../gmail-readonly.js',import.meta.url),'utf8');
function gmailRecord(c){
 const context=vm.createContext({...core,BUSINESS,fishingQuestion,atob,TextDecoder,Uint8Array,Date,Intl,Number,console});
 vm.runInContext(gmail.slice(gmail.indexOf('  function headerMap('),gmail.indexOf('  const SCOPE')),context);
 vm.runInContext(gmail.slice(gmail.indexOf('  function decoded('),gmail.indexOf('  async function readWithToken(')),context);
 context.message={id:'stress-'+c.id,threadId:'stress',internalDate:String(NOW.getTime()),payload:{mimeType:'text/plain',body:{data:Buffer.from(c.text).toString('base64url')},headers:[{name:'Subject',value:c.reply.subject||''},{name:'From',value:'Test <test@example.invalid>'}]}};
 return JSON.parse(JSON.stringify(vm.runInContext('transform(message)',context)));
}
export function evaluate(c){
 const gmailResult=gmailRecord(c);
 const text=core.activeMessageText?core.activeMessageText(c.text):c.text;
 const b=normalizeBookingInput({channel:'email',text:c.text,now:NOW}).booking;
 const flags=core.requestFlagsFromText?.(text)||{hotTubRequested:gmailResult.normalized.hot_tub_requested,petRequested:gmailResult.normalized.pet_requested};
 const actual={arrival:b.arrival,departure:b.departure,nights:b.arrival&&b.departure?(Date.parse(b.departure)-Date.parse(b.arrival))/86400000:null,adults:b.adults,children:b.children,childAges:[...b.childAges],guests:b.guests,cabin:b.cabin,unitsRequested:core.requestedUnitsFromText(text).count||null,hotTubRequested:flags.hotTubRequested,petRequested:flags.petRequested,fishingQuestion:Boolean(fishingQuestion(text)),parking:/parkol|parking|parkpl(?:atz|ätze)|parkiri/iu.test(text),phone:b.phone,specialRequests:core.specialRequestsFromText(text)};
 const fishing=fishingQuestion(text,core.languageFromText(text));
 const draft=core.buildReplyDraft({language:core.languageFromText(text),original:text,...b,bookingRules:BUSINESS.bookingRules,operationalRules:BUSINESS.operationalRules,pricingRules:BUSINESS.pricingRules,hotTub:flags.hotTubRequested,dog:flags.petRequested,knowledgeLines:fishing?[fishing.answer]:[]});
 const context=vm.createContext({window:{addEventListener(){},SarberkiNormalize:core,SarberkiConfig:BUSINESS,SarberkiFishingQuestion:fishingQuestion},document:{getElementById:()=>({value:'',textContent:''})},console,Date,Intl,Number,JSON});
 vm.runInContext(html.slice(html.indexOf('const $='),html.indexOf('function addEvent(')),context);
 vm.runInContext(html.slice(html.indexOf('function draft('),html.indexOf('function review(')),context);
 context.message=c.text;
 const ui=vm.runInContext("extract(message,'test@example.invalid')",context);
 const v=Object.fromEntries(Object.entries(ui.fields).map(([k,f])=>[k,f.value]));
 context.values=v;context.analysis=ui;
 // Preserve original in the same record shape used by the browser.
 vm.runInContext('record={original:message}',context);
 const uiDraft=vm.runInContext('draft(values,analysis.intent,analysis)',context);
 return {actual,draft,ui:{values:v,warnings:ui.warning_codes,draft:uiDraft,topics:JSON.parse(JSON.stringify(ui.topics))},gmail:gmailResult};
}
