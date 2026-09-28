(() => {
  const $ = id => document.getElementById(id);
  const cabins = {deluxe:'Deluxe',family:'Családi',vip:'VIP',small:'Különálló 2 fős'};
  let approvedPrice = null;
  let pendingQuote = null;

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

  function currentMessage(){
    return $('gmail_record') && !$('gmail_record').classList.contains('hidden') ? ($('gmail_original')?.textContent||'') : ($('message')?.value||'');
  }

  function quoteFingerprint(){
    return [
      $('price_arrival')?.value||'',
      $('price_departure')?.value||'',
      $('price_cabin')?.value||'',
      $('price_adults')?.value||'',
      $('price_children')?.value||'',
      $('price_child_ages')?.value||''
    ].join('|');
  }

  function formatFt(value){
    return Number(value).toLocaleString('hu-HU')+' Ft';
  }

  function approvedPriceText(quote){
    if(!quote) return '';
    const total='A jóváhagyott teljes szállásár: '+formatFt(quote.total)+'.';
    if(Number.isFinite(quote.accommodation)&&Number.isFinite(quote.tourismTax)){
      return total+' Ebből szállás: '+formatFt(quote.accommodation)+', IFA: '+formatFt(quote.tourismTax)+'.';
    }
    return total;
  }

  function clearApprovedPrice(reason=''){
    approvedPrice=null;
    pendingQuote=null;
    const button=$('approve_price');
    if(button) button.disabled=true;
    const input=$('approved_price_manual');
    if(input) input.value='';
    const status=$('price_approval_status');
    if(status) status.textContent=reason||'Ár nincs jóváhagyva. A vendégválaszba csak emberi jóváhagyás után kerülhet összeg.';
  }

  function buildPriceApprovalUi(){
    if($('price_approval_panel')) return;
    const result=$('price_result');
    if(!result) return;
    const panel=document.createElement('div');
    panel.id='price_approval_panel';
    panel.className='warning';
    panel.innerHTML='<strong>Ár jóváhagyása</strong><p class="muted">A lekért vagy kézzel ellenőrzött teljes árat először itt hagyd jóvá. A jóváhagyás csak a választervezetet egészíti ki; e-mailt nem küld.</p><label for="approved_price_manual">Ellenőrzött teljes ár (Ft)</label><input id="approved_price_manual" type="number" min="1" step="1" inputmode="numeric" placeholder="pl. 128000"><button id="approve_price" type="button" disabled>Ár jóváhagyása és beépítése a levélbe</button><p id="price_approval_status" class="muted" role="status">Ár nincs jóváhagyva.</p>';
    result.insertAdjacentElement('afterend',panel);
    $('approved_price_manual').addEventListener('input',()=>{
      const n=Number($('approved_price_manual').value);
      $('approve_price').disabled=!(Number.isFinite(n)&&n>0);
      pendingQuote=Number.isFinite(n)&&n>0?{total:Math.round(n),source:'kézi ellenőrzés',fingerprint:quoteFingerprint()}:null;
      approvedPrice=null;
      $('price_approval_status').textContent=pendingQuote?`Ellenőrzött ár előkészítve: ${formatFt(pendingQuote.total)} · jóváhagyásra vár.`:'Adj meg egy ellenőrzött teljes árat.';
    });
    $('approve_price').addEventListener('click',approvePriceIntoDraft);
  }

  function prepare(message) {
    const analysis = typeof extract === 'function' ? extract(message,'') : null;
    const fields = analysis?.fields || {};
    const gmailDate=gmailNormalizedDate();
    $('price_arrival').value = fields.arrival?.value || gmailDate?.arrival || '';
    $('price_departure').value = fields.departure?.value || gmailDate?.departure || '';
    const children = Number(fields.children?.value || 0);
    $('price_adults').value = fields.adults?.value || (children ? '' : fields.guests?.value || '');
    if ($('price_children')) $('price_children').value = String(children);
    if ($('price_child_ages')) $('price_child_ages').value = fields.child_ages?.value || '';
    const unit=(fields.unit?.value || '').toLowerCase();
    const explicit = explicitCabin(message);
    $('price_cabin').value = explicit || Object.keys(cabins).find(k => unit.includes(cabins[k].toLowerCase())) || '';
    $('price_result').textContent = '';
    clearApprovedPrice('Az érdeklődés adatai frissültek; az árat újra ellenőrizni és jóváhagyni kell.');
    $('price_status').textContent = children ? 'Gyermekes foglalás adatai átvéve (felnőttek, gyermekek és gyermekkorok). Automatikus árbecslés nem indul; kézi/hiteles árlekérés szükséges.' : !explicit ? 'Faház: ? – emberi döntésre vár. Melyik háztípust szeretnék: VIP, Családi, Deluxe vagy Osztott?' : 'Ellenőrizd a kinyert adatokat. Az automatikus lekérés jelenleg csak felnőttekkel működik.';
  }

  function huAskedTopics(message='',analysis=null){
    const topics=analysis?.topics?.secondary_intents||[];
    return {
      price:/(?:mennyi|mennyibe|ár(?:a|ak|at)?|teljes\s+ár|díj)/iu.test(message),
      availability:/(?:szabad|elérhető|foglalható|van[- ]?e\s+(?:hely|szabad)|kapacitás)/iu.test(message),
      pet:topics.includes('pet_question')||/\b(?:kuty|háziállat|kisállat)\w*/iu.test(message),
      hotTub:analysis?.topics?.requested_addons?.includes('hot_tub')||/dézs[áa]|dézsafürdő|jacuzzi/iu.test(message),
      amenities:topics.includes('amenities_question'),
      deposit:topics.includes('deposit_question')||/előleg/iu.test(message),
      cancellation:topics.includes('cancellation_terms_question')||/lemondási|lemondani.*feltét/iu.test(message),
      electricity:topics.includes('electricity_question'),
      firewood:topics.includes('firewood_question'),
      pier:topics.includes('pier_question'),
      parking:topics.includes('parking_question'),
      arrivalTime:topics.includes('arrival_time_question')
    };
  }

  function focusedReply(message=''){
    const analysis=typeof extract==='function'?extract(message,''):null;
    if(!analysis||analysis.fields?.language?.value!=='HU') return '';
    if(['cancellation_request','modification_request'].includes(analysis.intent)) return '';
    const f=analysis.fields||{};
    const v=Object.fromEntries(Object.entries(f).map(([k,x])=>[k,x?.value||'']));
    const asked=huAskedTopics(message,analysis);
    const lines=[`Kedves ${v.name||'Érdeklődő'}!`,'','Köszönjük érdeklődését a Sárberki Horgásztó iránt.'];

    const bookingBits=[];
    if(v.arrival&&v.departure) bookingBits.push(`${v.arrival} – ${v.departure}`);
    if(v.nights) bookingBits.push(`${v.nights} éjszakára`);
    if(v.guests) bookingBits.push(`${v.guests} fő részére`);
    if(bookingBits.length) lines.push('',`A megadott foglalási adatok: ${bookingBits.join(', ')}.`);

    const party=[];
    if(v.adults) party.push(`${v.adults} felnőtt`);
    if(v.children) party.push(`${v.children} gyermek${v.child_ages?` (${v.child_ages} éves)`:''}`);
    if(party.length) lines.push(`A vendégek összetétele: ${party.join(', ')}.`);

    const plan=typeof accommodationPlan==='function'?accommodationPlan(v):null;
    if(plan?.specific&&v.unit) lines.push(`A kért háztípus: ${v.unit}.`);
    else if(v.unit&&!/^(?:ház|faház|apartman|cabin)$/iu.test(v.unit)) lines.push(`A megadott szállástípus: ${v.unit}.`);
    else if(!v.unit) lines.push('A megfelelő háztípus pontosításához kérjük, írja meg, melyik típust szeretné.');

    const priceApproved=asked.price&&approvedPrice&&approvedPrice.fingerprint===quoteFingerprint();
    if(asked.availability&&asked.price){
      if(priceApproved) lines.push('','A megadott időszakra a kért szállás szabad kapacitását ellenőrizzük. '+approvedPriceText(approvedPrice));
      else lines.push('','A megadott időszakra a kért szállás szabad kapacitását ellenőrizzük. A pontos árról az ellenőrzést követően tájékoztatást adunk.');
    } else if(asked.availability) {
      lines.push('','A megadott időszakra ellenőrizzük a kért szállás szabad kapacitását, és az ellenőrzés után visszaigazoljuk az elérhetőséget.');
    } else if(asked.price) {
      if(priceApproved) lines.push('','A megadott adatok alapján '+approvedPriceText(approvedPrice));
      else lines.push('','A pontos árról az ellenőrzést követően tájékoztatást adunk.');
    }

    if(asked.pet) lines.push('','Háziállat térítés ellenében hozható, díja 2 000 Ft/nap/állat.');
    if(asked.hotTub) lines.push('','A dézsa iránti igényét figyelembe vettük.');

    if(asked.amenities) lines.push('','A felszereltséggel kapcsolatban a levélben feltett kérdésre külön, a kiválasztott háztípus biztos adatai alapján válaszolunk.');
    if(asked.deposit) lines.push('','Az előlegre vonatkozó kérdést a foglalási feltételek alapján külön ellenőrizzük és pontosan megválaszoljuk.');
    if(asked.cancellation) lines.push('','A lemondási feltételekre vonatkozó kérdést a foglalás létszáma és időpontja alapján külön megválaszoljuk.');
    if(asked.electricity) lines.push('','Az áramfogyasztással kapcsolatos kérdést a mérőállásos elszámolási szabály alapján külön megválaszoljuk.');
    if(asked.firewood) lines.push('','A tűzifával kapcsolatos kérdést külön megválaszoljuk; pontos díjat csak hitelesített adat alapján írunk.');
    if(asked.pier) lines.push('','A stéghasználatot a kiválasztott háztípus alapján pontosítjuk.');
    if(asked.parking) lines.push('','A parkolási lehetőséget a megadott autószám és háztípus alapján pontosítjuk.');
    if(asked.arrivalTime) lines.push('','A megadott érkezési időpontot is figyelembe vettük, és visszaigazoljuk, hogy az adott érkezési idő megfelelő-e.');

    const missing=[];
    if(!v.arrival||!v.departure) missing.push('pontos érkezési és távozási dátum');
    if(!v.guests) missing.push('vendéglétszám');
    if(v.children&&Number(v.children)>0&&analysis.warning_codes?.includes('missing_child_ages')) missing.push('gyermek(ek) életkora');
    if(missing.length) lines.push('',`A pontos válaszhoz még szükségünk van erre: ${missing.join(', ')}.`);

    lines.push('','','Üdvözlettel:','Sárberki Horgásztó');
    return lines.join('\n');
  }

  function applyFocusedReply(message=''){
    const reply=focusedReply(message);
    const box=$('draft');
    if(reply&&box) box.value=reply;
    const gmailBox=$('gmail_draft');
    if(reply&&gmailBox&&$('gmail_record')&&!$('gmail_record').classList.contains('hidden')) gmailBox.value=reply;
  }

  function approvePriceIntoDraft(){
    const inputValue=Number($('approved_price_manual')?.value||pendingQuote?.total||0);
    if(!Number.isFinite(inputValue)||inputValue<=0){
      $('price_approval_status').textContent='Nincs jóváhagyható ár. Előbb kérd le vagy add meg a hitelesen ellenőrzött teljes árat.';
      return;
    }
    const message=currentMessage();
    const analysis=typeof extract==='function'?extract(message,''):null;
    const asked=huAskedTopics(message,analysis);
    approvedPrice={
      total:Math.round(inputValue),
      accommodation:Number.isFinite(Number(pendingQuote?.raw?.accommodation))?Number(pendingQuote.raw.accommodation):null,
      tourismTax:Number.isFinite(Number(pendingQuote?.raw?.tourismTax))?Number(pendingQuote.raw.tourismTax):null,
      source:pendingQuote?.source||'kézi ellenőrzés',
      fingerprint:quoteFingerprint(),
      approvedAt:new Date().toISOString()
    };
    if(!asked.price){
      $('price_approval_status').textContent=`Az ár jóváhagyva (${formatFt(approvedPrice.total)}), de a vendég nem kérdezett árat, ezért nem került a válaszlevélbe.`;
      return;
    }
    applyFocusedReply(message);
    $('price_approval_status').textContent=`Jóváhagyva: ${formatFt(approvedPrice.total)}. Az összeg automatikusan bekerült a választervezetbe. E-mail nem lett elküldve.`;
    const status=$('status');
    if(status){
      status.className='warning';
      status.textContent='Állapot: az ár jóváhagyása után a választervezet frissült; a teljes levél továbbra is emberi jóváhagyásra vár. Innen nincs e-mail-küldés.';
    }
  }

  async function autoPrepareAndQuoteFromGmail() {
    const message=$('gmail_original')?.textContent||'';
    if(!message) return;
    prepare(message);
    applyFocusedReply(message);
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
      $('price_status').textContent='Gmailből előkészítve: gyermekes érdeklődés, ezért automatikus árlekérés nem indult. Hitelesen ellenőrzött teljes ár kézzel megadható, majd külön jóváhagyható.';
      return;
    }
    if(!complete){
      $('price_status').textContent='Gmailből előkészítve: az automatikus árlekéréshez még pontos dátum, explicit háztípus és felnőtt létszám szükséges.';
      return;
    }
    $('price_status').textContent='Gmailből kinyert adatok teljesek; automatikus, csak olvasási jellegű árlekérés indul…';
    await $('check_price').onclick();
  }

  $('prepare_price').onclick = () => prepare(currentMessage());
  $('check_price').onclick = async () => {
    const status=$('price_status'); status.textContent='Árlekérés folyamatban…';$('price_result').textContent='';
    clearApprovedPrice('Új árlekérés indult; az előző jóváhagyás törölve.');
    const message=currentMessage();
    const analysis=typeof extract==='function' ? extract(message,'') : null;
    const childCount=Number(analysis?.fields?.children?.value||0);
    if (childCount>0 || /\b(?:gyerek|gyermek|gyerekek|gyermekek|children|kind(?:er)?|otroka)\b/iu.test(message)) {status.textContent='Gyermekes érdeklődés: életkor és hiteles gyermekár nélkül kézi ellenőrzés szükséges. A kézzel ellenőrzött teljes ár az Ár jóváhagyása résznél megadható.';return;}
    const input={arrival:$('price_arrival').value,departure:$('price_departure').value,cabin:$('price_cabin').value,adults:Number($('price_adults').value),children:[]};
    if (!input.arrival || !input.departure || !input.cabin || !Number.isInteger(input.adults) || input.adults<1) {status.textContent='Pontos dátum, háztípus és létszám szükséges.';return;}
    try {
      const response=await fetch('/api/price-quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input),cache:'no-store'});
      if (!response.headers.get('content-type')?.includes('application/json')) throw Error('Az árlekérő szerver nincs ehhez az oldalhoz csatlakoztatva.');
      const result=await response.json(); if(!response.ok || result.status!=='review_required')throw Error(result.error||'Nem sikerült az árlekérés.');
      $('price_result').textContent=`${result.arrival}–${result.departure} · ${result.cabin} · ${result.adults} felnőtt · Szállás: ${result.accommodation.toLocaleString('hu-HU')} Ft · IFA: ${result.tourismTax.toLocaleString('hu-HU')} Ft · Teljes ár: ${result.total.toLocaleString('hu-HU')} Ft · Plusz fő díjkülönbsége és más bontás: nem igazolt · Forrás: ${result.source} · Lekérés: ${result.checkedAt} · Szezonfelár beépítése: nem igazolt · 20% törzsvendégkedvezmény: nincs alkalmazva`;
      pendingQuote={total:Number(result.total),source:result.source||'foglalási oldal',fingerprint:quoteFingerprint(),raw:result};
      $('approved_price_manual').value=String(result.total);
      $('approve_price').disabled=false;
      $('price_approval_status').textContent=`Lekért teljes ár: ${formatFt(result.total)} · jóváhagyásra vár. Még nincs a vendégválaszban.`;
      status.textContent='A foglalási oldalon megjelenő ár ellenőrzésre vár. Az „Ár jóváhagyása és beépítése a levélbe” gombig nem kerül a vendégválaszba, és foglalás nem történik.';
    } catch(e) {status.textContent=`Nincs igazolt ár: ${e.message} Nyisd meg a foglalási oldalt kézi ellenőrzésre.`;}
  };

  ['price_arrival','price_departure','price_cabin','price_adults','price_children','price_child_ages'].forEach(id=>{
    const el=$(id);
    if(el) el.addEventListener('change',()=>clearApprovedPrice('Az ár alapadata megváltozott; az árat újra ellenőrizni és jóváhagyni kell.'));
  });

  document.addEventListener('sarberki:analysis-ready',(event)=>{
    const message=event?.detail?.message||$('message')?.value||'';
    if(message){
      prepare(message);
      setTimeout(()=>applyFocusedReply(message),0);
    }
  });
  document.addEventListener('sarberki:record-loaded',()=>{autoPrepareAndQuoteFromGmail().catch(e=>{$('price_status').textContent='Automatikus adatátadás nem sikerült: '+e.message;});});
  document.addEventListener('sarberki:gmail-normalized',()=>{autoPrepareAndQuoteFromGmail().catch(e=>{$('price_status').textContent='Automatikus árlekérés nem igazolható: '+e.message;});});
  const refresh=$('refresh');
  if(refresh){
    const previous=refresh.onclick;
    refresh.onclick=(event)=>{
      if(typeof previous==='function') previous.call(refresh,event);
      const message=$('message')?.value||$('gmail_original')?.textContent||'';
      if(message) applyFocusedReply(message);
    };
  }

  buildPriceApprovalUi();
})();
