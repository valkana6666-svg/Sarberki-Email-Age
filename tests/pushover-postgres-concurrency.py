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
assert sql("SET ROLE service_role; SELECT public.sc_pushover_mark_unknown('"+cid+"');").splitlines()[-1]=='t'
assert claim(0)['status']=='duplicate'
assert sql("SET ROLE service_role; SELECT public.sc_pushover_mark_sent('"+cid+"','synthetic-ack');").splitlines()[-1]=='f'
for role in ['anon','authenticated']:
    try: sql('SET ROLE '+role+'; SELECT public.sc_pushover_claim_once('+a+');')
    except subprocess.CalledProcessError: pass
    else: raise AssertionError(role+' acquired claim')
assert sql('SELECT count(*) FROM public.sc_pushover_delivery_claims;')=='1'
print('PASS: 12 independent PostgreSQL connections, one claim, eleven duplicates; unknown blocks retry; browser RPC denied')
