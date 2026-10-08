import {PUBLIC_MISSING_FIELDS,PUBLIC_TOPICS} from './public-answer-data.mjs';

const allowedLanguages=new Set(['hu','de','en','si']);
const allowedCabins=new Set(['vip','family','deluxe','split2','split4','standalone2']);
const forbidden=/\b(?:previo|pms|pool|mapping|api|internal|belső|kezelői|emberi\s+(?:ellenőrzés|jóváhagyás|döntés)|ellenőrzendő|review_required)\b|\b(?:7|8|9|10)\s*[ABC]\b/iu;

function finite(value){
  const n=Number(value);
  return Number.isFinite(n)?n:null;
}
function safeText(value,{allowEmpty=false}={}){
  const text=String(value??'').trim();
  if(!text&&!allowEmpty)return null;
  if(text.length>120||/[\r\n\x00-\x1f\x7f]/u.test(text)||forbidden.test(text))return null;
  return text;
}
function safeInteger(value,min=0,max=99){
  if(value===null||value===undefined||String(value).trim()==='')return null;
  const n=Number(value);
  return Number.isInteger(n)&&n>=min&&n<=max?n:null;
}
function safeIso(value){
  const text=safeText(value);
  if(!text||!/^\d{4}-\d{2}-\d{2}$/u.test(text))return null;
  const [year,month,day]=text.split('-').map(Number);
  const date=new Date(Date.UTC(year,month-1,day));
  return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?text:null;
}
function safeMoney(value){
  if(value===null||value===undefined||String(value).trim()==='')return null;
  const n=finite(value);
  return n!==null&&n>=0?n:null;
}

export function containsForbiddenGuestText(value=''){
  return forbidden.test(String(value));
}

export function sanitizeGuestReplyPayload(input={}){
  const facts=input.facts&&typeof input.facts==='object'?input.facts:{};
  const language=allowedLanguages.has(String(facts.language||'').toLowerCase())?String(facts.language).toLowerCase():'hu';
  const cabin=allowedCabins.has(facts.cabin)?facts.cabin:null;
  const children=safeInteger(facts.children,0,30);
  const childAges=Array.isArray(facts.childAges)
    ? facts.childAges.map(x=>safeInteger(x,0,17)).filter(x=>x!==null).slice(0,children??30)
    : [];

  const cleanFacts=Object.freeze({
    language,
    name:(()=>{const name=safeText(facts.name);return name&&name.length<=80&&/^[\p{L}\p{M}\s.'’-]+$/u.test(name)?name:null;})(),
    arrival:safeIso(facts.arrival),
    departure:safeIso(facts.departure),
    nights:safeInteger(facts.nights,1,60),
    guests:safeInteger(facts.guests,1,60),
    adults:safeInteger(facts.adults,1,60),
    children,
    childAges:Object.freeze(childAges),
    phone:safeText(facts.phone),
    cabin,
    requestedUnits:safeInteger(facts.requestedUnits,1,20)
  });

  const topics=Object.freeze([...new Set(Array.isArray(input.topics)?input.topics.filter(x=>PUBLIC_TOPICS.includes(x)):[])]);
  const missing=Object.freeze([...new Set(Array.isArray(input.missing)?input.missing.filter(x=>PUBLIC_MISSING_FIELDS.includes(x)):[])]);

  let quote=null;
  if(input.quote?.approved===true){
    const total=safeMoney(input.quote.total);
    if(total!==null){
      const breakdown=Array.isArray(input.quote.unitBreakdown)?input.quote.unitBreakdown.map((row,index)=>Object.freeze({
        unit:safeInteger(row?.unit,1,20)??index+1,
        total:safeMoney(row?.total),
        accommodation:safeMoney(row?.accommodation),
        tourismTax:safeMoney(row?.tourismTax),
        eurTotal:safeMoney(row?.eurTotal)
      })).filter(row=>row.total!==null):[];
      quote=Object.freeze({
        approved:true,
        total,
        accommodation:safeMoney(input.quote.accommodation),
        tourismTax:safeMoney(input.quote.tourismTax),
        eurTotal:safeMoney(input.quote.eurTotal),
        unitBreakdown:Object.freeze(breakdown)
      });
    }
  }

  let availability=null;
  if(input.availability?.verified===true&&Array.isArray(input.availability.options)){
    // A szabadon formázott, akár belső megjegyzést tartalmazó nevek nem átadhatók.
    const allowedOptionLabels=new Set(['VIP','VIP faház','Családi','Családi faház','Deluxe','Deluxe faház','2 fős osztott apartman','4 fős osztott apartman','Különálló 2 fős faház']);
    const options=input.availability.options.map(x=>safeText(x)).filter(x=>x&&allowedOptionLabels.has(x));
    if(options.length) availability=Object.freeze({verified:true,options:Object.freeze(options)});
  }

  return Object.freeze({facts:cleanFacts,topics,missing,quote,availability});
}

export function assertGuestSafeOutput(text=''){
  if(containsForbiddenGuestText(text))throw new Error('A vendégválasz tiltott belső kifejezést tartalmaz.');
  return text;
}
