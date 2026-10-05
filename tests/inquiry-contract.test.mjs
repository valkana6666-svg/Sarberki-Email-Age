import test from 'node:test';
import assert from 'node:assert/strict';
import { createInquiryEnvelope, INQUIRY_CHANNELS } from '../shared-core/inquiry-contract.mjs';

test('shared inquiry contract is business-independent and preserves normalized payload', () => {
  const result=createInquiryEnvelope({
    schemaVersion:'sarberki_inquiry_v1',
    sourceChannel:'gmail',
    rawText:'  Szeretnék szállást.  ',
    receivedAt:'2026-10-05T08:30:00+02:00',
    sender:'guest@example.com',
    normalized:{language:'hu',guests:2}
  });

  assert.equal(result.schema_version,'sarberki_inquiry_v1');
  assert.equal(result.source.channel,'gmail');
  assert.equal(result.original_text,'Szeretnék szállást.');
  assert.deepEqual(result.normalized,{language:'hu',guests:2});
});

test('shared inquiry contract accepts every planned input channel', () => {
  for(const channel of INQUIRY_CHANNELS){
    assert.doesNotThrow(()=>createInquiryEnvelope({
      schemaVersion:'test_v1',
      sourceChannel:channel,
      rawText:'test',
      normalized:{}
    }));
  }
});

test('shared inquiry contract rejects unknown channel and empty text', () => {
  assert.throws(()=>createInquiryEnvelope({
    schemaVersion:'test_v1',
    sourceChannel:'previo',
    rawText:'test'
  }),/Ismeretlen bemeneti csatorna/);

  assert.throws(()=>createInquiryEnvelope({
    schemaVersion:'test_v1',
    sourceChannel:'manual',
    rawText:'   '
  }),/Üres vendégüzenet/);
});
