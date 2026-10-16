import test from 'node:test';
import assert from 'node:assert/strict';
import {createBookingCaseStore} from '../booking-cases.mjs';
import {classifyTubRequest,tubServiceMessage,tubServiceProjection,assessTubEligibility} from '../shared-core/tub-request.mjs';
import {tubServiceDraft} from '../central-reply.mjs';
import {extractServerMessage} from '../shared-core/server-message-extraction.mjs';
import {syntheticPreviewState} from '../synthetic-server-preview.mjs';
import {readFileSync} from 'node:fs';
const stay={arrival:'2026-11-13',departure:'2026-11-16',guests:'4',adults:'4',children:'0',unit:'Deluxe'};
const message=(id,text,extra={})=>({sender:'guest@synthetic.invalid',message_id:id,thread_id:'thread-one',text,received_at:'2026-10-16T12:00:00Z',...extra});
function fixture(){let n=0,saved='[]';const storage={getItem:()=>saved,setItem:(_key,value)=>{saved=value;}};
 const store=createBookingCaseStore({tenantId:'sarberki-test',storage,id:()=> 'case-'+(++n),clock:()=> '2026-10-16T13:00:00Z'});
 const first=store.ingest(message('m1','Deluxe booking',{received_at:'2026-10-16T10:00:00Z'}),stay).bookingCase;
 return {store,first,trust(context){const rows=JSON.parse(saved);rows[0].bookingContext=context;saved=JSON.stringify(rows);return createBookingCaseStore({tenantId:'sarberki-test',storage,id:()=> 'review-'+(++n),clock:()=> '2026-10-16T13:00:00Z'});}};
}
test('1 linked service-only request persists its schedule without changing stay dates, guests or unit',()=>{
 const {store,first}=fixture();const text='2026-11-14 18:00-tól 24 órára dézsafürdőt kérünk.';
 const result=store.ingest(message('m2',text),{arrival:'2040-01-01',departure:'2040-01-02',unit:'VIP',guests:'9'});
 assert.equal(result.bookingCase.id,first.id);for(const [key,value]of Object.entries(stay))assert.equal(result.bookingCase.state.values[key],value,key);
 assert.equal(result.bookingCase.serviceRequests.length,1);assert.deepEqual(tubServiceProjection(result.bookingCase),{requested:true,startDate:'2026-11-14',startTime:'18:00',durationHours:24,linkedCaseId:first.id,verificationStatus:'unverified',requiresHumanApproval:true});
});
test('2 HU DE EN SI current-message classifiers preserve full explicit schedule including non-24-hour durations',()=>{
 for(const text of ['2026-11-14 18:00-tól 48 órára dézsát kérünk.','Bitte Badezuber am 2026-11-14 ab 18:00 für 48 Stunden.',
  'Please add a hot tub on 2026-11-14 at 18:00 for 48 hours.','Prosimo za masažno kad 2026-11-14 ob 18:00 za 48 ur.']){
  const parsed=classifyTubRequest(text);assert.equal(parsed.kind,'tub_request',text);assert.equal(parsed.startDate,'2026-11-14');assert.equal(parsed.startTime,'18:00');assert.equal(parsed.durationHours,48);assert.equal(parsed.confirmationAllowed,false);
 }
});
test('3 missing, impossible and conflicting schedule values remain unknown and never confirm',()=>{
 for(const text of ['Dézsát kérünk.','Dézsát kérünk 2026-02-30 99:99-től.','Dézsát kérünk 2026-11-14 vagy 2026-11-15, 18:00 vagy 20:00, 24 vagy 48 órára.']){
  const r=classifyTubRequest(text);assert.equal(r.kind,'tub_request');assert.equal(r.startDate,null);assert.equal(r.startTime,null);assert.equal(r.durationHours,null);assert.equal(r.confirmationAllowed,false);assert.equal(r.requiresHumanReview,true);
 }
});
test('4 a persisted verified reference can link; unknown or conflicting email references remain separate service review',()=>{
 const f=fixture(),store=f.trust({verified:true,source:'operator_verified',reference:'REF-123',unitNumber:7});
 const linked=store.ingest(message('m2','Booking reference REF-123. Please add a hot tub.',{thread_id:''}),{});
 assert.equal(linked.bookingCase.id,f.first.id);assert.equal(linked.bookingCase.serviceRequests.at(-1).eligibility.status,'not_available');assert.equal(tubServiceProjection(linked.bookingCase).verificationStatus,'unverified');
 for(const [id,text]of [['m3','Booking reference WRONG-123. Please add a hot tub.'],['m4','Booking reference REF-123. Booking reference OTHER-456. Please add a hot tub.']]){
  const result=store.ingest(message(id,text),{});assert.equal(result.resolution.status,'ambiguous');assert.equal(result.bookingCase.caseKind,'service_link_review');for(const key of Object.keys(stay))assert.equal(result.bookingCase.state.values[key],undefined);assert.equal(tubServiceProjection(result.bookingCase).linkedCaseId,null);
 }
});
test('5 sender alone, wrong sender, independent thread and claimed case id cannot hijack or create accommodation',()=>{
 for(const extra of [{thread_id:''},{sender:'other@synthetic.invalid'},{thread_id:'new-thread',in_reply_to:'<old@synthetic.invalid>'},{case_id:'case-1',thread_id:'new-thread'}]){
  const {store,first}=fixture();const result=store.ingest(message('m2','Please add a hot tub.',extra),stay);
  assert.notEqual(result.bookingCase.id,first.id);assert.equal(result.bookingCase.caseKind,'service_link_review');for(const key of Object.keys(stay))assert.equal(result.bookingCase.state.values[key],undefined);assert.equal(result.bookingCase.state.intent,'service_request');
 }
});
test('6 new and historical unique service messages invalidate approval, while duplicate replay adds no request',()=>{
 const {store,first}=fixture();const state=structuredClone(first.state);state.approval='internally_approved';store.save(first.id,state);
 const result=store.ingest(message('m2','Please add a hot tub.'),{});assert.equal(result.bookingCase.state.approval,'pending');
 const again=structuredClone(result.bookingCase.state);again.approval='internally_approved';store.save(first.id,again);
 const historical=store.ingest(message('m3','Please add a hot tub.',{received_at:'2026-10-16T09:00:00Z'}),{});assert.equal(historical.resolution.status,'historical');assert.equal(historical.bookingCase.state.approval,'pending');
 const count=historical.bookingCase.serviceRequests.length;const duplicate=store.ingest(message('m3','Please add a hot tub.'),{});assert.equal(duplicate.resolution.status,'duplicate');assert.equal(duplicate.bookingCase.serviceRequests.length,count);
});
test('7 authoritative split-unit config excludes every 7–10 segment; equipped or unknown houses still never confirm',()=>{
 for(const n of [7,8,9,10])for(const segment of ['A','B','C'])assert.equal(assessTubEligibility({unit:n+segment,availability:'available'}).status,'not_available');
 for(const n of [1,6,11,15,undefined])assert.equal(assessTubEligibility({unitNumber:n,availability:'available'}).confirmationAllowed,false);
});
test('8 cancellation supersedes request and older appended request cannot resurrect it or overwrite the stay',()=>{
 const {store,first}=fixture();store.ingest(message('m2','2026-11-14 18:00-tól 24 órára dézsát kérünk.'),{});
 const cancelled=store.ingest(message('m3','Mégsem kérünk dézsát 2026-11-15-től.',{received_at:'2026-10-16T12:30:00Z'}),{arrival:'2026-11-15'});
 assert.equal(tubServiceProjection(cancelled.bookingCase).requested,false);assert.equal(cancelled.bookingCase.state.values.arrival,stay.arrival);
 const historical=store.ingest(message('m4','Dézsát kérünk.',{received_at:'2026-10-16T11:00:00Z'}),{});
 assert.equal(tubServiceProjection(historical.bookingCase).requested,false);assert.equal(historical.bookingCase.id,first.id);
});
test('9 quoted-only old tub request does not create a new service request after cancellation',()=>{
 const {store}=fixture();store.ingest(message('m2','Mégsem kérünk dézsát.'),{});
 const result=store.ingest(message('m3','Köszönöm.\nFrom: guest@synthetic.invalid\nSent: 2026-10-15\nSubject: régi\nDézsát kérek.',{received_at:'2026-10-16T13:00:00Z'}),{});
 assert.equal(result.bookingCase.serviceRequests.length,1);assert.equal(tubServiceProjection(result.bookingCase).requested,false);
});
test('10 Reader seven fields and four-language clarification drafts cannot claim availability or approval',()=>{
 const request={requested:true,startDate:'2026-11-14',startTime:'18:00',durationHours:24,linkedCaseId:'case-1',verificationStatus:'unverified',requiresHumanApproval:true};
 const state=syntheticPreviewState({serviceRequest:request});const fields=['service_requested','service_date','service_time','service_duration','service_case','service_verification','service_human'];assert.equal(fields.length,7);assert.deepEqual(Object.keys(state).filter(key=>key.startsWith('service_')).sort(),[...fields,'service_link'].sort());assert.match(state.service_link,/Nincs külön ügykapcsolási felülvizsgálat/u);assert.match(state.service_verification,/NEM IGAZOLT/);assert.match(state.service_human,/Igen/);
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');for(const field of [...fields,'service_link'])assert.ok(html.includes('id="server_preview_'+field+'"'));
 for(const language of ['hu','de','en','si']){assert.ok(tubServiceDraft(language,false).length>70);assert.ok(tubServiceDraft(language,true).length>70);}
 assert.equal(extractServerMessage({text:'Bitte Badezuber für 24 Stunden.',received_at:'2026-10-16T10:00:00Z'}).request,'Bitte Badezuber für 24 Stunden.');
});

