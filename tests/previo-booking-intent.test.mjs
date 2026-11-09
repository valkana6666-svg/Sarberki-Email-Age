import test from 'node:test';
import assert from 'node:assert/strict';
import {previoPriceRequest,PREVIO_TEST_73521} from '../shared-core/previo-booking-intent.mjs';
const cats={adult:111,child:[{id:222,minAge:0,maxAge:2},{id:333,minAge:3,maxAge:8},{id:444,minAge:9,maxAge:17}]};

test('Previo-shaped price request from a case: room kind, rate plan, guest categories by age (9–17 too, IFA-exempt); unit kept for a later write',()=>{
 const r=previoPriceRequest({values:{arrival:'2027-06-10',departure:'2027-06-13',adults:'2',children:'3',child_ages:'1,5,10'},cabin:'deluxe',unit:'12',guestCategories:cats,mealTypeId:1});
 assert.equal(r.hotelId,'73521');assert.equal(r.roomId,2392199);
 const room=r.body.rooms[0];
 assert.deepEqual([room.from,room.to,room.roomKindId,room.ratePlanId],['2027-06-10','2027-06-13',1012899,385033]);
 assert.deepEqual(room.guests.map(g=>g.guestCategoryId),[111,111,222,333,444]);
 assert.ok(room.guests.every(g=>g.mealTypeId===1));
 assert.equal(Object.keys(PREVIO_TEST_73521.rooms).length,23);
});

test('unknown or missing facts refuse instead of guessing',()=>{
 const v={arrival:'2027-06-10',departure:'2027-06-13',adults:'2',children:'0'};
 assert.throws(()=>previoPriceRequest({values:v,cabin:'tent',guestCategories:cats,mealTypeId:1}),/ROOM_KIND_UNKNOWN/);
 assert.throws(()=>previoPriceRequest({values:v,cabin:'deluxe',unit:'7/A ',guestCategories:cats,mealTypeId:1}),/UNIT_UNKNOWN/);
 assert.throws(()=>previoPriceRequest({values:{...v,departure:'2027-06-10'},cabin:'deluxe',guestCategories:cats,mealTypeId:1}),/DATES_REQUIRED/);
 assert.throws(()=>previoPriceRequest({values:{...v,children:'1'},cabin:'deluxe',guestCategories:cats,mealTypeId:1}),/CHILD_AGES_REQUIRED/);
 assert.throws(()=>previoPriceRequest({values:v,cabin:'deluxe',guestCategories:null,mealTypeId:1}),/GUEST_CATEGORY_UNVERIFIED/);
 assert.throws(()=>previoPriceRequest({values:{...v,children:'1',child_ages:'4'},cabin:'deluxe',guestCategories:{adult:1,child:[]},mealTypeId:1}),/GUEST_CATEGORY_UNVERIFIED/);
});

test('73521 defaults: own guest categories (Felnőtt 472221, Gyerek 472223), no meal plan -> the body the suggester accepted',()=>{
 const r=previoPriceRequest({values:{arrival:'2027-06-15',departure:'2027-06-17',adults:'2',children:'2',child_ages:'4,12'},cabin:'deluxe'});
 assert.deepEqual(r.body.rooms[0].guests,[{guestCategoryId:472221},{guestCategoryId:472221},{guestCategoryId:472223},{guestCategoryId:472223}]);
 assert.throws(()=>previoPriceRequest({values:{arrival:'2027-06-15',departure:'2027-06-17',adults:'2',children:'0'},cabin:'deluxe',mealTypeId:'x'}),/GUEST_CATEGORY_UNVERIFIED/);
});
