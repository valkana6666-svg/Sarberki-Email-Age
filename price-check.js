(() => {
  const $ = id => document.getElementById(id);
  const cabins = {deluxe:'Deluxe',family:'Családi',vip:'VIP',small:'Különálló 2 fős'};
  function explicitCabin(message='') {
    const found=[];
    if (/\bvip\b/iu.test(message)) found.push('vip');
    if (/\b(?:családi|family|familien)\b/iu.test(message)) found.push('family');
    if (/\bdeluxe\b/iu.test(message)) found.push('deluxe');
    if (/\b(?:osztott|split|geteilte[rs]?|deljen[ai]?)\b/iu.test(message)) found.push('split');
    return found.length===1 ? found[0] : '';
  }
  function gmailNormalizedDate() {
    try {
      const raw=document.getElementById('gmail_json')?.value;
      if(!raw) return null;
      const record=JSON.parse(raw);
      const item=(record.extracted||[]).find(x=>x && typeof x==='object' && /^Időszak/u.test(x.label||'') && /^20\d{2}-\d{2}-\d{2} – 20\d{2}-\d{2}-\d{2}$/u.test(x.value||''));
      if(!item) return null;
      const [arrival,departure]=item.value.split(' – ');
      return {arrival,departure,inferred:/következtetett/u.test(item.label)};
    } catch { return null; }
  }
  function prepare(message) {
    const analysis = typeof extract === 'function' ? extract(message,'') : null;
    const fields = analysis?.fields || {};
    const gmailDate=gmailNormalizedDate();
    $('price_arrival').value = fields.arrival?.value || gmailDate?.arrival || '';
    $('price_departure').value = fields.departure?.value || gmailDate?.departure || '';
    const children = Number(fields.children?.value || 0);
    $('price_adults').value = children ? '' : (fields.adults?.value || fields.guests?.value || '');
    const unit=(fields.unit?.value || '').toLowerCase();
    const explicit = explicitCabin(message);
    $('price_cabin').value = explicit || Object.keys(cabins).find(k => unit.includes(cabins[k].toLowerCase())) || '';
    $('price_result').textContent = '';
    $('price_status').textContent = children ? 'Gyermek is szerepel a levélben. A gyermekkor szerinti árlekérés még nem működik; kézi ellenőrzés szükséges.' : !explicit ? 'Faház: ? – emberi döntésre vár. Melyik háztípust szeretnék: VIP, Családi, Deluxe vagy Osztott?' : 'Ellenőrizd a kinyert adatokat. Az automatikus lekérés jelenleg csak felnőttekkel működik.';
  }
  async function autoPrepareAndQuoteFromGmail() {
    const message=$('gmail_original')?.textContent||'';
    if(!message) return;
    prepare(message);
    const analysis=typeof extract==='function' ? extract(message,'') : null;
    const childCount=Number(analysis?.fields?.children?.value||0);
    const hasChildWord=/\b(?:gyerek|gyermek|gyerekek|gyermekek|children|child|kind(?:er)?|otroka)\b/iu.test(message);
    const gmailDate=gmailNormalizedDate();
    const complete=Boolean($('price_arrival').value&&$('price_departure').value&&$('price_cabin').value&&Number($('price_adults').value)>0);
    if(gmailDate?.inferred){
      $('price_status').textContent='Gmailből előkészítve: az év következtetett, ezért emberi jóváhagyás nélkül automatikus árlekérés nem indul.';
      return;
    }
    if(childCount>0||hasChildWord){
      $('price_status').textContent='Gmailből előkészítve: gyermekes érdeklődés, ezért automatikus árlekérés nem indult.';
      return;
    }
    if(!complete){
      $('price_status').textContent='Gmailből előkészítve: az automatikus árlekéréshez még pontos dátum, explicit háztípus és felnőtt létszám szükséges.';
      return;
    }
    $('price_status').textContent='Gmailből kinyert adatok teljesek; automatikus, csak olvasási jellegű árlekérés indul…';
    await $('check_price').onclick();
  }
  $('prepare_price').onclick = () => prepare($('gmail_record').classList.contains('hidden') ? $('message').value : $('gmail_original').textContent);
  $('check_price').onclick = async () => {
    const status=$('price_status'); status.textContent='Árlekérés folyamatban…';$('price_result').textContent='';
    const message=$('gmail_record').classList.contains('hidden') ? $('message').value : $('gmail_original').textContent;
    const analysis=typeof extract==='function' ? extract(message,'') : null;
    const childCount=Number(analysis?.fields?.children?.value||0);
    if (childCount>0 || /\b(?:gyerek|gyermek|gyerekek|gyermekek|children|kind(?:er)?|otroka)\b/iu.test(message)) {status.textContent='Gyermekes érdeklődés: életkor és hiteles gyermekár nélkül kézi ellenőrzés szükséges.';return;}
    const input={arrival:$('price_arrival').value,departure:$('price_departure').value,cabin:$('price_cabin').value,adults:Number($('price_adults').value),children:[]};
    if (!input.arrival || !input.departure || !input.cabin || !Number.isInteger(input.adults) || input.adults<1) {status.textContent='Pontos dátum, háztípus és létszám szükséges.';return;}
    try {
      const response=await fetch('/api/price-quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input),cache:'no-store'});
      if (!response.headers.get('content-type')?.includes('application/json')) throw Error('Az árlekérő szerver nincs ehhez az oldalhoz csatlakoztatva.');
      const result=await response.json(); if(!response.ok || result.status!=='review_required')throw Error(result.error||'Nem sikerült az árlekérés.');
      $('price_result').textContent=`${result.arrival}–${result.departure} · ${result.cabin} · ${result.adults} felnőtt · Szállás: ${result.accommodation.toLocaleString('hu-HU')} Ft · IFA: ${result.tourismTax.toLocaleString('hu-HU')} Ft · Teljes ár: ${result.total.toLocaleString('hu-HU')} Ft · Plusz fő díjkülönbsége és más bontás: nem igazolt · Forrás: ${result.source} · Lekérés: ${result.checkedAt} · Szezonfelár beépítése: nem igazolt · 20% törzsvendégkedvezmény: nincs alkalmazva`;
      status.textContent='A foglalási oldalon megjelenő ár ellenőrzésre vár. Nem került automatikusan a vendégválaszba, és foglalás nem történt.';
    } catch(e) {status.textContent=`Nincs igazolt ár: ${e.message} Nyisd meg a foglalási oldalt kézi ellenőrzésre.`;}
  };
  document.addEventListener('sarberki:gmail-normalized',()=>{autoPrepareAndQuoteFromGmail().catch(e=>{$('price_status').textContent='Automatikus árlekérés nem igazolható: '+e.message;});});
})();
