// Temporary owner-operated probe. Closed by default; never enables booking-cases.
import { createServerCaseService } from '../../shared-core/server-case-service.mjs';
import { randomUUID } from 'node:crypto';
import { createSupabaseTransport, createSupabaseAuthority, createSupabaseCaseRepository } from '../../shared-core/supabase-case-repository.mjs';
const origin = 'https://leafy-chimera-2403e5.netlify.app';
const project = 'https://mojnqizbcaczstguikpv.supabase.co';
const emails = ['writer@sarberki-test.invalid','reader@sarberki-test.invalid','operator@demo-test.invalid'];
const headers = {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'same-origin','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"};
const reply = (statusCode, body) => ({statusCode,headers,body});
export function createHandler({env=process.env, fetchImpl=fetch, now=Date.now}={}) {
 return async event => {
  const until = Date.parse(env.SUPABASE_AUTH_TEST_UNTIL || '');
  if(env.CASE_STORE_ENABLED !== 'disabled' || env.URL !== origin || env.SUPABASE_URL !== project || !env.SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')) return reply(404,'Tesztútvonal kikapcsolva.');
  if(!Number.isFinite(until) || until <= now() || until-now()>86400000) return reply(404,'Tesztútvonal kikapcsolva. Szerveroldali konfiguráció ellenőrizve.');
  if(event.httpMethod === 'GET') return reply(200,`<!doctype html><html lang="hu"><meta charset="utf-8"><title>Sárberki ideiglenes Auth-próba</title><h1>Szintetikus Supabase Auth-próba</h1><p>A jelszavak csak a Netlify szerver és a megadott Supabase-projekt memóriájában használhatók. Token nem kerül a böngészőbe. Három új szintetikus ügy megmarad a mentési próbához.</p><form method="post">${emails.map((email,i)=>`<p><label>${email}<input type="password" name="password${i}" autocomplete="current-password" required maxlength="256"></label></p>`).join('')}<button type="submit">Auth, RLS és CAS teszt indítása</button></form></html>`);
  if(event.httpMethod !== 'POST') return reply(405,'Nem támogatott művelet.');
  if(event.headers?.origin !== origin || !(event.headers?.['content-type'] || '').startsWith('application/x-www-form-urlencoded') || event.isBase64Encoded || Buffer.byteLength(event.body || '')>8192) return reply(400,'Érvénytelen kérés.');
  const form = new URLSearchParams(event.body);
  if([...form.keys()].length!==3 || emails.some((_,i)=>form.getAll(`password${i}`).length!==1 || !form.get(`password${i}`) || form.get(`password${i}`).length>256)) return reply(400,'Érvénytelen kérés.');
  const tokens=[]; const refreshTokens=[]; const checks=[];
  const check=(name,pass)=>{checks.push({name,pass:pass===true}); if(!pass)throw new Error('CHECK_FAILED');};
  const raw=async(path,token,method='GET',body)=>fetchImpl(project+path,{method,redirect:'error',signal:AbortSignal.timeout(10000),headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,...(token?{Authorization:`Bearer ${token}`} : {}),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  try {
   for(const i of [0,0,1,2]) {
    const response=await raw('/auth/v1/token?grant_type=password',null,'POST',{email:emails[i],password:form.get(`password${i}`)});
    if(!response.ok)throw new Error('AUTH_FAILED');
    const data=await response.json(); if(!data.access_token || !data.refresh_token || data.user?.email!==emails[i])throw new Error('AUTH_FAILED'); tokens.push(data.access_token); refreshTokens.push(data.refresh_token);
   }
   const ts=tokens.map(token=>createSupabaseTransport({url:project,publishableKey:env.SUPABASE_PUBLISHABLE_KEY,token,fetchImpl}));
   const identities=await Promise.all(ts.map(t=>createSupabaseAuthority(t)()));
   check('Négy valódi Auth-munkamenet; két külön író token',tokens[0]!==tokens[1] && identities[0].subject===identities[1].subject && new Set(identities.map(i=>i.subject)).size===3);
   check('Elkülönített read/write/approve jogosultságok',JSON.stringify(identities[0].tenants['sarberki-test'])==='["read","write"]' && JSON.stringify(identities[2].tenants['sarberki-test'])==='["read"]' && JSON.stringify(identities[3].tenants['demo-test'])==='["read","write"]' && Object.keys(identities[0].tenants).length===1 && Object.keys(identities[3].tenants).length===1);
   check('Hiányzó Auth token elutasítása',!(await raw('/auth/v1/user')).ok);
   check('Hamis Auth token elutasítása',!(await raw('/auth/v1/user','invalid.test.token')).ok);
   const repos=ts.map(createSupabaseCaseRepository), id='auth_probe_'+randomUUID().replaceAll('-','');
   const data={id,tenantId:'sarberki-test',sender:'probe@synthetic.invalid',state:{values:{},approval:'pending'},messages:[{mailbox_id:'probe',message_id:id,body:'Kitalált tesztüzenet.'}],drafts:[]};
   check('Író operátor új szintetikus ügyet ír',await repos[0].insert('sarberki-test',id,{data}));
   check('Olvasó operátor ügyet olvas',!!await repos[2].get('sarberki-test',id));
   const denied=async(fn)=>{try{await fn();return false;}catch(error){return error.code==='FORBIDDEN';}};
   const rpcRejected=async(payload,revision,code)=>{
    const response=await raw('/rest/v1/rpc/sc_write_case',tokens[0],'POST',{p_tenant:'sarberki-test',p_case:payload.id,p_expected:revision,p_data:payload});
    if(response.ok||![400,403,409].includes(response.status))return false;
    return (await response.json()).code===code;
   };
   const readerService=createServerCaseService({repository:repos[2],resolveAuthority:createSupabaseAuthority(ts[2])});
   check('Hamisított kliensszerepkör nem ad írásjogot',await denied(()=>readerService.createCase({requestContext:{userId:identities[0].subject,role:'admin'},tenantId:'sarberki-test',bookingCase:{...data,id:id+'_spoof'}})));
   check('Végleges jóváhagyás tiltva',await denied(()=>readerService.requireApproval({tenantId:'sarberki-test',requestContext:{role:'admin'}})));
   check('Olvasó RPC írásának tiltása',await denied(()=>repos[2].compareAndSwap('sarberki-test',id,1,{data})));
   check('Második tenant nem olvashatja az első ügyét',await repos[3].get('sarberki-test',id)===null);
   check('Második tenant nem írhat az elsőbe',await denied(()=>repos[3].compareAndSwap('sarberki-test',id,1,{data})));
   check('Közvetlen táblaírás tiltása',!(await raw('/rest/v1/sc_cases',tokens[0],'POST',{tenant_id:'sarberki-test',case_id:id,revision:1,data,updated_by:identities[0].subject})).ok);
   check('Önkiszolgáló tagságmódosítás tiltása',!(await raw('/rest/v1/sc_memberships?user_id=eq.'+identities[2].subject,tokens[2],'PATCH',{can_write:true})).ok);
   const race=await Promise.all([0,1].map(i=>repos[i].compareAndSwap('sarberki-test',id,1,{data:{...data,state:{values:{operator:i},approval:'pending'}}})));
   check('Két valódi munkamenet: pontosan egy CAS-siker',race.filter(Boolean).length===1);
   const current=await repos[0].get('sarberki-test',id);
   check('CAS után revision=2',current.revision===2);
   check('Korábbi üzenet felülírásának tiltása',await rpcRejected({...current.data,messages:[]},2,'22023'));
   check('Új belső tervezetverzió hozzáfűzése',await repos[0].compareAndSwap('sarberki-test',id,2,{data:{...current.data,drafts:[{text:'Kitalált belső tervezet.',at:new Date(now()).toISOString(),revision:2}]}}));
   const drafted=await repos[0].get('sarberki-test',id);
   check('Korábbi tervezet felülírásának tiltása',await rpcRejected({...drafted.data,drafts:[{...drafted.data.drafts[0],text:'Felülírás'}]},3,'22023'));
   check('Korábbi tervezet törlésének tiltása',await rpcRejected({...drafted.data,drafts:[]},3,'22023'));
   for(let revision=3;revision<6;revision++) {
    const snapshot=await repos[0].get('sarberki-test',id);
    const competing=await Promise.all([0,1].map(i=>repos[i].compareAndSwap('sarberki-test',id,revision,{data:{...snapshot.data,state:{...snapshot.data.state,values:{operator:i,round:revision}}}})));
    check('Ismételt kétmunkamenetes CAS: '+revision,competing.filter(Boolean).length===1);
   }
   const mailboxId=id+'_mailbox';
   check('Azonos üzenetazonosító másik mailboxban engedélyezett',await repos[0].insert('sarberki-test',mailboxId,{data:{...data,id:mailboxId,messages:[{...data.messages[0],mailbox_id:'probe_other'}]}}));
   const duplicateId=id+'_duplicate';
   check('Mailbox/message duplikáció elutasítása',await rpcRejected({...data,id:duplicateId},0,'23505'));
   check('Hibás tranzakció rollbackje',await repos[0].get('sarberki-test',duplicateId)===null);
   const audit=await ts[0]('/rest/v1/sc_audit?select=revision,actor,kind,data_hash&tenant_id=eq.sarberki-test&case_id=eq.'+id+'&order=revision.asc');
   check('Hat következetes auditbejegyzés',audit.length===6 && audit.every((a,i)=>a.revision===i+1 && a.actor===identities[0].subject && /^[a-f0-9]{64}$/.test(a.data_hash)) && audit[0].kind==='insert' && audit.slice(1).every(a=>a.kind==='update'));
   const demo={...data,id:id+'_demo',tenantId:'demo-test'};
   check('Második tenant saját ügyet ír',await repos[3].insert('demo-test',demo.id,{data:demo}));
   check('Első tenant nem olvashatja a második ügyét',await repos[0].get('demo-test',demo.id)===null);
  } catch { checks.push({name:'Futás befejezése',pass:false}); }
  finally {
   for(let i=0;i<tokens.length;i++){
    try {
     check('Tesztmunkamenet refresh-token visszavonása',(await raw('/auth/v1/logout?scope=local',tokens[i],'POST',{})).ok);
     const reuse=await raw('/auth/v1/token?grant_type=refresh_token',null,'POST',{refresh_token:refreshTokens[i]});
     // A network failure / 5xx is not proof that Auth rejected a revoked credential.
     if(reuse.ok){const unexpected=await reuse.json();if(unexpected.access_token)await raw('/auth/v1/logout?scope=local',unexpected.access_token,'POST',{});}
     const rejection=reuse.ok?null:await reuse.json();
     check('Visszavont refresh token újrafelhasználásának elutasítása',[400,401].includes(reuse.status) && ['refresh_token_not_found','refresh_token_already_used','session_not_found','session_expired'].includes(rejection?.error_code||rejection?.code));
    }catch{checks.push({name:'Munkamenet lezárása vagy visszavonásellenőrzése',pass:false});}
   }
   form.forEach((_,key)=>form.set(key,'')); tokens.fill(''); refreshTokens.fill('');
  }
  return reply(checks.length && checks.every(c=>c.pass)?200:422,`<!doctype html><html lang="hu"><meta charset="utf-8"><title>Auth-teszt eredmény</title><h1>Auth-teszt eredmény</h1><p>Az ügy-API továbbra is disabled. Az access JWT a lejáratig érvényes maradhat; nem került a klienshez.</p><ul>${checks.map(c=>`<li>${c.pass?'PASS':'FAIL'} — ${c.name}</li>`).join('')}</ul></html>`);
 };
}
export const handler=createHandler();
