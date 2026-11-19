// Returning-guest discount (owner 2026-11-19: „ellenőrizze a 20% kedvezményt … a Previo korábbi foglalásaiból”).
// Approved rule (business-config.mjs): 20% of the ACCOMMODATION price when the previous stay's last day is within 730
// days and the guest is in the guest book (a checked-out stay). Pure decision + price step; no data source here.
// Prepared defaults (owner decision pending, docs/V1-ALLAPOT.md): a certain match only on the same e-mail or phone;
// a name-only match is a hint for the operator, never an automatic discount; the 730 days are counted back from the
// booking day; IFA is not discounted; the deposit follows the discounted accommodation.
import {BUSINESS} from '../business-config.mjs';

const DAY=86400000;
export const normEmail=x=>{const e=String(x||'').trim().toLowerCase().replace(/[.,;]+$/u,'');return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(e)?e:null;};
// Hungarian numbers in any common form (06 30…, +36 30…, 0036…) → the same key; other countries keep their digits.
export const normPhone=x=>{let d=String(x||'').replace(/[^0-9+]/g,'');if(d.startsWith('+'))d=d.slice(1);else if(d.startsWith('00'))d=d.slice(2);else if(d.startsWith('06'))d='36'+d.slice(2);
 return /^[0-9]{8,15}$/.test(d)?d:null;};
const normName=x=>String(x||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim()||null;

// stays: [{email, phone, name, lastDay:'YYYY-MM-DD'}] – checked-out stays only (the caller filters the status).
// → {status:'eligible'|'possible'|'none', matchedBy, lastStay, pct} – no personal data in the result.
export function returningGuestDecision({guest,stays,referenceDay,rules=BUSINESS.operationalRules}={}){
 const pct=Number(rules?.returningGuestDiscountPct),days=Number(rules?.returningGuestLookbackDays);
 if(!Number.isFinite(pct)||pct<=0||!Number.isFinite(days)||days<=0||!/^\d{4}-\d{2}-\d{2}$/.test(referenceDay||''))return Object.freeze({status:'none',matchedBy:null,lastStay:null,pct:0});
 const from=new Date(Date.parse(referenceDay+'T00:00:00Z')-days*DAY).toISOString().slice(0,10);
 const email=normEmail(guest?.email),phone=normPhone(guest?.phone),name=normName(guest?.name);
 const recent=(Array.isArray(stays)?stays:[]).filter(s=>/^\d{4}-\d{2}-\d{2}$/.test(s?.lastDay||'')&&s.lastDay>=from&&s.lastDay<=referenceDay);
 const latest=list=>list.map(s=>s.lastDay).sort().at(-1)??null;
 const byContact=recent.filter(s=>email&&normEmail(s.email)===email||phone&&normPhone(s.phone)===phone);
 if(byContact.length)return Object.freeze({status:'eligible',matchedBy:byContact.some(s=>email&&normEmail(s.email)===email)?'email':'phone',lastStay:latest(byContact),pct});
 const byName=name?recent.filter(s=>normName(s.name)===name):[];
 if(byName.length)return Object.freeze({status:'possible',matchedBy:'name',lastStay:latest(byName),pct});
 return Object.freeze({status:'none',matchedBy:null,lastStay:null,pct});
}

// The price step: only an 'eligible' decision changes the quote (accommodation − pct%, IFA unchanged).
export function applyReturningDiscount(quote,decision){
 if(decision?.status!=='eligible'||!Number.isSafeInteger(quote?.accommodation)||!Number.isSafeInteger(quote?.tourismTax))return quote;
 const discount=Math.round(quote.accommodation*decision.pct/100),accommodation=quote.accommodation-discount;
 return Object.freeze({...quote,accommodationBeforeDiscount:quote.accommodation,returningDiscount:Object.freeze({pct:decision.pct,amount:discount,lastStay:decision.lastStay}),
  accommodation,total:accommodation+quote.tourismTax});
}

// Operator line for the daily view (Hungarian, no personal data).
export function returningGuestLine(decision){
 if(decision?.status==='eligible')return `🎁 Törzsvendég (azonos ${decision.matchedBy==='email'?'e-mail-cím':'telefonszám'}, utolsó tartózkodás: ${decision.lastStay}) – ${decision.pct}% kedvezmény a szállásdíjból beszámítva.`;
 if(decision?.status==='possible')return `❓ Lehetséges törzsvendég: csak a név egyezik egy korábbi tartózkodással (${decision.lastStay}). Kedvezményt nem számoltunk – ellenőrizd a Previóban.`;
 if(decision?.status==='unknown')return 'Törzsvendég-ellenőrzés most nem sikerült – ha a vendég visszatérő, ellenőrizd kézzel.';
 return null;
}
