import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sanitizeGuestReplyPayload,containsForbiddenGuestText} from '../guest-reply/public-answer-contract.mjs';
import {composeGuestReply} from '../guest-reply/public-answer-renderer.mjs';

test('new public reply core is prepared but not wired into the current page',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,/guest-reply\//u);
});

test('strict contract drops internal fields and unapproved quote data',()=>{
  const model=sanitizeGuestReplyPayload({
    facts:{language:'hu',arrival:'2026-10-16',departure:'2026-10-18',guests:4,adults:2,children:2,childAges:[7,11],cabin:'deluxe',internal_note:'titkos'},
    topics:['accommodation','price','unknown_topic'],
    quote:{approved:false,total:122200,source:'internal system',debug:'secret'},
    internal_status:'review_required'
  });
  assert.equal(model.quote,null);
  assert.deepEqual(model.topics,['accommodation','price']);
  assert.equal('internal_note' in model.facts,false);
  assert.equal('internal_status' in model,false);
});

test('approved quote keeps only guest-safe numeric values',()=>{
  const model=sanitizeGuestReplyPayload({
    facts:{language:'hu'},
    topics:['price'],
    quote:{approved:true,total:122200,accommodation:120000,tourismTax:2200,eurTotal:332.31,source:'Previo',checkedAt:'2026-10-07',debug:'internal'}
  });
  assert.equal(model.quote.total,122200);
  assert.equal(model.quote.accommodation,120000);
  assert.equal(model.quote.tourismTax,2200);
  assert.equal(model.quote.eurTotal,332.31);
  assert.equal('source' in model.quote,false);
  assert.equal('checkedAt' in model.quote,false);
  assert.equal('debug' in model.quote,false);
});

test('physical split identifiers and internal wording cannot enter availability',()=>{
  const model=sanitizeGuestReplyPayload({
    facts:{language:'hu'},
    topics:['availability'],
    availability:{verified:true,options:['Deluxe','7C','Previo pool','Családi']}
  });
  assert.deepEqual(model.availability.options,['Deluxe','Családi']);
});

test('renderer answers only selected public topics and asks only declared missing booking data',()=>{
  const draft=composeGuestReply({
    facts:{language:'hu',name:'Elek',arrival:'2026-10-16',departure:'2026-10-18',guests:4,adults:2,children:2,childAges:[7,11],cabin:'deluxe'},
    topics:['accommodation','price','hot_tub'],
    missing:['phone'],
    quote:{approved:true,total:122200,accommodation:120000,tourismTax:2200,eurTotal:332.31,source:'Previo'}
  });
  assert.match(draft,/Deluxe faház/u);
  assert.match(draft,/122.?200 Ft/u);
  assert.match(draft,/120.?000 Ft/u);
  assert.match(draft,/2.?200 Ft/u);
  assert.match(draft,/332,31 €/u);
  assert.match(draft,/30.?000 Ft\/24 óra/u);
  assert.match(draft,/6 főig/u);
  assert.match(draft,/4.?000 Ft\/fő\/24 óra/u);
  assert.match(draft,/telefonszám/u);
  assert.doesNotMatch(draft,/horgászjegy|lemondási határidő|parkolási lehetőség/u);
  assert.equal(containsForbiddenGuestText(draft),false);
});

test('fishing topic comes only from the curated public answer table',()=>{
  const draft=composeGuestReply({facts:{language:'hu'},topics:['fishing'],missing:[]});
  for(const phrase of ['állami horgászjegy','szakáll nélküli','6-os','pontybölcső','merítőháló','sebfertőtlenítő','pontyzsák','külön váltandó'])assert.match(draft,new RegExp(phrase,'iu'));
  assert.equal(containsForbiddenGuestText(draft),false);
});

test('missing booking facts become guest questions without internal review text',()=>{
  const draft=composeGuestReply({facts:{language:'hu'},topics:[],missing:['dates','adults','children_status','child_ages','phone','cabin']});
  for(const phrase of ['érkezési és távozási','hány felnőtt','érkezik-e gyermek','minden gyermek életkorát','telefonszámot','melyik háztípust'])assert.match(draft,new RegExp(phrase,'u'));
  assert.doesNotMatch(draft,/ellenőrzendő|emberi|kezelői|belső|PMS|Previo/iu);
});
