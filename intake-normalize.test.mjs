import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeInquiryInput,normalizePhoneAiTranscript} from './intake-normalize.mjs';

const text='2027. október 16-18. között 4 fő mennénk: 2 felnőtt és 2 gyermek, 7 és 11 évesek. Deluxe házat szeretnénk. Telefonszám: +36 30 555 1234.';

test('manual Gmail web form and phone AI normalize into the same booking schema',()=>{
  const channels=['manual','gmail','web_form','phone_ai'];
  const rows=channels.map(sourceChannel=>normalizeInquiryInput({sourceChannel,rawText:text,now:new Date('2026-10-03T10:00:00Z')}));
  for(const row of rows){
    assert.equal(row.schema_version,'sarberki_inquiry_v1');
    assert.equal(row.normalized.cabin,'Deluxe');
    assert.equal(row.normalized.guests,4);
    assert.equal(row.normalized.adults,2);
    assert.equal(row.normalized.children,2);
    assert.deepEqual(row.normalized.child_ages,[7,11]);
    assert.deepEqual(row.normalized.dates,{arrival:'2027-10-16',departure:'2027-10-18',inferred_year:false});
  }
  assert.deepEqual(rows.map(x=>x.normalized),[rows[0].normalized,rows[0].normalized,rows[0].normalized,rows[0].normalized]);
});

test('phone AI transcript uses the common core without creating a separate booking logic',()=>{
  const row=normalizePhoneAiTranscript({rawText:text,now:new Date('2026-10-03T10:00:00Z')});
  assert.equal(row.source.channel,'phone_ai');
  assert.equal(row.normalized.phone,'+36 30 555 1234');
});

test('unknown channels are rejected',()=>{
  assert.throws(()=>normalizeInquiryInput({sourceChannel:'other',rawText:text}),/Ismeretlen bemeneti csatorna/u);
});


test('split-unit intent is normalized consistently across channels',()=>{
  const message='2027. október 16-18. között kettő darab kétfős osztott apartmant szeretnénk, 4 felnőtt részére.';
  const rows=['manual','gmail','web_form','phone_ai'].map(sourceChannel=>normalizeInquiryInput({sourceChannel,rawText:message,now:new Date('2026-10-03T10:00:00Z')}));
  for(const row of rows){
    assert.equal(row.normalized.cabin,'Osztott');
    assert.equal(row.normalized.split_request.isSplit,true);
    assert.equal(row.normalized.split_request.requestedAB,2);
    assert.equal(row.normalized.split_request.requestedC,0);
    assert.equal(row.normalized.split_request.sameHousePreferred,true);
    assert.equal(row.normalized.split_request.crossHouseFallbackRequiresApproval,false);
  }
});
