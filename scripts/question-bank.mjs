// Owner 2026-11-27 („a nagy kérdésgyűjteményt készítsd el és futtasd is le”): the everyday single questions a guest
// asks, in HU/DE/EN/SI, several phrasings each (typos, no accents, short forms). Every question has an expectation on
// the ANSWER (the fact it must contain), not on the internal route. Fictional data only; nothing is submitted.
//
//  engine – in-process chat engine (no network): the deterministic answer, or „AI” when the question goes to the
//           fact-bound model (the generic „cannot answer” sentence).
//  live   – the deployed TEST chatbot page in a headless browser (real chat-offer + chat-assist); the request form is
//           never submitted (intake endpoints blocked and counted).
// Usage: node scripts/question-bank.mjs engine [out.json]
//        node scripts/question-bank.mjs live <out.json> [from] [to]
//        node scripts/question-bank.mjs report <out.json>
import {createChatInquirySession} from '../sarberki-chatbot-project/chat-session.mjs';
import {writeFileSync,existsSync,readFileSync} from 'node:fs';

const NUM=n=>new RegExp(String(n).replace(/\B(?=(\d{3})+(?!\d))/g,'[  .,]?'));
// kind: 'fact' = the answer must contain the fact; 'info' = a knowledge question – reported (answered / „staff will
// help”), a gap is a missing fact for the owner, not a program error.
export const BANK=[
 {id:'price-deluxe',kind:'fact',expect:[NUM(63000)],q:{
  hu:['Mennyibe kerül a Deluxe faház?','mennyibe kerul a delux fahaz','Mennyi a deluxe ház ára egy éjszakára?','Deluxe ház ár?','Mibe kerül egy éj a deluxe házban?'],
  de:['Was kostet das Deluxe Haus?','Preis Deluxe Haus pro Nacht?','Wie teuer ist das Deluxe-Haus?'],
  en:['How much is the deluxe cabin?','Deluxe cabin price per night?','What does the deluxe house cost?'],
  si:['Koliko stane deluxe hiška?','Cena deluxe hiške na noč?','Kakšna je cena za deluxe hišo?']}},
 {id:'price-vip',kind:'fact',expect:[NUM(63000)],q:{hu:['Mennyibe kerül a VIP ház?','vip faház ára?'],de:['Was kostet das VIP Haus?'],en:['How much is the VIP cabin?'],si:['Koliko stane VIP hiška?']}},
 {id:'price-family',kind:'fact',expect:[NUM(55000)],q:{hu:['Mennyibe kerül a családi faház?','csaladi haz ara'],de:['Was kostet das Familienhaus?'],en:['How much is the family cabin?'],si:['Koliko stane družinska hiška?']}},
 {id:'price-apartment',kind:'fact',expect:[NUM(24000)],q:{hu:['Mennyibe kerül az apartman?','Mennyi egy apartman egy éjszakára?'],de:['Was kostet die Wohnung?','Was kostet ein Apartment?'],en:['How much is the apartment?'],si:['Koliko stane apartma?']}},
 {id:'price-all',kind:'fact',expect:[NUM(55000),NUM(63000)],q:{
  hu:['Mennyibe kerülnek a faházak?','Mik az árak?','Milyen áron vannak a házak?','Mennyibe kerül nálatok a szállás?'],
  de:['Was kosten die Ferienhäuser?','Wie sind Ihre Preise?'],en:['How much are the cabins?','What are your prices?'],si:['Koliko stanejo hiške?','Kakšne so cene?']}},
 {id:'capacity-max',kind:'fact',expect:[/\b8\b|nyolc|acht|eight|osem/i],q:{
  hu:['Hány fős a legnagyobb ház?','Hányan férünk el maximum egy házban?','Mekkora a legnagyobb faház?'],de:['Wie viele Personen passen maximal in ein Haus?'],en:['How many people fit in the biggest cabin?'],si:['Koliko oseb lahko največ spi v eni hiški?']}},
 {id:'hottub-price',kind:'fact',expect:[NUM(30000)],q:{hu:['Mennyibe kerül a dézsa?','dezsa ara?','Van dézsa? Mennyi?'],de:['Was kostet der Badezuber?'],en:['How much is the hot tub?'],si:['Koliko stane masažna kad?']}},
 {id:'ticket-price',kind:'fact',expect:[NUM(7500)],q:{hu:['Mennyibe kerül a horgászjegy?','Mennyi a napijegy a normál tóra?','horgaszjegy ara'],de:['Was kostet die Angelkarte?'],en:['How much is a fishing ticket?'],si:['Koliko stane ribiška karta?']}},
 {id:'checkin',kind:'fact',expect:[/14/],q:{hu:['Hánytól lehet érkezni?','Mikor lehet elfoglalni a szállást?','Hány órától van a bejelentkezés?'],de:['Ab wann ist Check-in?'],en:['What time is check-in?'],si:['Od kdaj je prijava?']}},
 {id:'checkout',kind:'fact',expect:[/\b10\b|tíz|zehn|ten\b|deset/i],q:{hu:['Meddig kell elhagyni a házat?','Mikor kell kijelentkezni?','Hány óráig kell távozni?'],de:['Bis wann ist Check-out?'],en:['What time is check-out?'],si:['Do kdaj je odjava?']}},
 {id:'pet',kind:'fact',expect:[NUM(2000)],q:{hu:['Hozhatom a kutyámat?','Lehet kutyát vinni?','Háziállat megengedett?'],de:['Darf ich meinen Hund mitbringen?'],en:['Can I bring my dog?'],si:['Lahko pripeljem psa?']}},
 {id:'deposit',kind:'fact',expect:[/50\s?%|ötven százal|50 Prozent|50 percent|50 odstot/i],q:{hu:['Mennyi a foglaló?','Mennyi előleget kell fizetni?','Kell foglalót fizetni?'],de:['Wie hoch ist die Anzahlung?'],en:['How much is the deposit?'],si:['Koliko je predplačilo?']}},
 {id:'cancellation',kind:'fact',expect:[/14|tizennégy|vierzehn|fourteen|štirinajst/i],q:{hu:['Mi a lemondási feltétel?','Ha le kell mondanom, mi történik a foglalóval?','Ingyenes a lemondás?'],de:['Wie sind die Stornobedingungen?'],en:['What is the cancellation policy?'],si:['Kakšni so pogoji odpovedi?']}},
 {id:'how-to-book',kind:'fact',expect:[/dátum|datum|date|Anreise|Abreise|arrival|prihod/i],q:{hu:['Hogyan tudok foglalni?','Szeretnék foglalni','Hogy lehet lefoglalni egy házat?'],de:['Wie kann ich buchen?'],en:['How can I book?'],si:['Kako lahko rezerviram?']}},
 {id:'availability-nodate',kind:'fact',expect:[/dátum|érkez|Anreise|Datum|arrival|date|prihod/i],q:{hu:['Van szabad hely?','Van még szabad ház hétvégén?'],de:['Haben Sie noch etwas frei?'],en:['Do you have availability?'],si:['Imate še prosto?']}},
 {id:'parking',kind:'info',q:{hu:['Van parkoló?'],de:['Gibt es Parkplätze?'],en:['Is there parking?'],si:['Ali je parkirišče?']}},
 {id:'wifi',kind:'info',q:{hu:['Van wifi?'],de:['Gibt es WLAN?'],en:['Is there wifi?'],si:['Ali je wifi?']}},
 {id:'food',kind:'info',q:{hu:['Van reggeli vagy étterem?'],de:['Gibt es Frühstück oder ein Restaurant?'],en:['Is there breakfast or a restaurant?'],si:['Ali imate zajtrk ali restavracijo?']}},
 {id:'payment-card',kind:'info',q:{hu:['Lehet kártyával fizetni?'],de:['Kann man mit Karte zahlen?'],en:['Can I pay by card?'],si:['Lahko plačam s kartico?']}},
 {id:'grill',kind:'info',q:{hu:['Van grillezési lehetőség?'],de:['Kann man grillen?'],en:['Can we barbecue?'],si:['Ali lahko žarimo?']}},
 {id:'location',kind:'info',q:{hu:['Hol vagytok pontosan?'],de:['Wo genau sind Sie?'],en:['Where exactly are you?'],si:['Kje točno ste?']}},
];
const GENERIC=/nem tudom hitelesen megválaszolni|keine verlässlich bestätigten|cannot reliably confirm|ne morem zanesljivo potrditi/i;
const CABIN_LIST=/típusok találhatók nálunk|Haustypen|cabin types|tipi hišk/i;

