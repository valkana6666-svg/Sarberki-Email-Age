import test from 'node:test';
import assert from 'node:assert/strict';
import {previoBookingWriter,V2_REFERENCE} from '../shared-core/server-previo-booking-sync.mjs';
import {confirmTestMailboxBooking,markTestMailboxDepositReceived,cancelTestMailboxBooking} from '../shared-core/server-test-mailbox-confirm.mjs';

// Synthetic only: fictional key, case and Previo answers; fetch is injected, nothing leaves the process.
const ENV={PREVIO_WRITE_ENABLED:'sandbox-73521-only',PREVIO_HOTEL_ID:'73521',PREVIO_WRITE_PERMISSION_ID:'PERM-20261111-V2-UI',PREVIO_API_KEY:'synthetic-previo-key-0123456789'};
const KEY='e5'.repeat(32);
const ok=(resId,voucher,status=1)=>`<reservations><reservation><comId>9${resId}</comId><resId>${resId}</resId><voucher>${voucher}</voucher><status><statusId>${status}</statusId></status></reservation></reservations>`;
function previo({create='ok',search='<reservations/>'}={}){
 const calls=[];
 const fetchImpl=async(url,o)=>{const path=new URL(url).pathname,body=String(o.body);calls.push({path,body});
  if(path.endsWith('/searchReservations'))return new Response(typeof search==='function'?search(calls):search);
  if(path.endsWith('/reservation')){
   if(body.includes('<gCosId>'))return new Response(ok(5001,'X',Number(body.match(/<gCosId>(\d+)/)[1])));
   if(create==='timeout')throw Object.assign(Error('t'),{name:'TimeoutError'});
   return new Response(ok(5001,body.match(/<voucher>([^<]+)/)[1]));}
  throw Error('unexpected '+path);};
 return {calls,fetchImpl};
}
const record=()=>({tenantId:'sarberki-test',caseId:'tm-1a2b3c4d5e6f7a8b',revision:3,data:{state:{values:{arrival:'2027-06-15',departure:'2027-06-17',adults:'2',children:'0',unit:'Deluxe',language:'hu',name:'Teszt Elek'}},drafts:[],messages:[]}});
function db({saveResult='ok'}={}){const rpc=[];return {rpc,transport:async(path,o={})=>{
 if(path.startsWith('/rest/v1/sc_cases'))return [];
 rpc.push({path,body:o.body});
 if(saveResult==='throw')throw Object.assign(Error('DB'),{code:'DB'});
 if(saveResult==='null')return null;
 return {case_id:o.body.p_case,revision:4,data:{booking:{status:'finalized'}}};}};}

test('writer exists only with the switch, 73521, a permission id and a key',()=>{
 assert.equal(previoBookingWriter({},fetch),null);
 assert.equal(previoBookingWriter({...ENV,PREVIO_HOTEL_ID:'753011'},fetch),null);
 assert.equal(previoBookingWriter({...ENV,PREVIO_WRITE_PERMISSION_ID:'yes'},fetch),null);
 assert.equal(previoBookingWriter({...ENV,PREVIO_API_KEY:''},fetch),null);
 assert.equal(typeof previoBookingWriter(ENV,fetch).createOption,'function');
});

test('V2 finalize: search, create the option on the chosen unit, save "V2-<resId>", operator note; no guest contact data sent',async()=>{
 const p=previo(),d=db();
 const r=await confirmTestMailboxBooking({record:record(),previoAuto:true,previoWriter:previoBookingWriter(ENV,p.fetchImpl,{pauseMs:0}),unit:'12',attestationKey:KEY,transport:d.transport});
 assert.deepEqual(p.calls.map(c=>c.path),['/x1/hotel/searchReservations','/x1/hotel/reservation']);
 const xml=p.calls[1].body;
 assert.match(xml,/<objId>2392199<\/objId>/);assert.match(xml,/<cosId>1<\/cosId>/);assert.match(xml,/<name>Teszt Elek<\/name>/);assert.match(xml,/<total>128200<\/total>/);
 assert.doesNotMatch(xml,/<email>|<phone>/);
 const saved=d.rpc[0].body;
 assert.equal(saved.p_booking.previoReference,'V2-5001');assert.match(saved.p_booking.previoReference,V2_REFERENCE);
 assert.match(saved.p_draft.operatorReviewText,/Previo \(V2, automatikus\): opció létrehozva .* azonosító 5001, egység 12/);
 assert.doesNotMatch(saved.p_draft.text,/5001|V2-|Previo/,'nothing internal in the guest letter');
 assert.equal(r.previo.resId,5001);
});

test('V2 finalize without the writer refuses; V1 manual path unchanged',async()=>{
 await assert.rejects(confirmTestMailboxBooking({record:record(),previoAuto:true,unit:'12',attestationKey:KEY,transport:db().transport}),/PREVIO_WRITE_DISABLED/);
 const d=db();await confirmTestMailboxBooking({record:record(),previoRecorded:true,previoReference:'P-1',unit:'12',attestationKey:KEY,transport:d.transport});
 assert.equal(d.rpc[0].body.p_booking.previoReference,'P-1');
});

test('our save fails or conflicts after the Previo create -> the new option is cancelled (no orphan)',async()=>{
 for(const saveResult of ['throw','null']){
  const p=previo(),d=db({saveResult});
  const run=confirmTestMailboxBooking({record:record(),previoAuto:true,previoWriter:previoBookingWriter(ENV,p.fetchImpl,{pauseMs:0}),unit:'12',attestationKey:KEY,transport:d.transport});
  if(saveResult==='throw')await assert.rejects(run,/DB/);else assert.equal((await run).saved,null);
  assert.match(p.calls.at(-1).body,/<resId>5001<\/resId><gCosId>7<\/gCosId>/,saveResult);
 }
});

