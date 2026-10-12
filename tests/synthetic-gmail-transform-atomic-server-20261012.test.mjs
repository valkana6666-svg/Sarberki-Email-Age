import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as core from '../sarberki-core.mjs';
import {BUSINESS} from '../business-config.mjs';
import * as fishing from '../fishing-rules.mjs';
import * as policy from '../gmail-policy.mjs';
import * as splitUnits from '../split-units.mjs';
import {createServerCaseService} from '../shared-core/server-case-service.mjs';
import {createServerBookingRuntime} from '../shared-core/server-booking-runtime.mjs';

// Offline browser Gmail transform -> atomic synthetic server draft -> edit -> reread.
// No real account, email send, Previo or network access.
async function transformFixture(){
 const source=readFileSync(new URL('../gmail-readonly.js',import.meta.url),'utf8')
  .replace(/await import\('\.\/([^']+)'\)/gu,(_,name)=>'modules['+JSON.stringify(name.split('?')[0])+']');
 const button={disabled:false,addEventListener(){}},status={textContent:'',insertAdjacentElement(){}};
 const window={};
 const document={getElementById:id=>id==='read_gmail'?button:status,querySelector:()=>({content:'synthetic-client'})};
 const context=vm.createContext({
  modules:{'sarberki-core.mjs':core,'business-config.mjs':{BUSINESS},'fishing-rules.mjs':fishing,
   'gmail-policy.mjs':policy,'split-units.mjs':splitUnits},
  document,window,console,URL,Date,Number,Intl,TextDecoder,Uint8Array,atob
 });
 await vm.runInContext(source,context);
 return window.sarberkiGmailTransform;
}
function syntheticEmail(from='guest@synthetic.invalid'){
 const body='Jó napot! 2026. november 26–28. között 2 felnőtt részére VIP faházat szeretnénk. gyermek nélkül. Van szabad hely? Üdvözlettel: Teszt Vendég';
 return {id:'test-msg-001',threadId:'test-thread-001',
  internalDate:String(Date.parse('2026-10-12T08:00:00Z')),labelIds:['INBOX'],
  payload:{mimeType:'text/plain',body:{data:Buffer.from(body).toString('base64url')},
   headers:[{name:'From',value:'Synthetic Guest <'+from+'>'},
    {name:'To',value:'test-inbox@synthetic.invalid'},{name:'Subject',value:'Synthetic VIP inquiry'}]}};
}
function fixture(){
 const rows=new Map(),repository={
  get:async(t,c)=>structuredClone(rows.get(t+':'+c)??null),
  list:async t=>structuredClone([...rows.values()].filter(x=>x.tenantId===t)),
  insert:async(t,c,r)=>{if(rows.has(t+':'+c))return false;rows.set(t+':'+c,structuredClone(r));return true;},
  compareAndSwap:async(t,c,v,r)=>{if(rows.get(t+':'+c)?.revision!==v)return false;rows.set(t+':'+c,structuredClone(r));return true;}
 };
 const service=createServerCaseService({repository,resolveAuthority:async caller=>caller});
 const writer={subject:'writer',tenants:{'sarberki-test':['read','write']}};
 const reader={subject:'reader',tenants:{'sarberki-test':['read']}};
 const base={service,tenantId:'sarberki-test',clock:()=> '2026-10-12T09:00:00Z'};
 return {rows,service,writer,reader,base,
  runtime:createServerBookingRuntime({...base,requestContext:writer,id:()=> 'case-synthetic-vip-gmail'})};
}
function toSyntheticServerImport(record){
 const v=record.normalized;
 return {envelope:{sender:record.source.from_email,text:record.original_message,
  mailbox_id:'synthetic-mailbox',message_id:record.source.message_id,
  thread_id:record.source.thread_id,received_at:record.source.received_at},
  values:{arrival:v.dates.arrival,departure:v.dates.departure,
   adults:String(v.adults),children:String(v.children),guests:String(v.guests),
   unit:v.cabin,language:v.language,units_requested:String(v.units_requested||1)}};
}
test('Gmail browser fixture atomically persists pending synthetic draft and revised edit',async()=>{
 const transform=await transformFixture(),parsed=transform(syntheticEmail());
 assert.equal(parsed.source.from_email,'guest@synthetic.invalid');
 assert.equal(parsed.normalized.dates?.arrival,'2026-11-26');
 assert.equal(parsed.normalized.dates?.departure,'2026-11-28');
 assert.equal(parsed.normalized.guests,2);
 assert.equal(parsed.normalized.cabin,'VIP');
 const f=fixture(),input=toSyntheticServerImport(parsed);
 const first=await f.runtime.ingest(input.envelope,input.values,{expectedRevision:0,persistDraft:true});
 assert.equal(first.record.revision,1);
 assert.equal(first.record.data.messages.length,1);
 assert.equal(first.record.data.drafts.length,1);
 assert.equal(first.record.data.drafts[0].synthetic,true);
 assert.equal(first.record.data.drafts[0].reviewStatus,'manual_review_required');
 assert.equal(first.record.data.state.approval,'pending');
 assert.equal(first.record.data.state.quote,null);
 assert.equal(first.record.data.state.availability,null);
 const again=await f.runtime.ingest(input.envelope,input.values,{expectedRevision:0,persistDraft:true});
 assert.equal(again.resolution.status,'duplicate');
 assert.equal(again.record.revision,1);
 const original=first.record.data.drafts[0].text;
 const editedText='Szintetikus szerkesztett válasz – kezelői jóváhagyásra vár.';
 const saved=await f.runtime.editDraft(first.record.caseId,1,editedText);
 assert.equal(saved.revision,2);
 assert.equal(saved.data.drafts.length,2);
 assert.equal(saved.data.drafts[0].text,original);
 assert.equal(saved.data.state.approval,'pending');
 const readonly=createServerBookingRuntime({...f.base,requestContext:f.reader});
 const preview=await readonly.previewDraft(first.record.caseId,2);
 assert.equal(preview.storedDraft?.text,editedText);
 assert.equal(preview.storedDraft?.edited,true);
 assert.equal(preview.approval,'pending');
 assert.equal(preview.persisted,false);
 await assert.rejects(readonly.editDraft(first.record.caseId,2,'unauthorized'),e=>e.code==='FORBIDDEN');
 await assert.rejects(f.runtime.editDraft(first.record.caseId,1,'stale'),e=>e.code==='CASE_CONFLICT');
 assert.equal(f.rows.size,1);
});
test('browser Gmail fixture cannot upload a real sender to the synthetic case store',async()=>{
 const transform=await transformFixture(),parsed=transform(syntheticEmail('real@example.com'));
 const f=fixture(),input=toSyntheticServerImport(parsed);
 await assert.rejects(f.runtime.ingest(input.envelope,input.values,{expectedRevision:0,persistDraft:true}),e=>e.code==='INVALID_INPUT');
 assert.equal(f.rows.size,0);
});
