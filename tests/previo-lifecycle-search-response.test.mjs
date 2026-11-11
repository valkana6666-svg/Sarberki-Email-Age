import test from 'node:test';
import assert from 'node:assert/strict';
import {isReservationListResponse} from '../scripts/previo-lifecycle-search-response.mjs';
test('observed Previo empty search is a verified empty list, not SEARCH_UNVERIFIED',()=>{
 const observed='<?xml version="1.0" encoding="UTF-8"?>\n<reservations/>';
 assert.equal(/<reservations(?:\s|>)/.test(observed),false,'reproduce former R2 guard failure');
 assert.equal(isReservationListResponse(observed),true);
});
test('equivalent empty envelopes and normal populated list are accepted',()=>{
 for(const text of ['<reservations/>','<reservations />',' <reservations></reservations> ',
  '<reservations><reservation><resId>123</resId></reservation></reservations>'])
  assert.equal(isReservationListResponse(text),true,text);
});
test('wrong root, truncated list, error and trailing records fail closed',()=>{
 for(const text of ['',null,{},'<html></html>','<reservationsBad/>','<reservations>',
  '<reservations/><reservation></reservation>','<reservations><error><code>401</code></error></reservations>',
  '<error><code>401</code></error>','<reservations></reservations><extra/>'])
  assert.equal(isReservationListResponse(text),false);
});
