import {stageFacts} from './booking-filter.mjs';
import {buildReplyDraft, phoneFromText, requestFlagsFromText, activeMessageText, cabinFromText, cabinClarificationRequired} from './sarberki-core.mjs?v=20261007-e2e1';
import {BUSINESS} from './business-config.mjs?v=20261007-e2e1';
import {fishingQuestion} from './fishing-rules.mjs';

const clone = value => JSON.parse(JSON.stringify(value));
const number = value => value === '' || value == null ? null : Number(value);
const ft = value => Number(value).toLocaleString('hu-HU') + ' Ft';
const eur = value => Number(value).toLocaleString('hu-HU', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' €';
const choose = (lang, hu, de, en, si) => ({hu,de,en,si})[lang] || hu;
export function caseFingerprint(values) {
  return JSON.stringify(['arrival','departure','guests','adults','children','child_ages','unit','units_requested','request','split_request_text'].map(key => String(values[key] ?? '')));
}
export function carsFromText(text='') {
  const words={egy:1,két:2,ket:2,három:3,négy:4,one:1,two:2,three:3,ein:1,einem:1,zwei:2,drei:3,enim:1,dva:2,dve:2};
  const match=activeMessageText(text).match(/\b(\d+|egy|két|ket|három|négy|one|two|three|ein|einem|zwei|drei|enim|dva|dve)\s+(?:autó\w*|kocsi\w*|cars?\b|autos?\b|avto\w*|avtomobil\w*)/iu);
  return match ? (words[match[1].toLowerCase()] ?? Number(match[1])) : null;
}
function hotTubAtHouse(unit='') {
  const value=String(unit||'').trim();
  if(/osztott|split/iu.test(value)||/^(?:7|8|9|10)[ABC]$/iu.test(value)) return false;
  if(/deluxe|családi|family|vip|különálló|small/iu.test(value)||/^15(?:-ös)?$/iu.test(value)) return true;
  return null;
}
export function createCaseState({original='', values={}, intent='booking_request', unresolvedQuestions=[], now=new Date().toISOString()}={}) {
  const flags=requestFlagsFromText(activeMessageText(original));
  return {version:1, revision:0, original, intent, now, unresolvedQuestions, values:{...values, phone:values.phone ?? phoneFromText(activeMessageText(original)) ?? '', cars:values.cars ?? carsFromText(original) ?? ''},
    quote:null, availability:null, hotTub:{requested:flags.hotTubRequested, atHouse:hotTubAtHouse(values.unit), available:null, fee:null, included:null},
    terms:{depositBasis:null, depositVerified:false, cancellationVerified:false, depositAmount:null, depositDeadline:null, cancellationDeadline:null}, approval:'pending'};
}
// All dependent verifications are bound to the current stay, never to an old reply string.
export function updateCaseState(state, action) {
  if(action.type==='facts' && Object.entries(action.values).every(([key,value])=>state.values[key]===value)) return state;
  const next=clone(state); next.revision++; next.approval='pending';
  if(action.type==='facts') {
    next.values={...next.values,...action.values};
    if(caseFingerprint(state.values)!==caseFingerprint(next.values)) {
      next.quote=null;
      const capacityFields=['arrival','departure','guests','adults','children','unit','units_requested','request','split_request_text'];
      if(capacityFields.some(k=>String(state.values[k]??'')!==String(next.values[k]??'')))next.availability=null;
      next.hotTub={...next.hotTub,atHouse:hotTubAtHouse(next.values.unit),available:null,fee:null,included:null};
      next.terms={...next.terms,depositVerified:false,cancellationVerified:false,depositAmount:null,depositDeadline:null,cancellationDeadline:null};
    }
    if(state.values.request!==next.values.request) {
      next.hotTub={requested:/dézs|hot.?tub|badefass|whirlpool|kad/iu.test(next.values.request||''),atHouse:hotTubAtHouse(next.values.unit),available:null,fee:null,included:null};
      next.quote=null;
      if(/egymás|szomszéd|same house|adjacent|nebeneinander|sosed/iu.test(String(state.values.request||'')+' '+String(next.values.request||'')))next.availability=null;
    }
  } else if(action.type==='quote') {
    const quote=action.quote;
    if(!quote || !Number.isFinite(quote.total) || quote.total<=0) throw Error('Érvénytelen jóváhagyott ár.');
    if(action.fingerprint!==caseFingerprint(next.values)) throw Error('Az ár más vendégadatokhoz tartozik.');
    if(state.quote && JSON.stringify(state.quote)!==JSON.stringify({...quote,approved:true,fingerprint:action.fingerprint})) next.terms={...next.terms,depositVerified:false,depositAmount:null,depositDeadline:null};
    next.quote={...quote,approved:true,fingerprint:action.fingerprint};
  } else if(action.type==='invalidateQuote') {next.quote=null;next.terms={...next.terms,depositVerified:false,depositAmount:null,depositDeadline:null};}
  else if(action.type==='availability') {
    if(action.fingerprint!==caseFingerprint(next.values)) return state;
    next.availability={lines:action.lines||[],verified:action.verified===true,checkedAt:action.checkedAt||new Date().toISOString(),evidence:action.evidence||null};
    if(action.requestedAvailable===false){
      next.quote=null;
      next.terms={...next.terms,depositVerified:false,depositAmount:null,depositDeadline:null};
    }
  } else if(action.type==='checks') {
    if(action.hotTub) {
      for(const key of ['atHouse','available','included'])if(action.hotTub[key]!=null&&typeof action.hotTub[key]!=='boolean')throw Error('A dézsa ellenőrzési státusza hibás.');
      if(action.hotTub.fee!=null&&(!Number.isFinite(action.hotTub.fee)||action.hotTub.fee<0))throw Error('Érvénytelen dézsadíj.');
      const hotTub={...next.hotTub,...action.hotTub};if(JSON.stringify(hotTub)!==JSON.stringify(next.hotTub)){next.quote=null;next.terms={...next.terms,depositVerified:false,depositAmount:null,depositDeadline:null};}next.hotTub=hotTub;
    }
    if(action.terms) {
      const terms={...next.terms,...action.terms};
      if(terms.depositVerified&&(!terms.depositBasis||!Number.isFinite(terms.depositAmount)||terms.depositAmount<0||!/^\d{4}-\d{2}-\d{2}$/.test(terms.depositDeadline||'')))throw Error('Az előleg jóváhagyásához számítási alap, ellenőrzött összeg és fizetési határidő szükséges.');
      if(terms.cancellationVerified&&!terms.cancellationDeadline)throw Error('A lemondás jóváhagyásához ellenőrzött feltétel szükséges.');
      next.terms=terms;
    }
  } else throw Error('Ismeretlen ügyállapot-művelet.');
  return next;
}
export function deriveCaseView(state, baseReview={warning_codes:[],issues:[]}) {
  const v=state.values, q=state.quote, h=state.hotTub, t=state.terms;
  const rental=BUSINESS.hotTubRentalRules;
  const tariff=`${ft(rental.baseHufPer24Hours)}/24 óra ${rental.includedPeople} főig, felette +${ft(rental.extraPersonHufPer24Hours)}/fő/24 óra`;
  const lang=String(v.language||'HU').toLowerCase()==='sl'?'si':String(v.language||'HU').toLowerCase();
  const guests=number(v.guests), adults=number(v.adults), children=number(v.children);
  const ages=String(v.child_ages||'').split(',').filter(x=>x.trim()!=='').map(Number);
  const booking=['booking_request','availability_request','price_request'].includes(state.intent);
  const reviewedCabin=cabinFromText(String(v.unit||''));
  const cabinKnown=Boolean(reviewedCabin&&!reviewedCabin.startsWith('?'));
  const cabinTypeRequired=booking&&!cabinKnown&&cabinClarificationRequired(state.original,guests);
  const rules=BUSINESS.bookingRules;
  const cancellationDays=guests>=15?rules.cancellationDaysFrom15Guests:rules.cancellationDaysUnder15Guests;
  const dateParts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:BUSINESS.timezone||'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(state.now)).map(x=>[x.type,x.value]));
  const today=`${dateParts.year}-${dateParts.month}-${dateParts.day}`;
  const untilArrival=v.arrival?(Date.parse(v.arrival)-Date.parse(today))/86400000:null;
  // No new deadline: the configured normal policy cannot safely be applied here.
  const closeArrival=booking&&Number.isFinite(untilArrival)&&(untilArrival<cancellationDays||untilArrival<=Number(rules.depositDueDays)+1);
  const removed=new Set(['price_unverified','hot_tub_availability_unverified','unresolved_guest_question','missing_child_ages','missing_contact']);
  if(lang==='hu')removed.add('foreign_review');
  const warnings=(baseReview.warning_codes||[]).flatMap((code,i)=>removed.has(code)?[]:[{code,text:baseReview.issues[i]}]);
  const add=(code,text)=>{if(!warnings.some(x=>x.code===code))warnings.push({code,text});};
  for(const [key,fact]of Object.entries(stageFacts(v)))if(fact.status==='contradictory')add('fact_conflict','Ellentmondásos vagy érvénytelen ügyadat: '+key);
  const missing=[];
  if(booking&&!v.arrival){missing.push('Érkezési dátum');add('missing_arrival','Érkezési dátum hiányzik');}
  if(booking&&!v.departure){missing.push('Távozási dátum');add('missing_departure','Távozási dátum hiányzik');}
  if(booking&&!(adults>0)){missing.push('Felnőttek száma');add('missing_adults','Felnőttek száma hiányzik');}
  if(booking&&children==null){missing.push('Érkezik-e gyermek');add('missing_children','Gyermekek száma nincs megadva');}
  if(cabinTypeRequired){missing.push('Háztípus');add('cabin_type_required','A 2 vagy 4 fős igény önmagában nem határozza meg a háztípust; vissza kell kérdezni.');}
  for(const question of state.unresolvedQuestions||[]) if(!['deposit_amount','hot_tub_availability','hot_tub_price'].includes(question.topic)) add(question.topic,question.question||question.message||'Emberi ellenőrzés szükséges');
  if(booking&&!v.phone) {missing.push('Telefonszám');add('missing_phone','Telefon hiányzik');}
  if(booking&&children>0&&(ages.length!==children||ages.some(x=>!Number.isInteger(x)||x<0||x>17))) {missing.push('Gyermekek pontos életkora');add('missing_child_ages','Gyermekek életkora hiányzik vagy hibás');}
  if(booking&&!q) add('price_unverified','Ár nincs jóváhagyva');
  if(booking&&!q?.availabilityVerified&&!state.availability?.verified) add('availability_unverified','Foglalható elhelyezés nincs igazolva; kapacitás- és szükség esetén párosításellenőrzés kell.');
  if(closeArrival&&(!t.depositVerified||!t.cancellationVerified)) add('close_arrival','KÖZELI ÉRKEZÉS – az előleg- és lemondási feltétel alkalmazása emberi ellenőrzést igényel.');
  if(booking&&!t.depositVerified) add('deposit_review','Előlegfeltétel ellenőrzendő');
  if(booking&&!t.depositBasis) add('deposit_basis_review','Előleg számítási alapja tulajdonosi döntést igényel');
  if(booking&&(!t.depositVerified||t.depositAmount==null)) add('deposit_amount','Előleg konkrét összege nincs ellenőrizve (nem a százalék hiányzik)');
  if(booking&&!t.cancellationVerified) add('cancellation_terms_review','Lemondási feltétel ellenőrzendő');
  if(h.requested) {
    if(h.atHouse==null) add('hot_tub_assignment','Dézsa házhoz rendelése nincs ellenőrizve');
    if(h.available==null) add('hot_tub_availability','Dézsa elérhetősége nincs ellenőrizve');
    if(h.fee==null) add('hot_tub_fee','Dézsa bérlési időtartama és konkrét díja ellenőrzendő; tarifa: '+tariff);
    if(h.included==null) add('hot_tub_included','Az ajánlat dézsadíj-tartalma nincs ellenőrizve');
  }
  const priceLines=[];
  if(q) {
    priceLines.push(choose(lang,`A jóváhagyott szállásajánlat összege: ${ft(q.total)}${Number.isFinite(q.eurTotal)?' / '+eur(q.eurTotal):''}.`,`Der freigegebene Unterkunftspreis beträgt ${ft(q.total)}${Number.isFinite(q.eurTotal)?' / '+eur(q.eurTotal):''}.`,`The approved accommodation quote is ${ft(q.total)}${Number.isFinite(q.eurTotal)?' / '+eur(q.eurTotal):''}.`,`Potrjena cena nastanitve znaša ${ft(q.total)}${Number.isFinite(q.eurTotal)?' / '+eur(q.eurTotal):''}.`));
    if(Number.isFinite(q.accommodation)&&Number.isFinite(q.tourismTax))priceLines.push(choose(lang,`Ebből szállásdíj: ${ft(q.accommodation)}, IFA: ${ft(q.tourismTax)}.`,`Unterkunft: ${ft(q.accommodation)}, Ortstaxe: ${ft(q.tourismTax)}.`,`Accommodation: ${ft(q.accommodation)}, tourist tax: ${ft(q.tourismTax)}.`,`Nastanitev: ${ft(q.accommodation)}, turistična taksa: ${ft(q.tourismTax)}.`));
    if(q.unitBreakdown?.length>1) priceLines.push(...q.unitBreakdown.map(x=>`${x.unit}. ${choose(lang,'egység','Einheit','unit','enota')}: ${ft(x.total)}${q.eurRate>0?' / '+eur(Math.round(x.total/q.eurRate*100)/100):''}`));
  }
  const bookingLines=[];
  const asksDeposit=/(?:előleg|foglaló|deposit|anzahlung|predplačil)/iu.test(state.original);
  const asksCancellation=/(?:lemond|storn|cancel|odpoved)/iu.test(state.original);
  if(booking) {
    if(asksDeposit) {
      if(t.depositVerified&&t.depositBasis&&Number.isFinite(t.depositAmount)&&t.depositDeadline) bookingLines.push(choose(lang,`Az ellenőrzött előleg összege ${ft(t.depositAmount)}, fizetési határideje: ${t.depositDeadline}.`,`Die geprüfte Anzahlung beträgt ${ft(t.depositAmount)}, zahlbar bis ${t.depositDeadline}.`,`The verified deposit is ${ft(t.depositAmount)}, payable by ${t.depositDeadline}.`,`Preverjeno predplačilo znaša ${ft(t.depositAmount)}, rok plačila: ${t.depositDeadline}.`));
      else bookingLines.push(choose(lang,'Az előleg pontos összegét és fizetési határidejét az ajánlattal együtt adjuk meg.','Den genauen Anzahlungsbetrag und die Zahlungsfrist nennen wir zusammen mit dem Angebot.','We will provide the exact deposit amount and payment deadline with the offer.','Natančen znesek in rok predplačila navedemo skupaj s ponudbo.'));
    }
    if(asksCancellation) {
      if(t.cancellationVerified&&t.cancellationDeadline) bookingLines.push(choose(lang,`Az ellenőrzött lemondási határidő: ${t.cancellationDeadline}.`,`Die geprüfte Stornierungsfrist ist ${t.cancellationDeadline}.`,`The verified cancellation deadline is ${t.cancellationDeadline}.`,`Preverjeni rok odpovedi: ${t.cancellationDeadline}.`));
      else bookingLines.push(choose(lang,'A lemondási feltételt az ajánlattal együtt pontosan megadjuk.','Die genaue Stornierungsbedingung nennen wir zusammen mit dem Angebot.','We will provide the exact cancellation condition with the offer.','Natančen pogoj odpovedi navedemo skupaj s ponudbo.'));
    }
    if(q) bookingLines.push(choose(lang,'Amennyiben az ajánlat megfelel Önnek, kérjük, válaszoljon erre a levélre.','Wenn Ihnen das Angebot zusagt, antworten Sie bitte auf diese Nachricht.','If this offer is suitable, please reply to this message.','Če vam ponudba ustreza, prosimo odgovorite na to sporočilo.'));
  }
  const extraLines=[];
  const cars=number(v.cars);
  if(cars!=null||/parkol|parking|parkplatz|parkir/iu.test(state.original))extraLines.push(cars===1?choose(lang,'Egy autó részére a parkolás biztosított.','Ein Parkplatz für ein Auto ist vorhanden.','Parking for one car is available.','Parkiranje za en avtomobil je zagotovljeno.'):choose(lang,cars!=null?`${cars} autó parkolását külön ellenőrizzük.`:'Parkolási lehetőség biztosított a házaknál.','Parkmöglichkeiten sind bei den Häusern vorhanden.','Parking is available by the cabins.','Parkiranje je zagotovljeno pri hiškah.'));
  if(h.requested) {
    if(h.atHouse===false||h.available===false) extraLines.push(choose(lang,'A kért dézsa nem biztosítható a jelenleg ellenőrzött feltételekkel; más lehetőséget egyeztetünk.','Das gewünschte Badefass kann derzeit nicht bestätigt werden.','The requested hot tub cannot be provided under the checked conditions.','Želene masažne kadi pod preverjenimi pogoji ni mogoče zagotoviti.'));
    else if(h.atHouse===true&&h.available===true&&h.fee!=null&&h.included!=null&&(!h.included||q)) extraLines.push(choose(lang,`A dézsa a kért időszakra elérhető. Díja: ${ft(h.fee)}; ${h.included?'a jóváhagyott ár tartalmazza':'a szállásajánlaton felül fizetendő'}.`,`Das Badefass ist verfügbar. Preis: ${ft(h.fee)}; ${h.included?'im freigegebenen Preis enthalten':'zusätzlich zum Unterkunftspreis'}.`,`The hot tub is available. Fee: ${ft(h.fee)}; ${h.included?'included in the approved price':'payable in addition to the accommodation quote'}.`,`Masažna kad je na voljo. Cena: ${ft(h.fee)}; ${h.included?'vključena v potrjeno ceno':'doplačilo k nastanitvi'}.`));
    else extraLines.push(choose(lang,`A dézsa külön bérelhető, nem jár automatikusan a házhoz. Díja ${tariff}. A kért időszak elérhetőségét, a bérlés időtartamát és az ajánlatba foglalását külön visszaigazoljuk; a feltüntetett szállásárból a dézsahasználat díja nem állapítható meg.`,'Das Badefass ist separat zu mieten und gehört nicht automatisch zur Unterkunft. Preis: 30 000 Ft je 24 Stunden für bis zu 6 Personen, darüber +4 000 Ft je Person/24 Stunden. Verfügbarkeit, Mietdauer und Aufnahme in das Angebot bestätigen wir separat.','The hot tub is rented separately and is not automatically included with the house. The rate is 30 000 Ft per 24 hours for up to 6 people, plus 4 000 Ft per additional person/24 hours. We separately confirm availability, rental duration and inclusion in the quote.','Masažna kad se najame posebej in ni samodejno vključena v nastanitev. Cena je 30 000 Ft/24 ur za največ 6 oseb, nato +4 000 Ft/osebo/24 ur. Razpoložljivost, trajanje najema in vključitev v ponudbo potrdimo posebej.'));
  }
  const availabilityLines=q?.availabilityVerified?[choose(lang,'Az árlekéréskor a kért szállás szabad kapacitása ellenőrizve volt. A foglalást külön visszaigazoljuk.','Bei der Preisabfrage wurde die Verfügbarkeit der gewünschten Unterkunft geprüft. Die Buchung bestätigen wir separat.','Availability of the requested accommodation was verified when checking the price. We confirm the booking separately.','Razpoložljivost želene nastanitve je bila preverjena ob preverjanju cene. Rezervacijo potrdimo posebej.')]:state.availability?.lines||[];
  const fishing=fishingQuestion(state.original,lang);
  const draft=buildReplyDraft({language:lang,name:v.name,original:state.original,arrival:v.arrival,departure:v.departure,guests,adults,children,childAges:ages,phone:v.phone,cabin:v.unit||'? – emberi döntésre vár',hotTub:h.requested,intent:state.intent,brandName:BUSINESS.brandName,bookingRules:rules,operationalRules:BUSINESS.operationalRules,pricingRules:BUSINESS.pricingRules,knowledgeLines:fishing?[fishing.answer]:[],caseContext:{priceLines,bookingLines,extraLines,availabilityLines,priceApproved:Boolean(q)}});
  const summary=`${v.arrival||'?'} – ${v.departure||'?'}; ${v.nights||'?'} éjszaka; ${guests??'?'} fő; felnőtt: ${adults??'?'}; gyermek: ${children??'?'}${ages.length?' ('+ages.join(', ')+' éves)':''}; ${v.unit||'háztípus nincs megadva'}${cars!=null?'; Parkolás: '+cars+' autó – adat megadva':''}${q?'; Ár ellenőrizve':''}.`;
  return {draft,summary,missing,warnings,closeArrival,untilArrival,critical:Boolean(baseReview.critical)||warnings.some(x=>['fact_conflict','availability_unverified','close_arrival','deposit_review','deposit_basis_review','cancellation_terms_review','cabin_type_required'].includes(x.code)),priceStatus:q?'Ár ellenőrizve':'Ár nincs jóváhagyva'};
}
