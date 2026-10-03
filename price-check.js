(() => {
  const $ = id => document.getElementById(id);
  const cabins = {deluxe:'Deluxe',family:'Családi',vip:'VIP',small:'Különálló 2 fős',splitA:'Osztott A',splitB:'Osztott B',splitC:'Osztott C'};
  const singleCabinCapacity = {deluxe:6,family:8,vip:7,small:3,splitA:2,splitB:2,splitC:5};
  let approvedPrice = null;
  let pendingQuote = null;

  function explicitCabin(message='') {
    const found=[];
    if (/\bvip\b/iu.test(message)) found.push('vip');
    if (/\b(?:családi|family|familien)\b/iu.test(message) || /\bdružinsk\w*\s+(?:hišk\w*|koč\w*|nastanitev)\b/iu.test(message)) found.push('family');
    if (/\bdeluxe\b/iu.test(message)) found.push('deluxe');
    if (/\b(?:osztott|split|geteilte[rs]?|deljen[ai]?)\b/iu.test(message)) found.push('split');
    return found.length===1 ? found[0] : '';
  }

  function explicitSplitUnit(message='') {
    const nearSplit=message.match(/\b(?:osztott|split|geteilte[rs]?|deljen[ai]?)\b[^\n.!?]{0,40}\b([ABC])\b/iu)
      || message.match(/\b([ABC])\s*(?:egység|unit|einheit|enota)\b[^\n.!?]{0,40}\b(?:osztott|split|geteilte[rs]?|deljen[ai]?)\b/iu);
    return nearSplit ? nearSplit[1].toUpperCase() : '';
  }

  function requestedUnits(message='') {
    const shared=window.SarberkiNormalize?.requestedUnitsFromText?.(message);
    if(shared) return shared.open ? null : Number(shared.count||0);
    const open=/\b(?:több|multiple|several|mehrere|več)\s+(?:szállás)?(?:egység\w*|faház\w*|ház\w*|apartman\w*|units?|cabins?|houses?|einheiten|enot\w*)\b/iu.test(message);
    if(open) return null;
    const m=message.match(/\b(két|2|három|3|négy|4|öt|5|hat|6|two|three|four|five|six|zwei|drei|vier|fünf|funf|sechs|dva|dve|tri|štiri|stiri|pet|šest|sest)\s+(?:db\s+)?(?:vip|családi|deluxe|family|familien|družinsk\w*)?(?:\s*[-–]?\s*)(?:házat?|faházat?|apartmant?|egységet?|cabins?|houses?|units?|cottages?|häuser|hauser|einheiten|hišk\w*|hisk\w*|koč\w*|enot\w*)\b/iu);
    if(!m) return 0;
    return ({'két':2,'2':2,'három':3,'3':3,'négy':4,'4':4,'öt':5,'5':5,'hat':6,'6':6,two:2,three:3,four:4,five:5,six:6,zwei:2,drei:3,vier:4,'fünf':5,funf:5,sechs:6,dva:2,dve:2,tri:3,'štiri':4,stiri:4,pet:5,'šest':6,sest:6})[m[1].toLowerCase()]||0;
  }

  function gmailNormalizedRecord() {
    try {
      const raw=document.getElementById('gmail_json')?.value;
      if(!raw) return null;
      const record=JSON.parse(raw);
      return record && typeof record==='object' ? record : null;
    } catch { return null; }
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
    const gmailVisible=$('gmail_record') && !$('gmail_record').classList.contains('hidden');
    const gmailMessage=String($('gmail_original')?.textContent||'').trim();
    if(gmailVisible&&gmailMessage) return gmailMessage;
    return String($('message')?.value||'').trim();
  }

  function quoteFingerprint(){
    return [
      $('price_arrival')?.value||'',
      $('price_departure')?.value||'',
      $('price_cabin')?.value||'',
      $('price_adults')?.value||'',
      $('price_children')?.value||'',
      $('price_child_ages')?.value||'',
      String(requestedUnits(currentMessage())||0),
      explicitSplitUnit(currentMessage())
    ].join('|');
  }

  function formatFt(value){
    return Number(value).toLocaleString('hu-HU')+' Ft';
  }

  function formatEur(value){
    return Number(value).toLocaleString('hu-HU',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
  }

  function approvedPriceText(quote){
    if(!quote) return '';
    const eur=Number.isFinite(quote.eurTotal)?' (kb. '+formatEur(quote.eurTotal)+', MNB '+(quote.eurRateDate||'')+')':'';
    const total=(quote.referenceOnly?'A Sárberki publikus árlistája alapján számolt teljes ár: ':'A foglalási felületen ellenőrzött teljes ár: ')+formatFt(quote.total)+eur+'.';
    const breakdown=Array.isArray(quote.unitBreakdown)&&quote.unitBreakdown.length>1
      ? ' Házanként: '+quote.unitBreakdown.map(x=>{
          const eurPart=Number.isFinite(quote.eurRate)&&quote.eurRate>0?' (kb. '+formatEur(Math.round((x.total/quote.eurRate)*100)/100)+')':'';
          return x.unit+'. egység: '+formatFt(x.total)+eurPart;
        }).join('; ')+'.'
      : '';
    if(Number.isFinite(quote.accommodation)&&Number.isFinite(quote.tourismTax)){
      return total+' Ebből szállás: '+formatFt(quote.accommodation)+', IFA: '+formatFt(quote.tourismTax)+'.'+breakdown;
    }
    return total+breakdown;
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
    const gmailRecord=gmailNormalizedRecord();
    const normalized=gmailRecord?.normalized||{};
    const gmailDate=gmailNormalizedDate();
    const sharedRange=window.SarberkiNormalize?.dateRangeFromText?.(message,new Date(),window.SarberkiConfig?.timezone||'Europe/Budapest')||null;
    $('price_arrival').value = fields.arrival?.value || normalized.dates?.arrival || gmailDate?.arrival || sharedRange?.arrival || '';
    $('price_departure').value = fields.departure?.value || normalized.dates?.departure || gmailDate?.departure || sharedRange?.departure || '';
    const sharedChildren=window.SarberkiNormalize?.childCountFromText?.(message);
    const children = Number.isInteger(Number(normalized.children)) ? Number(normalized.children) : (Number.isInteger(Number(fields.children?.value)) ? Number(fields.children.value) : (Number.isInteger(Number(sharedChildren)) ? Number(sharedChildren) : 0));
    const normalizedAdults=Number(normalized.adults);
    const normalizedGuests=Number(normalized.guests);
    const sharedGuests=Number(window.SarberkiNormalize?.guestCountFromText?.(message));
    const adultMatch=message.match(/\b(\d+)\s*(?:felnőtt\w*|adults?|erwachsene\w*|odrasl\w*)\b/iu);
    const directAdults=adultMatch?Number(adultMatch[1]):null;
    $('price_adults').value = Number.isInteger(normalizedAdults)&&normalizedAdults>0 ? String(normalizedAdults) : fields.adults?.value || (Number.isInteger(directAdults)&&directAdults>0?String(directAdults):'') || (children ? (Number.isInteger(normalizedGuests)&&normalizedGuests>children?String(normalizedGuests-children):Number.isInteger(sharedGuests)&&sharedGuests>children?String(sharedGuests-children):'') : fields.guests?.value || (Number.isInteger(sharedGuests)&&sharedGuests>0?String(sharedGuests):''));
    if ($('price_children')) $('price_children').value = String(children);
    const sharedAges=window.SarberkiNormalize?.childAgesFromText?.(message)||[];
    if ($('price_child_ages')) $('price_child_ages').value = Array.isArray(normalized.child_ages)&&normalized.child_ages.length ? normalized.child_ages.join(', ') : fields.child_ages?.value || (Array.isArray(sharedAges)&&sharedAges.length?sharedAges.join(', '):'');
    const unit=(fields.unit?.value || normalized.cabin || window.SarberkiNormalize?.cabinFromText?.(message) || '').toLowerCase();
    const explicit = explicitCabin(message);
    const splitUnit=explicit==='split'?explicitSplitUnit(message):'';
    $('price_cabin').value = splitUnit ? `split${splitUnit}` : explicit || Object.keys(cabins).find(k => unit.includes(cabins[k].toLowerCase())) || '';
    $('price_result').textContent = '';
    clearApprovedPrice('Az érdeklődés adatai frissültek; az árat újra ellenőrizni és jóváhagyni kell.');
    $('price_status').textContent = children ? 'Gyermekes foglalás adatai átvéve. Pontos gyermekkorokkal hiteles élő árlekérés indítható; az ár külön jóváhagyásra vár.' : !explicit ? 'Faház: ? – emberi döntésre vár. Melyik háztípust szeretnék: VIP, Családi, Deluxe vagy Osztott?' : 'Ellenőrizd a kinyert adatokat. Az élő árlekérés után külön árjóváhagyás szükséges.';
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
    if(bookingBits.length) lines.push('',`Örömmel fogadtuk érdeklődését a ${bookingBits.join(', ')} tervezett tartózkodásról.`);

    const party=[];
    if(v.adults) party.push(`${v.adults} felnőtt`);
    if(v.children) party.push(`${v.children} gyermek${v.child_ages?` (${v.child_ages} éves)`:''}`);
    if(party.length) lines.push(`Úgy látjuk, ${party.join(' és ')} érkezne.`);

    const plan=typeof accommodationPlan==='function'?accommodationPlan(v):null;
    if(plan?.specific&&v.unit) lines.push(`A kért ${v.unit} háztípust figyelembe vettük.`);
    else if(v.unit&&!/^(?:ház|faház|apartman|cabin)$/iu.test(v.unit)) lines.push(`A megadott szállástípus: ${v.unit}.`);
    else if(!v.unit) lines.push('Kérjük, írja meg, melyik háztípust szeretnék: VIP, Családi, Deluxe vagy Osztott?');

    const priceApproved=asked.price&&approvedPrice&&approvedPrice.fingerprint===quoteFingerprint();
    if(asked.availability&&asked.price){
      if(priceApproved) lines.push('','Ellenőrizzük, hogy a megadott időpontra elérhető-e a kért háztípus. '+approvedPriceText(approvedPrice)+' Az elérhetőséget külön visszaigazoljuk.');
      else lines.push('','Ellenőrizzük, hogy a megadott időpontra elérhető-e a kért háztípus. Az aktuális teljes árról ezt követően tudunk pontos tájékoztatást adni.');
    } else if(asked.availability) {
      lines.push('','Ellenőrizzük, hogy a megadott időpontra elérhető-e a kért háztípus, és hamarosan visszajelzünk.');
    } else if(asked.price) {
      if(priceApproved) lines.push('','A megadott adatok alapján '+approvedPriceText(approvedPrice));
      else lines.push('','Az aktuális teljes árat a foglalási felületen ellenőrizzük, és ezt követően tudunk pontos tájékoztatást adni.');
    }

    if(asked.pet) lines.push('','A kisebb kutyával kapcsolatos kérését is feljegyeztük. Háziállat térítés ellenében hozható; a pontos díjat ellenőrizzük.');
    if(asked.hotTub){
      if(/deluxe/iu.test(String(v.unit||''))) lines.push('','A Deluxe házakhoz dézsa tartozik; a kért időszak szabad kapacitását a foglalási felületen ellenőrizzük.');
      else lines.push('','A dézsa rendelkezésre állását is ellenőrizzük a kért időszakra.');
    }

    if(asked.amenities) lines.push('','A felszereltséggel kapcsolatban a levélben feltett kérdésre külön, a kiválasztott háztípus biztos adatai alapján válaszolunk.');
    if(asked.deposit) lines.push('','Az előlegre vonatkozó kérdést a foglalási feltételek alapján külön ellenőrizzük és pontosan megválaszoljuk.');
    if(asked.cancellation) lines.push('','A lemondási feltételekre vonatkozó kérdést a foglalás létszáma és időpontja alapján külön megválaszoljuk.');
    if(asked.electricity) lines.push('','Az áramfogyasztással kapcsolatos kérdést a mérőállásos elszámolási szabály alapján külön megválaszoljuk.');
    if(asked.firewood) lines.push('','A tűzifával kapcsolatos kérdést külön megválaszoljuk; pontos díjat csak hitelesített adat alapján írunk.');
    if(asked.pier){
      if(/deluxe/iu.test(String(v.unit||''))) lines.push('','A Deluxe házhoz saját stég tartozik.');
      else if(/osztott/iu.test(String(v.unit||''))) lines.push('','Az Osztott háznál a C egységhez külön stég tartozik, az A és B egység közös stéget használ.');
      else if(/vip|családi/iu.test(String(v.unit||''))) lines.push('','A kiválasztott házhoz stég tartozik.');
      else lines.push('','A stéghasználatot a kiválasztott háztípus alapján pontosítjuk.');
    }
    if(asked.parking) lines.push('','A parkolási lehetőséget a megadott autószám és háztípus alapján pontosítjuk.');
    if(asked.arrivalTime) lines.push('','A megadott érkezési időpontot is figyelembe vettük, és visszaigazoljuk, hogy az adott érkezési idő megfelelő-e.');

    const missing=[];
    if(!v.arrival||!v.departure) missing.push('pontos érkezési és távozási dátum');
    if(!v.guests) missing.push('vendéglétszám');
    if(v.children&&Number(v.children)>0&&analysis.warning_codes?.includes('missing_child_ages')) missing.push('gyermek(ek) életkora');
    if(missing.length) lines.push('',`A pontos válaszhoz kérjük, írja meg még: ${missing.join(', ')}.`);

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
      eurTotal:Number.isFinite(Number(pendingQuote?.raw?.eurConversion?.totalEur))?Number(pendingQuote.raw.eurConversion.totalEur):null,
      eurRateDate:pendingQuote?.raw?.eurConversion?.rateDate||'',
      eurRate:Number.isFinite(Number(pendingQuote?.raw?.eurConversion?.rateHufPerEur))?Number(pendingQuote.raw.eurConversion.rateHufPerEur):null,
      unitBreakdown:Array.isArray(pendingQuote?.raw?.unitBreakdown)?pendingQuote.raw.unitBreakdown:[],
      source:pendingQuote?.source||'kézi ellenőrzés',
      referenceOnly:Boolean(pendingQuote?.raw?.referenceOnly),
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
    const gmailRecord=gmailNormalizedRecord();
    const normalized=gmailRecord?.normalized||{};
    const childCount=Number.isInteger(Number(normalized.children)) ? Number(normalized.children) : Number(analysis?.fields?.children?.value||0);
    const hasChildWord=/\b(?:gyerek|gyermek|gyerekek|gyermekek|children|child|kind(?:er)?|otroka)\b/iu.test(message);
    const gmailDate=gmailNormalizedDate();
    const complete=Boolean($('price_arrival').value&&$('price_departure').value&&$('price_cabin').value&&Number($('price_adults').value)>0);
    const blockingWarnings=['guest_conflict','nights_conflict','date_conflict','invalid_date','uncertain_date'];
    const guests=Number.isInteger(Number(normalized.guests)) ? Number(normalized.guests) : Number(analysis?.fields?.guests?.value);
    const gmailReview=Array.isArray(gmailRecord?.human_review)?gmailRecord.human_review:[];
    const gmailConflict=gmailReview.some(item=>/ellentmondó|contradict/i.test(String(item)));
    if(gmailConflict||['modification_request','cancellation_request'].includes(analysis?.intent)||blockingWarnings.some(code=>analysis?.warning_codes?.includes(code))||!Number.isInteger(guests)||guests<1||guests!==Number($('price_adults').value)+childCount){
      $('price_status').textContent='Gmailből előkészítve: ellentmondó vagy módosítást érintő foglalási adat miatt automatikus árlekérés nem indul; kezelői ellenőrzés szükséges.';
      return;
    }
    if(gmailDate?.inferred){
      $('price_status').textContent='Gmailből előkészítve: az év következtetett, ezért emberi jóváhagyás nélkül automatikus árlekérés nem indul.';
      return;
    }
    if((childCount>0||hasChildWord)&&(Number($('price_children')?.value)!==childCount||!childAgesForQuote(childCount,$('price_child_ages')?.value)||childCount===0)){
      $('price_status').textContent='Gmailből előkészítve: a gyermekek pontos száma és életkora nélkül hiteles árlekérés nem indul.';
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
  function childAgesForQuote(count,raw) {
    if(!Number.isInteger(count)||count<0) return null;
    if(count===0) return [];
    const parts=String(raw||'').split(/[,;]+/u).map(x=>x.trim());
    if(parts.length!==count||parts.some(x=>!/^\d{1,2}$/u.test(x))) return null;
    const ages=parts.map(Number);
    return ages.every(age=>age>=0&&age<=17)?ages:null;
  }
  $('check_price').onclick = async () => {
    const status=$('price_status'); status.textContent='Árlekérés folyamatban…';$('price_result').textContent='';
    clearApprovedPrice('Új árlekérés indult; az előző jóváhagyás törölve.');
    const message=currentMessage();
    const analysis=typeof extract==='function' ? extract(message,'') : null;
    const cancellationTermsOnly=/(?:lemondási\s+feltét|lemondás\s+feltét|milyen\s+feltételekkel\s+lemond|cancellation\s+(?:terms|policy)|storno(?:bedingungen|bedingungen)|odpovedn\w*\s+pogoj)/iu.test(message);
    const changeOrCancel=/(?:módosít|változtat|átten|előző\s+foglalás|korábbi\s+foglalás|(?:szeretn(?:ém|énk)|akar(?:om|juk)|kérem|kérjük)[^.!?\n]{0,80}lemond|foglalás[^.!?\n]{0,40}lemond[\p{L}]*|stornieren|cancel\s+(?:my|our)?\s*(?:booking|reservation)|change\s+(?:my|our)?\s*(?:booking|reservation)|(?:foglalás|booking|reservation)[^.!?\n]{0,80}\b(?:helyett|instead of|statt|namesto)\b)/iu.test(message) && !cancellationTermsOnly;
    if(changeOrCancel||['modification_request','cancellation_request'].includes(analysis?.intent)) {status.textContent='KÉZI ELLENŐRZÉS SZÜKSÉGES · Módosítás vagy lemondás esetén az ár megjelenítése csak a meglévő foglalás kézi azonosítása után biztonságos.';return;}
    const childCount=Number($('price_children')?.value||0);
    const ages=childAgesForQuote(childCount,$('price_child_ages')?.value);
    if (ages===null || (childCount===0 && /\b(?:gyerek|gyermek|gyerekek|gyermekek|children|kind(?:er)?|otroka)\b/iu.test(message))) {status.textContent='HITELES ÁRLEKÉRÉS SZÜKSÉGES · A gyermekek pontos száma és életkora nélkül ár nem adható.';return;}
    const input={arrival:$('price_arrival').value,departure:$('price_departure').value,cabin:$('price_cabin').value,adults:Number($('price_adults').value),children:ages};
    const askedSplit=explicitCabin(message)==='split';
    if(askedSplit&&!explicitSplitUnit(message)){status.textContent='OSZTOTT HÁZ / KÉZI ELLENŐRZÉS SZÜKSÉGES · Kérjük pontosítani: A, B vagy C egység.';return;}
    if (!input.arrival || !input.departure || !input.cabin || !Number.isInteger(input.adults) || input.adults<1) {status.textContent='Pontos dátum, háztípus és létszám szükséges.';return;}
    const capacity=singleCabinCapacity[input.cabin];
    if(!capacity){status.textContent='KÉZI ELLENŐRZÉS SZÜKSÉGES · Ehhez a háztípushoz nincs ellenőrzött kapacitás.';return;}
    const guestTotal=input.adults+input.children.length;
    const explicitUnits=requestedUnits(message);
    const units=Math.max(explicitUnits||1,Math.ceil(guestTotal/capacity));
    if(guestTotal>capacity*units){status.textContent='KÉZI ELLENŐRZÉS SZÜKSÉGES · A vendéglétszám a kért egységszámmal sem fér el.';return;}
    if(units>1&&input.adults<units){status.textContent='KÉZI ELLENŐRZÉS SZÜKSÉGES · Több háznál minden egységhez legalább egy felnőtt szükséges az élő árlekéréshez.';return;}
    if(units>1) input.units=units;
    try {
      const response=await fetch('/api/price-quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input),cache:'no-store'});
      if (!response.headers.get('content-type')?.includes('application/json')) throw Error('Az árlekérő szerver nincs ehhez az oldalhoz csatlakoztatva.');
      const result=await response.json(); if(result.status==='unavailable'){const needed=Number(input.units||1);const free=Number(result.availableUnits);status.textContent=Number.isInteger(free)?`A kért ${cabins[input.cabin]||input.cabin} típusból ${needed} egység szükséges ehhez a létszámhoz, de a foglalási felület csak ${free} szabad egységet mutat erre az időszakra. Ár nem került a válaszba; kezelői ellenőrzés szükséges.`:'A kért háztípusból a foglalási felület nem mutat szabad egységet erre az időszakra. Ár nem került a válaszba; kezelői ellenőrzés szükséges.';return;} if(!response.ok || !['review_required','public_reference'].includes(result.status))throw Error(result.error||'Nem sikerült az árlekérés.');
      const referenceOnly=result.status==='public_reference';
      if(result.arrival!==input.arrival||result.departure!==input.departure||result.cabin!==input.cabin||result.adults!==input.adults||JSON.stringify(result.children)!==JSON.stringify(input.children)||(!referenceOnly&&(result.availability!=='available'||!Number.isInteger(result.availableUnits)||result.availableUnits<1))||!Number.isSafeInteger(result.total)||result.total<=0||!Number.isSafeInteger(result.accommodation)||!Number.isSafeInteger(result.tourismTax)||result.accommodation+result.tourismTax!==result.total||result.currency!=='HUF') throw Error('Az árválasz hiányos vagy eltér a kért vendégösszetételtől.');
      const eurText=result.eurConversion?.status==='available' ? ` · EUR: ${formatEur(result.eurConversion.totalEur)} · MNB középárfolyam: 1 € = ${Number(result.eurConversion.rateHufPerEur).toLocaleString('hu-HU',{minimumFractionDigits:2,maximumFractionDigits:2})} Ft (${result.eurConversion.rateDate})` : ' · EUR átváltás: jelenleg nem elérhető';
      const unitText=Array.isArray(result.unitBreakdown)&&result.unitBreakdown.length>1
        ? ' · Házanként: '+result.unitBreakdown.map(x=>{
            const eurPart=result.eurConversion?.status==='available'&&Number(result.eurConversion.rateHufPerEur)>0
              ? ' / '+formatEur(Math.round((x.total/Number(result.eurConversion.rateHufPerEur))*100)/100)
              : '';
            return `${x.unit}. egység: ${formatFt(x.total)}${eurPart} (${x.adults} felnőtt${x.children?.length?`, ${x.children.length} gyermek`:''})`;
          }).join(' | ')
        : '';
      $('price_result').textContent=`${result.arrival}–${result.departure} · ${result.cabin}${(result.units||1)>1?` · Egységek: ${result.units}`:''} · ${result.adults} felnőtt${result.children.length?` · ${result.children.length} gyermek (${result.children.join(', ')} éves)`:''} · Szállás: ${result.accommodation.toLocaleString('hu-HU')} Ft · IFA: ${result.tourismTax.toLocaleString('hu-HU')} Ft · Teljes ár: ${result.total.toLocaleString('hu-HU')} Ft${referenceOnly?' · PUBLIKUS ÁRLISTA-REFERENCIA · Szabad kapacitás külön ellenőrzendő':eurText+unitText} · Forrás: ${result.source} · Lekérés: ${result.checkedAt} · 20% törzsvendégkedvezmény: nincs alkalmazva`;
      pendingQuote={total:Number(result.total),source:result.source||'foglalási oldal',fingerprint:quoteFingerprint(),raw:{...result,referenceOnly}};
      $('approved_price_manual').value=String(result.total);
      $('approve_price').disabled=false;
      $('price_approval_status').textContent=`Lekért teljes ár: ${formatFt(result.total)} · jóváhagyásra vár. Még nincs a vendégválaszban.`;
      status.textContent=referenceOnly?'A Sárberki publikus árlistája alapján számolt referenciaár elkészült. A szabad kapacitást külön kell ellenőrizni; az összeg csak jóváhagyás után kerülhet a válaszba.':'A foglalási oldalon megjelenő ár ellenőrzésre vár. Az „Ár jóváhagyása és beépítése a levélbe” gombig nem kerül a vendégválaszba, és foglalás nem történik.';
    } catch(e) {status.textContent=`HITELES ÁRLEKÉRÉS SZÜKSÉGES · ${e.message} Nyisd meg a foglalási oldalt kézi ellenőrzésre.`;}
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
