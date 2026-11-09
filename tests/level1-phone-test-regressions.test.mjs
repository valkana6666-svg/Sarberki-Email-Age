import test from 'node:test';
import assert from 'node:assert/strict';
import {childCountFromText} from '../sarberki-core.mjs';
import {extractServerMessage} from '../shared-core/server-message-extraction.mjs';
import {serverInquiryOptions} from '../shared-core/server-inquiry-options.mjs';
import {emailDraftWithCapacity} from '../shared-core/server-capacity-draft.mjs';

// Owner iPhone test 2026-11-09 (fictional "Teszt Vendég 9"): "gyerek nincs" was not understood, so the draft asked
// about children and the Previo read never ran; with the read, the free sentence stood after the booking status.
const TEXT='Jó napot!\n\nSzeretnénk érdeklődni egy Deluxe faházról 2027. június 15-től június 17-ig (2 éjszaka), 2 felnőtt részére, gyerek nincs.\nVan szabad hely, és mennyi lenne az ár?\n\nKöszönettel:\nTeszt Vendég 9';

test('"gyerek nincs" and similar mean zero children; real counts unchanged',()=>{
 for(const t of ['2 felnőtt részére, gyerek nincs.','3 felnőtt, gyerekek nélkül','Gyerekek nem jönnek.','gyermek nem lesz','nincs gyerek','gyerek nélkül'])assert.equal(childCountFromText(t),0,t);
 assert.equal(childCountFromText('2 felnőtt és 1 gyerek (5 éves)'),1);
});

async function draft(availability){
 const values=extractServerMessage({text:TEXT,received_at:'2026-11-09T13:39:00Z'});
 assert.equal(values.children,'0');
 const calls=[];
 const plan=await emailDraftWithCapacity(serverInquiryOptions({tenantId:'sarberki-test',data:{state:{original:TEXT,values}}},new Date('2026-11-09T13:40:00Z')),
  async({arrival,departure,cabin})=>{calls.push(cabin);return {arrival,departure,cabin,availability,availableUnits:availability==='available'?4:0,checkedAt:'2026-11-09T13:40:00.300Z',source:'previo-rest-73521'};},
  {clock:()=>Date.parse('2026-11-09T13:40:00.400Z')});
 return {text:plan.text,calls};
}
test('verified free: the Previo sentence replaces "we confirm separately" inside the accommodation section',async()=>{
 const {text,calls}=await draft('available');
 assert.deepEqual(calls,['deluxe']);
 const lines=text.split('\n');
 const at=lines.indexOf('A kért időszakra jelenleg van szabad helyünk ebben a háztípusban. A foglalás a visszaigazolásunkkal válik érvényessé.');
 assert.ok(at>lines.indexOf('Szállás')&&at<lines.indexOf('Ár és díjak'),'inside "Szállás"');
 assert.doesNotMatch(text,/elérhetőségét külön visszaigazoljuk/);
 assert.doesNotMatch(text,/érkezik-e gyermek/);
 assert.match(text,/A teljes árat a ténylegesen szabad lehetőség alapján adjuk meg\./,'the price step still finds its line');
});
test('verified not free: the "no availability" sentence takes the same place',async()=>{
 const {text}=await draft('unavailable');
 assert.match(text,/Szállás\n[\s\S]*A kért időszakra sajnos nincs elegendő szabad helyünk ebben a háztípusban\.\n\nÁr és díjak/);
 assert.doesNotMatch(text,/elérhetőségét külön visszaigazoljuk/);
});

test('no cabin type named: no Previo call, the short "which cabin type?" letter as before',async()=>{
 const text='Szia! 2027. június 15-17 között lenne szabad hely 2 felnőttnek? Gyerek nem jön. Üdv: Teszt D';
 const values=extractServerMessage({text,received_at:'2026-11-09T13:39:00Z'});
 let calls=0;
 const plan=await emailDraftWithCapacity(serverInquiryOptions({tenantId:'sarberki-test',data:{state:{original:text,values}}},new Date('2026-11-09T13:40:00Z')),
  async()=>{calls++;throw Error('must not be called');});
 assert.equal(calls,0);
 assert.match(plan.text,/melyik háztípust választaná/);assert.doesNotMatch(plan.text,/ebben a háztípusban/);
});
test('verified full, no placeholder in the letter: the sentence goes right after the requested cabin type line',async()=>{
 const text='Jó napot! 2027. június 11-től 12-ig egy éjszakára jönnénk a Deluxe faházba, 3 felnőtt, gyerekek nélkül. Tel: +36 30 111 2222. Üdv: Teszt B';
 const values=extractServerMessage({text,received_at:'2026-11-09T13:39:00Z'});
 assert.equal(values.children,'0');
 const plan=await emailDraftWithCapacity(serverInquiryOptions({tenantId:'sarberki-test',data:{state:{original:text,values}}},new Date('2026-11-09T13:40:00Z')),
  async({arrival,departure,cabin})=>({arrival,departure,cabin,availability:'unavailable',availableUnits:0,checkedAt:'2026-11-09T13:40:00.200Z',source:'previo-rest-73521'}),
  {clock:()=>Date.parse('2026-11-09T13:40:00.300Z')});
 assert.match(plan.text,/A kért háztípus: Deluxe\.\nA kért időszakra sajnos nincs elegendő szabad helyünk ebben a háztípusban\./);
});
