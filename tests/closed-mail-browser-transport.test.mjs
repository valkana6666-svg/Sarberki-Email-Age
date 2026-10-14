import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createBookingRuntime} from '../booking-runtime.mjs';
test('browser-only transport blocks manual local approval for current closed fixture; ordinary server gate remains unchanged',async()=>{
 const source=(await readFile(new URL('../booking-runtime.mjs',import.meta.url),'utf8')).slice((await readFile(new URL('../booking-runtime.mjs',import.meta.url),'utf8')).indexOf("if(typeof window!=="));
 let closed=true,calls=0;
 const context=vm.createContext({createBookingRuntime,window:{SarberkiClosedSyntheticMailPreview:()=>closed},fetch:async()=>{calls++;return {ok:false,json:async()=>({error:'existing server gate'})};},JSON,Error});
 vm.runInContext(source,context);
 const values={arrival:'2026-10-23',departure:'2026-10-25',adults:'2',children:'0',guests:'2',unit:'Deluxe',units_requested:'1'};
 await assert.rejects(context.window.SarberkiBookingRuntime.beforeApproval(values),/szintetikus/);assert.equal(calls,0);
 closed=false;await assert.rejects(context.window.SarberkiBookingRuntime.beforeApproval(values),/existing server gate/);assert.equal(calls,1);
});
