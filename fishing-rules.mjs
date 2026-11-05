// Sárberki-only knowledge. Never combine these prices with accommodation totals.
export const fishing = Object.freeze({
  namespace: 'sarberki_specific.fishing',
  source: 'https://sarberkito.hu/horgaszat/',
  rulesSource: 'https://sarberkito.hu/sarberki-horgaszto-horgaszati-szabalyai/',
  verifiedAt: '2026-09-28', validFrom: '2026-01-01', currency: 'HUF',
  tickets: {
    normal: {adult: {hours12:5000,hours24:7500,week:32500,year:86000,half1:43000,half2:53000}, child:{hours12:2500,hours24:3750,week:16250,year:43000,half1:21500,half2:26500}},
    record: {adult: {hours12:7500,hours24:11250,week:48750,year:129000,half1:64500,half2:80000}, child:{hours12:3750,hours24:5650,week:24500,year:64500,half1:32250,half2:39750}}
  },
  fishPerKg: {zander:4500,pike:4500,catfish:1500,catfishNonAngler:3500,carpUnder5Kg:2000,grassCarpUnder5Kg:2000,bream:1350,crucian:1350},
  extrasPerDay: {cradle:1000,cart:600},
  minimumCm: {zander:30,pike:40,carp:30,grassCarp:40,catfish:50}
});

// Single source of the general fishing rules sentence (email, chatbot and public reply panel).
export const FISHING_GENERAL_TEXT=Object.freeze({
      hu:'A horgászathoz Magyarországra érvényes állami horgászjegy szükséges. Csak szakáll nélküli, legfeljebb 6-os méretű horog használható. Kötelező felszerelés a pontybölcső, merítőháló, sebfertőtlenítő és pontyzsák. A választott tóhoz és időtartamhoz tartozó Sárberki horgászjegyet külön kell kiválasztani.',
      de:'Zum Angeln ist ein in Ungarn gültiger staatlicher Angelschein erforderlich. Es dürfen nur widerhakenlose Haken bis maximal Größe 6 verwendet werden. Abhakmatte, Kescher, Wunddesinfektionsmittel und Karpfensack sind erforderlich. Die Sárberki-Angelkarte wird je nach See und Gültigkeitsdauer separat gewählt.',
      en:'Fishing requires a state fishing licence valid in Hungary. Only barbless hooks up to size 6 may be used. A carp cradle/unhooking mat, landing net, wound disinfectant and carp sack are required. The Sárberki fishing ticket is selected separately according to the lake and duration.',
      si:'Za ribolov je potrebna državna ribolovna dovolilnica, veljavna na Madžarskem. Dovoljeni so le trnki brez zalusti do največ velikosti 6. Potrebni so podloga za krape, podmetalka, razkužilo za rane in vreča za krape. Ribolovna karta Sárberki se izbere posebej glede na jezero in trajanje.'
    });

