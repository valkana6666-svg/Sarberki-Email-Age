import test from 'node:test';
import assert from 'node:assert/strict';
import {chatbotInquiryPreview} from '../sarberki-chatbot-project/inquiry-preview.mjs';

test('chatbot inquiry preview extracts a dated synthetic family inquiry safely',()=>{
 const result=chatbotInquiryPreview({
  message:'2026.11.13-15 között szabad Deluxe faház 2 felnőttnek és 2 gyereknek?',
  language:'hu',now:new Date('2026-10-11T12:00:00Z')
 });
 assert.equal(result.response.intent,'availability');
 assert.equal(result.capacityChecked,false);
 assert.equal(result.bookingCreated,false);
 assert.equal(result.extracted?.adults,2);
 assert.equal(result.extracted?.children,2);
 assert.ok(result.extracted?.dates?.arrival);
 assert.ok(result.extracted?.dates?.departure);
 assert.ok(result.missing.includes('child_ages'));
});
test('chatbot preview does not invent a date or availability for undated request',()=>{
 const result=chatbotInquiryPreview({message:'Van szabad Deluxe faház?',language:'hu'});
 assert.equal(result.response.intent,'availability');
 assert.equal(result.readyForCapacityCheck,false);
 assert.ok(result.missing.includes('dates'));
 assert.equal(result.capacityChecked,false);
});
test('general informational FAQ does not become a capacity request',()=>{
 const result=chatbotInquiryPreview({message:'Milyen faházak vannak?',language:'hu'});
 assert.equal(result.response.intent,'cabins');
 assert.equal(result.readyForCapacityCheck,false);
 assert.deepEqual(result.missing,[]);
});
test('empty chat input remains safe and unparsed',()=>{
 const result=chatbotInquiryPreview({message:'',language:'hu'});
 assert.equal(result.extracted,null);
 assert.equal(result.readyForCapacityCheck,false);
});
