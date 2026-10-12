-- New isolated DB only. No installation on a managed/original project.
begin;
do $$begin if current_database()<>'sc_approval_test' then raise exception 'isolated database required';end if;end$$;
create or replace function public.sc_isolated_identity() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('database',current_database(),
 'syntheticOnly',not exists(select 1 from public.sc_tenants where not test_only or tenant_id not in ('sarberki-test','demo-test'))
  and not exists(select 1 from public.sc_cases where coalesce(data->>'sender','') !~ '^[^@[:space:]]+@[^@[:space:]]+\.invalid$'),
 'approvalInstalled',to_regprocedure('public.sc_approve_case(text,text,bigint,text,jsonb)') is not null,
 'attestationFingerprint',(select encode(sha256(convert_to(key_hex,'UTF8')),'hex') from public.sc_isolated_approval_key where singleton=true));
$$;
revoke all on function public.sc_isolated_identity() from public,authenticated;
grant execute on function public.sc_isolated_identity() to anon;
commit;
