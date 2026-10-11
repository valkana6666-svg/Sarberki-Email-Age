import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareSyntheticBookingReview} from '../shared-core/server-synthetic-booking-review.mjs';
import {evaluateCentralInquiry} from '../shared-core/central-inquiry-decision.mjs';
import {serverInquiryOptions} from '../shared-core/server-inquiry-options.mjs';
import {buildCentralReply} from '../central-reply.mjs';
import {SARBERKI_TENANT} from '../tenant-config.mjs';
const at=Date.parse('2026-10-10T08:00:00Z');
function fixture(){
 const calls=[];
 const record={tenantId:'sarberki-test',caseId:'case-central',revision:2,data:{id:'case-central',tenantId:'sarberki-test',sender:'guest@synthetic.invalid',messages:[],drafts:[],state:{approval:'pending',revision:0,
  original:'Deluxe cabin from 2026-11-01 to 2026-11-03 for 2 adults and no children.',
  values:{arrival:'2026-11-01',departure:'2026-11-03',guests:'2',adults:'2',children:'0',unit:'Deluxe',units_requested:'1',language:'en'}}}};
 return {record,calls,now:at,
  availability:async q=>{calls.push({kind:'capacity',query:q});return {...q,source:'synthetic-fixture',checkedAt:new Date(at).toISOString(),availability:'available',availableUnits:1};},
  pricing:async q=>{calls.push({kind:'price',query:q});return {...q,tenantId:'sarberki-test',unitId:q.cabin,source:'synthetic-fixture',checkedAt:new Date(at).toISOString(),verified:true,basis:'per_unit',capacity:4,nightly:100};}};
}
test('server review uses common facts/readiness, correct tenant evidence and internal pricing',async()=>{
 const f=fixture(),before=structuredClone(f.record),review=await prepareSyntheticBookingReview(f);
 const base=evaluateCentralInquiry(serverInquiryOptions(f.record,new Date(at)));
 assert.deepEqual(review.decision.facts,base.facts);assert.deepEqual(review.decision.missing,base.missing);
 assert.deepEqual(review.decision.capacity.input,base.capacity.input);
 assert.equal(review.status,'internal_review_required');assert.equal(review.decision.capacity.verified,true);
 assert.equal(review.decision.capacity.selectedOptions[0].evidence.tenantId,'sarberki-test');
 assert.equal(review.evidence.tenantId,'sarberki-test');assert.equal(review.evidence.unit,'Deluxe');
 assert.equal(review.quote.tenantId,'sarberki-test');assert.equal(review.quote.unitId,'Deluxe');assert.equal(review.quote.total,200);
 assert.equal(review.decision.pricing.verified,true);assert.equal(review.decision.safety.approval,'pending');
 assert.equal(review.decision.pricing.guestPriceApproved,false);assert.deepEqual(f.calls.map(c=>c.kind),['capacity','price']);
 assert.deepEqual(f.record,before);
});
test('new guest draft accurately renders stored facts and Hungarian operator review uses the same decision',async()=>{
 const f=fixture(),v=f.record.data.state.values,review=await prepareSyntheticBookingReview(f);
 const expected=buildCentralReply({caseId:f.record.data.id,language:v.language,arrival:v.arrival,departure:v.departure,guests:2,adults:2,children:0,childAges:[],phone:v.phone,name:v.name,cabin:v.unit,original:f.record.data.state.original},{tenant:{...SARBERKI_TENANT,id:'sarberki-test'},records:[]});
 assert.equal(review.draft,expected);assert.equal(review.operatorReviewLanguage,'hu');
 assert.match(review.operatorReviewText,/Kedves|Köszönjük/);assert.match(review.operatorReviewText,/2 felnőtt/);
 assert.match(review.operatorReviewText,/01\.11\.2026/);assert.match(review.operatorReviewText,/03\.11\.2026/);
 assert.match(review.operatorReviewText,/kapacitás igazolt/);assert.match(review.draft,/2 guests/);assert.doesNotMatch(review.draft,/null adults/);assert.doesNotMatch(review.draft,/200/);
 const repeated=await prepareSyntheticBookingReview({...f,currentNow:()=>at+1000});assert.equal(repeated.draft,review.draft);
});
test('common missing/contradictory/past-date checks block both fixture transports',async()=>{
 for(const change of [{arrival:'2026-02-30'},{adults:'0',guests:'0'},
  {children:'1',guests:'3',child_ages:'18'},{guests:'5'},
  {arrival:'2026-10-01',departure:'2026-10-03'},{nights:'99'},{unit:'Unknown'}]){
  const f=fixture();Object.assign(f.record.data.state.values,change);
  const review=await prepareSyntheticBookingReview(f);
  assert.equal(review.status,'missing_data');assert.equal(review.decision.readyForCapacityCheck,false);assert.deepEqual(f.calls,[]);
 }
});
test('capacity tenant/date/freshness failures cannot be repaired by adapter translation',async()=>{
 for(const change of [{tenantId:'sarberki'},{tenantId:'other'},{tenantId:undefined},
  {cabin:'VIP'},{arrival:'2026-11-02'},{checkedAt:new Date(at-120001).toISOString()}]){
  const f=fixture(),read=f.availability;f.availability=async q=>({...await read(q),...change});
  const review=await prepareSyntheticBookingReview(f);assert.equal(review.status,'capacity_unknown');assert.equal(review.quote,undefined);
  assert.deepEqual(f.calls.map(c=>c.kind),['capacity']);
 }
 assert.throws(()=>evaluateCentralInquiry({tenantId:'foreign'}),/UNSUPPORTED_INQUIRY_TENANT/);
});
test('unknown, zero and insufficient stock remain distinct and never call pricing',async()=>{
 for(const [raw,status] of [[{availability:'unknown',availableUnits:0},'capacity_unknown'],
  [{availability:'unavailable',availableUnits:0},'capacity_unavailable'],
  [{availability:'available',availableUnits:1},'capacity_unavailable']]){
  const f=fixture();f.record.data.state.values.units_requested='2';const read=f.availability;
  f.availability=async q=>({...await read(q),...raw});
  const review=await prepareSyntheticBookingReview(f);assert.equal(review.status,status);assert.equal(review.quote,undefined);
  assert.deepEqual(f.calls.map(c=>c.kind),['capacity']);
 }
});
test('capacity is re-evaluated after awaited pricing and cannot promote a stale result',async()=>{
 const f=fixture(),price=f.pricing;let current=at;f.currentNow=()=>current;
 f.pricing=async q=>{const rate=await price(q);current+=120001;return {...rate,checkedAt:new Date(current).toISOString()};};
 const review=await prepareSyntheticBookingReview(f);assert.equal(review.status,'capacity_unknown');assert.equal(review.decision.capacity.verified,false);assert.equal(review.quote,undefined);
});

test('known stored child ages and contact fields survive guest and Hungarian rendering',async()=>{
 const f=fixture();Object.assign(f.record.data.state.values,{guests:'3',children:'1',child_ages:'7',phone:'+36123456789',name:'Synthetic Operator Guest'});
 const review=await prepareSyntheticBookingReview(f);
 assert.deepEqual(review.decision.facts.child_ages,[7]);
 assert.match(review.draft,/7/);assert.doesNotMatch(review.draft,/How old|phone number/);
 assert.match(review.operatorReviewText,/7/);assert.doesNotMatch(review.operatorReviewText,/gyermek életkorát|telefonszámot/);
 assert.equal(review.status,'internal_review_required');
});
