// Owner 2026-11-25 (#9 7161417452 / 7162176483): 100 natural, multi-turn chatbot conversations – 25 each in HU, DE,
// EN and SI – generated from a seeded phrase bank (typos, missing accents, slang, fragments, several questions at once,
// language switch, changes of dates / party / cabin / hot tub, fishing and services, regular guest, children,
// unsupported questions, hand-over to staff, price re-check). Fictional data only.
//
// Two passes over the SAME conversations:
//  engine  – the shared chat engine in-process (no network): understood facts, no re-asking of known data,
//            reply language, no internal house number, no repeated identical answer.
//  live    – the deployed TEST chatbot page in a headless browser with its real endpoints (chat-offer: Previo TEST
//            read-only capacity + price; chat-assist: the fact-bound model). The request form is NEVER submitted:
//            no intake, no Pushover, no booking, no e-mail.
// Usage: node scripts/chat-language-e2e.mjs engine [out.json]
//        node scripts/chat-language-e2e.mjs live <out.json> [from] [to]
import {createChatInquirySession} from '../sarberki-chatbot-project/chat-session.mjs';
import {replyQuestions,languageFromText} from '../sarberki-core.mjs';
import {writeFileSync,existsSync,readFileSync} from 'node:fs';

export const NOW=new Date('2026-11-25T12:00:00Z');
const LANGS=['hu','de','en','si'];
function rng(seed){let s=seed>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}

const MONTH={hu:['január','február','március','április','május','június','július','augusztus','szeptember','október','november','december'],
 de:['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'],
 en:['January','February','March','April','May','June','July','August','September','October','November','December'],
 si:['januar','februar','marec','april','maj','junij','julij','avgust','september','oktober','november','december']};
const SI_GEN=['januarja','februarja','marca','aprila','maja','junija','julija','avgusta','septembra','oktobra','novembra','decembra'];
const HU_SUFFIX_TOL=d=>`${d}-${[1,2,4,5,7,9,10].includes(d%10)&&d!==10?'től':'tól'}`;
const fold=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'');
const pad=n=>String(n).padStart(2,'0');

