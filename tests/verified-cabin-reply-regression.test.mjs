import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReplyDraft} from '../sarberki-core.mjs';

const request={
  language:'hu',intent:'booking_request',
  original:'November 13-tól 15-ig két felnőtt és két gyermek részére keresek szabad faházat.',
  arrival:'2026-11-13',departure:'2026-11-15',
  guests:4,adults:2,children:2,childAges:[],phone:null,
  cabin:'? – emberi döntésre vár'
};

test('verified availability replaces provisional capacity text but retains stay summary and cabin question',()=>{
  const draft=buildReplyDraft({...request,caseContext:{
    extraLines:[],priceLines:[],bookingLines:[],
    availabilityLines:['Igazoltan elérhető faházak: Családi, VIP, Deluxe.'],
    priceApproved:false
  }});
  assert.match(draft,/Igazoltan elérhető faházak: Családi, VIP, Deluxe/);
  assert.doesNotMatch(draft,/A ténylegesen szabad lehetőségeket a kért időszakra ellenőrizzük/);
  assert.match(draft,/13\.11\.2026/);
  assert.match(draft,/melyik felajánlott faháztípust választja/);
});

test('unverified capacity is never described as confirmed availability',()=>{
  const draft=buildReplyDraft(request);
  assert.match(draft,/A ténylegesen szabad lehetőségeket a kért időszakra ellenőrizzük/);
  assert.doesNotMatch(draft,/Igazoltan elérhető faházak/);
});

test('verified cabin options request a guest choice even when cabin clarification is otherwise required',()=>{
 const draft=buildReplyDraft({...request,original:'Négy főre szeretnénk szabad faházat.',caseContext:{
   extraLines:[],priceLines:[],bookingLines:[],
   availabilityLines:['Ellenőrzött elérhető lehetőségek: Családi, VIP.'],
   priceApproved:false
 }});
 assert.match(draft,/Ellenőrzött elérhető lehetőségek: Családi, VIP/u);
 assert.match(draft,/melyik felajánlott faháztípust választja/u);
});

test('synthetic capacity result feeds only verified cabin types into the guest reply',async()=>{
 const {buildAvailabilityOptions}=await import('../netlify/functions/availability-options.mjs');
 const {availabilitySentence}=await import('../availability-recommend.mjs');
 const result=await buildAvailabilityOptions({arrival:'2026-11-13',departure:'2026-11-15',guests:4},async ({cabin})=>({
   availability:cabin==='family'?'available':'unavailable',
   availableUnits:cabin==='family'?1:0,
   checkedAt:new Date().toISOString(),source:'synthetic-test'
 }));
 const sentence=availabilitySentence(result,'hu');
 const draft=buildReplyDraft({...request,caseContext:{
   extraLines:[],priceLines:[],bookingLines:[],availabilityLines:[sentence],priceApproved:false
 }});
 assert.match(draft,/szabad lehetőségek: Családi/u);
 assert.doesNotMatch(sentence,/VIP|Deluxe/u);
 assert.match(draft,/melyik felajánlott faháztípust választja/u);
 assert.doesNotMatch(draft,/A ténylegesen szabad lehetőségeket a kért időszakra ellenőrizzük/u);
});
