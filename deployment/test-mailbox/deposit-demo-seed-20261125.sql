-- TEST only – owner 2026-11-25 („Létre kell hozni tesztfoglalásokat, amiket rövid időn belül tudunk tesztelni ezeknek a
-- foglalókkal kapcsolatban”): four FICTIONAL deposit test bookings for the finance view, the deposit Pushover alerts and
-- the guest reminders. Copies of the newest finalized test-mailbox case (fictional data, test sender) with their own
-- ids, names, deadlines and a NON-Previo reference (DEMO-n) – so no button on them can write to Previo (the Previo
-- confirm/modify paths need a V2-n reference), and the option-expiry job (Previo SC options) never sees them.
-- No Previo call, no e-mail. Deadlines (Budapest time):
--   1 Lejárt          2026-11-25 09:00  → "Lejárt" group
--   2 Ma lejár        2026-11-26 18:00  → Pushover 11-26 08:00 ("ma lejár"); guest reminder 1 now, 2 on 11-26
--   3 Két nap múlva   2026-11-28 20:00  → Pushover 11-26 08:00 ("2 nap múlva") and 11-28 08:00
--   4 Várakozó        2026-12-05 20:00  → "Várakozó" group
-- Rollback: deposit-demo-seed-20261125-rollback.sql (deletes exactly these four).
begin;
do $$ begin
 if coalesce(current_setting('sarberki.tm_install_project_ref',true),'')!~'^[a-z]{20}$'
 or coalesce(current_setting('sarberki.tm_backup_sha256',true),'')!~'^[a-f0-9]{64}$' then
  raise exception 'verified project and fresh backup required';
 end if;
end $$;
do $$ declare tpl record; src record; n int; v jsonb; b jsonb; id text;
 seeds constant jsonb:='[
  {"n":1,"name":"Teszt Foglaló Lejárt","deadline":"2026-11-25T08:00:00Z"},
  {"n":2,"name":"Teszt Foglaló Ma","deadline":"2026-11-26T17:00:00Z"},
  {"n":3,"name":"Teszt Foglaló Kétnap","deadline":"2026-11-28T19:00:00Z"},
  {"n":4,"name":"Teszt Foglaló Várakozó","deadline":"2026-12-05T19:00:00Z"}]';
 s jsonb;
begin
 select c.* into tpl from public.sc_cases c join public.sc_test_mailbox_cases t on t.tenant_id=c.tenant_id and t.case_id=c.case_id
  where c.tenant_id='sarberki-test' and c.data->'booking'->>'status'='finalized' and c.data->'booking'->'deposit'->>'amount' is not null
   and c.case_id not like 'tm-dee000000000000%'
  order by c.updated_at desc limit 1;
 if tpl.case_id is null then raise exception 'no finalized test-mailbox case to copy'; end if;
 select * into src from public.sc_test_mailbox_cases where tenant_id='sarberki-test' and case_id=tpl.case_id;
 for s in select * from jsonb_array_elements(seeds) loop
  n:=(s->>'n')::int; id:='tm-dee000000000000'||n;
  if exists(select 1 from public.sc_cases where tenant_id='sarberki-test' and case_id=id) then continue; end if;
  b:=(tpl.data->'booking')-'depositReminder'-'depositReminderFinal'-'depositReceived';
  b:=jsonb_set(b,'{status}','"finalized"');
  b:=jsonb_set(b,'{deposit,deadlineUtc}',to_jsonb(s->>'deadline'));
  b:=jsonb_set(b,'{previo}',coalesce(b->'previo','{}'::jsonb)||jsonb_build_object('reference','DEMO-'||n,'recordedAt',to_jsonb(now())));
  v:=jsonb_set(tpl.data,'{id}',to_jsonb(id));
  v:=jsonb_set(v,'{booking}',b);
  v:=jsonb_set(v,'{state,values,name}',to_jsonb(s->>'name'));
  v:=jsonb_set(v,'{demoSeed}',jsonb_build_object('owner','2026-11-25','source',tpl.case_id));
  if (v->'booking'->'previo'->>'reference')~'^V2-' then raise exception 'seed must never carry a Previo V2 reference'; end if;
  insert into public.sc_cases(tenant_id,case_id,revision,data,updated_by) values('sarberki-test',id,1,v,tpl.updated_by);
  insert into public.sc_test_mailbox_cases(tenant_id,case_id,mailbox_id,message_id,body_sha256,created_by)
   values('sarberki-test',id,src.mailbox_id,'demo-seed-20261125-'||n,src.body_sha256,src.created_by);
 end loop;
end $$;
commit;
