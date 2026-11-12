import test from 'node:test';
import assert from 'node:assert/strict';
import {ingestTestMailboxMessage} from '../shared-core/server-test-mailbox-case.mjs';
import {previoAvailabilitySource} from '../shared-core/server-capacity-draft.mjs';

// Level 1 (synthetic): Gmail fixture -> server extraction -> Previo read (stub) -> central decision -> guest draft.
const id='1a1a32e7a1cd26c9';
const body='Jó napot! 2027. június 10-től 13-ig jönnénk 2 felnőtt, gyerek nélkül, a Deluxe faházba. Telefon: +36 30 000 0000. Üdv: Teszt Elek';
const msg={id,threadId:id,labelIds:['INBOX'],internalDate:String(Date.parse('2026-11-09T09:00:00Z')),payload:{mimeType:'text/plain',
 headers:[{name:'Subject',value:'Sárberki élő teszt – Previo'},{name:'From',value:'Teszt Elek <sarberkito@gmail.com>'},{name:'To',value:'sarberkiprojecttest@gmail.com'},{name:'Message-ID',value:'<cap@example.test>'}],
 body:{data:Buffer.from(body).toString('base64url')}}};
const fetchImpl=async url=>new URL(url).pathname.endsWith('/profile')?new Response(JSON.stringify({emailAddress:'sarberkiprojecttest@gmail.com'})):new Response(JSON.stringify(msg));
async function draftWith(reader){
 let sent;
 await ingestTestMailboxMessage({token:'ya29.SYNTHETIC_ONLY_0123456789abcdef',messageId:id,attestationKey:'ab'.repeat(32),fetchImpl,clock:()=>'2026-11-09T09:00:00.000Z',
  transport:async(_,{body})=>{sent=body;return {revision:1};},availabilitySource:reader?previoAvailabilitySource(reader):null});
 return sent.p_data.drafts[0].text;
}
const reader=free=>async({cabin,arrival,departure})=>({hotelId:'73521',arrival,departure,checkedAt:'2026-11-09T09:00:00.000Z',freeByCabin:{[cabin]:free}});

test('Previo says free -> the guest draft says so in guest words; none of the internal capacity wording',async()=>{
 const t=await draftWith(reader(3));
 assert.match(t,/A kért időszakra jelenleg van szabad helyünk ebben a háztípusban\./);
 assert.doesNotMatch(t,/kapacitás ellenőrzése még nem igazolt|Az elérhetőséget a kért időszakra a foglalás előtt ellenőrizzük|típusszintű|emberi jóváhagyás/);
});
test('Previo says 0 -> no free place sentence',async()=>{
 assert.match(await draftWith(reader(0)),/sajnos nincs elegendő szabad helyünk/);
});
test('no switch, or a failed read -> exactly the previous behaviour (never "sold out")',async()=>{
 const off=await draftWith(null);
 assert.match(off,/Az elérhetőséget a kért időszakra a foglalás előtt ellenőrizzük/);
 const failed=await draftWith(async()=>{throw Error('PREVIO_TIMEOUT');});
 assert.equal(failed,off);
});

test('real timing: the Previo answer arrives after the draft started (clock moves) -> still accepted',async()=>{
 let t=Date.parse('2026-11-09T09:00:00.000Z');const clock=()=>{t+=400;return new Date(t).toISOString();};
 let sent;
 await ingestTestMailboxMessage({token:'ya29.SYNTHETIC_ONLY_0123456789abcdef',messageId:id,attestationKey:'ab'.repeat(32),fetchImpl,clock,
  transport:async(_,{body})=>{sent=body;return {revision:1};},
  availabilitySource:previoAvailabilitySource(async({cabin,arrival,departure})=>({hotelId:'73521',arrival,departure,checkedAt:clock(),freeByCabin:{[cabin]:2}}))});
 assert.match(sent.p_data.drafts[0].text,/A kért időszakra jelenleg van szabad helyünk ebben a háztípusban\./);
});