test('equal timestamps and imperative English withdrawal cannot revive an earlier request',()=>{
 const {store}=fixture();store.ingest(message('m2','Please add a hot tub.'),{});
 const cancelled=store.ingest(message('m3','Please cancel the hot tub.'),{});
 assert.equal(tubServiceProjection(cancelled.bookingCase).requested,false);
 const sameTime=store.ingest(message('m4','Please add a hot tub.'),{});
 assert.equal(tubServiceProjection(sameTime.bookingCase).requested,false);
 const mixed=tubServiceMessage('Please cancel the hot tub and add a hot tub.');assert.equal(mixed.actionConflict,true);assert.equal(mixed.confirmationAllowed,false);
});

test('booking a tub at the existing cabin in four languages never changes accommodation dates or guests',()=>{
 for(const text of ['Dézsát szeretnék foglalni 2026-11-14 18:00-tól 24 órára a meglévő Deluxe faházunkhoz.',
  'I would like to book a hot tub at our Deluxe cabin on 2026-11-14 at 18:00 for 24 hours.',
  'Wir möchten einen Badezuber bei unserem Deluxe Ferienhaus am 2026-11-14 um 18:00 für 24 Stunden buchen.',
  'Želimo rezervirati masažno kad pri naši hiški Deluxe 2026-11-14 ob 18:00 za 24 ur.']){
  const {store}=fixture();assert.equal(classifyTubRequest(text).serviceOnly,true,text);
  const result=store.ingest(message('m2',text),{arrival:'2026-11-14',departure:'2026-11-15',guests:'9'});
  for(const [key,value]of Object.entries(stay))assert.equal(result.bookingCase.state.values[key],value,key);
 }
 assert.equal(classifyTubRequest('Please book one Deluxe cabin and a hot tub.').serviceOnly,false);
});

