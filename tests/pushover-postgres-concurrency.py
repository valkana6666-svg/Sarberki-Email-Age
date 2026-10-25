import concurrent.futures, os, pathlib, subprocess, json

def sql(q):
    r=subprocess.run(['psql','-X','-v','ON_ERROR_STOP=1','-At','-c',q],capture_output=True,text=True,check=True)
    return r.stdout.strip()
sql('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;')
subprocess.run(['psql','-X','-v','ON_ERROR_STOP=1','-f','supabase/migrations/20261025173000_pushover_delivery_ledger.sql'],check=True)
a="'sarberki-test','sarberkiprojecttest@gmail.com','19abcdef12345','gmail-new-message'"
def claim(_):
    return json.loads(sql('SET ROLE service_role; SELECT public.sc_pushover_claim_once('+a+');').splitlines()[-1])
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
    results=list(pool.map(claim,range(12)))
assert sum(r['status']=='claimed' for r in results)==1,results
assert sum(r['status']=='duplicate' for r in results)==11,results
cid=next(r['claimId'] for r in results if r['status']=='claimed')
for assignment in ["gmail_message_id='19changed12345'", "claim_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'", "created_at=created_at+interval '1 day'"]:
    try: sql("SET ROLE service_role; UPDATE public.sc_pushover_delivery_claims SET "+assignment+" WHERE claim_id='"+cid+"';")
    except subprocess.CalledProcessError: pass
    else: raise AssertionError('sending claim re-keyed: '+assignment)
assert sql("SET ROLE service_role; SELECT public.sc_pushover_mark_unknown('"+cid+"');").splitlines()[-1]=='t'
assert claim(0)['status']=='duplicate'
assert sql("SET ROLE service_role; SELECT public.sc_pushover_mark_sent('"+cid+"','synthetic-ack');").splitlines()[-1]=='f'
for role in ['anon','authenticated']:
    try: sql('SET ROLE '+role+'; SELECT public.sc_pushover_claim_once('+a+');')
    except subprocess.CalledProcessError: pass
    else: raise AssertionError(role+' acquired claim')
assert sql('SELECT count(*) FROM public.sc_pushover_delivery_claims;')=='1'
print('PASS: 12 independent PostgreSQL connections, one claim, eleven duplicates; unknown blocks retry; browser RPC denied')

# New invariant checks: privileged application role cannot re-key or reopen claims.
for assignment in ["gmail_message_id='19changed12345'", "claim_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'", "created_at=created_at+interval '1 day'", "status='sending'", "provider_request_id='rewritten'"]:
    try: sql("SET ROLE service_role; UPDATE public.sc_pushover_delivery_claims SET "+assignment+" WHERE claim_id='"+cid+"';")
    except subprocess.CalledProcessError: pass
    else: raise AssertionError('terminal claim mutated: '+assignment)
assert claim(0)['status']=='duplicate'
assert sql("SELECT status FROM public.sc_pushover_delivery_claims WHERE claim_id='"+cid+"';")=='outcome_unknown'
b="'sarberki-test','sarberkiprojecttest@gmail.com','19sent12345','gmail-new-message'"
sent_id=json.loads(sql('SET ROLE service_role; SELECT public.sc_pushover_claim_once('+b+');').splitlines()[-1])['claimId']
assert sql("SET ROLE service_role; SELECT public.sc_pushover_mark_sent('"+sent_id+"','synthetic-receipt');").splitlines()[-1]=='t'
for assignment in ["status='sending'", "status='outcome_unknown'", "provider_request_id='rewritten'"]:
    try: sql("SET ROLE service_role; UPDATE public.sc_pushover_delivery_claims SET "+assignment+" WHERE claim_id='"+sent_id+"';")
    except subprocess.CalledProcessError: pass
    else: raise AssertionError('sent claim mutated: '+assignment)
assert sql("SELECT provider_request_id FROM public.sc_pushover_delivery_claims WHERE claim_id='"+sent_id+"';")=='synthetic-receipt'
print('PASS: PostgreSQL terminal state and identity mutation denied; successful RPC receipt preserved')
