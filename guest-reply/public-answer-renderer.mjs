import {PUBLIC_REPLY_DATA as DATA} from './public-answer-data.mjs';
import {sanitizeGuestReplyPayload,assertGuestSafeOutput} from './public-answer-contract.mjs';

const choose=(lang,obj)=>obj?.[lang]??obj?.hu??'';
const money=n=>Number(n).toLocaleString('hu-HU')+' Ft';
const euro=n=>Number(n).toLocaleString('hu-HU',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';

function cabinLabel(key,lang){return key?choose(lang,DATA.cabins[key]?.label):'';}
function formatDate(iso,lang){
  if(!iso)return '';
  const [y,m,d]=iso.split('-').map(Number);
  if(lang==='en')return new Intl.DateTimeFormat('en-GB',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,d)));
  return String(d).padStart(2,'0')+'.'+String(m).padStart(2,'0')+'.'+y;
}
function questions(model){
  return model.missing.map(key=>{
    const mapped=key==='children_status'?'childrenStatus':key==='child_ages'?'childAges':key;
    return choose(model.facts.language,DATA.questions[mapped]);
  }).filter(Boolean);
}

export function composeGuestReply(raw={}){
  const model=sanitizeGuestReplyPayload(raw);
  const {facts,topics,quote,availability}=model;
  const lang=facts.language;
  const name=facts.name;
  const greeting={
    hu:name?'Kedves '+name+'!':'Kedves Vendégünk!',
    de:name?'Guten Tag, '+name+'!':'Guten Tag!',
    en:name?'Dear '+name+',':'Dear Guest,',
    si:name?'Pozdravljeni, '+name+'!':'Pozdravljeni!'
  }[lang];
  const thanks={hu:'Köszönjük érdeklődését.',de:'Vielen Dank für Ihre Anfrage.',en:'Thank you for your enquiry.',si:'Hvala za vaše povpraševanje.'}[lang];
  const closing={hu:'Üdvözlettel:',de:'Mit freundlichen Grüßen',en:'Kind regards,',si:'Lep pozdrav'}[lang];
  const blocks=[];

  if(topics.includes('accommodation')){
    const lines=[];
    if(facts.arrival&&facts.departure){
      lines.push({
        hu:'A kért időszak: '+formatDate(facts.arrival,lang)+' – '+formatDate(facts.departure,lang)+'.',
        de:'Gewünschter Zeitraum: '+formatDate(facts.arrival,lang)+' – '+formatDate(facts.departure,lang)+'.',
        en:'Requested dates: '+formatDate(facts.arrival,lang)+' – '+formatDate(facts.departure,lang)+'.',
        si:'Želeni termin: '+formatDate(facts.arrival,lang)+' – '+formatDate(facts.departure,lang)+'.'
      }[lang]);
    }
    if(facts.guests)lines.push({hu:'Létszám: '+facts.guests+' fő.',de:'Personenzahl: '+facts.guests+'.',en:'Party size: '+facts.guests+' guests.',si:'Število gostov: '+facts.guests+'.'}[lang]);
    if(facts.cabin)lines.push({hu:'Kért háztípus: '+cabinLabel(facts.cabin,lang)+'.',de:'Gewünschter Haustyp: '+cabinLabel(facts.cabin,lang)+'.',en:'Requested cabin: '+cabinLabel(facts.cabin,lang)+'.',si:'Želeni tip hiške: '+cabinLabel(facts.cabin,lang)+'.'}[lang]);
    if(lines.length)blocks.push(lines.join('\n'));
  }

  if(topics.includes('availability')&&availability){
    const labels=availability.options.join(', ');
    blocks.push({hu:'Szabad lehetőségek: '+labels+'.',de:'Freie Möglichkeiten: '+labels+'.',en:'Available options: '+labels+'.',si:'Proste možnosti: '+labels+'.'}[lang]);
  }

  if(topics.includes('availability')&&!availability)blocks.push(choose(lang,DATA.pending.availability));
  if(topics.includes('price')&&!quote)blocks.push(choose(lang,DATA.pending.price));
  if(topics.includes('price')&&quote){
    const suffix=quote.eurTotal!==null?' / '+euro(quote.eurTotal):'';
    const lines=[{hu:'Teljes ár: '+money(quote.total)+suffix+'.',de:'Gesamtpreis: '+money(quote.total)+suffix+'.',en:'Total price: '+money(quote.total)+suffix+'.',si:'Skupna cena: '+money(quote.total)+suffix+'.'}[lang]];
    if(quote.accommodation!==null)lines.push({hu:'Szállásdíj: '+money(quote.accommodation)+'.',de:'Unterkunft: '+money(quote.accommodation)+'.',en:'Accommodation: '+money(quote.accommodation)+'.',si:'Nastanitev: '+money(quote.accommodation)+'.'}[lang]);
    if(quote.tourismTax!==null)lines.push({hu:'Idegenforgalmi adó: '+money(quote.tourismTax)+'.',de:'Ortstaxe: '+money(quote.tourismTax)+'.',en:'Tourist tax: '+money(quote.tourismTax)+'.',si:'Turistična taksa: '+money(quote.tourismTax)+'.'}[lang]);
    for(const row of quote.unitBreakdown){
      const unitSuffix=row.eurTotal!==null?' / '+euro(row.eurTotal):'';
      lines.push({hu:row.unit+'. egység: '+money(row.total)+unitSuffix+'.',de:row.unit+'. Einheit: '+money(row.total)+unitSuffix+'.',en:'Unit '+row.unit+': '+money(row.total)+unitSuffix+'.',si:row.unit+'. enota: '+money(row.total)+unitSuffix+'.'}[lang]);
    }
    blocks.push(lines.join('\n'));
  }

  if(topics.includes('hot_tub')){
    const h=DATA.hotTub;
    const tariff={
      hu:'Díja '+money(h.baseHufPer24Hours)+'/24 óra '+h.includedPeople+' főig, e fölött +'+money(h.extraPersonHufPer24Hours)+'/fő/24 óra.',
      de:'Preis: '+money(h.baseHufPer24Hours)+'/24 Stunden bis '+h.includedPeople+' Personen, darüber +'+money(h.extraPersonHufPer24Hours)+'/Person/24 Stunden.',
      en:'Rate: '+money(h.baseHufPer24Hours)+'/24 hours for up to '+h.includedPeople+' guests, then +'+money(h.extraPersonHufPer24Hours)+'/additional guest/24 hours.',
      si:'Cena: '+money(h.baseHufPer24Hours)+'/24 ur za največ '+h.includedPeople+' oseb, nato +'+money(h.extraPersonHufPer24Hours)+'/dodatno osebo/24 ur.'
    }[lang];
    blocks.push(choose(lang,h.text)+' '+tariff);
  }

  if(topics.includes('fishing'))blocks.push(choose(lang,DATA.fishing.text));

  if(topics.includes('booking_terms')){
    const b=DATA.booking, lines=[];
    const pct=facts.guests?b[facts.guests>=15?'depositPctFrom15Guests':'depositPctUnder15Guests']:null;
    if(typeof pct==='number')lines.push({hu:'Az előleg mértéke '+pct+'%.',de:'Die Anzahlung beträgt '+pct+'%.',en:'The deposit is '+pct+'%.',si:'Predplačilo znaša '+pct+'%.'}[lang]);
    lines.push((b.depositExactBoundaryRequiresReview===false?{hu:'A fizetési határidő az érkezésig hátralévő időtől függ: 14 napnál több idő esetén 7 nap, legfeljebb 14 nap esetén 24 óra. A konkrét fizetési határidőt és a külön ellenőrzendő lemondási feltételeket visszaigazoljuk.',de:'Die Zahlungsfrist beträgt bei mehr als 14 Tagen bis zur Anreise 7 Tage und bei höchstens 14 Tagen 24 Stunden. Den konkreten Zahlungstermin und die gesondert zu prüfenden Stornobedingungen bestätigen wir separat.',en:'The payment window is 7 days when arrival is more than 14 days away, and 24 hours when it is at most 14 days away. We confirm the exact payment deadline and the separately reviewed cancellation terms.',si:'Rok plačila je 7 dni pri več kot 14 dneh do prihoda in 24 ur pri največ 14 dneh. Točen rok plačila in posebej preverjene pogoje odpovedi potrdimo ločeno.'}:{hu:'A fizetési határidő az érkezésig hátralévő időtől függ: 14 napnál több idő esetén 7 nap, 14 napnál kevesebb idő esetén 24 óra. Pontosan 14 nap esetén emberi egyeztetés szükséges. A konkrét fizetési és lemondási feltételeket külön visszaigazoljuk.',de:'Die Zahlungsfrist beträgt bei mehr als 14 Tagen bis zur Anreise 7 Tage, bei weniger als 14 Tagen 24 Stunden. Genau 14 Tage erfordern eine menschliche Prüfung. Die konkreten Zahlungs- und Stornobedingungen bestätigen wir separat.',en:'The payment window is 7 days when arrival is more than 14 days away, and 24 hours when it is fewer than 14 days away. Exactly 14 days requires human review. We confirm the specific payment and cancellation terms separately.',si:'Rok plačila je 7 dni pri več kot 14 dneh do prihoda in 24 ur pri manj kot 14 dneh. Natanko 14 dni zahteva človeški pregled. Konkretne plačilne pogoje in pogoje odpovedi potrdimo posebej.'})[lang]);
    if(lines.length)blocks.push(lines.join('\n'));
  }

  if(topics.includes('parking')&&DATA.operations.parkingAvailable)blocks.push({hu:'Parkolási lehetőség biztosított.',de:'Parkmöglichkeiten sind vorhanden.',en:'Parking is available.',si:'Parkiranje je zagotovljeno.'}[lang]);
  if(topics.includes('pet'))blocks.push({hu:'Háziállat hozható; díja '+money(DATA.operations.petFeeHufPerPetPerDay)+'/állat/nap.',de:'Haustiere sind erlaubt; die Gebühr beträgt '+money(DATA.operations.petFeeHufPerPetPerDay)+' pro Tier und Tag.',en:'Pets are allowed; the fee is '+money(DATA.operations.petFeeHufPerPetPerDay)+' per pet per day.',si:'Hišni ljubljenčki so dovoljeni; pristojbina znaša '+money(DATA.operations.petFeeHufPerPetPerDay)+' na žival na dan.'}[lang]);
  if(topics.includes('arrival_departure'))blocks.push({hu:'A szállás '+DATA.operations.checkinFrom+'-tól foglalható el, távozáskor '+DATA.operations.checkoutBy+'-ig kell elhagyni.',de:'Check-in ist ab '+DATA.operations.checkinFrom+' Uhr möglich; am Abreisetag ist die Unterkunft bis '+DATA.operations.checkoutBy+' Uhr zu verlassen.',en:'Check-in is available from '+DATA.operations.checkinFrom+'; on departure day the accommodation must be vacated by '+DATA.operations.checkoutBy+'.',si:'Prijava je mogoča od '+DATA.operations.checkinFrom+'; na dan odhoda je treba nastanitev zapustiti do '+DATA.operations.checkoutBy+'.'}[lang]);

  const qs=questions(model);
  if(qs.length)blocks.push(qs.join('\n'));

  const result=[greeting,'',thanks,blocks.length?'\n'+blocks.join('\n\n'):'','',closing,DATA.brandName].join('\n').replace(/\n{3,}/g,'\n\n').trim();
  return assertGuestSafeOutput(result);
}
