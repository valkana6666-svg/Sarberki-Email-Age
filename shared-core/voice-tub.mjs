// Owner 2026-11-27 (PERM-20261127-VOICE-TUB-NOTE): a hot tub wish on the phone – before or after the booking is saved –
// is understood as a TUB request (days within the stay, guests, optional start hour), answered with its price and
// written into the Previo option's first note field (`note`) in the form the live Previo uses (survey run
// 46004433641: „DÉZSAFÜRDŐ <date> <hour> óra <n>x24 óra”). No start hour given → 1x24 óra; the staff set the hour later.
import {BUSINESS} from '../business-config.mjs';

const R=BUSINESS.hotTubRentalRules;
export const TUB_WORD=/dézs|dezs|hot[ -]?tub|badezuber|badefass|whirlpool|jacuzzi|masažn\p{L}*\s*kad|(?<!\p{L})kad(?:i|jo|e)?(?!\p{L})/iu;
const REFUSED=/mégse|megse|nem\s+(?:kér|kell|szeretn)|no\s+hot\s*tub|without|kein|ohne|brez|ne\s+potrebuj/iu;
// A stay statement („Családi faház dézsával július 10–13”) carries a range; a tub-day request does not.
const RANGE=/(?:\d\s*-?\s*(?:t[óő]l|jétől|ától|étől)[^.?!]{0,40}\d\s*-?\s*(?:ig|éig|áig)(?!\p{L})|\bbis\b|\bfrom\b[^.?!]{0,30}\b(?:to|until)\b|(?<!\p{L})od\s+\d[^.?!]{0,30}\bdo\s+\d|\d\.?\s*[–]\s*\d|\d{1,2}\s*-\s*\d{1,2}(?!\s*(?:fő|órá|óra|tól|től)))/iu;
// Owner 2026-11-27: „minden napra”, „az összes napra”, „az egészre”, „az egész ott tartózkodásunk teljes idejére”,
// „végig” – the whole stay; „csak harmadikára / negyedikére”, „az első (két) napra”, „az utolsó napra” – those nights.
const ALL_DAYS=/minden\s+(?:nap|este|éj)|mindegyik\s+nap|(?:az\s+)?összes\s+nap|(?:az\s+)?egész(?:re|\s+(?:időre|idő|ott|tartózkodás|hét|szállás))|teljes\s+(?:idő|tartózkodás|ott)|végig|egész\s+ott\s+tartózkodásunk|every\s+(?:day|night)|each\s+day|all\s+(?:the\s+)?(?:days|nights)|whole\s+(?:stay|time)|entire\s+stay|jeden\s+(?:Tag|Abend)|alle\s+Tage|ganzen?\s+(?:Aufenthalt|Zeit)|die\s+ganze\s+Zeit|vsak\s+dan|vse\s+dni|ves\s+čas|celotno\s+bivanje|cel\s+čas/iu;
// Day words (ordinals) → day of month: HU 1–31, DE/EN/SI 1–10 (digits work in every language).
const HU_UNIT={elsej:1,egyedik:1,második:2,kettedik:2,harmadik:3,negyedik:4,ötödik:5,hatodik:6,hetedik:7,nyolcadik:8,kilencedik:9};
const ORD={first:1,second:2,third:3,fourth:4,fifth:5,sixth:6,seventh:7,eighth:8,ninth:9,tenth:10,ersten:1,zweiten:2,dritten:3,vierten:4,fünften:5,sechsten:6,siebten:7,achten:8,neunten:9,zehnten:10,
 prvega:1,drugega:2,tretjega:3,četrtega:4,petega:5,šestega:6,sedmega:7,osmega:8,devetega:9,desetega:10};
