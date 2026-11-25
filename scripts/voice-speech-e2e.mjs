// Owner 2026-11-25 („vágj bele”): phone-style test set – 25 calls per language (HU/DE/EN/SI) written the way speech-to-
// text writes them: lower case, little punctuation, fillers, spoken numbers and years, „egy hétre”, spoken child ages,
// a greeting / „can you hear me”, a party correction, a price question, misheard cabin names. Runs through the voice
// endpoint's own logic (shared-core/voice-turn.mjs: normaliser → shared engine → spoken reply), no network.
// Checks: stay facts, reply present / short / in the caller's language, no phone-number request, no raw numeric date.
// Usage: node scripts/voice-speech-e2e.mjs [out.json]
import {voiceTurn} from '../shared-core/voice-turn.mjs';
import {languageFromText} from '../sarberki-core.mjs';
import {writeFileSync} from 'node:fs';

const CLOCK=()=>new Date('2026-11-25T12:00:00Z');
function rng(seed){let s=seed>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const pad=n=>String(n).padStart(2,'0');
const W={
 hu:{units:['','egy','két','három','négy','öt','hat','hét','nyolc','kilenc'],ord:['','elsejétől','másodikától','harmadikától','negyedikétől','ötödikétől','hatodikától','hetedikétől','nyolcadikától','kilencedikétől','tizedikétől','tizenegyedikétől','tizenkettedikétől','tizenharmadikától','tizennegyedikétől','tizenötödikétől','tizenhatodikától','tizenhetedikétől','tizennyolcadikától','tizenkilencedikétől','huszadikától','huszonegyedikétől','huszonkettedikétől'],
  ordIg:['','elsejéig','másodikáig','harmadikáig','negyedikéig','ötödikéig','hatodikáig','hetedikéig','nyolcadikáig','kilencedikéig','tizedikéig','tizenegyedikéig','tizenkettedikéig','tizenharmadikáig','tizennegyedikéig','tizenötödikéig','tizenhatodikáig','tizenhetedikéig','tizennyolcadikáig','tizenkilencedikéig','huszadikáig','huszonegyedikéig','huszonkettedikéig','huszonharmadikáig','huszonnegyedikéig','huszonötödikéig','huszonhatodikáig'],
  month:['','','','','','május','június','július','augusztus','szeptember'],year:'kétezer-huszonhét',
  cabin:{Deluxe:['de lux házat','deluxe faházat','delux házat'],Családi:['családi házat','csaladi hazat','családi faházat'],VIP:['víp apartmant','vip apartmant']},
  greet:['halló','halló jó napot','hallanak','szia'],filler:['öö ','','hmm ',''],adults:n=>`${['','egy','két','három','négy','öt'][n]} felnőtt`,kids:a=>a.length===1?` és egy gyerek ${['','egy','két','három','négy','öt','hat','hét','nyolc','kilenc','tíz','tizenegy','tizenkét'][a[0]]}éves`:` és két gyerek ${['','egy','két','három','négy','öt','hat','hét','nyolc','kilenc','tíz','tizenegy','tizenkét'][a[0]]} és ${['','egy','két','három','négy','öt','hat','hét','nyolc','kilenc','tíz','tizenegy','tizenkét'][a[1]]} évesek`,
  want:(c)=>`szeretnénk ${c}`,price:'és mennyibe kerül',fix:n=>`bocsánat mégis ${['','egy','két','három','négy','öt'][n]} felnőtt leszünk`,week:'egy hétre'},
 en:{num:['','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'],ord:['','first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth','eleventh','twelfth','thirteenth','fourteenth','fifteenth','sixteenth','seventeenth','eighteenth','nineteenth','twentieth','twenty first','twenty second','twenty third','twenty fourth','twenty fifth','twenty sixth'],
  month:['','','','','','may','june','july','august','september'],year:'twenty twenty seven',
  cabin:{Deluxe:['the deluxe cabin','a de luxe cabin'],Családi:['the family cabin','a family cabin'],VIP:['the vip apartment','the v i p apartment']},
  greet:['hello','hi can you hear me','hello there'],filler:['um ','','uh ',''],adults:n=>`${['','one','two','three','four','five'][n]} adults`,kids:a=>a.length===1?` and one kid a ${['','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'][a[0]]} year old`:` and two kids aged ${['','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'][a[0]]} and ${['','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'][a[1]]}`,
  want:c=>`we'd like ${c}`,price:'and how much is that',fix:n=>`sorry actually we'll be ${['','one','two','three','four','five'][n]} adults`,week:'for a week'},
 de:{num:['','ein','zwei','drei','vier','fünf','sechs','sieben','acht','neun','zehn','elf','zwölf'],ord:['','ersten','zweiten','dritten','vierten','fünften','sechsten','siebten','achten','neunten','zehnten','elften','zwölften','dreizehnten','vierzehnten','fünfzehnten','sechzehnten','siebzehnten','achtzehnten','neunzehnten','zwanzigsten','einundzwanzigsten','zweiundzwanzigsten','dreiundzwanzigsten','vierundzwanzigsten','fünfundzwanzigsten','sechsundzwanzigsten'],
  month:['','','','','','Mai','Juni','Juli','August','September'],year:'zweitausendsiebenundzwanzig',
  cabin:{Deluxe:['das Deluxe Haus','ein de luxe Haus'],Családi:['das Familienhaus','ein Familienhaus'],VIP:['das VIP Apartment']},
  greet:['hallo','hallo hören Sie mich','guten Tag'],filler:['äh ','','ähm ',''],adults:n=>`${['','ein','zwei','drei','vier','fünf'][n]} Erwachsene`,kids:a=>a.length===1?` und ein Kind ${['','ein','zwei','drei','vier','fünf','sechs','sieben','acht','neun','zehn','elf','zwölf'][a[0]]} Jahre alt`:` und zwei Kinder ${['','ein','zwei','drei','vier','fünf','sechs','sieben','acht','neun','zehn','elf','zwölf'][a[0]]} und ${['','ein','zwei','drei','vier','fünf','sechs','sieben','acht','neun','zehn','elf','zwölf'][a[1]]} Jahre alt`,
  want:c=>`wir möchten ${c}`,price:'und was kostet das',fix:n=>`Entschuldigung doch ${['','ein','zwei','drei','vier','fünf'][n]} Erwachsene`,week:'für eine Woche'},
 si:{ord:['','prvega','drugega','tretjega','četrtega','petega','šestega','sedmega','osmega','devetega','desetega','enajstega','dvanajstega','trinajstega','štirinajstega','petnajstega','šestnajstega','sedemnajstega','osemnajstega','devetnajstega','dvajsetega','enaindvajsetega','dvaindvajsetega','triindvajsetega','štiriindvajsetega','petindvajsetega','šestindvajsetega'],
  month:['','','','','','maja','junija','julija','avgusta','septembra'],year:'dva tisoč sedemindvajset',
  cabin:{Deluxe:['deluxe hiško','de luks hiško'],Családi:['družinsko hiško','druzinsko hisko'],VIP:['vip apartma']},
  greet:['halo','pozdravljeni me slišite','dober dan'],filler:['eee ','','mmm ',''],adults:n=>`${['','en odrasel','dva odrasla','trije odrasli','štirje odrasli','pet odraslih'][n]}`,kids:a=>a.length===1?` in en otrok star ${['','ena','dva','tri','štiri','pet','šest','sedem','osem','devet','deset','enajst','dvanajst'][a[0]]} let`:` in dva otroka stara ${['','ena','dva','tri','štiri','pet','šest','sedem','osem','devet','deset','enajst','dvanajst'][a[0]]} in ${['','ena','dva','tri','štiri','pet','šest','sedem','osem','devet','deset','enajst','dvanajst'][a[1]]} let`,
  want:c=>`želimo ${c}`,price:'in koliko to stane',fix:n=>`oprostite vseeno nas bo ${['','en odrasel','dva odrasla','trije odrasli','štirje odrasli','pet odraslih'][n]}`,week:'za en teden'}
};
function spokenDates(lang,a,b,m,r,useWeek){
 const L=W[lang];
 if(lang==='hu')return useWeek?`${L.year} ${L.month[m]} ${L.ord[a]} ${L.week}`:`${r()<0.5?L.year+' ':''}${L.month[m]} ${L.ord[a]} ${L.ordIg[b]}`;
 if(lang==='en')return useWeek?`from ${L.month[m]} the ${L.ord[a]} ${L.week}`:`from ${L.month[m]} ${L.ord[a]} to the ${L.ord[b]}${r()<0.5?' '+L.year:''}`;
 if(lang==='de')return useWeek?`ab dem ${L.ord[a]} ${L.month[m]} ${L.week}`:`vom ${L.ord[a]} bis ${L.ord[b]} ${L.month[m]}${r()<0.5?' '+L.year:''}`;
 return useWeek?`od ${L.ord[a]} ${L.month[m]} ${L.week}`:`od ${L.ord[a]} do ${L.ord[b]} ${L.month[m]}${r()<0.5?' '+L.year:''}`;
}
export function buildCalls(seed=20261125){
 const r=rng(seed),pick=a=>a[Math.floor(r()*a.length)],out=[];
 for(const lang of ['hu','de','en','si'])for(let i=0;i<25;i++){
  const L=W[lang],m=5+Math.floor(r()*5),a=1+Math.floor(r()*19),week=r()<0.2,n=week?7:2+Math.floor(r()*3),b=a+n;
  const cabin=pick(Object.keys(L.cabin)),adults=2+Math.floor(r()*3),kids=r()<0.35?[3+Math.floor(r()*9)].concat(r()<0.4?[2+Math.floor(r()*10)]:[]):[];
  const want={arrival:`2027-${pad(m)}-${pad(a)}`,departure:`2027-${pad(m)}-${pad(b)}`,adults,children:kids.length,cabin};
  const turns=[];if(r()<0.5)turns.push(pick(L.greet));
  const d=spokenDates(lang,a,b,m,r,week),p=L.adults(adults)+(kids.length?L.kids(kids):''),c=L.want(pick(L.cabin[cabin]));
  const style=r();
  if(style<0.4)turns.push(`${pick(L.filler)}${c} ${d} ${p}`);
  else if(style<0.75){turns.push(`${pick(L.filler)}${c}`);turns.push(d);turns.push(p);}
  else{turns.push(`${d} ${p}`);turns.push(c);}
  if(r()<0.3){const a2=adults===2?3:2;turns.push(L.fix(a2));want.adults=a2;}
  turns.push(L.price);
  out.push({id:`${lang.toUpperCase()}-V${pad(i+1)}`,lang,turns,want});
 }
 return out;
}
export async function runVoice(calls){
 const res=[];
 for(const c of calls){
  const r=await voiceTurn({utterances:c.turns,clock:CLOCK}),issues=[];
  for(const [k,v] of Object.entries(c.want)){const got=r.facts[k]??(k==='children'?0:null);if(got!==v)issues.push(`${k}: várt ${v}, kapott ${got}`);}
  if(typeof r.reply!=='string'||!r.reply.trim())issues.push('nincs válasz');
  else{
   if(r.reply.length>460)issues.push('túl hosszú válasz');
   if(/telefonszám|phone number|Telefonnummer|telefonsko številko/i.test(r.reply))issues.push('telefonszámot kér');
   if(/\b20\d{2}\.\d{2}\.\d{2}\b|\b\d{2}\.\d{2}\.20\d{2}\b/.test(r.reply))issues.push('számjegyes dátum a felolvasásban');
   const l=languageFromText(r.reply);if(l!=='unknown'&&l!==c.lang)issues.push(`válasz nyelve ${l}`);
  }
  res.push({id:c.id,lang:c.lang,turns:c.turns,reply:r.reply,facts:r.facts,issues,ok:!issues.length});
 }
 return res;
}
if(import.meta.url===`file://${process.argv[1]}`){
 const res=await runVoice(buildCalls());if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(res,null,1));
 for(const l of ['hu','de','en','si']){const x=res.filter(r=>r.lang===l);console.log(l.toUpperCase(),'hívás',x.length,'PASS',x.filter(r=>r.ok).length);}
 for(const r of res.filter(r=>!r.ok))console.log('❌',r.id,r.issues.join(' | '),'||',r.turns.join(' / '));
}