// Cabin wording per language; key = engine label.
const CABIN={
 'Deluxe':{hu:['Deluxe faházat','deluxe házat','delux hazat'],de:['ein Deluxe-Haus','das Deluxe Haus'],en:['a Deluxe cabin','the deluxe cabin'],si:['Deluxe hiško','deluxe hišico']},
 'Családi':{hu:['családi faházat','csaladi hazat','családi házat'],de:['ein Familienhaus','das Familienhaus'],en:['a family cabin','the family cabin'],si:['družinsko hiško','druzinsko hisko']},
 'VIP':{hu:['VIP apartmant','a VIP-et'],de:['das VIP-Apartment','VIP Apartment'],en:['the VIP apartment','VIP apartment'],si:['VIP apartma','VIP apartmaj']},
};
const CABINS=Object.keys(CABIN);
const SAY={
 hu:{greet:['Szia!','Jó napot!','Hali','Üdv,','Szép napot!'],want:['Szeretnénk {c}','{c} kérnénk','Érdeklődnék, lenne {c}?','Foglalnánk {c}'],
  dates:[(a,b,m)=>`2027. ${MONTH.hu[m]} ${HU_SUFFIX_TOL(a)} ${b}-ig`,(a,b,m)=>`${MONTH.hu[m]} ${a}-${b}`,(a,b,m)=>fold(`${MONTH.hu[m]} ${a}-${b} kozott`),(a,b,m)=>`${pad(m+1)}.${pad(a)}-${pad(m+1)}.${pad(b)}`,(a,b,m)=>`${MONTH.hu[m]} ${HU_SUFFIX_TOL(a)} ${b-a} éjszakára`],
  party:[(ad,ch)=>ch.length?`${ad} felnőtt és ${ch.length} gyerek (${ch.join(' és ')} évesek)`:`${ad} felnőtt`,(ad,ch)=>ch.length?`${ad} felnott ${ch.length} gyerek, ${ch.join(', ')} evesek`:`${ad} fo, mind felnott`,(ad,ch)=>ch.length?`${ad} felnőtt, ${ch.length} gyerek: ${ch.join(' és ')} éves`:`${ad} felnőtt jön`],
  partyLater:(ad)=>`${ad} felnőtt leszünk`,kidsAges:ch=>`A gyerekek ${ch.join(' és ')} évesek`,
  changeDates:(a,b,m)=>`Bocsi, mégis inkább ${MONTH.hu[m]} ${a}-${b} lenne jó`,changeParty:ad=>`Mégis ${ad} felnőtt leszünk`,changeCabin:c=>`Inkább ${c} kérnénk`,
  side:['Lehet horgászni éjszaka is?','Hozhatunk kutyát?','Van wifi a házakban?','Hány órától lehet érkezni?','Van parkoló?','Mennyi a napijegy horgászatra?','Lehet etetőanyagot venni helyben?','Van grillezési lehetőség?'],
  multi:['Lehet kutyát hozni, és van-e parkoló?','Mikor kell az előleget utalni, és mennyi az?','Mik a lemondási feltételek? És van-e dézsa?'],
  tubWish:'Dézsát is szeretnénk bérelni',tubNo:'A dézsát mégsem kérjük',price:['Mennyi lesz összesen?','És ez mennyibe kerül?','Mennyi az ár?'],
  unsupported:['Van helikopter-leszálló?','Lehet nálatok esküvőt tartani 200 fővel?','Tudtok reptéri transzfert?'],handover:['Beszélhetnék egy munkatárssal?','Kérhetnék visszahívást?'],
  regular:['Tavaly is voltunk, jár törzsvendég kedvezmény?'],thanks:['Köszi, ennyi lenne!','Rendben, köszönöm!','Szuper, köszi'],slang:['ok, akkor mehet','oké, jó lesz','kösz, tök jó']},
 de:{greet:['Hallo!','Guten Tag,','Servus','Hi'],want:['Wir möchten {c} buchen','Hätten Sie {c} frei?','Wir interessieren uns für {c}'],
  dates:[(a,b,m)=>`vom ${a}. bis ${b}. ${MONTH.de[m]} 2027`,(a,b,m)=>`${a}.-${b}. ${MONTH.de[m]}`,(a,b,m)=>`${pad(a)}.${pad(m+1)}.-${pad(b)}.${pad(m+1)}.2027`,(a,b,m)=>`ab ${a}. ${MONTH.de[m]} für ${b-a} Nächte`],
  party:[(ad,ch)=>ch.length?`${ad} Erwachsene und ${ch.length} Kinder (${ch.join(' und ')} Jahre)`:`${ad} Erwachsene`,(ad,ch)=>ch.length?`wir sind ${ad} Erwachsene mit ${ch.length} Kind${ch.length>1?'ern':''}, ${ch.join(' und ')} Jahre alt`:`wir sind ${ad} Erwachsene`],
  partyLater:ad=>`Wir sind ${ad} Erwachsene`,kidsAges:ch=>`Die Kinder sind ${ch.join(' und ')} Jahre alt`,
  changeDates:(a,b,m)=>`Entschuldigung, lieber vom ${a}. bis ${b}. ${MONTH.de[m]}`,changeParty:ad=>`Doch ${ad} Erwachsene`,changeCabin:c=>`Lieber ${c}`,
  side:['Darf man nachts angeln?','Dürfen wir einen Hund mitbringen?','Gibt es WLAN?','Ab wann ist Check-in?','Gibt es Parkplätze?','Was kostet die Angelkarte?'],
  multi:['Hund erlaubt und gibt es Parkplätze?','Wie hoch ist die Anzahlung und bis wann?','Wie sind die Stornobedingungen? Und gibt es einen Badezuber?'],
  tubWish:'Wir möchten auch den Badezuber mieten',tubNo:'Den Badezuber doch nicht, danke',price:['Was kostet das insgesamt?','Wie viel kostet das?'],
  unsupported:['Gibt es einen Hubschrauberlandeplatz?','Bieten Sie Flughafentransfer an?'],handover:['Kann ich mit einem Mitarbeiter sprechen?','Bitte um Rückruf'],
  regular:['Wir waren letztes Jahr schon da, gibt es Stammgastrabatt?'],thanks:['Danke, das wars!','Super, danke schön'],slang:['ok passt','alles klar, passt so']},
 en:{greet:['Hi!','Hello,','Hey there','Good morning'],want:["We'd like {c}",'Do you have {c} available?','Looking for {c}'],
  dates:[(a,b,m)=>`from ${MONTH.en[m]} ${a} to ${MONTH.en[m]} ${b}`,(a,b,m)=>`${MONTH.en[m]} ${a}-${b}`,(a,b,m)=>`${a}-${b} ${MONTH.en[m]} 2027`,(a,b,m)=>`arriving ${MONTH.en[m]} ${a} for ${b-a} nights`],
  party:[(ad,ch)=>ch.length?`${ad} adults and ${ch.length} kids aged ${ch.join(' and ')}`:`${ad} adults`,(ad,ch)=>ch.length?`${ad} adults + ${ch.length} children (${ch.join(', ')} yrs)`:`just ${ad} adults`],
  partyLater:ad=>`We are ${ad} adults`,kidsAges:ch=>`The kids are ${ch.join(' and ')}`,
  changeDates:(a,b,m)=>`Sorry, can we do ${MONTH.en[m]} ${a}-${b} instead?`,changeParty:ad=>`Actually we'll be ${ad} adults`,changeCabin:c=>`Actually ${c} please`,
  side:['Can we fish at night?','Are dogs allowed?','Is there wifi?','What time is check-in?','Is there parking?','How much is a fishing ticket?'],
  multi:['Are dogs ok and is there parking?','How much is the deposit and when is it due?','What are the cancellation terms? And is there a hot tub?'],
  tubWish:"We'd like to rent the hot tub too",tubNo:"We don't need the hot tub after all",price:['How much is it in total?','What will it cost?'],
  unsupported:['Is there a helipad?','Do you do airport transfers?'],handover:['Can I talk to a real person?','Could someone call me back?'],
  regular:['We stayed last year, is there a returning guest discount?'],thanks:["Thanks, that's all!",'Great, thank you'],slang:['cool, sounds good','ok great']},
 si:{greet:['Pozdravljeni!','Živjo,','Dober dan'],want:['Želimo {c}','Ali imate prosto {c}?','Zanima nas {c}'],
  dates:[(a,b,m)=>`od ${a}. do ${b}. ${SI_GEN[m]} 2027`,(a,b,m)=>`${a}.-${b}. ${SI_GEN[m]}`,(a,b,m)=>`${a}.${m+1}.-${b}.${m+1}.2027`,(a,b,m)=>`od ${a}. ${SI_GEN[m]} za ${b-a} noči`],
  party:[(ad,ch)=>ch.length?`${ad} odrasla in ${ch.length} otroka (${ch.join(' in ')} let)`:`${ad} odrasli`,(ad,ch)=>ch.length?`nas je ${ad} odraslih in ${ch.length} otrok, stari ${ch.join(' in ')} let`:`nas je ${ad} odraslih`],
  partyLater:ad=>`Nas bo ${ad} odraslih`,kidsAges:ch=>`Otroci so stari ${ch.join(' in ')} let`,
  changeDates:(a,b,m)=>`Oprostite, raje od ${a}. do ${b}. ${SI_GEN[m]}`,changeParty:ad=>`Vseeno nas bo ${ad} odraslih`,changeCabin:c=>`Raje ${c}`,
  side:['Ali se lahko ponoči lovi?','Ali lahko pripeljemo psa?','Ali je wifi?','Ob kateri uri je prihod?','Ali je parkirišče?','Koliko stane ribolovna karta?'],
  multi:['Ali je pes dovoljen in ali je parkirišče?','Koliko je predplačilo in do kdaj?','Kakšni so pogoji odpovedi? Ali imate masažno kad?'],
  tubWish:'Radi bi najeli tudi masažno kad',tubNo:'Masažne kadi vseeno ne potrebujemo',price:['Koliko bo skupaj?','Koliko to stane?'],
  unsupported:['Ali imate heliport?','Ali nudite prevoz z letališča?'],handover:['Lahko govorim z osebjem?','Prosim za povratni klic'],
  regular:['Lani smo že bili pri vas, ali je popust za stalne goste?'],thanks:['Hvala, to je vse!','Super, hvala'],slang:['ok, super','velja, hvala']}
};