function ordinalDays(t){
 const out=[];
 for(const m of t.toLowerCase().matchAll(/(?<!\p{L})(tizen|huszon|harminc)?(elsej|egyedik|második|kettedik|harmadik|negyedik|ötödik|hatodik|hetedik|nyolcadik|kilencedik)\p{L}*|(?<!\p{L})(tizedik|huszadik|harmincadik)\p{L}*/gu)){
  if(m[3]){out.push({tizedik:10,huszadik:20,harmincadik:30}[m[3]]);continue;}
  const tens={tizen:10,huszon:20,harminc:30}[m[1]]||0,u=HU_UNIT[m[2]];
  if(m[2]==='elsej'&&tens)continue;out.push(tens+u);
 }
 for(const w of t.toLowerCase().split(/[^\p{L}]+/u))if(ORD[w])out.push(ORD[w]);
 // Owner's call 2026-11-27 18:19: „Tizenegy és tizenkettedikére” – a plain number word before „és/meg/,” shares the
 // ordinal/suffix of the next day, so it is a day too (only when such a day follows).
 const CARD={egy:1,két:2,kettő:2,három:3,négy:4,öt:5,hat:6,hét:7,nyolc:8,kilenc:9};
 for(const m of t.toLowerCase().matchAll(/(?<!\p{L})(?:(tizen|huszon|harminc)(egy|két|kettő|három|négy|öt|hat|hét|nyolc|kilenc)?|(tíz|húsz|harminc)|(egy|kettő|három|négy|öt|hat|hét|nyolc|kilenc))(?=\s*(?:,|és|meg|vagy)\s+(?:\p{L}*(?:dik|edik|adik|odik|ödik|elsej)\p{L}*|\d{1,2}\s*-?\s*(?:\.|re|ra|én|án|ére|ára|ján|jén|ig)))/gu)){
  const d=m[3]?{tíz:10,húsz:20,harminc:30}[m[3]]:m[4]?CARD[m[4]]:({tizen:10,huszon:20,harminc:30}[m[1]]+(m[2]?CARD[m[2]]:0));
  if(m[1]&&!m[2])continue;out.push(d);
 }
 return out.filter(d=>d>=1&&d<=31);
}
function edgeDays(t,stayNights){
 const n=w=>Number.isInteger(+w)?+w:NUMS[String(w||'').toLowerCase()]||1;
 let m=t.match(/(?:az\s+)?első\s+(?:(\p{L}+|\d)\s+)?(?:nap|éj)|first\s+(?:(\p{L}+|\d)\s+)?(?:day|night)|ersten?\s+(?:(\p{L}+|\d)\s+)?(?:Tag|Nacht)|prv(?:i|a|e)\s+(?:(\p{L}+|\d)\s+)?(?:dan|noč)/iu);
 if(m)return stayNights.slice(0,n(m[1]||m[2]||m[3]||m[4]));
 m=t.match(/(?:az\s+)?utolsó\s+(?:(\p{L}+|\d)\s+)?(?:nap|éj)|last\s+(?:(\p{L}+|\d)\s+)?(?:day|night)|letzten?\s+(?:(\p{L}+|\d)\s+)?(?:Tag|Nacht)|zadnj(?:i|a|e)\s+(?:(\p{L}+|\d)\s+)?(?:dan|noč)/iu);
 if(m)return stayNights.slice(-n(m[1]||m[2]||m[3]||m[4]));
 return null;
}
// The days of a tub request within the stay (empty: not said).
export function tubDays(text,stay){
 const t=String(text||''),stayNights=nights(stay.arrival,stay.departure);
 if(ALL_DAYS.test(t))return stayNights;
 const edge=edgeDays(t,stayNights);if(edge)return edge;
 const days=[];
 const nums=[...t.replace(/(?:este|délután|abends|evening|zvečer)\s+\d{1,2}\s*-?\s*(?:t[óő]l|kor)?/giu,' ').matchAll(/(?<!\d)(\d{1,2})(?:\s*-?\s*(?:re|ra|én|án|ján|jén|ére|ára|ei|i)|\.|st|nd|rd|th)?(?!\d|\s*(?:fő|fos|fős|Person|guest|oseb|órá|óra|h\b|Uhr|o'clock|ur\b|pm\b|am\b|p\.m|nap|éj|day|night|Tag|dan|noč|felnőtt|gyer|adult|Erwachs|Kind|child|kid|odrasl|otro))/giu)].map(m=>+m[1]).filter(d=>d>=1&&d<=31);
 for(const d of [...nums,...ordinalDays(t)]){const hit=stayNights.find(x=>+x.slice(8)===d);if(hit&&!days.includes(hit))days.push(hit);}
 return days.sort();
}
// „Melyik napokra szeretné?” → „Csak negyedikére.”: a day answer right after a tub request without days.
export function isTubDayAnswer(prev,last){
 const p=String(prev||''),l=String(last||'');
 if(!isTubRequest(p)||TUB_WORD.test(l)||REFUSED.test(l))return false;
 return ALL_DAYS.test(l)||/(?<!\p{L})(?:első|utolsó|first|last)\s/iu.test(l)||ordinalDays(l).length>0||/(?<!\d)\d{1,2}\s*-?\s*(?:re|ra|én|án|ére|ára|ján|jén)(?!\p{L})|\b\d{1,2}(?:st|nd|rd|th)\b/iu.test(l);
}
const NUMS={egy:1,két:2,kettő:2,három:3,négy:4,öt:5,hat:6,hét:7,nyolc:8,kilenc:9,tíz:10,ketten:2,hárman:3,négyen:4,öten:5,hatan:6,heten:7,nyolcan:8,
 one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,eins:1,zwei:2,drei:3,vier:4,fünf:5,sechs:6,sieben:7,acht:8,ena:1,dva:2,tri:3,štiri:4,pet:5,šest:6,sedem:7,osem:8};

export function tubPricePer24h(persons){
 const p=Number.isInteger(persons)&&persons>0?persons:R.includedPeople;
 return R.baseHufPer24Hours+Math.max(0,p-R.includedPeople)*R.extraPersonHufPer24Hours;
}
const nights=(a,d)=>{const out=[];for(let t=Date.parse(a+'T00:00:00Z');t<Date.parse(d+'T00:00:00Z');t+=86400000)out.push(new Date(t).toISOString().slice(0,10));return out;};

// Is this utterance a tub request (not a refusal, not a whole stay statement)?
const WISH=/szeretn|kér|kell|foglal|írja|írd|fel|want|like|need|book|reserve|möcht|hätte|bitte|buchen|želi|rad|rezerv/iu;
const PRICE_Q=/mennyibe|mennyi\s+(?:az\s+)?ár|how\s+much|price|cost|kostet|preis|koliko|cena|stane/iu;
// A sentence that books or names the accommodation („le szeretném foglalni a faházat … és dézsát is”) is a stay turn
// (the tub wish rides along with it), not a separate tub request.
const STAY_TURN=/lefoglal|foglaln[áa]|foglalom|faház|(?<!\p{L})ház(?:at|ba|ra)?(?!\p{L})|cabin|house|haus|hišk|hiš[aoe]|apartm|book\s+it|we'?ll\s+take|buchen|nehmen|rezervir/iu;
export function isTubRequest(text){const t=String(text||'');return TUB_WORD.test(t)&&!REFUSED.test(t)&&!RANGE.test(t)&&!STAY_TURN.test(t)&&WISH.test(t)&&!PRICE_Q.test(t);}

// The request in one utterance, against a known stay {arrival, departure, guests}.
export function parseTubRequest(text,stay){
 const t=String(text||'');if(!isTubRequest(t)||!stay?.arrival||!stay?.departure)return null;
 const stayNights=nights(stay.arrival,stay.departure);
const days=tubDays(t,stay);
 if(false){
  const nums=[...t.replace(/(?:este|délután|abends|evening|zvečer)\s+\d{1,2}\s*-?\s*(?:t[óő]l|kor)?/giu,' ').matchAll(/(?<!\d)(\d{1,2})(?:\s*-?\s*(?:re|ra|én|án|ján|jén|ére|ára|ei|i)|\.|st|nd|rd|th)?(?!\d|\s*(?:fő|fos|fős|Person|guest|oseb|órá|óra|h\b|Uhr|o'clock|ur\b|pm\b|am\b|p\.m))/giu)].map(m=>+m[1]).filter(d=>d>=1&&d<=31);
  for(const d of nums){const hit=stayNights.find(x=>+x.slice(8)===d);if(hit&&!days.includes(hit))days.push(hit);}
 }
 let persons=null;
 const pm=t.match(/(\d{1,2})\s*(?:fő|főre|fős|személy|Person\p{L}*|guests?|people|oseb\p{L}*)/iu)||t.match(/(\p{L}+)\s+(?:főre|fő\b|személyre|Personen|guests|people|osebe|oseb)/iu);
 if(pm)persons=Number.isInteger(+pm[1])?+pm[1]:NUMS[pm[1].toLowerCase()]??null;
 if(!persons&&Number.isInteger(stay.guests))persons=stay.guests;
 let hour=null;const th=hourDigits(t),hm=th.match(/(\d{1,2})\s*(?:órától|óra|órakor|Uhr|o'?clock|h\b|uri|ure)/iu)||th.match(/(?:este|délután|abends|nachmittags|evening|afternoon|zvečer|popoldne)\s+(\d{1,2})\s*-?\s*(?:t[óő]l|kor)?/iu)||th.match(/(\d{1,2})\s*(?:pm)\b/iu);
 if(hm){hour=+hm[1];if(/este|délután|abends|nachmittags|evening|afternoon|pm|zvečer|popoldne/iu.test(th)&&hour<12)hour+=12;if(hour>23)hour=null;}
 const per=tubPricePer24h(persons);
 return {days,persons,hour,per24h:per,total:days.length?per*days.length:null,allStay:days.length===stayNights.length};
}
const huDate=iso=>iso.replaceAll('-','.')+'.';
const ft=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
// The Previo note line(s), the live form: „DÉZSAFÜRDŐ 2027.03.05. 18 ÓRÁTÓL 1x24 óra, 5 fő – 30 000 Ft (telefonos igény)”.
export function tubNoteLines(req){
 if(!req)return [];
 const who=`${req.persons??'?'} fő – ${ft(req.per24h)} Ft`;
 if(!req.days.length)return [`DÉZSAFÜRDŐ napok egyeztetendők 1x24 óra/nap, ${who}/24 óra (telefonos igény)`];
 return req.days.map(d=>`DÉZSAFÜRDŐ ${huDate(d)} ${req.hour!=null?req.hour+' ÓRÁTÓL ':''}1x24 óra, ${who} (telefonos igény)`);
}
const MON={hu:['január','február','március','április','május','június','július','augusztus','szeptember','október','november','december'],de:['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'],
 en:['January','February','March','April','May','June','July','August','September','October','November','December'],si:['januarja','februarja','marca','aprila','maja','junija','julija','avgusta','septembra','oktobra','novembra','decembra']};
const dayList=(days,lang)=>days.map(d=>{const m=MON[lang]||MON.hu,mm=+d.slice(5,7)-1,dd=+d.slice(8);return lang==='hu'?`${m[mm]} ${dd}.`:lang==='en'?`${m[mm]} ${dd}`:`${dd}. ${m[mm]}`;}).join(lang==='hu'?' és ':lang==='de'?' und ':lang==='si'?' in ':' and ');
// What the caller hears.
export function tubReply(req,lang='hu'){
 if(!req)return null;
 if(!req.days.length)return {hu:`Rendben, a dézsafürdőt felírtam, ${req.persons} főre: 24 óránként ${req.per24h} forint. Melyik napokra szeretné?`,
  de:`Gerne, den Badezuber habe ich notiert, für ${req.persons} Personen: ${req.per24h} Forint pro 24 Stunden. Für welche Tage möchten Sie ihn?`,
  en:`Fine, I have noted the hot tub for ${req.persons} guests: ${req.per24h} forints per 24 hours. Which days would you like it?`,
  si:`V redu, masažno kad sem zabeležil za ${req.persons} oseb: ${req.per24h} forintov na 24 ur. Za katere dni jo želite?`}[lang];
 const n=req.days.length,whole=n>2&&req.allStay;
 const at=req.hour!=null?{hu:`, ${req.hour} órától`,de:`, ab ${req.hour} Uhr`,en:`, from ${req.hour}:00`,si:`, od ${req.hour}. ure`}[lang]:'';
 const d=(whole?{hu:`a teljes tartózkodás minden napjára (${n} nap)`,de:`für jeden Tag des Aufenthalts (${n} Tage)`,en:`for every day of the stay (${n} days)`,si:`za vse dni bivanja (${n} dni)`}[lang]:dayList(req.days,lang))+at;
 return {hu:`Rendben, felírtam: dézsafürdő ${d}${n>1?'':''}, ${req.persons} főre, ${whole?'összesen ':n>1?`${n} napra, összesen `:''}${req.total} forint. ${req.hour!=null?'':'Ha konkrét időpontot szeretne, munkatársunk egyezteti Önnel.'}`.trim(),
  de:`Gerne, notiert: Badezuber am ${d}, für ${req.persons} Personen, ${req.total} Forint. ${req.hour!=null?'':'Die genaue Uhrzeit stimmt unser Team mit Ihnen ab.'}`.trim(),
  en:`Fine, noted: hot tub on ${d}, for ${req.persons} guests, ${req.total} forints. ${req.hour!=null?'':'Our team will agree the exact time with you.'}`.trim(),
  si:`V redu, zabeleženo: masažna kad ${d}, za ${req.persons} oseb, ${req.total} forintov. ${req.hour!=null?'':'Točen čas bo z vami uskladila naša ekipa.'}`.trim()}[lang];
}

// The tub requests of a call, each with its day answer joined („Kérünk dézsát is.” + „Csak negyedikére.”), and which
// utterances are tub turns (kept out of the stay replay).
// Owner's call 2026-11-27 15:37: „délután négy órától” (an hour said in words) – the hour words become digits.
const HOUR_WORDS={egy:1,két:2,kettő:2,három:3,négy:4,öt:5,hat:6,hét:7,nyolc:8,kilenc:9,tíz:10,tizenegy:11,tizenkét:12,tizenkettő:12,tizenhárom:13,tizennégy:14,tizenöt:15,tizenhat:16,tizenhét:17,tizennyolc:18,tizenkilenc:19,húsz:20,huszonegy:21,huszonkét:22,huszonkettő:22,
 eins:1,zwei:2,drei:3,vier:4,fünf:5,sechs:6,sieben:7,acht:8,neun:9,zehn:10,elf:11,zwölf:12,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,
 ena:1,dve:2,tri:3,štiri:4,pet:5,šest:6,sedem:7,osem:8,devet:9,deset:10};
const HW=Object.keys(HOUR_WORDS).sort((a,b)=>b.length-a.length).join('|');
export function hourDigits(text){
 return String(text||'').replace(new RegExp(`(?<!\\p{L})(${HW})(?=\\s*(?:órától|órakor|óra(?!\\p{L})|Uhr|o'?clock|pm\\b|am\\b|uri|ure))`,'giu'),(m,w)=>String(HOUR_WORDS[w.toLowerCase()]))
  .replace(new RegExp(`((?:reggel|délelőtt|délután|este|morgens|vormittags|nachmittags|abends|morning|afternoon|evening|zjutraj|dopoldne|popoldne|zvečer)\\s+)(${HW})(?!\\p{L})`,'giu'),(m,a,w)=>a+HOUR_WORDS[w.toLowerCase()]);
}
// Owner's call 2026-11-27 14:54: „Délután 4-től szeretném kérni.” right after the tub request is its start hour.
const TIME_ANSWER=/(?<!\d)\d{1,2}\s*(?:órától|órakor|óra(?!\p{L})|Uhr|o'?clock|pm|am)\b|(?:reggel|délelőtt|délután|este|morgens|vormittags|nachmittags|abends|morning|afternoon|evening|zjutraj|dopoldne|popoldne|zvečer)\s+\d{1,2}(?!\d)/iu;
export function isTubTimeAnswer(last){const l=hourDigits(last);return TIME_ANSWER.test(l)&&!TUB_WORD.test(l)&&!REFUSED.test(l)&&!RANGE.test(l)&&!STAY_TURN.test(l)&&!PRICE_Q.test(l);}
export function isTubTurn(utterances,i){return isTubRequest(utterances[i])||(i>0&&(isTubDayAnswer(utterances[i-1],utterances[i])||(isTubTimeAnswer(utterances[i])&&isTubTurn(utterances,i-1))));}
export function tubTexts(utterances){
 const out=[];
 utterances.forEach((u,i)=>{if(isTubRequest(u))out.push(u);else if(out.length&&i>0&&isTubTurn(utterances,i))out[out.length-1]=out[out.length-1]+' '+u;});
 return out;
}