test('cancellation policy questions do not withdraw a mixed accommodation and tub request',()=>{
 for(const text of [
  'Deluxe faházat foglalni szeretnénk, dézsát is kérünk. Milyen lemondási feltételek vannak?',
  'Please book a Deluxe cabin and add a hot tub. What are the cancellation conditions?'
 ]){
  const parsed=tubServiceMessage(text);assert.equal(parsed.kind,'tub_request');assert.equal(parsed.serviceOnly,false);assert.notEqual(parsed.cancelled,true);
 }
 for(const text of ['A dézsát lemondjuk.','Please cancel the hot tub.','Bitte stornieren Sie den Badezuber.','Želim preklicati masažno kad.'])assert.equal(tubServiceMessage(text).cancelled,true,text);
});

test('split-house guests retain an unverified rental request while their own-house equipment stays absent',()=>{
 for(const house of [7,8,9,10]){
  const f=fixture(),store=f.trust({verified:true,source:'operator_verified',reference:'REF-123',unitNumber:house});
  const result=store.ingest(message('cross-house','Booking reference REF-123. Please add a hot tub on 2026-11-14 at 18:00 for 24 hours.',{thread_id:''}),{});
  const physical=result.bookingCase.serviceRequests.at(-1).eligibility;
  const service=tubServiceProjection(result.bookingCase);
  assert.equal(physical.status,'not_available');
  assert.equal(physical.confirmationAllowed,false);
  assert.equal(service.verificationStatus,'unverified');
  assert.equal(service.linkedCaseId,f.first.id);
  assert.equal(service.startDate,'2026-11-14');
  assert.equal(service.requiresHumanApproval,true);
  for(const [key,value] of Object.entries(stay))assert.equal(result.bookingCase.state.values[key],value);
  const view=syntheticPreviewState({serviceRequest:service});
  assert.match(view.service_verification,/NEM IGAZOLT/);
  assert.doesNotMatch(view.service_verification,/nincs dézsa/);
 }
});