test('slow create: re-read by voucher; found -> continue, not found -> PREVIO_WRITE_UNCERTAIN (never re-sent)',async()=>{
 const voucherSearch=calls=>{const v=calls.find(c=>c.path.endsWith('/reservation'))?.body.match(/<voucher>([^<]+)/)?.[1];return v?ok(5002,v):'<reservations/>';};
 const p1=previo({create:'timeout',search:voucherSearch});
 const w=previoBookingWriter(ENV,p1.fetchImpl,{pauseMs:0});
 const r=await w.createOption({tenantId:'t',caseId:'c',values:{arrival:'2027-06-15',departure:'2027-06-17',adults:'2',children:'0'},cabin:'deluxe',unit:'12',contactName:'X',totalHuf:128200,optionExpiresUtc:'2027-01-01T00:00:00Z'});
 assert.equal(r.resId,5002);assert.equal(p1.calls.filter(c=>c.path.endsWith('/reservation')).length,1,'create sent once');
 const p2=previo({create:'timeout'});
 await assert.rejects(previoBookingWriter(ENV,p2.fetchImpl,{pauseMs:0}).createOption({tenantId:'t',caseId:'c',values:{arrival:'2027-06-15',departure:'2027-06-17',adults:'2',children:'0'},cabin:'deluxe',unit:'12',contactName:'X',totalHuf:128200,optionExpiresUtc:'2027-01-01T00:00:00Z'}),/PREVIO_WRITE_UNCERTAIN/);
 assert.equal(p2.calls.filter(c=>c.path.endsWith('/reservation')).length,1);
});

test('an existing cancelled Previo record for the case is not reused',async()=>{
 const voucherSearch=calls=>{const v=calls[0].body.match(/<fulltext>([^<]+)/)[1];return ok(5003,v,7);};
 const p=previo({search:voucherSearch});
 await assert.rejects(previoBookingWriter(ENV,p.fetchImpl,{pauseMs:0}).createOption({tenantId:'t',caseId:'c',values:{arrival:'2027-06-15',departure:'2027-06-17',adults:'2',children:'0'},cabin:'deluxe',unit:'12',contactName:'X',totalHuf:128200,optionExpiresUtc:'2027-01-01T00:00:00Z'}),/PREVIO_BOOKING_NOT_ACTIVE/);
 assert.equal(p.calls.filter(c=>c.path.endsWith('/reservation')).length,0);
});

test('deposit received on a V2 booking -> Previo confirmed (2); a manual V1 reference -> no Previo call',async()=>{
 const rec=r=>({tenantId:'sarberki-test',caseId:'tm-1a2b3c4d5e6f7a8b',revision:4,data:{booking:{status:'finalized',previo:{reference:r}}}});
 const transport=async(_,o)=>({case_id:o.body.p_case,revision:5});
 const p=previo();
 const r=await markTestMailboxDepositReceived({record:rec('V2-5001'),receivedOn:'2026-11-11',depositConfirmed:true,transport,previoWriter:previoBookingWriter(ENV,p.fetchImpl)});
 assert.equal(r.previoSync,'confirmed');assert.match(p.calls[0].body,/<resId>5001<\/resId><gCosId>2<\/gCosId>/);
 const p2=previo();
 const r2=await markTestMailboxDepositReceived({record:rec('P-1'),receivedOn:'2026-11-11',depositConfirmed:true,transport,previoWriter:previoBookingWriter(ENV,p2.fetchImpl)});
 assert.equal(r2.previoSync,undefined);assert.equal(p2.calls.length,0);
 await assert.rejects(markTestMailboxDepositReceived({record:rec('V2-5001'),receivedOn:'2026-11-11',depositConfirmed:true,transport}),/PREVIO_WRITE_DISABLED/);
});

test('cancel a V2 booking -> our state first, then Previo storno (7); manual reference -> no Previo call; inactive refused',async()=>{
 const rec=(r,status='deposit_received')=>({tenantId:'sarberki-test',caseId:'tm-1a2b3c4d5e6f7a8b',revision:5,data:{booking:{status,previo:{reference:r}}}});
 const calls=[];const transport=async(path,o)=>{calls.push(path);return {case_id:o.body.p_case,revision:6};};
 const p=previo();
 const r=await cancelTestMailboxBooking({record:rec('V2-5001'),reason:'Vendég lemondta',cancelConfirmed:true,transport,previoWriter:previoBookingWriter(ENV,p.fetchImpl)});
 assert.equal(r.previoSync,'cancelled');assert.deepEqual(calls,['/rest/v1/rpc/sc_tm_cancel_booking']);assert.match(p.calls[0].body,/<resId>5001<\/resId><gCosId>7<\/gCosId>/);
 const p2=previo();
 assert.equal((await cancelTestMailboxBooking({record:rec('P-1','finalized'),reason:'x',cancelConfirmed:true,transport,previoWriter:previoBookingWriter(ENV,p2.fetchImpl)})).previoSync,'manual');
 assert.equal(p2.calls.length,0);
 await assert.rejects(cancelTestMailboxBooking({record:rec('V2-5001','cancelled'),reason:'x',cancelConfirmed:true,transport}),/NOT_ACTIVE_BOOKING/);
 await assert.rejects(cancelTestMailboxBooking({record:rec('V2-5001'),reason:'x',cancelConfirmed:true,transport}),/PREVIO_WRITE_DISABLED/);
 await assert.rejects(cancelTestMailboxBooking({record:rec('V2-5001'),reason:'x',cancelConfirmed:false,transport}),/CANCEL_NOT_CONFIRMED/);
});
