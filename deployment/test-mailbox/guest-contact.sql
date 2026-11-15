-- Owner 2026-11-14/15: the guest's name is required before a V2 booking (Previo contact + voucher); a chat/phone
-- request may lack it (or an e-mail). sc_tm_set_guest_contact lets a Writer complete the name and/or e-mail of a
-- test-mailbox case that is not booked yet (CAS revision, audit 'tm_guest_contact'). Drafts and approval are left
-- unchanged; the booking letter built later uses the stored name. Rollback: guest-contact-rollback.sql.
begin;
do $$ begin
 if coalesce(current_setting('sarberki.tm_install_project_ref',true),'')!~'^[a-z]{20}$'
 or coalesce(current_setting('sarberki.tm_backup_sha256',true),'')!~'^[a-f0-9]{64}$'
 or to_regprocedure('public.sc_tm_actor(text,text)') is null
 or to_regclass('public.sc_test_mailbox_cases') is null
 or not exists(select 1 from public.sc_cloud_approval_binding where singleton and project_ref=current_setting('sarberki.tm_install_project_ref')) then
  raise exception 'verified project, fresh backup and test-mailbox install required';
 end if;
end $$;

create or replace function public.sc_tm_set_guest_contact(p_tenant text,p_case text,p_expected bigint,p_name text,p_email text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; c public.sc_cases%rowtype; result public.sc_cases%rowtype; changed jsonb; n text:=btrim(coalesce(p_name,'')); e text:=lower(btrim(coalesce(p_email,'')));
begin
 actor:=public.sc_tm_actor(p_tenant,'write');
 if p_expected is null or p_expected<1 or (n='' and e='')
 or (n<>'' and (length(n)>80 or n!~'^[[:alpha:]][[:alpha:] .''-]{0,79}$'))
 or (e<>'' and (length(e)>254 or e!~'^[^[:space:]@<>"(),;:]{1,64}@[^[:space:]@<>"(),;:]{1,190}\.[a-z]{2,}$')) then
  raise exception 'invalid guest contact' using errcode='22023';
 end if;
 select * into c from public.sc_cases where tenant_id=p_tenant and case_id=p_case and revision=p_expected for update;
 if not found then return null; end if;
 if not exists(select 1 from public.sc_test_mailbox_cases where tenant_id=p_tenant and case_id=p_case) then
  raise exception 'test-mailbox case required' using errcode='42501';
 end if;
 if coalesce(c.data->'booking'->>'status','') in ('finalized','deposit_received') then
  raise exception 'booked case: contact is fixed' using errcode='22023';
 end if;
 changed:=c.data;
 if n<>'' then changed:=jsonb_set(changed,'{state,values,name}',to_jsonb(n)); end if;
 if e<>'' then changed:=jsonb_set(changed,'{state,values,email}',to_jsonb(e)); end if;
 update public.sc_cases set revision=p_expected+1,data=changed,updated_at=now(),updated_by=actor
  where tenant_id=p_tenant and case_id=p_case and revision=p_expected returning * into result;
 insert into public.sc_audit(tenant_id,case_id,revision,actor,kind,data_hash) values(p_tenant,p_case,p_expected+1,actor,'tm_guest_contact',encode(sha256(convert_to(changed::text,'UTF8')),'hex'));
 return to_jsonb(result);
end $$;

revoke all on function public.sc_tm_set_guest_contact(text,text,bigint,text,text) from public,anon;
grant execute on function public.sc_tm_set_guest_contact(text,text,bigint,text,text) to authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  execute 'revoke all on function public.sc_tm_set_guest_contact(text,text,bigint,text,text) from service_role';
 end if;
end $$;
commit;
