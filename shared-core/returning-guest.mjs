// Returning-guest discount (owner 2026-11-19: „ellenőrizze a 20% kedvezményt … a Previo korábbi foglalásaiból”).
// Approved rule (business-config.mjs): 20% of the ACCOMMODATION price when the previous stay's last day is within 730
// days and the guest is in the guest book (a checked-out stay). Pure decision + price step; no data source here.
// Owner 2026-11-19: automatic discount only when NAME, E-MAIL AND PHONE all match the same earlier stay; any partial
// match (e.g. the name only) is for the operator to decide and look into. The 730 days are counted back from the
// ARRIVAL day of the new stay (owner 2026-11-21); IFA is not discounted; the deposit follows the discounted accommodation.
import {BUSINESS} from '../business-config.mjs';

const DAY=86400000;
export const normEmail=x=>{const e=String(x||'').trim().toLowerCase().replace(/[.,;]+$/u,'');return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(e)?e:null;};
// Hungarian numbers in any common form (06 30…, +36 30…, 0036…) → the same key; other countries keep their digits.
export const normPhone=x=>{let d=String(x||'').replace(/[^0-9+]/g,'');if(d.startsWith('+'))d=d.slice(1);else if(d.startsWith('00'))d=d.slice(2);else if(d.startsWith('06'))d='36'+d.slice(2);
 return /^[0-9]{8,15}$/.test(d)?d:null;};
// Accents, case, spacing and word order do not matter ("Kovács Péter" = "Peter Kovacs").
const normName=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z\s-]/g,' ').split(/\s+/).filter(Boolean).sort().join(' ')||null;

// stays: [{email, phone, name, lastDay:'YYYY-MM-DD'}] – checked-out stays only (the caller filters the status).
// → {status:'eligible'|'possible'|'none', matchedBy:[...], lastStay, pct} – no personal data in the result.
export function returningGuestDecision({guest,stays,referenceDay,rules=BUSINESS.operationalRules}={}){
 const pct=Number(rules?.returningGuestDiscountPct),days=Number(rules?.returningGuestLookbackDays);
 if(!Number.isFinite(pct)||pct<=0||!Number.isFinite(days)||days<=0||!/^\d{4}-\d{2}-\d{2}$/.test(referenceDay||''))return Object.freeze({status:'none',matchedBy:Object.freeze([]),lastStay:null,pct:0});
 const from=new Date(Date.parse(referenceDay+'T00:00:00Z')-days*DAY).toISOString().slice(0,10);
 const email=normEmail(guest?.email),phone=normPhone(guest?.phone),name=normName(guest?.name);
 const recent=(Array.isArray(stays)?stays:[]).filter(s=>/^\d{4}-\d{2}-\d{2}$/.test(s?.lastDay||'')&&s.lastDay>=from&&s.lastDay<=referenceDay);
 const latest=list=>list.map(s=>s.lastDay).sort().at(-1)??null;
 const fields=s=>[name&&normName(s.name)===name&&'name',email&&normEmail(s.email)===email&&'email',phone&&normPhone(s.phone)===phone&&'phone'].filter(Boolean);
 const full=recent.filter(s=>fields(s).length===3);
 if(full.length)return Object.freeze({status:'eligible',matchedBy:Object.freeze(['name','email','phone']),lastStay:latest(full),pct});
 const partial=recent.map(s=>({s,f:fields(s)})).filter(x=>x.f.length>0).sort((a,b)=>b.f.length-a.f.length||(a.s.lastDay<b.s.lastDay?1:-1));
 if(partial.length)return Object.freeze({status:'possible',matchedBy:Object.freeze(partial[0].f),lastStay:partial[0].s.lastDay,pct});
 return Object.freeze({status:'none',matchedBy:Object.freeze([]),lastStay:null,pct});
}

// The price step: only an 'eligible' decision changes the quote (accommodation − pct%, IFA unchanged).
export function applyReturningDiscount(quote,decision){
 if(decision?.status!=='eligible'||!Number.isSafeInteger(quote?.accommodation)||!Number.isSafeInteger(quote?.tourismTax))return quote;
 // 7=6 (owner 2026-11-27): the 20% comes FIRST on the full list price; then each full week's DISCOUNTED amount ÷ 7 is
 // deducted (140 000 → 112 000 → −16 000 → 96 000).
 const wf=quote.weeklyFree;
 if(wf&&Number.isSafeInteger(quote.listAccommodation)&&Array.isArray(wf.weeks)){
  const units=Number.isInteger(quote.units)&&quote.units>0?quote.units:1;
  const discount=Math.round(quote.listAccommodation*decision.pct/100);
  const weeks=wf.weeks.map(w=>{const sum=w.weekSumHuf-Math.round(w.weekSumHuf*decision.pct/100);return {...w,weekSumAfterDiscountHuf:sum,freeHuf:Math.round(sum/7)};});
  const free=weeks.reduce((s,w)=>s+w.freeHuf,0)*units,accommodation=quote.listAccommodation-discount-free;
  return Object.freeze({...quote,accommodationBeforeDiscount:quote.listAccommodation,returningDiscount:Object.freeze({pct:decision.pct,amount:discount,lastStay:decision.lastStay}),
   weeklyFree:Object.freeze({freeNights:wf.freeNights,amount:free,weeks}),accommodation,total:accommodation+quote.tourismTax});
 }
 const discount=Math.round(quote.accommodation*decision.pct/100),accommodation=quote.accommodation-discount;
 return Object.freeze({...quote,accommodationBeforeDiscount:quote.accommodation,returningDiscount:Object.freeze({pct:decision.pct,amount:discount,lastStay:decision.lastStay}),
  accommodation,total:accommodation+quote.tourismTax});
}

// Operator line for the daily view (Hungarian, no personal data).
export function returningGuestLine(decision){
 const HU={name:'név',email:'e-mail-cím',phone:'telefonszám'};
 const list=f=>(Array.isArray(f)?f:[]).map(x=>HU[x]).filter(Boolean).join(', ');
 if(decision?.status==='eligible')return `🎁 Törzsvendég (név, e-mail-cím és telefonszám is egyezik; utolsó tartózkodás: ${decision.lastStay}) – ${decision.pct}% kedvezmény a szállásdíjból beszámítva; a dézsa árából is ${decision.pct}% jár (ha kér dézsát, azt külön számold).`;
 if(decision?.status==='possible')return `❓ Lehetséges törzsvendég: csak ez egyezik egy korábbi tartózkodással (${decision.lastStay}): ${list(decision.matchedBy)}. Kedvezményt nem számoltunk – a te döntésed: nézz utána a Previóban.`;
 if(decision?.status==='unknown')return 'Törzsvendég-ellenőrzés most nem sikerült – ha a vendég visszatérő, ellenőrizd kézzel.';
 return null;
}