test('stored physical eligibility and caller availability cannot prove service calendar availability',()=>{
 for(const status of ['not_available','requires_operator_confirmation','unverified']){
  const record={serviceRequests:[{at:'2026-10-16T12:00:00Z',eligibility:{status,confirmationAllowed:true},availability:'available'}]};
  const result=tubServiceProjection(record);
  assert.equal(result.verificationStatus,'unverified');
  assert.equal(result.requiresHumanApproval,true);
  assert.equal('confirmationAllowed' in result,false);
 }
});

const mixedWithdrawalMessages=[
 'Deluxe faházat foglalni szeretnénk 2026-12-11 és 2026-12-14 között. A dézsát lemondjuk.',
 'Please book a Deluxe cabin from 2026-12-11 to 2026-12-14. Please cancel the hot tub.',
 'Wir möchten ein Deluxe Ferienhaus buchen, vom 2026-12-11 bis 2026-12-14. Bitte stornieren Sie den Badezuber.',
 'Želimo rezervirati hiško Deluxe od 2026-12-11 do 2026-12-14. Preklicujem masažno kad.'
];
test('HU DE EN SI tub withdrawals retain a simultaneous new accommodation request',()=>{
 for(const text of mixedWithdrawalMessages){
  const parsed=tubServiceMessage(text);
  assert.equal(parsed.kind,'tub_request',text);
  assert.equal(parsed.cancelled,true,text);
  assert.equal(parsed.serviceOnly,false,text);
  assert.equal(parsed.confirmationAllowed,false);
  assert.equal(parsed.requiresHumanReview,true);
 }
});
test('mixed withdrawal ingests accommodation facts and a separate unconfirmed cancellation without hijacking an older stay',()=>{
 for(const text of mixedWithdrawalMessages){
  const {store,first}=fixture(),before=store.get(first.id);
  const incoming={...stay,arrival:'2026-12-11',departure:'2026-12-14'};
  const result=store.ingest(message('mixed-withdrawal',text,{thread_id:'new-stay-thread'}),incoming);
  assert.equal(result.resolution.status,'new',text);
  assert.notEqual(result.bookingCase.id,first.id);
  assert.notEqual(result.bookingCase.caseKind,'service_link_review');
  assert.equal(result.bookingCase.state.intent,'booking_request');
  for(const [key,value] of Object.entries(incoming))assert.equal(result.bookingCase.state.values[key],value,key);
  const service=tubServiceProjection(result.bookingCase);
  assert.equal(service.requested,false);
  assert.equal(service.verificationStatus,'cancelled_unverified');
  assert.equal(service.requiresHumanApproval,true);
  assert.equal(result.bookingCase.state.approval,'pending');
  assert.deepEqual(store.get(first.id),before);
 }
});
