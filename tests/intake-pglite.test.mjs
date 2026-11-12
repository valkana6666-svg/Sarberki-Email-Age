// V3-1 shared intake (owner-approved V3 plan 2026-11-12): a phone/chat booking request becomes one pending
// test-mailbox case through sc_intake_create. Real PostgreSQL (PGlite), fictional data, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createIntakeRequest,verifyIntakeSignature,signIntake,intakeValues} from '../shared-core/server-intake.mjs';
import {confirmTestMailboxBooking} from '../shared-core/server-test-mailbox-confirm.mjs';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const REF='mojnqizbcaczstguikpv',project='https://'+REF+'.supabase.co',KEY='e5'.repeat(32),TENANT='sarberki-test';
const ids={writer:'11111111-1111-4111-8111-111111111111',intake:'33333333-3333-4333-8333-333333333333'};
const sessions={writer:'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',intake:'aaaaaaaa-aaaa-4aaa-8aaa-000000000003'};
const facts={arrival:'2027-06-10',departure:'2027-06-13',adults:2,children:0,cabin:'deluxe',phone:'+36 30 000 0000',name:'Teszt Hívó',language:'hu'};
const summary='A vendég Deluxe faházat szeretne 2027. június 10–13., 2 felnőtt, gyerek nincs. Visszahívást kér.';

