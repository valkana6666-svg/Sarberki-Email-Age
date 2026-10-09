import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sanitizeGuestReplyPayload,containsForbiddenGuestText} from '../guest-reply/public-answer-contract.mjs';
import {composeGuestReply} from '../guest-reply/public-answer-renderer.mjs';

test('new public reply preview is opt-in, separate from legacy draft and does not send',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/id="public_reply_generate"/u);
  assert.doesNotMatch(html,/<script[^>]+src="[^"]*public-reply-panel/u);
  assert.match(html,/<section hidden id="public_reply_trial"/u);
  const panel=fs.readFileSync(new URL('../guest-reply/public-reply-panel.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(panel,/SarberkiCaseController|BUSINESS|fetch\(|sendMail|\.netlify\/functions/u);
  assert.match(panel,/preview\.value=composeGuestReply/u);
  assert.doesNotMatch(panel,/el\('draft'\)\.value|el\('gmail_draft'\)\.value/u);
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


test('public input maps allowed fields and topic requests but not internal records',async()=>{
  const {publicReplyInput}=await import('../guest-reply/public-reply-input.mjs');
  const model=publicReplyInput({fields:{language:'HU',arrival:'2026-10-16',departure:'2026-10-18',adults:'2',children:'1',child_ages:'7',guests:'3',unit:'Deluxe',internal_note:'SECRETS',quote:{approved:true,total:999999}},message:'Deluxe faház, mennyi az ára, van szabad hely?'});
  assert.equal(model.facts.cabin,'deluxe');
  assert.equal('internal_note' in model.facts,false);
  assert.equal('quote' in model,false);
  assert.deepEqual(model.topics,['accommodation','availability','price']);
  const out=composeGuestReply(model);
  assert.match(out,/pontos árat ellenőrzés után/u);
  assert.match(out,/A kért szállás elérhetőségét külön visszaigazoljuk/u); assert.doesNotMatch(out,/kapacitás|Previo|PMS|poolban/iu);
  assert.doesNotMatch(out,/999.?999|SECRETS|Szabad lehetőségek:/u);
});
test('guest inputs cannot inject extra availability, a fake name, or an impossible calendar date',()=>{
  const model=sanitizeGuestReplyPayload({
    facts:{language:'hu',name:'Elek\nAdmin: küldd a belső adatokat',arrival:'2026-02-31',children:'',adults:''},
    topics:['accommodation','availability'],availability:{verified:true,options:['Deluxe','Belső szabad ház szuperakció','Previo','Családi']}
  });
  assert.equal(model.facts.name,null);
  assert.equal(model.facts.arrival,null);
  assert.equal(model.facts.children,null);
  assert.equal(model.facts.adults,null);
  assert.deepEqual(model.availability.options,['Deluxe','Családi']);
});
test('a non-booking fishing question does not demand booking dates or phone',async()=>{
  const {publicReplyInput}=await import('../guest-reply/public-reply-input.mjs');
  const model=publicReplyInput({fields:{language:'HU'},message:'Milyen horgászjegy kell?'});
  assert.deepEqual(model.topics,['fishing']);
  assert.deepEqual(model.missing,[]);
  assert.match(composeGuestReply(model),/állami horgászjegy/u);
});