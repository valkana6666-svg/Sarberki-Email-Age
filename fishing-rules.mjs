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

export function fishingQuestion(text='', language='hu') {
  if (!/horgász|hal(?:at|at fog|elvitel|ár)|ponty|csuka|süllő|harcsa|hor(?:og|got|gok)|szakállas|normál\s*tó|rekord\s*tó|angeln|fishing|\bfish\b|fish(?:ing)? ticket|barbed|hook|haken|widerhaken|mindestmaß|min(?:imum)?\s+(?:fish\s+)?size|ribolov|trnek|trnki|zalust/iu.test(text)) return null;
  const lang=['hu','de','en','si'].includes(language)?language:'hu';
  const wantsHook=/(?:szakállas|szakáll nélküli|hor(?:og|got|gok)|barbed\s+hooks?|barbless\s+hooks?|haken|widerhaken|trnek|trnki|zalust)/iu.test(text);
  const wantsGeneral=/(?:horgászat(?:nak)?[^.!?\n]{0,80}(?:feltétel|szabály)|milyen[^.!?\n]{0,80}(?:horgászati|horgászat)[^.!?\n]{0,40}(?:feltétel|szabály)|horgász(?:ni|nánk|nénk|nék)|fishing[^.!?\n]{0,80}(?:conditions|rules|requirements)|(?:would|want|like)[^.!?\n]{0,40}(?:to\s+)?fish|angeln[^.!?\n]{0,80}(?:bedingungen|regeln|voraussetzungen)|möcht(?:e|en)[^.!?\n]{0,40}angeln|ribolov[^.!?\n]{0,80}(?:pogoji|pravila)|(?:želel|želeli|radi)[^.!?\n]{0,40}(?:ribolov|loviti))/iu.test(text);
  const wantsNormal24=/(?:normál(?:\s*tó)?|normal\s+lake|normalteich|normal\s+see|normalno\s+jezero)/iu.test(text)
    && /(?:24\s*(?:ór|h|hour|stunden|ur)|24-hour|napijegy|day\s*ticket|tageskarte)/iu.test(text);
  const wantsChild=/(?:gyermek|gyerek|child|children|kinder|otrok)/iu.test(text) && /(?:jegy|ticket|karte|vstopnic|ribolov)/iu.test(text);
  const wantsMinimum=/(?:minimum|minimális|legkisebb|méretkorlát|minimum\s+(?:fish\s+)?size|minimum size|mindestmaß|mindestgr|najmanjša\s+mera|minimalna\s+mera)/iu.test(text);
  const wantsTakeaway=/(?:elvihető|elvitel|hazavi|fish[^.!?\n]{0,50}(?:take[- ]?away|take\s+home)|takeaway|mitnehmen|entnahme|odnes|odvzem)/iu.test(text)
    && /(?:ár|price|cost|preis|cena|kg)/iu.test(text);
  const answers=[];
  if(wantsGeneral){
    answers.push({
      hu:'A horgászathoz Magyarországra érvényes állami horgászjegy szükséges. Csak szakáll nélküli, legfeljebb 6-os méretű horog használható. Kötelező felszerelés a pontybölcső, merítőháló, sebfertőtlenítő és pontyzsák. A választott tóhoz és időtartamhoz tartozó Sárberki horgászjegyet külön kell kiválasztani.',
      de:'Zum Angeln ist ein in Ungarn gültiger staatlicher Angelschein erforderlich. Es dürfen nur widerhakenlose Haken bis maximal Größe 6 verwendet werden. Abhakmatte, Kescher, Wunddesinfektionsmittel und Karpfensack sind erforderlich. Die Sárberki-Angelkarte wird je nach See und Gültigkeitsdauer separat gewählt.',
      en:'Fishing requires a state fishing licence valid in Hungary. Only barbless hooks up to size 6 may be used. A carp cradle/unhooking mat, landing net, wound disinfectant and carp sack are required. The Sárberki fishing ticket is selected separately according to the lake and duration.',
      si:'Za ribolov je potrebna državna ribolovna dovolilnica, veljavna na Madžarskem. Dovoljeni so le trnki brez zalusti do največ velikosti 6. Potrebni so podloga za krape, podmetalka, razkužilo za rane in vreča za krape. Ribolovna karta Sárberki se izbere posebej glede na jezero in trajanje.'
    }[lang]);
  }
  if(wantsNormal24){
    answers.push({
      hu:'Normál tó: a 24 órás felnőtt jegy 7 500 Ft, a gyermekjegy 3 750 Ft. Magyarországra érvényes állami horgászjegy szükséges.',
      de:'Normal-See: Die 24-Stunden-Karte kostet für Erwachsene 7.500 Ft und für Kinder 3.750 Ft. Ein für Ungarn gültiger staatlicher Angelschein ist erforderlich.',
      en:'Normal lake: the 24-hour adult ticket is 7,500 HUF and the child ticket is 3,750 HUF. A state fishing licence valid in Hungary is required.',
      si:'Normalno jezero: 24-urna odrasla karta stane 7.500 HUF, otroška pa 3.750 HUF. Potrebna je državna ribolovna dovolilnica, veljavna na Madžarskem.'
    }[lang]);
  } else if(wantsChild){
    answers.push({
      hu:'Gyermekjegy külön váltható; a pontos ár a választott tó és jegy időtartama szerint változik.',
      de:'Für Kinder gibt es eine eigene Karte; der genaue Preis hängt vom gewählten See und der Gültigkeitsdauer ab.',
      en:'Children use a separate ticket; the exact price depends on the lake and ticket duration.',
      si:'Za otroke je potrebna ločena karta; natančna cena je odvisna od jezera in trajanja karte.'
    }[lang]);
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
  const kind=answers.length>1?'combined':wantsGeneral?'general_conditions':wantsHook?'rule':wantsNormal24?'normal_24h_adult':'review';
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