export function fishingQuestion(text='', language='hu') {
  // Gyakori ékezet nélküli magyar levél; a díjakat és szabályokat nem változtatja.
  text=String(text).replace(/horgasz/giu,'horgász').replace(/szabaly/giu,'szabály').replace(/szakall/giu,'szakáll');
  if (!/horgász|hal(?:at|at fog|elvitel|ár)|ponty|csuka|süllő|harcsa|hor(?:og|got|gok)|szakállas|normál\s*tó|rekord\s*tó|angeln|angel(?:karte|schein)|fishing|\bfish\b|fish(?:ing)? ticket|barbed|hook|haken|widerhaken|mindestmaß|min(?:imum)?\s+(?:fish\s+)?size|ribolov|lovili\s+ribe|loviti\s+ribe|trnek|trnki|zalust/iu.test(text)) return null;
  const lang=['hu','de','en','si'].includes(language)?language:'hu';
  const wantsHook=/(?:szakállas|szakáll nélküli|hor(?:og|got|gok)|barbed\s+hooks?|barbless\s+hooks?|haken|widerhaken|trnek|trnki|zalust)/iu.test(text);
  const wantsGeneral=/(?:horgászat(?:nak)?[^.!?\n]{0,80}(?:feltétel|szabály)|milyen[^.!?\n]{0,80}(?:horgászati|horgászat)[^.!?\n]{0,40}(?:feltétel|szabály)|horgász(?:ni|nánk|nénk|nék)|fishing[^.!?\n]{0,80}(?:conditions|rules|requirements)|(?:would|want|like)[^.!?\n]{0,40}(?:to\s+)?fish|angeln[^.!?\n]{0,80}(?:bedingungen|regeln|voraussetzungen)|möcht(?:e|en)[^.!?\n]{0,40}angeln|ribolov[^.!?\n]{0,80}(?:pogoji|pravila)|(?:želel|želeli|radi)[^.!?\n]{0,50}(?:ribolov|loviti|lovili\s+ribe))/iu.test(text);
  const wantsNormal24=/(?:normál(?:\s*tó)?|normal\s+lake|normalteich|normal\s+see|normalno\s+jezero)/iu.test(text)
    && /(?:24\s*(?:ór|h|hour|stunden|ur)|24-hour|napijegy|day\s*ticket|tageskarte)/iu.test(text);
  const wantsChild=/(?:gyermek|gyerek|child|children|kinder|otrok)/iu.test(text) && /(?:jegy|ticket|karte|vstopnic|ribolov)/iu.test(text);
  const wantsMinimum=/(?:minimum|minimális|legkisebb|méretkorlát|minimum\s+(?:fish\s+)?size|minimum size|mindestmaß|mindestgr|najmanjša\s+mera|minimalna\s+mera)/iu.test(text);
  const wantsTakeaway=/(?:elvihető|elvitel|hazavi|fish[^.!?\n]{0,50}(?:take[- ]?away|take\s+home)|takeaway|mitnehmen|entnahme|odnes|odvzem)/iu.test(text)
    && /(?:ár|price|cost|preis|cena|kg)/iu.test(text);
  const asksTicket=/(?:jegy|ticket|karte|kart[ae]\b|dovolilnic|vstopnic)/iu.test(text)||wantsNormal24||wantsChild;
  const answers=[];
  if(wantsGeneral){
    answers.push(FISHING_GENERAL_TEXT[lang]);
  }
  // Tickets (owner 2026-11-05): a general ticket question lists the 24-hour and weekly tickets of both
  // lakes (adult / child); a specific question lists only what was asked. No yearly/half-year tickets in
  // guest replies. Cabin guests cannot buy a 12-hour ticket; they buy the 24-hour one.
  if(asksTicket){
   const t=fishing.tickets,money=n=>({hu:String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ')+' Ft',de:String(n).replace(/\B(?=(\d{3})+(?!\d))/g,'.')+' Ft',en:String(n).replace(/\B(?=(\d{3})+(?!\d))/g,',')+' HUF',si:String(n).replace(/\B(?=(\d{3})+(?!\d))/g,'.')+' HUF'})[lang];
   const want24=/(?:24\s*(?:ór|h\b|hour|stunden|ur\b)|24-hour|napi(?:jegy)?|day\s*ticket|tageskarte|dnevn)/iu.test(text);
   const wantWeek=/(?:heti|week(?:ly)?|woche|wochen|tedensk)/iu.test(text);
   const durations=(want24||wantWeek)?[want24&&'hours24',wantWeek&&'week'].filter(Boolean):['hours24','week'];
   const normal=/(?:normál|normal)/iu.test(text),record=/(?:rekord|record)/iu.test(text);
   const lakes=normal!==record?[normal?'normal':'record']:['normal','record'];
   const W={hu:{head:'Horgászjegyek (felnőtt / gyermek):',normal:'Normál tó',record:'Rekord tó',hours24:'24 órás',week:'heti',valid:'A rekord tavi jegy a normál tóra is érvényes.',no12:'Faházvendégeknek 12 órás jegy nem váltható; nekik 24 órás jegyet kell váltani.'},
    de:{head:'Angelkarten (Erwachsene / Kinder):',normal:'Normal-See',record:'Rekord-See',hours24:'24 Stunden',week:'Woche',valid:'Die Karte für den Rekord-See gilt auch am Normal-See.',no12:'Hausgäste können keine 12-Stunden-Karte kaufen; für sie gilt die 24-Stunden-Karte.'},
    en:{head:'Fishing tickets (adult / child):',normal:'Normal lake',record:'Record lake',hours24:'24-hour',week:'weekly',valid:'The record-lake ticket is also valid at the normal lake.',no12:'Cabin guests cannot buy a 12-hour ticket; they need the 24-hour ticket.'},
    si:{head:'Ribolovne karte (odrasli / otroci):',normal:'Normalno jezero',record:'Rekordno jezero',hours24:'24-urna',week:'tedenska',valid:'Karta za rekordno jezero velja tudi na normalnem jezeru.',no12:'Gostje hišk ne morejo kupiti 12-urne karte; zanje velja 24-urna karta.'}}[lang];
   const rows=lakes.map(lake=>'– '+W[lake]+': '+durations.map(d=>W[d]+' '+money(t[lake].adult[d]).replace(/ (Ft|HUF)$/,'')+' / '+money(t[lake].child[d])).join('; ')+'.');
   const notes=[(lakes.includes('record'))&&W.valid,(durations.includes('hours24')||/12\s*(?:ór|h\b|hour|stunden|ur\b)|12-hour/iu.test(text))&&W.no12].filter(Boolean);
   answers.push([W.head,...rows,...notes].join('\n'));
  }
  if(wantsHook) answers.push({
    hu:'Szakállas horog nem használható; kizárólag szakáll nélküli, legfeljebb 6-os méretű horog engedélyezett.',
    de:'Haken mit Widerhaken sind nicht erlaubt; zulässig sind nur widerhakenlose Haken bis maximal Größe 6.',
    en:'Barbed hooks are not allowed; only barbless hooks up to size 6 may be used.',
    si:'Trnki z zalustjo niso dovoljeni; dovoljeni so le trnki brez zalusti do največ velikosti 6.'
  }[lang]);
  if(wantsMinimum) answers.push({
    hu:'Minimum méretek: süllő 30 cm, csuka 40 cm, ponty 30 cm, amur 40 cm, harcsa 50 cm.',
    de:'Mindestmaße: Zander 30 cm, Hecht 40 cm, Karpfen 30 cm, Graskarpfen 40 cm, Wels 50 cm.',
    en:'Minimum sizes: zander 30 cm, pike 40 cm, carp 30 cm, grass carp 40 cm, catfish 50 cm.',
    si:'Najmanjše mere: smuč 30 cm, ščuka 40 cm, krap 30 cm, amur 40 cm, som 50 cm.'
  }[lang]);
  if(wantsTakeaway) answers.push({
    hu:'Elvihető hal ára kilogrammonként: süllő 4 500 Ft, csuka 4 500 Ft, harcsa 1 500 Ft, 5 kg alatti ponty 2 000 Ft, 5 kg alatti amur 2 000 Ft, keszeg 1 350 Ft, kárász 1 350 Ft.',
    de:'Preis für entnommenen Fisch pro kg: Zander 4.500 Ft, Hecht 4.500 Ft, Wels 1.500 Ft, Karpfen unter 5 kg 2.000 Ft, Graskarpfen unter 5 kg 2.000 Ft, Brasse 1.350 Ft, Karausche 1.350 Ft.',
    en:'Take-away fish prices per kg: zander 4,500 HUF, pike 4,500 HUF, catfish 1,500 HUF, carp under 5 kg 2,000 HUF, grass carp under 5 kg 2,000 HUF, bream 1,350 HUF, crucian carp 1,350 HUF.',
    si:'Cena odnesenih rib na kg: smuč 4.500 HUF, ščuka 4.500 HUF, som 1.500 HUF, krap pod 5 kg 2.000 HUF, amur pod 5 kg 2.000 HUF, ploščič 1.350 HUF, koreselj 1.350 HUF.'
  }[lang]);
  if(!answers.length) answers.push({
    hu:'A horgászati kérdés tó, jegytípus és korcsoport szerint ellenőrizendő.',
    de:'Die Angelanfrage muss nach See, Kartentyp und Altersgruppe geprüft werden.',
    en:'The fishing question needs to be checked by lake, ticket type and age group.',
    si:'Ribolovno vprašanje je treba preveriti glede na jezero, vrsto karte in starostno skupino.'
  }[lang]);
  const kind=answers.length>1?'combined':wantsGeneral?'general_conditions':wantsHook?'rule':asksTicket?'tickets':'review';
  return {namespace:fishing.namespace,kind,answer:answers.join(' '),
    source:wantsHook||wantsMinimum?fishing.rulesSource:fishing.source,verifiedAt:fishing.verifiedAt,validFrom:fishing.validFrom,
    accommodationTotalAffected:false};
}

if (typeof document !== 'undefined') {
  const panel=document.getElementById('fishing_panel');
  const show=()=>{
    const original=document.getElementById('gmail_record')?.classList.contains('hidden') ? document.getElementById('message')?.value : document.getElementById('gmail_original')?.textContent;
    const result=fishingQuestion(original||'');
    panel.hidden=!result;
    if(result) panel.textContent=`Horgászati modul · ${result.answer} Forrás: ${result.source} · Ellenőrizve: ${result.verifiedAt} · Érvényes: ${result.validFrom}. A szállásárhoz nem adtuk hozzá.`;
  };
  document.getElementById('prepare_price')?.addEventListener('click',show);
  document.addEventListener('sarberki:record-loaded',show);
  document.getElementById('load_gmail_record')?.addEventListener('click',show);
  document.getElementById('analyze')?.addEventListener('click',show);
  document.getElementById('message')?.addEventListener('input',show);
}
