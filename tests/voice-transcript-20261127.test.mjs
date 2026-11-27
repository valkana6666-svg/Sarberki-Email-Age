// Owner 2026-11-27 („Nagyon fontos, hogy napi kezelőben a teljes beszélgetés szövege megjelenjen”): the whole phone
// conversation goes to the case – at the booking (sc_intake_create) and after it (sc_intake_phone_transcript).
// Real PostgreSQL (PGlite), fictional data, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createIntakeRequest} from '../shared-core/server-intake.mjs';
import {callTranscript,saveTranscript,transcriptText} from '../shared-core/voice-transcript.mjs';
import {saveCallTranscript} from '../netlify/functions/voice-request.mjs';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const REF='mojnqizbcaczstguikpv',project='https://'+REF+'.supabase.co',KEY='e5'.repeat(32),TENANT='sarberki-test';
const ids={writer:'11111111-1111-4111-8111-111111111111',intake:'33333333-3333-4333-8333-333333333333'};
const sessions={writer:'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',intake:'aaaaaaaa-aaaa-4aaa-8aaa-000000000003'};
// The shape ElevenLabs sends (owner's call 11-27 14:54), fictional text; the tool entries carry the caller number.
const history=n=>JSON.stringify({'x-elevenlabs-history':true,entries:[
 {role:'agent',message:'Üdvözlöm! A Sárberki Horgásztó automatikus asszisztense vagyok.'},
 {role:'user',message:'Deluxe faházat szeretnék március 3-tól 7-ig.'},
 {role:'agent',tool_requests:[{tool_name:'sarberki_reply',params_as_json:{caller_messages:['x'],caller_id:'+36300000000'}}]},
 {role:'agent',tool_results:[{tool_name:'sarberki_reply',result_value:'{"reply":"…"}'}]},
 {role:'agent',message:'""'},
 {role:'agent',message:'Jó hír: van szabad hely. Szeretné lefoglalni?'},
 ...Array.from({length:n},(_,i)=>({role:i%2?'agent':'user',message:'Későbbi mondat '+i}))]});

test('callTranscript keeps only the spoken sentences (no tool data, no caller number), both sides',()=>{
 const l=callTranscript(history(0));
 assert.deepEqual(l.map(x=>x.role),['agent','caller','agent']);
 assert.doesNotMatch(JSON.stringify(l),/36300000000|tool|reply/);
 assert.equal(transcriptText(l).split('\n')[1],'Hívó: Deluxe faházat szeretnék március 3-tól 7-ig.');
 assert.deepEqual(callTranscript('nem json'),[]);assert.deepEqual(callTranscript(undefined),[]);
 assert.equal(callTranscript(JSON.stringify({entries:[{role:'user',message:'x'.repeat(5000)}]}))[0].text.length,1500);
});

