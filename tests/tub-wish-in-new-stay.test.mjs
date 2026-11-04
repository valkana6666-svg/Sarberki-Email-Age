import test from 'node:test';
import assert from 'node:assert/strict';
import {tubServiceMessage} from '../shared-core/tub-request.mjs';

test('a new stay with dates and party size plus a tub wish is an accommodation enquiry',()=>{
 for(const t of [
  'Jó napot!\n2027. július 10. és 14. között jönnénk 2 felnőtt és 2 gyerek (6 és 9 évesek), egy kis kutyát is hoznánk. Dézsát is szeretnénk bérelni. Mennyi lenne az ár?\nÜdvözlettel: Nagy Éva',
  'Hello, we would come from 2027-08-01 to 2027-08-04 with 4 adults and would like to rent the hot tub too.'
 ]){const r=tubServiceMessage(t);assert.equal(r.kind==='tub_request'?r.serviceOnly:false,false,t);}
});

test('a tub request for an existing booking stays a service request',()=>{
 for(const t of [
  'Jó napot! A 2027. július 10–14. közötti foglalásunkhoz dézsát szeretnénk kérni, 4 fő vagyunk.',
  'Dézsát szeretnénk kérni a foglalásunkhoz.',
  'Hello, for our booking from 2027-08-01 to 2027-08-04 (4 adults) we would like to add the hot tub.'
 ]){const r=tubServiceMessage(t);assert.equal(r.kind,'tub_request',t);assert.equal(r.serviceOnly,true,t);}
});