// One conversation: guest turns + the facts the engine must hold at the end.
function conversation(lang,i,r){
 const L=SAY[lang],pick=a=>a[Math.floor(r()*a.length)],long=i<5,cabin=pick(CABINS);
 const m=4+Math.floor(r()*5),a=1+Math.floor(r()*22),n=2+Math.floor(r()*3);let b=a+n;
 const adults=2+Math.floor(r()*3),kids=r()<0.35?[3+Math.floor(r()*10)].concat(r()<0.4?[2+Math.floor(r()*12)]:[]):[];
 const want={arrival:`2027-${pad(m+1)}-${pad(a)}`,departure:`2027-${pad(m+1)}-${pad(b)}`,adults,children:kids.length,cabin};
 if(kids.length)want.child_ages=kids;
 const turns=[],tags=new Set();
 const t=(text,tag)=>{turns.push({text,tag});if(tag)tags.add(tag);};
 const cw=pick(CABIN[cabin][lang]),dateText=pick(L.dates)(a,b,m),partyText=pick(L.party)(adults,kids);
 if(r()<0.5)t(pick(L.greet)+' '+pick(L.side),'side');
 const style=r();
 if(style<0.35){t(`${pick(L.greet)} ${pick(L.want).replace('{c}',cw)} ${dateText}, ${partyText}.`,'all-in-one');}
 else if(style<0.7){t(pick(L.want).replace('{c}',cw)+'?','pieces');t(dateText,'pieces');t(kids.length&&r()<0.5?L.partyLater(adults)+(lang==='hu'?' és '+kids.length+' gyerek':lang==='de'?' und '+kids.length+' Kinder':lang==='en'?' and '+kids.length+' kids':' in '+kids.length+' otroka'):partyText,'pieces');
  if(kids.length&&!/\d+\s*(?:éves|evesek|évesek|Jahre|aged|yrs|let)/.test(turns.at(-1).text))t(L.kidsAges(kids),'child-ages-later');}
 else {t(`${dateText} ${partyText}`,'fragment');t(pick(L.want).replace('{c}',cw),'fragment');}
 if(r()<0.6)t(pick(L.multi),'multi-question');
 if(long||r()<0.4){ // a change
  const k=r();
  if(k<0.4){const a2=Math.min(a+1+Math.floor(r()*3),24),b2=a2+n;t(L.changeDates(a2,b2,m),'change-dates');want.arrival=`2027-${pad(m+1)}-${pad(a2)}`;want.departure=`2027-${pad(m+1)}-${pad(b2)}`;}
  else if(k<0.7){const ad2=adults===2?3:2;t(L.changeParty(ad2),'change-party');want.adults=ad2;}
  else{const c2=CABINS.find(c=>c!==cabin);t(L.changeCabin(pick(CABIN[c2][lang])),'change-cabin');want.cabin=c2;}
 }
 if(r()<0.4){t(L.tubWish,'hot-tub');if(r()<0.3)t(L.tubNo,'hot-tub-cancel');}
 t(pick(L.price),'price-recheck');
 if(long){
  t(pick(L.unsupported),'unsupported');t(pick(L.regular),'regular-guest');t(pick(L.side),'side');
  const other=LANGS[(LANGS.indexOf(lang)+1+Math.floor(r()*3))%4];t(pick(SAY[other].side),'language-switch:'+other);t(pick(L.side),'switch-back');
  t(pick(L.multi),'multi-question');t(pick(L.price),'price-recheck');t(pick(L.slang),'slang');t(pick(L.handover),'handover');
  if(r()<0.5){const ad2=want.adults===2?3:2;t(L.changeParty(ad2),'change-party');want.adults=ad2;}
  t(pick(L.side),'side');t(pick(L.price),'price-recheck');
 }else if(r()<0.3)t(pick(L.handover),'handover');
 t(pick(L.thanks),'thanks');
 return {id:`${lang.toUpperCase()}-${String(i+1).padStart(2,'0')}`,lang,turns,want,tags:[...tags]};
}
export function buildConversations(seed=20261125){
 const r=rng(seed);return LANGS.flatMap(lang=>Array.from({length:25},(_,i)=>conversation(lang,i,r)));
}

