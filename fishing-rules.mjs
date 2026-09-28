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

export function fishingQuestion(text='') {
  if (!/horgász|hal(?:at|at fog|elvitel|ár)|ponty|csuka|süllő|harcsa|hor(?:og|got|gok)|szakállas|normál\s*tó|rekord\s*tó|angeln|fishing|fish(?:ing)? ticket/iu.test(text)) return null;
  const rule = /szakállas|szakáll nélküli|hor(?:og|got|gok)|pontybölcső|fonott|főzsinór/iu.test(text);
  const normal24 = /normál(?: tó)?/iu.test(text) && /24\s*ór|egy nap|napijegy/iu.test(text);
  return {namespace:fishing.namespace,kind:rule?'rule':normal24?'normal_24h_adult':'review',
    answer:rule&&/szakállas|hor(?:og|got|gok)/iu.test(text)?'Szakállas horog nem használható; kizárólag szakáll nélküli, legfeljebb 6-os méretű horog engedélyezett.':normal24?'Normál tó, 24 órás felnőtt horgászjegy: 7 500 Ft. Gyermekjegy: 3 750 Ft. Magyarországra érvényes állami horgászjegy szükséges.':'A horgászati kérdés tó, jegytípus és korcsoport szerint ellenőrizendő.',
    source:rule?fishing.rulesSource:fishing.source,verifiedAt:fishing.verifiedAt,validFrom:fishing.validFrom,
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