test('the transcript is stored at the booking and replaced (only by a longer one) after it; only the intake account, own recent phone case',async()=>{
 const db=new PGlite();
 const claims=role=>({sub:ids[role],role:'authenticated',iss:project+'/auth/v1',session_id:sessions[role],exp:Math.floor(Date.now()/1000)+3600});
 const transportFor=role=>async(path,{method='GET',body}={})=>{
  await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims(role))]);
  try{
   const fn=new URL('https://x'+path).pathname.split('/').at(-1);
   const args={sc_intake_create:['p_tenant','p_case','p_data','p_proof'],sc_intake_phone_transcript:['p_tenant','p_case','p_text','p_proof']}[fn];
   const vals=args.map(k=>typeof body[k]==='object'&&body[k]!==null?JSON.stringify(body[k]):body[k]??null);
   return (await db.query(`select ${fn}(${vals.map((_,i)=>'$'+(i+1)).join(',')}) r`,vals)).rows[0].r;
  }catch(error){throw Object.assign(Error(error.code==='42501'?'FORBIDDEN':'DB'),{code:error.code==='42501'?'FORBIDDEN':'DB',detail:error.message});}
  finally{await db.exec('reset role');}
 };
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;grant select on auth.sessions to authenticated;`);
  await db.exec(await read('supabase/migrations/202610090001_case_store.sql'));
  await db.query("select set_config('sarberki.approval_install_project_ref',$1,false),set_config('sarberki.approval_backup_sha256',$2,false),set_config('sarberki.receipt_install_project_ref',$1,false),set_config('sarberki.receipt_backup_sha256',$2,false),set_config('sarberki.tm_install_project_ref',$1,false),set_config('sarberki.tm_backup_sha256',$2,false)",[REF,'b'.repeat(64)]);
  await db.exec("insert into sc_tenants values('sarberki-test','Fictional',true)");
  for(const f of ['deployment/cloud-approval/install.sql','deployment/cloud-approval/separate-approver-permission.sql','deployment/exact-receipt/install.sql'])await db.exec(await read(f));
  await db.query('insert into sc_isolated_approval_key(key_hex) values($1)',[KEY]);
  for(const f of ['deployment/test-mailbox/install.sql','deployment/intake/install.sql','deployment/intake/phone-transcript.sql'])await db.exec(await read(f));
  assert.equal((await db.exec(await read('deployment/intake/phone-transcript.verify.sql'))).at(-1).rows[0].result,'VERIFY PASS');
  await db.exec('update sc_test_mailbox_config set enabled=true');
  for(const [role,id] of Object.entries(ids)){await db.query('insert into auth.users values($1)',[id]);await db.query('insert into auth.sessions values($1,$2,null)',[sessions[role],id]);}
  await db.query('insert into sc_memberships values($1,$2,true,true,false)',[TENANT,ids.writer]);
  await db.query('insert into sc_intake_actors(tenant_id,user_id) values($1,$2)',[TENANT,ids.intake]);

  const facts={arrival:'2027-03-03',departure:'2027-03-07',adults:3,children:0,cabin:'deluxe',email:'sarberkito@gmail.com',name:'Teszt Hívó',language:'hu'};
  const {caseId}=await createIntakeRequest({channel:'phone',externalId:'voice_conv_test0001',facts,summary:'Deluxe faház 2027. március 3–7., 3 felnőtt.',
   attestationKey:KEY,tenantId:TENANT,transport:transportFor('intake'),transcript:callTranscript(history(0))});
  const row=async()=>(await db.query('select revision,data from sc_cases where case_id=$1',[caseId])).rows[0];
  let r=await row();assert.equal(r.data.callTranscript.lines.length,3,'stored at the booking');assert.equal(Number(r.revision),1);
  // After the booking: a longer transcript replaces it (revision + 1, audit), nothing else changes.
  const save=(role,lines,key=KEY,c=caseId)=>saveTranscript({transport:transportFor(role),tenantId:TENANT,caseId:c,lines,attestationKey:key});
  assert.equal((await save('intake',callTranscript(history(4)))).changed,true);
  r=await row();assert.equal(r.data.callTranscript.lines.length,7);assert.equal(Number(r.revision),2);
  assert.equal(r.data.state.approval,'pending');assert.equal(r.data.drafts.length,1);assert.equal(r.data.messages.length,1);
  assert.equal((await db.query("select count(*)::int n from sc_audit where case_id=$1 and kind='intake_transcript'",[caseId])).rows[0].n,1);
  // A shorter (late) one never cuts it back.
  assert.equal((await save('intake',callTranscript(history(2)))).changed,false);assert.equal((await row()).data.callTranscript.lines.length,7);
  // Refused: an operator account, a forged proof, another case, an old case.
  await assert.rejects(save('writer',callTranscript(history(6))),/FORBIDDEN/);
  await assert.rejects(save('intake',callTranscript(history(6)),'f0'.repeat(32)),/FORBIDDEN/);
  await assert.rejects(save('intake',callTranscript(history(6)),KEY,'tm-'+'0'.repeat(24)),/FORBIDDEN/);
  await db.query("update sc_test_mailbox_cases set created_at=now()-interval '4 hours' where case_id=$1",[caseId]);
  await assert.rejects(save('intake',callTranscript(history(6))),/FORBIDDEN/);
  // Rollback removes the function.
  await db.exec(await read('deployment/intake/phone-transcript-rollback.sql'));
  assert.equal((await db.query("select to_regprocedure('public.sc_intake_phone_transcript(text,text,text,jsonb)') f")).rows[0].f,null);
 }finally{await db.close();}
});

test('saveCallTranscript: needs the switch, a conversation id and a transcript; the case of the call; never throws',async()=>{
 const env={VOICE_INTAKE:'test-only',SUPABASE_URL:'https://mojnqizbcaczstguikpv.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_x',INTAKE_ACCOUNT_EMAIL:'i@x.invalid',INTAKE_ACCOUNT_PASSWORD:'p',ISOLATED_APPROVAL_ATTESTATION_KEY:KEY};
 const calls=[];const fetchImpl=async(url,o)=>{calls.push({url:String(url),body:o?.body});return String(url).includes('/auth/')?new Response(JSON.stringify({access_token:'t'})):new Response('{"changed":true}');};
 assert.equal(await saveCallTranscript({env:{...env,VOICE_INTAKE:''},fetchImpl,args:{conversation_id:'conv_abc123',conversation_history:history(1)}}),false);
 assert.equal(await saveCallTranscript({env,fetchImpl,args:{conversation_history:history(1)}}),false);
 assert.equal(calls.length,0);
 assert.equal(await saveCallTranscript({env,fetchImpl,args:{conversation_id:'conv_abc123',conversation_history:history(1)}}),true);
 const rpc=calls.find(c=>c.url.endsWith('/rpc/sc_intake_phone_transcript'));const b=JSON.parse(rpc.body);
 const {createHash}=await import('node:crypto');
 assert.equal(b.p_case,'tm-'+createHash('sha256').update('phone:voice_conv_abc123').digest('hex').slice(0,24),'same case id as at the booking');
 assert.equal(JSON.parse(b.p_text).lines.length,4);
 // Owner's call 11-27 15:37: the answer to the last question is in the transcript too (a promise, as in voice-turn).
 calls.length=0;
 assert.equal(await saveCallTranscript({env,fetchImpl,args:{conversation_id:'conv_abc123',conversation_history:history(1)},reply:Promise.resolve('Egy napijegy ára …')}),true);
 const l2=JSON.parse(JSON.parse(calls.find(c=>c.url.endsWith('/rpc/sc_intake_phone_transcript')).body).p_text).lines;
 assert.equal(l2.length,5);assert.deepEqual(l2.at(-1),{role:'agent',text:'Egy napijegy ára …'});
 assert.equal(await saveCallTranscript({env,fetchImpl:async()=>{throw Error('net');},args:{conversation_id:'conv_abc123',conversation_history:history(1)}}),false);
});
