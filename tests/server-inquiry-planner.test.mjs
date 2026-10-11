import test from 'node:test';
import assert from 'node:assert/strict';
import {planCentralInquiry} from '../shared-core/server-inquiry-planner.mjs';
import {buildChatInquiryReply,buildEmailInquiryDraft} from '../shared-core/inquiry-channel-adapters.mjs';
import {buildAvailabilityOptions} from '../netlify/functions/availability-options.mjs';
import {evaluateCentralInquiry} from '../shared-core/central-inquiry-decision.mjs';
const now=new Date();
const arrival=new Date(now.getTime()+14*86400000).toISOString().slice(0,10);
const departure=new Date(now.getTime()+16*86400000).toISOString().slice(0,10);
const facts={dates:{arrival,departure,inferred_year:false},cabin:'Deluxe',adults:2,children:0,child_ages:[],guests:2,units_requested:1};
const source=async q=>({...q,availability:'available',availableUnits:1,checkedAt:now.toISOString(),source:'SYNTHETIC_FIXTURE'});
const proof=()=>{const scope={tenantId:'sarberki',unitId:'deluxe',arrival,departure,adults:2,children:0,child_ages:[],guests:2,units:1,approved:true,checkedAt:now.toISOString()};return {...scope,components:Object.fromEntries(Object.entries({base:100,seasonal:20,discount:10,tourismTax:5,optional:0}).map(([key,amount])=>[key,{...scope,amount,verified:true,source:'SYNTHETIC_APPROVED'}]))};};
test('planner has no default provider and missing data never calls supplied providers',async()=>{
 assert.equal((await planCentralInquiry({facts},{clock:()=>new Date(now.getTime()+1000)})).capacity.status,'UNKNOWN');
 let calls=0;const provider=async()=>{calls++;throw Error('must not call');};
 await planCentralInquiry({facts:{...facts,adults:null}},{availabilitySource:provider,priceSource:provider,clock:()=>new Date(now.getTime()+1000)});assert.equal(calls,0);
});
test('source failure or unknown evidence prevents pricing; verified source enables bound price',async()=>{
 let prices=0;const priceSource=async()=>{prices++;return proof();};
 for(const availabilitySource of [async()=>{throw Error('offline');},async q=>({...q,availability:'unverified',source:'SYNTHETIC'})]){
 const d=await planCentralInquiry({facts},{availabilitySource,priceSource,clock:()=>new Date(now.getTime()+1000)});assert.equal(d.capacity.verified,false);}
 assert.equal(prices,0);
 const d=await planCentralInquiry({facts},{availabilitySource:source,priceSource,clock:()=>new Date(now.getTime()+1000)});assert.equal(d.capacity.status,'AVAILABLE');assert.equal(d.pricing.breakdown.total,115);assert.equal(prices,1);
});
test('capacity expiring while awaiting either provider fails closed',async()=>{
 let time=new Date(now.getTime()+1000);let prices=0;
 const d=await planCentralInquiry({facts},{clock:()=>time,availabilitySource:async q=>{const value=await source(q);time=new Date(now.getTime()+121001);return value;},priceSource:async()=>{prices++;return proof();}});
 assert.equal(d.capacity.verified,false);assert.equal(prices,0);
 time=new Date(now.getTime()+1000);
 const p=await planCentralInquiry({facts},{clock:()=>time,availabilitySource:source,priceSource:async()=>{time=new Date(now.getTime()+121001);return proof();}});
 assert.equal(p.capacity.verified,false);assert.equal(p.pricing.verified,false);
});
test('actual email and chat adapters preserve verified capacity and price decisions in all languages',async()=>{
 const capacity=await buildAvailabilityOptions(evaluateCentralInquiry({facts,now}).capacity.input,source);capacity.checkedAt=now.toISOString();
 for(const language of ['hu','de','en','si']){
 const options={facts,now,language,capacity,priceComponents:proof()};const a=buildEmailInquiryDraft(options),b=buildChatInquiryReply(options);
 assert.deepEqual(a.decision,b.decision);assert.equal(a.decision.capacity.status,'AVAILABLE');assert.equal(a.decision.pricing.breakdown.total,115);assert.equal(a.requiresApproval,true);assert.equal(b.requiresApproval,true);
 }
});
