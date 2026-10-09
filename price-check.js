(() => {
  const $ = id => document.getElementById(id);
  const cabins = {deluxe:'Deluxe',family:'Családi',vip:'VIP',small:'Különálló 2 fős',splitA:'Osztott A',splitB:'Osztott B',splitC:'Osztott C'};
  const singleCabinCapacity = {deluxe:6,family:8,vip:7,small:3,splitA:2,splitB:2,splitC:5};
  let approvedPrice = null;
  let pendingQuote = null;
  let availabilityOptions = null;

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
    const current=window.SarberkiCaseController?.snapshot();if(current)return current.original;
    const gmailVisible=$('gmail_record') && !$('gmail_record').classList.contains('hidden');
    const gmailMessage=String($('gmail_original')?.textContent||'').trim();
    if(gmailVisible&&gmailMessage) return gmailMessage;
    return String($('message')?.value||'').trim();
  }

  function explicitNoChildren(message=''){
    return /\b(?:nincs(?:enek)?\s+gyerek|nincs(?:enek)?\s+gyermek|gyermek\s+nélkül|gyerek\s+nélkül|no\s+children|without\s+children|keine\s+kinder|ohne\s+kinder|brez\s+otrok)\b/iu.test(message);
  }

  function childStatusKnown(message='',analysis=null,normalized={}){
    if(normalized?.children!==null&&normalized?.children!==undefined&&normalized?.children!==''&&Number.isInteger(Number(normalized.children))) return true;
    const field=analysis?.fields?.children?.value;
    if(field!==null&&field!==undefined&&field!==''&&Number.isInteger(Number(field))) return true;
    if(window.SarberkiNormalize?.childCountFromText?.(message)!=null) return true;
    const guests=window.SarberkiNormalize?.guestCountFromText?.(message);
    const adults=window.SarberkiNormalize?.adultCountFromText?.(message);
    if(Number.isInteger(guests)&&Number.isInteger(adults)&&guests===adults&&guests>0) return true;
    if(explicitNoChildren(message)) return true;
    const hasAdultCount=Number.isInteger(adults)&&adults>0;
    const mentionsChildren=/\b(?:gyerek\w*|gyermek\w*|children?|kids?|kind(?:er)?|otrok\w*)\b/iu.test(message);
    return hasAdultCount&&!mentionsChildren;
  }

  function quoteFingerprint(){
    if(window.SarberkiCaseState){const state=window.SarberkiCaseController?.snapshot();if(state)return state.original+'|'+window.SarberkiCaseState.caseFingerprint(state.values);}
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

  function bookingTermsForGuests(guests){
    const n=Number(guests);
    const rules=window.SarberkiConfig?.bookingRules||{};
    const large=Number.isInteger(n)&&n>=15;
    return {
      depositPct:Number(large?rules.depositPctFrom15Guests:rules.depositPctUnder15Guests)|| (large?80:50),
      depositDueDays:Number(rules.depositDueDays)||10,
      cancellationDays:Number(large?rules.cancellationDaysFrom15Guests:rules.cancellationDaysUnder15Guests)|| (large?30:14)
    };
  }

  function availabilityFingerprint(arrival,departure,guests){
    return [arrival||'',departure||'',String(guests||'')].join('|');
  }

  function currentAvailabilityLines(v={},lang='HU'){
    const arrival=v.arrival||$('price_arrival')?.value||'';
    const departure=v.departure||$('price_departure')?.value||'';
    const adultsRaw=v.adults??$('price_adults')?.value??'';
    const childrenRaw=v.children??$('price_children')?.value??'';
    const inferredGuests=(Number(adultsRaw)||0)+(Number(childrenRaw)||0);
    const guests=Number(v.guests||inferredGuests||0);
    if(!availabilityOptions||availabilityOptions.fingerprint!==availabilityFingerprint(arrival,departure,guests)) return [];
    const verified=(availabilityOptions.available_options||[]).filter(x=>x&&x.availability_verified!==false);
    const manual=(availabilityOptions.manual_review_options||[]).filter(x=>x&&x.pooled_availability_verified===true);
    const copy={
      HU:{verified:'A foglalási felületen ellenőrzött szabad lehetőségek:',manual:'Az Osztott egységeknél a szükséges 2 fős és 4 fős Previo poolban van szabad kapacitás; a konkrét A/B + C fizikai párosítást kézzel kell ellenőrizni:',unit:'egység'},
      DE:{verified:'Auf der Buchungsseite geprüfte freie Möglichkeiten:',manual:'Für die geteilten Einheiten ist in den benötigten 2-Personen- und 4-Personen-Previo-Pools freie Kapazität vorhanden; die konkrete physische Zuordnung A/B + C muss manuell geprüft werden:',unit:'Einheiten'},
      SL:{verified:'Na rezervacijskem sistemu preverjene proste možnosti:',manual:'V potrebnih Previo skupinah za 2- in 4-osebne deljene enote je dovolj prostih kapacitet; konkretno fizično kombinacijo A/B + C je treba preveriti ročno:',unit:'enoti'},
      EN:{verified:'Available options verified on the booking system:',manual:'The required 2-person and 4-person Previo pools have free capacity for the split units; the specific physical A/B + C pairing still requires manual verification:',unit:'units'}
    }[lang]||{verified:'Available options verified on the booking system:',manual:'Split-unit pool capacity is available; the specific physical pairing requires manual verification:',unit:'units'};
    const lines=[];
    if(verified.length){
      lines.push(copy.verified);
      for(const option of verified) lines.push('– '+option.label+(Number(option.units)>1?' ('+option.units+' '+copy.unit+')':''));
    }
    if(manual.length){
      lines.push(copy.manual);
      for(const option of manual) lines.push('– '+option.label);
    }
    return lines;
  }

  async function refreshAvailabilityOptions(message=''){
    if(window.SarberkiBookingRuntime){await window.SarberkiRefreshCapacity?.();return;}
    const analysis=typeof extract==='function'?extract(message,''):null;
    if(!analysis||explicitCabin(message)){availabilityOptions=null;return;}
    const requestState=window.SarberkiCaseController?.snapshot();
    const arrival=requestState?requestState.values.arrival:analysis.fields?.arrival?.value||$('price_arrival')?.value||'';
    const departure=requestState?requestState.values.departure:analysis.fields?.departure?.value||$('price_departure')?.value||'';
    const guests=Number(requestState?requestState.values.guests:analysis.fields?.guests?.value||window.SarberkiNormalize?.guestCountFromText?.(message)||0);
    if(!arrival||!departure||!Number.isInteger(guests)||guests<1){availabilityOptions=null;return;}
    const requestFingerprint=requestState&&window.SarberkiCaseState?.caseFingerprint(requestState.values);
    try{
      const response=await fetch('/api/availability-options',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({arrival,departure,guests}),cache:'no-store'});
      if(!response.headers.get('content-type')?.includes('application/json')) throw Error('A kapacitás-ellenőrző szerver nincs csatlakoztatva.');
      const result=await response.json();
      if(!response.ok||result.status!=='review_required'||result.arrival!==arrival||result.departure!==departure||Number(result.guests)!==guests||result.bookingCompleted!==false||!Array.isArray(result.available_options)||!Array.isArray(result.manual_review_options)) throw Error(result.error||'A kapacitásválasz hiányos vagy eltér a kért adatoktól.');
      if(requestState&&(requestState.original!==window.SarberkiCaseController?.snapshot()?.original||requestFingerprint!==window.SarberkiCaseState?.caseFingerprint(window.SarberkiCaseController.snapshot().values)))return;
      availabilityOptions={...result,fingerprint:availabilityFingerprint(arrival,departure,guests)};
      if(requestState)window.SarberkiCaseController?.apply({type:'availability',fingerprint:requestFingerprint,lines:currentAvailabilityLines(requestState.values,String(requestState.values.language||'HU'))});
      applyFocusedReply(message);
      const status=$('price_status');
      if(status) status.textContent='A megadott létszámhoz tartozó szabad háztípusok ellenőrizve; a lista bekerült a választervezetbe. Az Osztott típusok pooled kapacitása ellenőrizhető, a konkrét A/B + C fizikai párosítás továbbra is kézi ellenőrzést igényel.';
    }catch(error){
      availabilityOptions=null;
      const status=$('price_status');
      if(status&&!$('price_cabin')?.value) status.textContent='HITELES KAPACITÁSELLENŐRZÉS SZÜKSÉGES · '+error.message;
    }
  }

  function approvedPriceText(quote){
    if(!quote) return '';
    const eur=Number.isFinite(quote.eurTotal)?' (kb. '+formatEur(quote.eurTotal)+', MNB '+(quote.eurRateDate||'')+')':'';
    const total=(quote.referenceOnly?'A Sárberki publikus árlistája alapján számolt teljes ár: ':quote.operatorChecked?'A kezelő által a foglalási felületen ellenőrzött teljes ár: ':'A foglalási felületen ellenőrzött teljes ár: ')+formatFt(quote.total)+eur+'.';
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
    if(window.SarberkiCaseState) window.SarberkiCaseController?.apply({type:'invalidateQuote'});
    approvedPrice=null;
    pendingQuote=null;
    const button=$('approve_price');
    if(button) button.disabled=true;
    const input=$('approved_price_manual');
    if(input) input.value='';
    const manualConfirm=$('manual_quote_confirmed');
    if(manualConfirm) manualConfirm.checked=false;
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
    panel.innerHTML='<strong>Ár jóváhagyása</strong><p class="muted">A lekért vagy kézzel ellenőrzött teljes árat először itt hagyd jóvá. A jóváhagyás csak a választervezetet egészíti ki; e-mailt nem küld.</p><p><a href="https://sarberkito.hu/foglalas/" target="_blank" rel="noopener noreferrer">Hivatalos Sárberki / Previo foglaló megnyitása kézi ár- és kapacitásellenőrzéshez</a></p><label for="approved_price_manual">A foglalóban ellenőrzött teljes ár (Ft)</label><input id="approved_price_manual" type="number" min="1" step="1" inputmode="numeric" placeholder="pl. 128000"><label for="manual_quote_confirmed"><input type="checkbox" id="manual_quote_confirmed"> A kiválasztott teljes időszakot, háztípust, szükséges szabad egységszámot és vendégösszetételt a hivatalos foglalóban ellenőriztem. Nem készítettem foglalást.</label><button id="approve_price" type="button" disabled>Ár jóváhagyása és beépítése a levélbe</button><p id="price_approval_status" class="muted" role="status">Ár nincs jóváhagyva.</p>';
    result.insertAdjacentElement('afterend',panel);
    $('approved_price_manual').addEventListener('input',()=>{
      $('manual_quote_confirmed').checked=false;
      $('approve_price').disabled=true;
      pendingQuote=null;
      approvedPrice=null;
      if(window.SarberkiCaseState)window.SarberkiCaseController?.apply({type:'invalidateQuote'});
      $('price_approval_status').textContent='A beírt ár csak akkor jóváhagyható, ha a Previo foglalóban a teljes időszakot és a szabad kapacitást is ellenőrizted, majd bepipálod a megerősítést.';
    });
    $('manual_quote_confirmed').addEventListener('change',async()=>{
      const confirmation=$('manual_quote_confirmed');
      $('approve_price').disabled=true;
      pendingQuote=null;
      if(!confirmation.checked)return;
      const n=Number($('approved_price_manual').value);
      const arrival=$('price_arrival')?.value||'',departure=$('price_departure')?.value||'';
      const cabin=$('price_cabin')?.value||'';
      const adults=Number($('price_adults')?.value),children=Number($('price_children')?.value);
      const ages=childAgesForQuote(children,$('price_child_ages')?.value);
      const validDates=/^20\d{2}-\d{2}-\d{2}$/.test(arrival)&&/^20\d{2}-\d{2}-\d{2}$/.test(departure)&&departure>arrival;
      if(!Number.isSafeInteger(n)||n<=0||!validDates||!singleCabinCapacity[cabin]||!Number.isInteger(adults)||adults<1||ages===null){
        confirmation.checked=false;
        $('price_approval_status').textContent='Előbb pontosítsd a dátumokat, a háztípust, a felnőtt- és gyermekszámot, az életkorokat és a teljes forintárat.';
        return;
      }
      const fingerprint=quoteFingerprint();
      pendingQuote={total:n,source:'a Previo foglalóban kézzel ellenőrzött ár',fingerprint,operatorChecked:true};
      $('approve_price').disabled=false;
      $('price_approval_status').textContent=`Kézzel ellenőrzött ár: ${formatFt(n)} · MNB euróárfolyam lekérése… A vendéglevél még változatlan.`;
      try{
        const response=await fetch('/api/manual-fx',{method:'GET',cache:'no-store'});
        if(!response.ok)throw Error('Nincs elérhető árfolyam.');
        const rate=await response.json();
        if(rate.status!=='available'||!Number.isFinite(rate.rateHufPerEur)||rate.rateHufPerEur<=0||!/^20\d{2}-\d{2}-\d{2}$/.test(rate.rateDate))throw Error('Az árfolyam nem hitelesíthető.');
        if(!confirmation.checked||fingerprint!==quoteFingerprint()||Number($('approved_price_manual').value)!==n)return;
        const totalEur=Math.round(n/rate.rateHufPerEur*100)/100;
        pendingQuote.raw={eurConversion:{status:'available',rateHufPerEur:rate.rateHufPerEur,rateDate:rate.rateDate,totalEur}};
        $('price_approval_status').textContent=`Kézzel ellenőrzött ár: ${formatFt(n)} (kb. ${formatEur(totalEur)}; MNB: ${rate.rateDate}). Külön jóváhagyásra vár; nem küldtünk levelet.`;
      }catch{
        if(confirmation.checked&&fingerprint===quoteFingerprint()){
          $('price_approval_status').textContent=`Kézzel ellenőrzött ár: ${formatFt(n)}. Az MNB EUR-árfolyam most nem elérhető, ezért csak a forintösszeg hagyható jóvá.`;
        }
      }
    });
    $('approve_price').addEventListener('click',approvePriceIntoDraft);
  }

  function prepare(message) {
    const central=window.SarberkiBookingRuntime&&window.SarberkiCaseController?.snapshot();
    if(central){
      const v=central.values;
      for(const [key,id]of Object.entries({arrival:'price_arrival',departure:'price_departure',adults:'price_adults',children:'price_children',child_ages:'price_child_ages'}))$(id).value=v[key]??'';
      const keys=Object.entries(cabins).find(([,label])=>label===v.unit);$('price_cabin').value=keys?.[0]||'';
      if(!central.quote)clearApprovedPrice('Az ügyhöz nincs aktuális jóváhagyott ár.');
      $('price_status').textContent=central.quote?'Az ügy korábbi, továbbra is releváns jóváhagyott ára megmaradt.':'Az összegyűjtött ügyadatok átvéve; ár csak igazolt szabad kapacitásra kérhető.';
      return;
    }

    const analysis = typeof extract === 'function' ? extract(message,'') : null;
    const fields = analysis?.fields || {};
    const gmailRecord=gmailNormalizedRecord();
    const normalized=gmailRecord?.normalized||{};
    const gmailDate=gmailNormalizedDate();
    const sharedRange=window.SarberkiNormalize?.dateRangeFromText?.(message,new Date(),window.SarberkiConfig?.timezone||'Europe/Budapest')||null;
    $('price_arrival').value = fields.arrival?.value || normalized.dates?.arrival || gmailDate?.arrival || sharedRange?.arrival || '';
    $('price_departure').value = fields.departure?.value || normalized.dates?.departure || gmailDate?.departure || sharedRange?.departure || '';
    const sharedChildren=window.SarberkiNormalize?.childCountFromText?.(message);
    const hasKnownChildStatus=childStatusKnown(message,analysis,normalized);
    const directTotal=window.SarberkiNormalize?.guestCountFromText?.(message);
    const directAdult=window.SarberkiNormalize?.adultCountFromText?.(message);
    const deterministicNoChildren=Number.isInteger(directTotal)&&Number.isInteger(directAdult)&&directTotal===directAdult&&directTotal>0;
    const mentionsChildren=/\b(?:gyerek\w*|gyermek\w*|children?|kids?|kind(?:er)?|otrok\w*)\b/iu.test(message);
        const adultsOnlyMention=Number.isInteger(directAdult)&&directAdult>0&&!mentionsChildren;
        const children = normalized.children!==null&&normalized.children!==undefined&&normalized.children!==''&&Number.isInteger(Number(normalized.children)) ? Number(normalized.children) : (fields.children?.value!==null&&fields.children?.value!==undefined&&fields.children?.value!==''&&Number.isInteger(Number(fields.children.value)) ? Number(fields.children.value) : (sharedChildren!=null&&Number.isInteger(Number(sharedChildren)) ? Number(sharedChildren) : ((explicitNoChildren(message)||deterministicNoChildren||adultsOnlyMention)?0:null)));
    const normalizedAdults=Number(normalized.adults);
    const normalizedGuests=Number(normalized.guests);
    const sharedGuestsRaw=window.SarberkiNormalize?.guestCountFromText?.(message);
    const sharedGuests=sharedGuestsRaw==null?null:Number(sharedGuestsRaw);
    const adultMatch=message.match(/\b(\d+)\s*(?:felnőtt\w*|adults?|erwachsene\w*|odrasl\w*)\b/iu);
    const directAdults=adultMatch?Number(adultMatch[1]):null;
    const knownAdults=Number.isInteger(normalizedAdults)&&normalizedAdults>0 ? normalizedAdults : (fields.adults?.value&&Number.isInteger(Number(fields.adults.value))&&Number(fields.adults.value)>0 ? Number(fields.adults.value) : (Number.isInteger(directAdults)&&directAdults>0 ? directAdults : (hasKnownChildStatus&&Number.isInteger(children)&&children>0&&Number.isInteger(normalizedGuests)&&normalizedGuests>children ? normalizedGuests-children : (hasKnownChildStatus&&Number.isInteger(children)&&children>0&&Number.isInteger(sharedGuests)&&sharedGuests>children ? sharedGuests-children : null))));
    $('price_adults').value = Number.isInteger(knownAdults)&&knownAdults>0 ? String(knownAdults) : '';
    if ($('price_children')) $('price_children').value = Number.isInteger(children)&&children>=0 ? String(children) : '';
    const sharedAges=window.SarberkiNormalize?.childAgesFromText?.(message)||[];
    if ($('price_child_ages')) $('price_child_ages').value = Array.isArray(normalized.child_ages)&&normalized.child_ages.length ? normalized.child_ages.join(', ') : fields.child_ages?.value || (Array.isArray(sharedAges)&&sharedAges.length?sharedAges.join(', '):'');
    const unit=(fields.unit?.value || normalized.cabin || window.SarberkiNormalize?.cabinFromText?.(message) || '').toLowerCase();
    const explicit = explicitCabin(message);
    const splitUnit=explicit==='split'?explicitSplitUnit(message):'';
    $('price_cabin').value = splitUnit ? `split${splitUnit}` : explicit || Object.keys(cabins).find(k => unit.includes(cabins[k].toLowerCase())) || '';
    const caseValues=window.SarberkiCaseController?.snapshot()?.values;
    if(caseValues){for(const [key,id] of Object.entries({arrival:'price_arrival',departure:'price_departure',adults:'price_adults',children:'price_children',child_ages:'price_child_ages'}))$(id).value=caseValues[key]??'';const type=Object.keys(cabins).find(k=>cabins[k]===caseValues.unit);if(type)$('price_cabin').value=type;}
    $('price_result').textContent = '';
    clearApprovedPrice('Az érdeklődés adatai frissültek; az árat újra ellenőrizni és jóváhagyni kell.');
    $('price_status').textContent = !hasKnownChildStatus ? 'A teljes létszám ismert lehet, de a felnőtt/gyermek összetétel még hiányzik. Árlekérés csak ennek pontosítása után indulhat.' : children ? 'Gyermekes foglalás adatai átvéve. Pontos gyermekkorokkal hiteles élő árlekérés indítható; az ár külön jóváhagyásra vár.' : !explicit ? 'Háztípus nincs megadva; pontos dátum és létszám esetén a szabad, kapacitásban megfelelő lehetőségeket automatikusan ellenőrizzük.' : 'Ellenőrizd a kinyert adatokat. Az élő árlekérés után külön árjóváhagyás szükséges.';
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

  function foreignFocusedReply(message='',analysis=null,lang='EN'){
    const f=analysis?.fields||{};
    const v=Object.fromEntries(Object.entries(f).map(([k,x])=>[k,x?.value??'']));
    const selectedCabin=cabins[$('price_cabin')?.value||'']||v.unit||'';
    const adults=v.adults||$('price_adults')?.value||'';
    const children=(v.children!==null&&v.children!==undefined&&v.children!=='')?v.children:($('price_children')?.value??'');
    const ages=v.child_ages||$('price_child_ages')?.value||'';
    const guests=v.guests||((Number(adults)||0)+(Number(children)||0)||'');
    v.adults=adults; v.children=children; v.guests=guests;
    const cabin=selectedCabin||v.unit||'';
    const stay=v.arrival&&v.departure?v.arrival+' – '+v.departure:'';
    const availabilityLines=currentAvailabilityLines(v,lang);
    const priceApproved=approvedPrice&&approvedPrice.fingerprint===quoteFingerprint();
    const asksPrice=/(?:price|cost|how much|preis|kosten|wieviel|wie viel|cena|koliko|stane)/iu.test(message);
    const total=priceApproved?formatFt(approvedPrice.total):'';
    const eur=priceApproved&&Number.isFinite(approvedPrice.eurTotal)?formatEur(approvedPrice.eurTotal):'';
    const party=adults?(lang==='DE'?adults+' Erwachsene':lang==='SL'?adults+' odraslih':adults+' adults'):(guests?(lang==='DE'?guests+' Personen':lang==='SL'?guests+' oseb':guests+' guests'):'');
    const childText=Number(children)>0?(lang==='DE'?' und '+children+' Kinder'+(ages?' ('+ages+' Jahre)':''):lang==='SL'?' in '+children+' otrok'+(ages?' ('+ages+' let)':''):' and '+children+' children'+(ages?' (ages '+ages+')':'')):'';
    let priceLine='';
    if(priceApproved){
      if(lang==='DE') priceLine='Der von Ihnen ausgewählte Haustyp '+(cabin||'Unterkunft')+' kostet für '+(party||'die angegebene Gästezahl')+childText+' laut freigegebenem Preis insgesamt '+total+(eur?' (ca. '+eur+')':'')+'.';
      else if(lang==='SL') priceLine='Cena za izbrano nastanitev '+(cabin||'')+' za '+(party||'navedeno število gostov')+childText+' po potrjeni ponudbi znaša skupaj '+total+(eur?' (približno '+eur+')':'')+'.';
      else priceLine='The '+(cabin||'accommodation')+' selected for your stay for '+(party||'the stated number of guests')+childText+' has an approved total price of '+total+(eur?' (approx. '+eur+')':'')+'.';
    } else if(asksPrice){
      priceLine=lang==='DE'?'Den aktuellen Gesamtpreis bestätigen wir nach der Preisprüfung.':lang==='SL'?'Aktualno skupno ceno potrdimo po preverjanju cene.':'We will confirm the current total price after the price check.';
    }
    const missing=[];
    if(!v.arrival||!v.departure) missing.push(lang==='DE'?'genaues Anreise- und Abreisedatum':lang==='SL'?'točen datum prihoda in odhoda':'exact arrival and departure dates');
    if(!cabin&&!availabilityLines.length) missing.push(lang==='DE'?'gewünschter Haustyp':lang==='SL'?'želeni tip hiške':'requested cabin type');
    if(!adults) missing.push(lang==='DE'?'Anzahl der Erwachsenen':lang==='SL'?'število odraslih':'number of adults');
    const childKnown=children!==''&&children!==null&&children!==undefined;
    if(!childKnown) missing.push(lang==='DE'?'ob Kinder mitreisen':lang==='SL'?'ali bodo z vami otroci':'whether any children will be staying');
    if(childKnown&&Number(children)>0&&!ages) missing.push(lang==='DE'?'Alter der Kinder':lang==='SL'?'starost otrok':'ages of the children');
    const missingLine=missing.length?(lang==='DE'?'Bitte teilen Sie uns noch mit: ':lang==='SL'?'Prosimo, sporočite še: ':'Please also provide: ')+missing.join(', ')+'.':'';
    const parkingAsked=/(?:parking|parkplatz|parken|auto(?:s)?\b|parkir|avto\w*)/iu.test(message);
    const parkingLine=!parkingAsked?'':lang==='DE'?'Parkplätze sind vorhanden. Wenn Sie mit mehreren Autos anreisen, teilen Sie uns bitte die Anzahl mit; dies wird separat geprüft.':lang==='SL'?'Parkiranje je zagotovljeno. Če prihajate z več avtomobili, prosimo sporočite njihovo število; to preverimo posebej.':'Parking is available. If you are arriving with more than one car, please tell us how many cars; this is checked separately.';
    const fishingLang=lang==='SL'?'si':lang.toLowerCase();
    const fishingAnswer=(typeof window!=='undefined'&&window.SarberkiFishingQuestion?.(message,fishingLang)?.answer)||'';
    const lines=lang==='DE'?[
      'Guten Tag'+(v.name?', '+v.name:'')+'!','', 'Vielen Dank für Ihre Anfrage.', stay?'Gewünschter Zeitraum: '+stay+'.':'', cabin?'Ausgewählter Haustyp: '+cabin+'.':'', priceLine, parkingLine, fishingAnswer, '', ...availabilityLines, missingLine
    ]:lang==='SL'?[
      'Pozdravljeni'+(v.name?', '+v.name:'')+'!','', 'Hvala za vaše povpraševanje.', stay?'Želeno obdobje: '+stay+'.':'', cabin?'Izbrana nastanitev: '+cabin+'.':'', priceLine, parkingLine, fishingAnswer, '', ...availabilityLines, missingLine
    ]:[
      'Dear '+(v.name||'Guest')+',','', 'Thank you for your inquiry.', stay?'Requested stay: '+stay+'.':'', cabin?'Selected accommodation: '+cabin+'.':'', priceLine, parkingLine, fishingAnswer, '', ...availabilityLines, missingLine
    ];
    if(priceApproved){
      const terms=bookingTermsForGuests(Number(adults||0)+Number(children||0));
      if(lang==='DE') lines.push('', `Die Anzahlung beträgt ${terms.depositPct} % des Unterkunftspreises und ist innerhalb von ${terms.depositDueDays} Tagen per Überweisung zu bezahlen.`, `Eine Stornierung ist bis ${terms.cancellationDays} Tage vor der Anreise gemäß den Buchungsbedingungen möglich.`, 'Wenn dieses Angebot für Sie passt, antworten Sie bitte auf diese E-Mail und bestätigen Sie, dass wir die Buchung zu den oben genannten Bedingungen erfassen dürfen.');
      else if(lang==='SL') lines.push('', `Akontacija za rezervacijo znaša ${terms.depositPct} % cene nastanitve in jo je treba poravnati z bančnim nakazilom v ${terms.depositDueDays} dneh.`, `Rezervacijo je mogoče odpovedati do ${terms.cancellationDays} dni pred prihodom v skladu s pogoji rezervacije.`, 'Če vam ponudba ustreza, prosimo odgovorite na to e-pošto in potrdite, da lahko rezervacijo zabeležimo pod zgoraj navedenimi pogoji.');
      else lines.push('', `The booking deposit is ${terms.depositPct}% of the accommodation price and must be paid by bank transfer within ${terms.depositDueDays} days.`, `The reservation may be cancelled up to ${terms.cancellationDays} days before arrival in accordance with the booking conditions.`, 'If this offer is suitable for you, please reply to this email and confirm that we may proceed with the booking under the conditions above.');
    }
    if(lang==='DE') lines.push('','Mit freundlichen Grüßen','Sárberki Horgásztó');
    else if(lang==='SL') lines.push('','Lep pozdrav,','Sárberki Horgásztó');
    else lines.push('','Kind regards,','Sárberki Horgásztó');
    return lines.filter((x,i,a)=>x!==''||i===0||a[i-1]!=='').join('\n');
  }

  function focusedReply(message=''){
    if(typeof window!=='undefined'&&window.SarberkiCaseState&&window.SarberkiCaseController?.snapshot()) return window.SarberkiCaseController.rebuild();
    const analysis=typeof extract==='function'?extract(message,''):null;
    if(!analysis) return '';
    const replyLanguage=analysis.fields?.language?.value||'HU';
    if(replyLanguage!=='HU') return foreignFocusedReply(message,analysis,replyLanguage);
    if(['cancellation_request','modification_request'].includes(analysis.intent)) return '';
    const f=analysis.fields||{};
    const v=Object.fromEntries(Object.entries(f).map(([k,x])=>[k,x?.value??'']));
    const selectedCabin=cabins[$('price_cabin')?.value||'']||'';
    if(selectedCabin) v.unit=selectedCabin;
    v.adults=v.adults||$('price_adults')?.value||'';
    if(v.children===''||v.children===null||v.children===undefined) v.children=$('price_children')?.value??'';
    if(!v.guests) v.guests=(Number(v.adults)||0)+(Number(v.children)||0)||'';
    const asked=huAskedTopics(message,analysis);
    const availabilityLines=currentAvailabilityLines(v,'HU');
    const lines=['Kedves '+(v.name||'Érdeklődő')+'!','','Köszönjük érdeklődését a Sárberki Horgásztó iránt.'];
    const bookingBits=[];
    if(v.arrival&&v.departure) bookingBits.push(v.arrival+' – '+v.departure);
    if(v.nights) bookingBits.push(v.nights+' éjszakára');
    if(v.guests) bookingBits.push(v.guests+' fő részére');
    if(bookingBits.length) lines.push('','Örömmel fogadtuk érdeklődését a '+bookingBits.join(', ')+' tervezett tartózkodásról.');
    const party=[];
    if(v.adults) party.push(v.adults+' felnőtt');
    if(Number(v.children)>0) party.push(v.children+' gyermek'+(v.child_ages?' ('+v.child_ages+' éves)':''));
    if(party.length) lines.push('Úgy látjuk, '+party.join(' és ')+' érkezne.');
    const plan=typeof accommodationPlan==='function'?accommodationPlan(v):null;
    if(plan?.specific&&v.unit) lines.push('A kért '+v.unit+' háztípust figyelembe vettük.');
    else if(v.unit&&!/^(?:ház|faház|apartman|cabin)$/iu.test(v.unit)) lines.push('A megadott szállástípus: '+v.unit+'.');
    else if(!v.unit&&!availabilityLines.length) lines.push('Kérjük, írja meg, melyik háztípust szeretnék: VIP, Családi, Deluxe vagy Osztott?');
    const priceApproved=approvedPrice&&approvedPrice.fingerprint===quoteFingerprint();
    if(asked.availability&&asked.price){
      if(priceApproved) lines.push('','Ellenőrizzük, hogy a megadott időpontra elérhető-e a kért háztípus. '+approvedPriceText(approvedPrice)+' Az elérhetőséget külön visszaigazoljuk.');
      else lines.push('','Ellenőrizzük, hogy a megadott időpontra elérhető-e a kért háztípus. Az aktuális teljes árról ezt követően tudunk pontos tájékoztatást adni.');
    } else if(asked.availability&&!availabilityLines.length) lines.push('','Ellenőrizzük, hogy a megadott időpontra elérhető-e a kért háztípus, és hamarosan visszajelzünk.');
    else if(asked.price){
      if(priceApproved){
        const label=selectedCabin||v.unit||'kiválasztott háztípus';
        const pp=[]; if(v.adults)pp.push(v.adults+' felnőtt'); if(Number(v.children)>0)pp.push(v.children+' gyermek'+(v.child_ages?' ('+v.child_ages+' éves)':''));
        const pt=pp.length?pp.join(' és ')+' részére':(v.guests?v.guests+' fő részére':'');
        lines.push('','Az Ön által választott '+label+' '+(pt?pt+' ':'')+'a jóváhagyott adatok alapján '+approvedPriceText(approvedPrice));
      } else lines.push('','Az aktuális teljes árat a foglalási felületen ellenőrizzük, és ezt követően tudunk pontos tájékoztatást adni.');
    } else if(priceApproved){
      const label=selectedCabin||v.unit||'kiválasztott háztípus';
      const pp=[]; if(v.adults)pp.push(v.adults+' felnőtt'); if(Number(v.children)>0)pp.push(v.children+' gyermek'+(v.child_ages?' ('+v.child_ages+' éves)':''));
      const pt=pp.length?pp.join(' és ')+' részére':(v.guests?v.guests+' fő részére':'');
      lines.push('','Az Ön által választott '+label+' '+(pt?pt+' ':'')+'a jóváhagyott adatok alapján '+approvedPriceText(approvedPrice));
    }
    if(priceApproved){
      const guestCount=(Number(v.adults)||Number($('price_adults')?.value)||0)+(Number(v.children)||Number($('price_children')?.value)||0);
      const terms=bookingTermsForGuests(guestCount);
      lines.push('',`A foglaló összege a teljes szállásdíj ${terms.depositPct}%-a, amelyet ${terms.depositDueDays} napon belül átutalással kérünk rendezni.`,`A foglalás az érkezést megelőző ${terms.cancellationDays}. napig mondható le a foglalási feltételek szerint.`,'Amennyiben az ajánlat megfelel Önnek, kérjük, válasz e-mailben erősítse meg, hogy a foglalást a fenti feltételekkel rögzíthetjük. A foglalást csak az Ön egyértelmű visszaigazolása után rögzítjük.');
    }
    if(asked.pet) lines.push('','A kisebb kutyával kapcsolatos kérését is feljegyeztük. Háziállat térítés ellenében hozható; a pontos díjat ellenőrizzük.');
    if(asked.hotTub){ if(/deluxe/iu.test(String(v.unit||''))) lines.push('','A Deluxe házakhoz dézsa tartozik; a kért időszak szabad kapacitását a foglalási felületen ellenőrizzük.'); else lines.push('','A dézsa rendelkezésre állását is ellenőrizzük a kért időszakra.'); }
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
    if(asked.parking) lines.push('','A parkolás biztosított. Ha több autóval érkeznek, kérjük, jelezzék az autók számát, mert ezt külön ellenőrizzük.');
    if(asked.arrivalTime) lines.push('','A megadott érkezési időpontot is figyelembe vettük, és visszaigazoljuk, hogy az adott érkezési idő megfelelő-e.');
    const fishingAnswer=(typeof window!=='undefined'&&window.SarberkiFishingQuestion?.(message,'hu')?.answer)||'';
    if(fishingAnswer) lines.push('',fishingAnswer);
    if(availabilityLines.length) lines.push('',...availabilityLines);
    const missing=[];
    if(!v.arrival||!v.departure) missing.push('pontos érkezési és távozási dátum');
    if((!v.unit||/^(?:ház|faház|apartman|cabin)$/iu.test(v.unit))&&!availabilityLines.length) missing.push('kért háztípus');
    if(!v.adults) missing.push('felnőttek száma');
    const childKnown=v.children!==null&&v.children!==undefined&&v.children!=='';
    if(!childKnown) missing.push('érkezik-e gyermek');
    if(childKnown&&Number(v.children)>0&&!v.child_ages) missing.push('gyermek(ek) életkora');
    if(missing.length) lines.push('','A pontos válaszhoz kérjük, írja meg még: '+missing.join(', ')+'.');
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
    if(!pendingQuote||pendingQuote.fingerprint!==quoteFingerprint()||(pendingQuote.operatorChecked&&!$('manual_quote_confirmed')?.checked)){ $('price_approval_status').textContent='Az ár ellenőrzése hiányzik vagy az alapadata megváltozott; új ellenőrzés szükséges.';return;}
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
      operatorChecked:Boolean(pendingQuote?.operatorChecked),
      referenceOnly:Boolean(pendingQuote?.raw?.referenceOnly),
      availabilityVerified:pendingQuote?.raw?.availability==='available'&&!pendingQuote.raw.referenceOnly,
      fingerprint:quoteFingerprint(),
      approvedAt:new Date().toISOString()
    };
    if(window.SarberkiCaseState){const state=window.SarberkiCaseController?.snapshot();if(state)window.SarberkiCaseController.apply({type:'quote',quote:approvedPrice,fingerprint:window.SarberkiCaseState.caseFingerprint(state.values)});}
    applyFocusedReply(message);
    $('price_approval_status').textContent=`Jóváhagyva: ${formatFt(approvedPrice.total)}. Az összeg automatikusan bekerült a választervezetbe. E-mail nem lett elküldve.`;
    const status=$('status');
    if(status){
      status.className='warning';
      status.textContent='Állapot: az ár jóváhagyása után a választervezet frissült; a teljes levél továbbra is emberi jóváhagyásra vár. Innen nincs e-mail-küldés.';
    }
  }

  async function autoPrepareAndQuoteFromGmail() {
    if(window.SarberkiBookingRuntime){
      const central=window.SarberkiCaseController?.snapshot();if(!central)return;
      prepare(central.original);const v=central.values;
      if(central.quote)return;
      if(!['booking_request','availability_request','price_request'].includes(central.intent)||!v.arrival||!v.departure||!$('price_cabin').value||!(Number(v.adults)>0)||v.children===''||v.children==null||childAgesForQuote(Number(v.children),v.child_ages)===null)return;
      await $('check_price').onclick();return;
    }

    const message=$('gmail_original')?.textContent||'';
    if(!message) return;
    prepare(message);
    applyFocusedReply(message);
    const analysis=typeof extract==='function' ? extract(message,'') : null;
    const gmailRecord=gmailNormalizedRecord();
    const normalized=gmailRecord?.normalized||{};
    const hasKnownChildStatus=childStatusKnown(message,analysis,normalized);
    const normalizedChildRaw=normalized.children;
    const fieldChildRaw=analysis?.fields?.children?.value;
    const directTotal=window.SarberkiNormalize?.guestCountFromText?.(message);
    const directAdult=window.SarberkiNormalize?.adultCountFromText?.(message);
    const deterministicNoChildren=Number.isInteger(directTotal)&&Number.isInteger(directAdult)&&directTotal===directAdult&&directTotal>0;
    const childCount=normalizedChildRaw!==null&&normalizedChildRaw!==undefined&&normalizedChildRaw!==''&&Number.isInteger(Number(normalizedChildRaw)) ? Number(normalizedChildRaw) : (fieldChildRaw!==null&&fieldChildRaw!==undefined&&fieldChildRaw!==''&&Number.isInteger(Number(fieldChildRaw)) ? Number(fieldChildRaw) : ((explicitNoChildren(message)||deterministicNoChildren)?0:null));
    const hasChildWord=/\b(?:gyerek|gyermek|gyerekek|gyermekek|children|child|kind(?:er)?|otroka)\b/iu.test(message);
    const gmailDate=gmailNormalizedDate();
    const complete=Boolean($('price_arrival').value&&$('price_departure').value&&$('price_cabin').value&&Number($('price_adults').value)>0);
    const blockingWarnings=['guest_conflict','nights_conflict','date_conflict','invalid_date','uncertain_date'];
    const guests=Number.isInteger(Number(normalized.guests)) ? Number(normalized.guests) : Number(analysis?.fields?.guests?.value);
    const gmailReview=Array.isArray(gmailRecord?.human_review)?gmailRecord.human_review:[];
    const gmailConflict=gmailReview.some(item=>/ellentmondó|contradict/i.test(String(item)));
    if(!hasKnownChildStatus||gmailConflict||['modification_request','cancellation_request'].includes(analysis?.intent)||blockingWarnings.some(code=>analysis?.warning_codes?.includes(code))||!Number.isInteger(guests)||guests<1||!Number.isInteger(childCount)||guests!==Number($('price_adults').value)+childCount){
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
    const childRaw=$('price_children')?.value;
    if(childRaw===null||childRaw===undefined||childRaw===''){status.textContent='HITELES ÁRLEKÉRÉS SZÜKSÉGES · Előbb tisztázni kell, érkezik-e gyermek.';return;}
    const childCount=Number(childRaw);
    const ages=childAgesForQuote(childCount,$('price_child_ages')?.value);
    if (ages===null || (!explicitNoChildren(message) && childCount===0 && /\b(?:gyerek|gyermek|gyerekek|gyermekek|children|kind(?:er)?|otroka)\b/iu.test(message))) {status.textContent='HITELES ÁRLEKÉRÉS SZÜKSÉGES · A gyermekek pontos száma és életkora nélkül ár nem adható.';return;}
    if(window.SarberkiCaseState){const count=Number($('price_adults').value)+Number($('price_children').value);window.SarberkiCaseController?.facts({arrival:$('price_arrival').value,departure:$('price_departure').value,unit:cabins[$('price_cabin').value]||$('price_cabin').value,adults:$('price_adults').value,children:$('price_children').value,child_ages:$('price_child_ages').value,guests:String(count),nights:String((Date.parse($('price_departure').value)-Date.parse($('price_arrival').value))/86400000)});}
    const input={arrival:$('price_arrival').value,departure:$('price_departure').value,cabin:$('price_cabin').value,adults:Number($('price_adults').value),children:ages};
    const requestCase=window.SarberkiCaseController?.snapshot();
    const requestKey=quoteFingerprint();
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
      if(window.SarberkiBookingRuntime)await window.SarberkiBookingRuntime.beforePrice(input);
      let response=await fetch('/api/price-quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input),cache:'no-store'});
      if (!response.headers.get('content-type')?.includes('application/json')) throw Error('Az árlekérő szerver nincs ehhez az oldalhoz csatlakoztatva.');
      let result=await response.json();
      // Closed safety gate: request a public price-list reference, never an unverified Previo read.
      if(response.status===503&&result.code==='PREVIO_SAFETY_GATE_CLOSED'){
        response=await fetch('/api/price-reference',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input),cache:'no-store'});
        if(!response.headers.get('content-type')?.includes('application/json'))throw Error('A tájékoztató árkalkulátor nem érhető el.');
        result=await response.json();
      }
      if(typeof requestKey!=='undefined'&&(requestKey!==quoteFingerprint()||requestCase?.original!==window.SarberkiCaseController?.snapshot()?.original))return; if(result.status==='unavailable'){const needed=Number(input.units||1);const free=Number(result.availableUnits);status.textContent=Number.isInteger(free)?`A kért ${cabins[input.cabin]||input.cabin} típusból ${needed} egység szükséges ehhez a létszámhoz, de a foglalási felület csak ${free} szabad egységet mutat erre az időszakra. Ár nem került a válaszba; kezelői ellenőrzés szükséges.`:'A kért háztípusból a foglalási felület nem mutat szabad egységet erre az időszakra. Ár nem került a válaszba; kezelői ellenőrzés szükséges.';return;} if(!response.ok || !['review_required','public_reference'].includes(result.status))throw Error(result.error||'Nem sikerült az árlekérés.');
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
      $('price_result').textContent=`${result.arrival}–${result.departure} · ${result.cabin}${(result.units||1)>1?` · Egységek: ${result.units}`:''} · ${result.adults} felnőtt${result.children.length?` · ${result.children.length} gyermek (${result.children.join(', ')} éves)`:''} · Szállás: ${result.accommodation.toLocaleString('hu-HU')} Ft · IFA: ${result.tourismTax.toLocaleString('hu-HU')} Ft · Teljes ár: ${result.total.toLocaleString('hu-HU')} Ft${referenceOnly?' · TÁJÉKOZTATÓ ÁRLISTAÁR · Szabad kapacitás NEM ellenőrzött':''}${eurText}${unitText} · Forrás: ${result.source} · Lekérés: ${result.checkedAt} · 20% törzsvendégkedvezmény: nincs alkalmazva`;
      pendingQuote={total:Number(result.total),source:result.source||'foglalási oldal',fingerprint:quoteFingerprint(),raw:{...result,referenceOnly}};
      $('approved_price_manual').value=String(result.total);
      $('approve_price').disabled=false;
      $('price_approval_status').textContent=`${referenceOnly?'Tájékoztató árlistaár':'Lekért teljes ár'}: ${formatFt(result.total)} · jóváhagyásra vár. Még nincs a vendégválaszban.`;
      status.textContent=referenceOnly?'A Sárberki publikus árlistája alapján számolt referenciaár elkészült. A szabad kapacitást külön kell ellenőrizni; az összeg csak jóváhagyás után kerülhet a válaszba.':'A foglalási oldalon megjelenő ár ellenőrzésre vár. Az „Ár jóváhagyása és beépítése a levélbe” gombig nem kerül a vendégválaszba, és foglalás nem történik.';
    } catch(e) {status.textContent=`AZ AUTOMATIKUS ÁRLEKÉRÉS MÉG NEM ENGEDÉLYEZETT · ${e.message} A fenti hivatalos foglaló hivatkozásán ellenőrizheted az árat és a szabad kapacitást; utána írd be a teljes forintárat, és erősítsd meg a kézi ellenőrzést.`;}
  };

  ['price_arrival','price_departure','price_cabin','price_adults','price_children','price_child_ages'].forEach(id=>{
    const el=$(id);
    if(el) el.addEventListener('change',()=>{
      const key=id.replace('price_','').replace('cabin','unit');const value=key==='unit'?(cabins[el.value]||el.value):el.value;
      window.SarberkiCaseController?.facts({[key]:value});
      clearApprovedPrice('Az ár alapadata megváltozott; az árat újra ellenőrizni és jóváhagyni kell.');
    });
  });

  document.addEventListener('sarberki:analysis-ready',(event)=>{
    const message=event?.detail?.message||$('message')?.value||'';
    if(message){
      prepare(message);
      setTimeout(()=>applyFocusedReply(message),0);
      refreshAvailabilityOptions(message).catch(()=>{});
    }
  });
  document.addEventListener('sarberki:record-loaded',()=>{if(window.SarberkiBookingRuntime)return;autoPrepareAndQuoteFromGmail().catch(e=>{$('price_status').textContent='Automatikus adatátadás nem sikerült: '+e.message;});});
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
