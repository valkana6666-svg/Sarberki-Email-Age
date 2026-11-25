// Owner 2026-11-25 (#9 7159099524): the finance view. Same sign-in, same protected list (daily-list), same
// permissions as the daily view; read-only here. The deposit is marked received in the daily view (existing,
// server-checked human step) – each row links there. A probable Previo payment is a suggestion only.
import {createOperatorSession} from '../sarberki-chatbot-project/operator-session.mjs';
import {createCloudCaseRequest} from '../shared-core/cloud-case-request.mjs';
import {createEpochRequestQueue} from '../shared-core/epoch-request-queue.mjs';
import {GROUPS,GROUP_ORDER,financeRows,financeTotals,financeRowText,huf} from './penzugy-view.mjs';

const TEST_ORIGIN='https://leafy-chimera-2403e5.netlify.app';
const KNOWN_TENANTS=['sarberki-test','sarberki-live'];
let TENANT='sarberki-test',authenticated=false,epoch=0,rows=[],group='all',query='';
const el=id=>document.getElementById(id);
const session=createOperatorSession();
const request=createEpochRequestQueue({getEpoch:()=>epoch,isAuthenticated:()=>authenticated,prepare:()=>session.restore(),execute:createCloudCaseRequest()});
const remember=meta=>{if(KNOWN_TENANTS.includes(meta?.tenantId))TENANT=meta.tenantId;return meta;};
const linked=(()=>{try{const c=new URLSearchParams(location.search).get('case');return /^tm-[a-f0-9]{12,32}$/.test(c||'')?c:null;}catch{return null;}})();
const hints=new Map();

function signedIn(value,message){
 authenticated=value;if(!value){epoch++;rows=[];hints.clear();render();}
 el('session-status').textContent=message;el('login').hidden=value;el('logout').hidden=!value;el('reload').disabled=!value;
 document.body.classList.toggle('signed-in',value);
}
function failed(error){
 signedIn(false,error?.message==='FORBIDDEN'?'Ehhez nincs megfelelő jogosultság.':error?.message==='AUTH_REQUIRED'?'A bejelentkezés szükséges vagy lejárt.':'Az adatok most nem ellenőrizhetők. Próbálja újra.');
}

function render(){
 const now=Date.now(),totals=financeTotals(rows,now);
 for(const g of GROUP_ORDER){const b=document.querySelector(`[data-group="${g}"] .number`);if(b)b.textContent=authenticated?`${totals[g].count} db · ${huf(totals[g].amount)}${totals[g].unknownAmount?' + ?':''}`:'–';}
 for(const b of document.querySelectorAll('[data-group]'))b.setAttribute('aria-pressed',String(b.dataset.group===group));
 const list=el('finance-list');list.replaceChildren();
 const shown=financeRows(rows,{now,group,query});
 el('list-status').textContent=!authenticated?'A listához jelentkezzen be.':shown.length?`${shown.length} foglalás`+(group==='all'?'':' – '+GROUPS[group].label):'Nincs ilyen foglalás.';
 for(const {row} of shown){
  const t=financeRowText(row,now),li=document.createElement('li');li.className='fin-row fin-'+t.group;li.id='case-'+row.caseId;
  if(row.caseId===linked)li.classList.add('fin-linked');
  const h=document.createElement('strong');h.textContent=t.title;li.append(h);
  for(const line of t.lines){const p=document.createElement('p');p.textContent=line;li.append(p);}
  const hint=document.createElement('p');hint.className='fin-hint';hint.textContent=hints.get(row.caseId)||'';li.append(hint);
  const a=document.createElement('a');a.className='text-link';a.href='./?case='+encodeURIComponent(row.caseId);
  a.textContent=t.group==='received'||t.group==='cancelled'?'Ügy megnyitása a napi kezelőben ↗':'Megnyitás – „Foglaló beérkezett” a napi kezelőben ↗';li.append(a);
  list.append(li);
 }
 if(linked&&authenticated){const target=document.getElementById('case-'+linked);if(target&&!render.scrolled){render.scrolled=true;target.scrollIntoView({block:'center'});}}
}

// Suggestion only (Previo payments, TEST): asked once per open case, cached by the server for 10 minutes.
async function loadHints(turn){
 for(const {row} of financeRows(rows,{group:'all'}).filter(x=>['overdue','soon','waiting'].includes(x.group)).slice(0,12)){
  try{const r=await request({tenantId:TENANT,caseId:row.caseId,action:'test-mailbox-payment-hint'},'GET');
   if(turn!==epoch||!authenticated)return;
   if(r?.caseId===row.caseId&&typeof r.line==='string'&&r.line){hints.set(row.caseId,r.line);render();}
  }catch(error){if(['AUTH_REQUIRED','FORBIDDEN'].includes(error?.message))return;}
 }
}

async function load(){
 if(!authenticated)return;const turn=++epoch;el('list-status').textContent='Foglalók betöltése…';el('reload').disabled=true;
 try{
  const result=await request({tenantId:TENANT,action:'daily-list'},'GET');if(turn!==epoch)return;
  if(!Array.isArray(result)||result.length>100)throw Error('INVALID_DATA');
  rows=result.filter(r=>r?.tenantId===TENANT&&r.kind==='test-mailbox'&&/^tm-[a-f0-9]{12,32}$/.test(r.caseId)&&r.summary?.finance);
  render();void loadHints(turn);
 }catch(error){if(turn===epoch){if(['AUTH_REQUIRED','FORBIDDEN'].includes(error?.message))failed(error);else el('list-status').textContent='A lista most nem tölthető be. Próbálja újra.';}}
 finally{if(authenticated)el('reload').disabled=false;}
}

for(const b of document.querySelectorAll('[data-group]'))b.addEventListener('click',()=>{group=group===b.dataset.group?'all':b.dataset.group;render();});
el('search').addEventListener('input',()=>{query=el('search').value;render();});
el('reload').addEventListener('click',()=>load());
el('login').addEventListener('submit',async event=>{
 event.preventDefault();
 if(location.origin!==TEST_ORIGIN){signedIn(false,'A kapcsolat csak a kijelölt tesztoldalon használható.');return;}
 const email=el('email').value.trim(),password=el('password').value;el('password').value='';
 signedIn(false,'Bejelentkezés ellenőrzése…');
 try{remember(await session.login(email,password));signedIn(true,'Bejelentkezve.');await load();}catch(error){failed(error);}
});
el('logout').addEventListener('click',async()=>{signedIn(false,'Kijelentkezés…');try{await session.logout();el('session-status').textContent='Kijelentkezve.';}catch{el('session-status').textContent='A kijelentkezés nem ellenőrizhető.';}});
async function resume(){
 if(location.origin!==TEST_ORIGIN){signedIn(false,'A kapcsolat csak a kijelölt tesztoldalon használható.');return;}
 try{remember(await session.restore());signedIn(true,'Bejelentkezve.');await load();}catch{signedIn(false,'Jelentkezzen be (ugyanaz a belépés, mint a napi kezelőben).');}
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&authenticated)void load();});
render();void resume();