// ---- checks ----
const HOUSE_NO=/\b(?:ház|haus|house|hiška|hiško|egység|unit)\s*(?:#|nr\.?|szám|number)?\s*(?:1[0-5]|[1-9])(?:\/[ABC])?\b|\b(?:7|8|9|10)\/[ABC]\b/iu;
const QUESTIONS=Object.fromEntries(LANGS.map(l=>[l,{dates:replyQuestions(l,{needDates:true})[0],adults:replyQuestions(l,{needAdults:true})[0],cabin:replyQuestions(l,{needCabin:true})[0],cabin2:replyQuestions(l,{needCabin:true,guests:2})[0],child:replyQuestions(l,{needChildAge:true})[0]}]));
const known=f=>({dates:!!(f.dates?.arrival&&f.dates?.departure),adults:Number.isInteger(f.adults),cabin:!!f.cabin,child:!f.children||(Array.isArray(f.child_ages)&&f.child_ages.length===f.children)});
const expectLang=(conv,turn)=>{const s=(turn.tag||'').startsWith('language-switch:')?turn.tag.split(':')[1]:conv.lang;return s;};
export function checkFacts(f,want){
 const bad=[];
 for(const [k,v] of Object.entries(want)){const got=k==='arrival'||k==='departure'?f.dates?.[k]:k==='children'?(f.children||0):f[k];
  if(JSON.stringify(got)!==JSON.stringify(v))bad.push(`${k}: várt ${JSON.stringify(v)}, kapott ${JSON.stringify(got)}`);}
 return bad;
}
export function runEngine(convs){
 return convs.map(c=>{
  const s=createChatInquirySession({clock:()=>NOW}),issues=[],log=[];let prev=null;
  for(const turn of c.turns){
   const before=known(s.snapshot()),res=s.reply(turn.text),text=res.text,lang=s.language;
   log.push({guest:turn.text,bot:text,lang,tag:turn.tag});
   const q=QUESTIONS[lang]||QUESTIONS.hu,changes=/change|pieces|fragment|child-ages/.test(turn.tag||'');
   if(!changes){for(const k of ['dates','adults','cabin','child'])if(before[k]&&(text.includes(q[k])||(k==='cabin'&&text.includes(q.cabin2))))issues.push(`újrakérdezés (${k}) a(z) „${turn.text}” után`);}
   if(HOUSE_NO.test(text))issues.push('belső házszám a válaszban');
   if(/undefined|NaN|\[object/.test(text))issues.push('hibás szövegdarab');
   const exp=expectLang(c,turn);if(lang!==exp&&turn.text.split(/\s+/).length>=3)issues.push(`nyelv: várt ${exp}, válasz ${lang} („${turn.text}”)`);
   if(prev&&prev===text&&res.decision==null&&res.response?.intent!=='unknown'&&!/price|thanks|slang|hot-tub/.test(turn.tag||''))issues.push('ugyanaz a válasz kétszer egymás után');
   prev=text;
  }
  const bad=checkFacts(s.snapshot(),c.want);
  return {id:c.id,lang:c.lang,turns:c.turns.length,tags:c.tags,factIssues:bad,issues,ok:!bad.length&&!issues.length,log};
 });
}

// ---- live pass (deployed TEST page; never submits the request form) ----
export async function runLive(convs,{out,from=0,to=convs.length,origin='https://leafy-chimera-2403e5.netlify.app'}={}){
 const {chromium}=await import('playwright');
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',proxy:process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY}:undefined});
 const results=existsSync(out)?JSON.parse(readFileSync(out,'utf8')):{};
 for(const c of convs.slice(from,to)){
  if(results[c.id]?.done)continue;
  const ctx=await b.newContext({locale:{hu:'hu-HU',de:'de-DE',en:'en-GB',si:'sl-SI'}[c.lang]}),p=await ctx.newPage();
  const net={offer:[],assist:[],intake:0,errors:[]};
  p.on('response',async res=>{const u=res.url();try{
   if(u.endsWith('/chat-offer'))net.offer.push({http:res.status(),body:await res.json().catch(()=>null)});
   else if(u.endsWith('/chat-assist'))net.assist.push({http:res.status(),answer:(await res.json().catch(()=>({})))?.answer??null});
}catch{}});
  // Safety: the request form is never submitted; any call to an intake endpoint is blocked here and counted.
  await ctx.route(/\/\.netlify\/functions\/(?:chat-)?intake|\/api\/(?:chat-)?intake/,route=>{net.intake++;return route.abort();});
  p.on('pageerror',e=>net.errors.push(String(e)));
  await p.goto(origin+'/sarberki-chatbot-project/');await p.waitForSelector('[data-chat-input]');
  const transcript=[];
  for(const turn of c.turns){
   const n0=await p.locator('[data-chat-log] .entry').count(),a0=net.assist.length,o0=net.offer.length;
   await p.fill('[data-chat-input]',turn.text);await p.click('[data-chat-form] [type=submit]');
   await p.waitForFunction(n=>document.querySelectorAll('[data-chat-log] .entry').length>=n+2,n0,{timeout:10000}).catch(()=>{});
   // Let the real endpoints answer (offer / model) before the next message – as a person would read the reply.
   const t0=Date.now();while(Date.now()-t0<9000){await p.waitForTimeout(500);const pend=await p.evaluate(()=>performance.getEntriesByType('resource').length);void pend;
    if(net.assist.length>a0||net.offer.length>o0){await p.waitForTimeout(600);break;}if(Date.now()-t0>3000)break;}
   const entries=await p.locator('[data-chat-log] .entry').allInnerTexts();
   transcript.push({guest:turn.text,tag:turn.tag,bot:entries.slice(n0+1).map(e=>e.replace(/^Sárberki\n/,'')).filter(e=>!e.startsWith('Vendég / Guest')).join('\n---\n')});
  }
  await p.waitForTimeout(1500);
  const finalLog=await p.locator('[data-chat-log] .entry').allInnerTexts();
  results[c.id]={id:c.id,lang:c.lang,tags:c.tags,want:c.want,transcript,finalLog,offers:net.offer.map(o=>({http:o.http,status:o.body?.offer?.status??o.body?.status??null,total:o.body?.offer?.total??null})),
   assists:net.assist.map(a=>({http:a.http,answered:!!a.answer})),intakeRequests:net.intake,pageErrors:net.errors,done:true,at:new Date().toISOString()};
  writeFileSync(out,JSON.stringify(results,null,1));
  await ctx.close();
  console.log(c.id,'turns',c.turns.length,'offers',net.offer.length,'assist',net.assist.length,'intake',net.intake,'errors',net.errors.length);
  await new Promise(r=>setTimeout(r,1500));
 }
 await b.close();return results;
}

if(import.meta.url===`file://${process.argv[1]}`){
 const [mode='engine',out,from,to]=process.argv.slice(2),convs=buildConversations();
 if(mode==='engine'){
  const res=runEngine(convs);if(out)writeFileSync(out,JSON.stringify(res,null,1));
  for(const l of LANGS){const x=res.filter(r=>r.lang===l);console.log(l.toUpperCase(),'beszélgetés',x.length,'forduló',x.reduce((s,r)=>s+r.turns,0),'PASS',x.filter(r=>r.ok).length,'FAIL',x.filter(r=>!r.ok).length);}
  for(const r of res.filter(r=>!r.ok))console.log('❌',r.id,[...r.factIssues,...r.issues].join(' | '));
 }else await runLive(convs,{out,from:Number(from||0),to:Number(to||convs.length)});
}

// ---- live report: per conversation, from the saved transcripts (no network) ----
const fmtDate={hu:iso=>iso.replaceAll('-','.')+'.',de:iso=>iso.split('-').reverse().join('.'),si:iso=>iso.split('-').reverse().join('.'),
 en:iso=>{const [y,m,d]=iso.split('-');return `${Number(d)} ${MONTH.en[Number(m)-1]} ${y}`;}};
export function reportLive(results,convs){
 return convs.filter(c=>results[c.id]).map(c=>{
  // The TEST page is the operator view: its Hungarian review block is not guest text.
  const strip=t=>String(t||'').split(/\n?Magyar kezelői ellenőrző szöveg/)[0];
  const r={...results[c.id],transcript:results[c.id].transcript.map(t=>({...t,bot:t.bot.split('\n---\n').map(strip).join('\n---\n')}))},issues=[],bots=r.transcript.map(t=>t.bot).join('\n');
  // A price question after a checked offer must show a price again (regression found live 2026-11-25).
  let priced=false,noPrice=0;
  for(const t of r.transcript){if(t.tag==='price-recheck'&&priced&&!/\d[\d  .]*\s?(?:Ft|HUF)/.test(t.bot))noPrice++;if(/\d[\d  .]*\s?(?:Ft|HUF)/.test(t.bot)&&/(?:Ft|HUF)[^\n]{0,40}\(|szabad|frei|free|prosto|prost/i.test(t.bot))priced=true;}
  if(noPrice)issues.push(`${noPrice} árkérdésre nem jött ár`);
  if(r.pageErrors?.length)issues.push('oldalhiba');
  if(r.intakeRequests)issues.push('igényleadás történt');
  if(r.offers.some(o=>o.http!==200))issues.push('ajánlat HTTP-hiba');
  if(r.assists.some(a=>a.http!==200))issues.push('AI HTTP-hiba');
  const missingAnswer=r.transcript.filter(t=>!t.bot.trim()).length;if(missingAnswer)issues.push(`${missingAnswer} forduló válasz nélkül`);
  if(HOUSE_NO.test(bots))issues.push('belső házszám');
  if(/undefined|NaN|\[object/.test(bots))issues.push('hibás szövegdarab');
  // The stay finally understood must appear in the chat (the checked offer or the summary): arrival and departure.
  const f=fmtDate[c.lang]||fmtDate.hu,last=r.transcript.map(t=>t.bot).filter(Boolean).join('\n');
  const datesShown=[c.want.arrival,c.want.departure].every(d=>last.includes(f(d))||last.includes(fmtDate.hu(d))||last.includes(d));
  if(!datesShown)issues.push('a végső dátum nem jelent meg');
  // The handover reply is fixed text in the chat language (its "telefonszám" also scores as German): not checked here.
  const langOk=r.transcript.filter(t=>t.bot&&!(t.tag||'').startsWith('language-switch')&&t.tag!=='handover').every(t=>{const l=languageFromText(t.bot.split('\n').slice(0,3).join(' '));return l==='unknown'||l===c.lang;});
  if(!langOk)issues.push('nyelv eltér');
  return {id:c.id,lang:c.lang,turns:c.turns.length,offers:r.offers.length,available:r.offers.filter(o=>o.status==='AVAILABLE').length,assist:r.assists.length,assistAnswered:r.assists.filter(a=>a.answered).length,issues,ok:!issues.length};
 });
}
