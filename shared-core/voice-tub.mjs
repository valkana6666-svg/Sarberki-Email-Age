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
const ALL_DAYS=/minden\s+(?:nap|este|éjszak)|egész\s+(?:időre|ott\s*tartózkodás)|az\s+összes\s+napra|every\s+(?:day|night)|whole\s+stay|jeden\s+(?:Tag|Abend)|ganzen\s+Aufenthalt|vsak\s+dan|vse\s+dni|ves\s+čas/iu;
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
 let days=[];
 if(ALL_DAYS.test(t))days=stayNights;
 else{
  const nums=[...t.replace(/(?:este|délután|abends|evening|zvečer)\s+\d{1,2}\s*-?\s*(?:t[óő]l|kor)?/giu,' ').matchAll(/(?<!\d)(\d{1,2})(?:\s*-?\s*(?:re|ra|én|án|ján|jén|ére|ára|ei|i)|\.|st|nd|rd|th)?(?!\d|\s*(?:fő|fos|fős|Person|guest|oseb|órá|óra|h\b|Uhr|o'clock|ur\b|pm\b|am\b|p\.m))/giu)].map(m=>+m[1]).filter(d=>d>=1&&d<=31);
  for(const d of nums){const hit=stayNights.find(x=>+x.slice(8)===d);if(hit&&!days.includes(hit))days.push(hit);}
 }
 let persons=null;
 const pm=t.match(/(\d{1,2})\s*(?:fő|főre|fős|személy|Person\p{L}*|guests?|people|oseb\p{L}*)/iu)||t.match(/(\p{L}+)\s+(?:főre|fő\b|személyre|Personen|guests|people|osebe|oseb)/iu);
 if(pm)persons=Number.isInteger(+pm[1])?+pm[1]:NUMS[pm[1].toLowerCase()]??null;
 if(!persons&&Number.isInteger(stay.guests))persons=stay.guests;
 let hour=null;const hm=t.match(/(\d{1,2})\s*(?:órától|óra|órakor|Uhr|o'?clock|h\b|uri|ure)/iu)||t.match(/(?:este|délután|abends|evening|zvečer)\s+(\d{1,2})\s*-?\s*(?:t[óő]l|kor)?/iu)||t.match(/(\d{1,2})\s*(?:pm)\b/iu);
 if(hm){hour=+hm[1];if(/este|délután|abends|evening|pm|zvečer/iu.test(t)&&hour<12)hour+=12;if(hour>23)hour=null;}
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
 const d=whole?{hu:`a teljes tartózkodás minden napjára (${n} nap)`,de:`für jeden Tag des Aufenthalts (${n} Tage)`,en:`for every day of the stay (${n} days)`,si:`za vse dni bivanja (${n} dni)`}[lang]:dayList(req.days,lang);
 return {hu:`Rendben, felírtam: dézsafürdő ${d}${n>1?'':''}, ${req.persons} főre, ${n>1?`${n} napra, összesen `:''}${req.total} forint. ${req.hour!=null?'':'Ha konkrét időpontot szeretne, munkatársunk egyezteti Önnel.'}`.trim(),
  de:`Gerne, notiert: Badezuber am ${d}, für ${req.persons} Personen, ${req.total} Forint. ${req.hour!=null?'':'Die genaue Uhrzeit stimmt unser Team mit Ihnen ab.'}`.trim(),
  en:`Fine, noted: hot tub on ${d}, for ${req.persons} guests, ${req.total} forints. ${req.hour!=null?'':'Our team will agree the exact time with you.'}`.trim(),
  si:`V redu, zabeleženo: masažna kad ${d}, za ${req.persons} oseb, ${req.total} forintov. ${req.hour!=null?'':'Točen čas bo z vami uskladila naša ekipa.'}`.trim()}[lang];
}
