import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as core from '../sarberki-core.mjs';
import * as splitUnits from '../split-units.mjs';
import {BUSINESS} from '../business-config.mjs';
import {fishingQuestion} from '../fishing-rules.mjs';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
function extract(message){
 const context=vm.createContext({...splitUnits,window:{addEventListener(){},SarberkiNormalize:core,SarberkiConfig:BUSINESS,SarberkiFishingQuestion:fishingQuestion,SarberkiSplitUnits:splitUnits},document:{getElementById:()=>({value:'',textContent:''})},console,Date,Intl,Number,JSON,message});
 vm.runInContext(html.slice(html.indexOf('const $='),html.indexOf('function addEvent(')),context);
 return vm.runInContext("extract(message,'fixture@synthetic.invalid')",context);
}
for(const [language,text] of [
 ['SL','Pozdravljeni! Deluxe hiška 2026-10-23 do 2026-10-25, 2 odrasli, 0 otroci. Telefon: +36 00 000 0000.'],
 ['DE','Guten Tag! Deluxe Haus 2026-10-23 bis 2026-10-25, 2 Erwachsene, 0 Kinder. Telefon: +36 00 000 0000.'],
 ['EN','Hello! Deluxe cabin 2026-10-23 to 2026-10-25, 2 adults, 0 children. Contact: +36 00 000 0000.'],
 ['HU','Deluxe faház 2026-10-23 és 2026-10-25 között, 2 felnőtt, 0 gyermek. Telefon: +36 00 000 0000.']
])test(`${language}: contact details cannot downgrade a dated accommodation request`,()=>{
 const result=extract(text);
 assert.equal(result.intent,'booking_request');
 assert.equal(result.fields.arrival.value,'2026-10-23');
 assert.equal(result.fields.departure.value,'2026-10-25');
 assert.equal(result.fields.guests.value,'2');
});
for(const text of ['Telefon: +36 00 000 0000.','Deluxe hiška. Telefon: +36 00 000 0000.'])
 test('contact-only question is not promoted: '+text,()=>assert.equal(extract(text).intent,'general_question'));
