// V2 step 2 (owner 2026-11-07: V1 testing and V2 development in parallel). Builds, from a stored booking case,
// the request in Previo's own shape (REST `POST /rest/reservations/accounts/suggester`, documented in the Previo
// Postman collection: rooms[{from,to,roomKindId,ratePlanId,guests[{guestCategoryId,mealTypeId}]}]). The same
// structure is what a later, owner-approved booking write would carry, plus the chosen unit (roomId).
// Pure: no network, no write. Unknown ids refuse (no guessing a room, rate plan or guest category).
const fail=code=>{const e=Error(code);e.code=code;throw e;};
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;

// API TEST property 73521, read back by Claude 2026-11-09 (docs/PREVIO-TEST-23-EGYSEG-2026-11-06.md, 6. pont).
export const PREVIO_TEST_73521=Object.freeze({
 hotelId:'73521',ratePlanId:385033,
 roomKinds:Object.freeze({vip:1012895,family:1012897,deluxe:1012899,small:1012901,splitA:1012903,splitB:1012903,splitC:1012905}),
 rooms:Object.freeze({'1':2392185,'2':2392187,'3':2392189,'4':2392191,'5':2392193,'6':2392195,'11':2392197,'12':2392199,'13':2392201,'14':2392203,'15':2392205,
  '7/A':2392207,'7/B':2392209,'8/A':2392211,'8/B':2392213,'9/A':2392215,'9/B':2392217,'10/A':2392219,'10/B':2392221,
  '7/C':2392223,'8/C':2392225,'9/C':2392227,'10/C':2392229}),
 // Read by Claude 2026-11-09 from the TEST property's public booking page (PageParams.GUEST_CATEGORIES), no Previo
 // request for rights: Felnőtt 18–150 = 472221, Gyerek 0–17 = 472223. The property has no meal plans (MEALS: []).
 guestCategories:Object.freeze({adult:472221,child:Object.freeze([Object.freeze({id:472223,minAge:0,maxAge:17})])}),
 mealTypeId:null
});

// guestCategories: {adult, child:[{id, minAge, maxAge}]} (default: the property's own); mealTypeId: null when the
// property has no meal plans (then it is left out). Children 9+ are priced as adults (owner 2026-11-09) – in Previo that
// is the child category's own behaviour above the included occupancy.
// Suggester check 2026-11-09 (73521, owner-approved read): Deluxe 2027-06-15→17, 2 adults = 126 000 + IFA 2 200.
export function previoPriceRequest({values,cabin,unit=null,property=PREVIO_TEST_73521,guestCategories=property.guestCategories,mealTypeId=property.mealTypeId??null}){
 if(!day(values?.arrival)||!day(values?.departure)||values.departure<=values.arrival)fail('DATES_REQUIRED');
 const roomKindId=property.roomKinds[cabin];if(!roomKindId)fail('ROOM_KIND_UNKNOWN');
 if(unit!==null&&!property.rooms[unit])fail('UNIT_UNKNOWN');
 const adults=Number(values.adults);if(!Number.isInteger(adults)||adults<1)fail('ADULTS_REQUIRED');
 const ages=String(values.child_ages||'').split(',').filter(Boolean).map(Number);
 if(Number(values.children||0)!==ages.length||ages.some(a=>!Number.isInteger(a)||a<0||a>17))fail('CHILD_AGES_REQUIRED');
 if(!Number.isSafeInteger(guestCategories?.adult)||(mealTypeId!==null&&!Number.isSafeInteger(mealTypeId)))fail('GUEST_CATEGORY_UNVERIFIED');
 const childCategory=age=>{const c=(guestCategories.child||[]).find(c=>age>=c.minAge&&age<=c.maxAge);if(!c)fail('GUEST_CATEGORY_UNVERIFIED');return c.id;};
 // Every child 0–17 goes in a child category: Previo prices a child above the included occupancy like an adult and
 // exempts it from IFA (73521 suggester, 2026-11-09) – sending a 9–17-year-old as an adult would add IFA.
 const guests=[...Array(adults).fill(guestCategories.adult),...ages.map(childCategory)]
  .map(guestCategoryId=>mealTypeId===null?{guestCategoryId}:{guestCategoryId,mealTypeId});
 const room={from:values.arrival,to:values.departure,roomKindId,ratePlanId:property.ratePlanId,guests};
 return Object.freeze({hotelId:property.hotelId,body:Object.freeze({rooms:[room]}),
  // For a later booking write only (not sent to the suggester): the operator-chosen physical unit.
  roomId:unit?property.rooms[unit]:null});
}