test('intake: one pending case per call, only the intake account can create it, the operator steps work on it',async()=>{
 const db=new PGlite();
 const claims=role=>({sub:ids[role],role:'authenticated',iss:project+'/auth/v1',session_id:sessions[role],exp:Math.floor(Date.now()/1000)+3600});
 const transportFor=role=>async(path,{method='GET',body}={})=>{
  await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims(role))]);
  try{
   const url=new URL('https://x'+path);
   if(method==='GET'&&url.pathname==='/rest/v1/sc_cases')return (await db.query('select * from sc_cases where tenant_id=$1',[TENANT])).rows;
   const fn=url.pathname.split('/').at(-1);
   const args={sc_intake_create:['p_tenant','p_case','p_data','p_proof'],sc_tm_create:['p_tenant','p_case','p_data','p_proof'],sc_tm_confirm_booking:['p_tenant','p_case','p_expected','p_booking','p_draft','p_proof']}[fn];
   const vals=args.map(k=>typeof body[k]==='object'&&body[k]!==null?JSON.stringify(body[k]):body[k]??null);
   return (await db.query(`select ${fn}(${vals.map((_,i)=>'$'+(i+1)).join(',')}) r`,vals)).rows[0].r;
  }catch(error){throw Object.assign(Error(error.code==='42501'?'FORBIDDEN':'DB'),{code:error.code==='42501'?'FORBIDDEN':'DB',detail:error.message});}
  finally{await db.exec('reset role');}
 };
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;grant select on auth.sessions to authenticated;`);
  await db.exec(await read('supabase/migrations/202610090001_case_store.sql'));
  await db.query("select set_config('sarberki.approval_install_project_ref',$1,false),set_config('sarberki.approval_backup_sha256',$2,false),set_config('sarberki.receipt_install_project_ref',$1,false),set_config('sarberki.receipt_backup_sha256',$2,false),set_config('sarberki.tm_install_project_ref',$1,false),set_config('sarberki.tm_backup_sha256',$2,false)",[REF,'b'.repeat(64)]);
  await db.exec("insert into sc_tenants values('sarberki-test','Fictional',true),('demo-test','Fictional other',true)");
  for(const f of ['deployment/cloud-approval/install.sql','deployment/cloud-approval/separate-approver-permission.sql','deployment/exact-receipt/install.sql'])await db.exec(await read(f));
  await db.query('insert into sc_isolated_approval_key(key_hex) values($1)',[KEY]);
  for(const f of ['deployment/test-mailbox/install.sql','deployment/test-mailbox/booking-status.sql','deployment/test-mailbox/booking-unit.sql','deployment/test-mailbox/booking-cancel.sql','deployment/test-mailbox/booking-multiunit.sql','deployment/intake/install.sql'])await db.exec(await read(f));
  assert.equal((await db.exec(await read('deployment/intake/install.verify.sql'))).at(-1).rows[0].result,'VERIFY PASS');
  await db.exec('update sc_test_mailbox_config set enabled=true');
  for(const [role,id] of Object.entries(ids)){await db.query('insert into auth.users values($1)',[id]);await db.query('insert into auth.sessions values($1,$2,null)',[sessions[role],id]);}
  // Writer: normal operator membership. Intake: NO membership, only the intake registry.
  await db.query('insert into sc_memberships values($1,$2,true,true,false)',[TENANT,ids.writer]);
  await db.query('insert into sc_intake_actors(tenant_id,user_id) values($1,$2)',[TENANT,ids.intake]);

  const base={channel:'phone',externalId:'call_test_000001',facts,summary,attestationKey:KEY,tenantId:TENANT};
  // An operator (not in the intake registry) cannot use the intake path.
  await assert.rejects(createIntakeRequest({...base,transport:transportFor('writer')}),/FORBIDDEN/);
  // A forged proof (other key) is refused.
  await assert.rejects(createIntakeRequest({...base,attestationKey:'f0'.repeat(32),transport:transportFor('intake')}),/FORBIDDEN/);
  // The intake account creates exactly one case.
  const {caseId,revision}=await createIntakeRequest({...base,transport:transportFor('intake')});
  assert.match(caseId,/^tm-[a-f0-9]{24}$/);assert.equal(revision,1);
  await assert.rejects(createIntakeRequest({...base,transport:transportFor('intake')}),/STORAGE_FAILURE/,'same call twice: no second case');
  const row=(await db.query('select * from sc_cases where case_id=$1',[caseId])).rows[0];
  assert.equal(row.data.state.approval,'pending');assert.equal(row.data.sourceReceipt.provider,'phone');assert.equal(row.data.sender,'intake:phone');
  assert.equal(row.data.state.values.unit,'Deluxe');assert.equal(row.data.state.values.adults,'2');assert.equal(row.data.state.values.phone,'+36 30 000 0000');
  assert.match(row.data.messages[0].text,/^Telefonos foglalási igény \(AI-recepciós\)/);
  assert.match(row.data.drafts[0].operatorReviewText,/visszahívással vagy e-mailben válaszolj/);
  assert.equal((await db.query("select count(*)::int n from sc_test_mailbox_cases where case_id=$1 and mailbox_id='intake:phone'",[caseId])).rows[0].n,1);
  assert.equal((await db.query("select kind from sc_audit where case_id=$1",[caseId])).rows[0].kind,'intake_create');
  // Least privilege: the intake account can neither read cases nor use the operator functions.
  assert.equal((await transportFor('intake')('/rest/v1/sc_cases?select=*&tenant_id=eq.'+TENANT)).length,0);
  // The existing operator step works unchanged on the intake case (manual Previo recording -> finalized).
  const record={tenantId:TENANT,caseId,revision:Number(row.revision),data:row.data};
  await assert.rejects(confirmTestMailboxBooking({record,previoReference:'P-1',previoRecorded:true,unit:'11',attestationKey:KEY,transport:transportFor('intake')}),/FORBIDDEN|DB/);
  const {saved}=await confirmTestMailboxBooking({record,previoReference:'TEST-73521-9',previoRecorded:true,unit:'11',attestationKey:KEY,transport:transportFor('writer')});
  assert.equal(saved.revision,2);
  // A chat request with its own id is a separate case.
  const chat=await createIntakeRequest({...base,channel:'chat',externalId:'chat_test_000001',transport:transportFor('intake')});
  assert.notEqual(chat.caseId,caseId);
 }finally{await db.close();}
});

test('intake signature and fact validation',()=>{
 const key='ab'.repeat(32),body='{"x":1}',now=Date.parse('2026-11-12T10:00:00Z'),t=Math.floor(now/1000);
 assert.equal(verifyIntakeSignature({key,header:signIntake(key,body,t),body,now}),true);
 assert.throws(()=>verifyIntakeSignature({key,header:signIntake(key,body,t),body:'{"x":2}',now}),/FORBIDDEN/);
 assert.throws(()=>verifyIntakeSignature({key,header:signIntake(key,body,t-301),body,now}),/FORBIDDEN/,'older than 5 minutes');
 assert.throws(()=>verifyIntakeSignature({key,header:signIntake('cd'.repeat(32),body,t),body,now}),/FORBIDDEN/);
 assert.throws(()=>verifyIntakeSignature({key:'short',header:'x',body,now}),/SETUP_REQUIRED/);
 const v=intakeValues({arrival:'2027-06-13',departure:'2027-06-10',adults:99,childAges:[4,30],cabin:'castle',phone:'call me',name:'<script>',language:'xx',extra:'ignored'});
 assert.deepEqual(v,{language:'hu'},'invalid facts are dropped, never guessed');
 assert.deepEqual(intakeValues({adults:2,childAges:[4,10],cabin:'family',language:'de'}),{adults:'2',children:'2',child_ages:'4,10',guests:'4',unit:'Családi',language:'de'});
});