export function questions(){return BANK.flatMap(t=>Object.entries(t.q).flatMap(([lang,qs])=>qs.map((text,i)=>({id:`${t.id}-${lang}-${i+1}`,topic:t.id,kind:t.kind,expect:t.expect||[],lang,text}))));}
export function judge(q,answer,{viaModel=false}={}){
 const a=String(answer||'');
 if(!a.trim())return {status:'FAIL',why:'nincs válasz'};
 if(q.kind==='info')return GENERIC.test(a)?{status:'GAP',why:'nincs jóváhagyott tény – munkatárshoz küldi'}:{status:'PASS',why:viaModel?'AI válaszolt':'szabályalapú'};
 if(CABIN_LIST.test(a)&&!q.expect.some(r=>r.test(a)))return {status:'FAIL',why:'általános háztípus-lista'};
 if(GENERIC.test(a)&&!viaModel)return {status:'AI',why:'a szabályalapú rész nem tudja – AI-ra megy'};
 const miss=q.expect.filter(r=>!r.test(a));
 return miss.length?{status:'FAIL',why:'hiányzik: '+miss.map(String).join(', ')}:{status:'PASS',why:viaModel?'AI válaszolt':'szabályalapú'};
}
export function runEngine(qs){
 return qs.map(q=>{const s=createChatInquirySession({language:q.lang,clock:()=>new Date('2026-11-27T10:00:00Z')});const r=s.reply(q.text);
  return {...q,expect:undefined,answer:r.text,...judge(q,r.text)};});
}
export async function runLive(qs,{out,from=0,to=qs.length,origin='https://leafy-chimera-2403e5.netlify.app'}={}){
 const {chromium}=await import('playwright');
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',proxy:process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY}:undefined});
 const results=existsSync(out)?JSON.parse(readFileSync(out,'utf8')):{};
 const ctx=await b.newContext();let intake=0;
 await ctx.route(/\/\.netlify\/functions\/(?:chat-)?intake|\/api\/(?:chat-)?intake/,route=>{intake++;return route.abort();});
 for(const q of qs.slice(from,to)){
  if(results[q.id]?.done)continue;
  const p=await ctx.newPage();let assist=0,assistDone=0;
  p.on('request',r=>{if(r.url().endsWith('/chat-assist'))assist++;});p.on('response',r=>{if(r.url().endsWith('/chat-assist'))assistDone++;});
  await p.goto(origin+'/sarberki-chatbot-project/');await p.waitForSelector('[data-chat-input]');
  const n0=await p.locator('[data-chat-log] .entry').count();
  await p.fill('[data-chat-input]',q.text);await p.click('[data-chat-form] [type=submit]');
  await p.waitForFunction(n=>document.querySelectorAll('[data-chat-log] .entry').length>=n+2,n0,{timeout:10000}).catch(()=>{});
  const t0=Date.now();while(Date.now()-t0<12000){await p.waitForTimeout(400);if(assist&&assistDone>=assist){await p.waitForTimeout(500);break;}if(!assist&&Date.now()-t0>2500)break;}
  const entries=await p.locator('[data-chat-log] .entry').allInnerTexts();
  const answer=entries.slice(n0+1).map(e=>e.replace(/^Sárberki\n/,'')).filter(e=>!e.startsWith('Vendég / Guest')).join('\n---\n').split(/\n?Magyar kezelői ellenőrző szöveg/)[0];
  results[q.id]={id:q.id,topic:q.topic,kind:q.kind,lang:q.lang,text:q.text,answer,assist,done:true};
  writeFileSync(out,JSON.stringify(results,null,1));
  await p.close();
 }
 await b.close();console.log('intake blocked',intake);return results;
}
export function summarize(rows){
 const by={};for(const r of rows){(by[r.topic]??={PASS:0,AI:0,GAP:0,FAIL:0,n:0});by[r.topic][r.status]++;by[r.topic].n++;}
 return by;
}
if(import.meta.url===`file://${process.argv[1]}`){
 const [mode='engine',out,from,to]=process.argv.slice(2),qs=questions();
 if(mode==='engine'){
  const res=runEngine(qs);if(out)writeFileSync(out,JSON.stringify(res,null,1));
  const s=summarize(res);console.log('kérdés',res.length);for(const [t,v] of Object.entries(s))console.log(t.padEnd(20),JSON.stringify(v));
  for(const r of res.filter(r=>r.status==='FAIL'))console.log('❌',r.id,'|',r.text,'|',r.why,'|',r.answer.slice(0,90).replace(/\n/g,' '));
 }else if(mode==='live'){await runLive(qs,{out,from:Number(from||0),to:Number(to||qs.length)});}
 else if(mode==='report'){
  const live=JSON.parse(readFileSync(out,'utf8')),byId=Object.fromEntries(qs.map(q=>[q.id,q]));
  const res=Object.values(live).map(r=>({...r,...judge(byId[r.id],r.answer,{viaModel:r.assist>0})}));
  const s=summarize(res);console.log('kérdés',res.length);for(const [t,v] of Object.entries(s))console.log(t.padEnd(20),JSON.stringify(v));
  for(const r of res.filter(r=>r.status!=='PASS'))console.log(r.status==='GAP'?'◻':'❌',r.id,'|',r.text,'|',r.why,'|',r.answer.slice(0,120).replace(/\n/g,' '));
 }
}
