const $=id=>document.getElementById(id);

function localizedOptionLabel(label,language='hu'){
  const lang=['hu','de','en','si'].includes(language)?language:'hu';
  let text=String(label||'');
  if(lang==='de') return text
    .replace(/Különálló 2 fős/gu,'Freistehende Hütte für 2 Personen')
    .replace(/Családi/gu,'Familienhaus')
    .replace(/Osztott/gu,'Geteilte Einheit');
  if(lang==='en') return text
    .replace(/Különálló 2 fős/gu,'Standalone 2-person cabin')
    .replace(/Családi/gu,'Family cabin')
    .replace(/Osztott/gu,'Split unit');
  if(lang==='si') return text
    .replace(/Különálló 2 fős/gu,'Samostojna hiška za 2 osebi')
    .replace(/Családi/gu,'Družinska hiška')
    .replace(/Osztott/gu,'Deljena enota');
  return text;
}
function unitText(option,language='hu'){
  const count=Number(option.units)||1;
  const label=localizedOptionLabel(option.label,language);
  return count===1?label:`${count} × ${label}`;
}
export function availabilitySentence(result,language='hu'){
  const available=(result?.available_options||[]).map(option=>unitText(option,language));
  if(!available.length)return ({hu:'A megadott időszakra a hitelesen ellenőrizhető háztípusok között jelenleg nem találtunk megfelelő szabad kapacitást.',de:'Für den gewünschten Zeitraum haben wir bei den geprüften Haustypen keine passende freie Kapazität gefunden.',en:'We have not found suitable availability among the verified cabin types for the requested dates.',si:'Za izbrani termin med preverjenimi tipi hišk nismo našli primerne proste kapacitete.'})[language]||availabilitySentence(result,'hu');
  const intro=({hu:'A megadott időpontban a létszám alapján ellenőrzött, szabad lehetőségek: ',de:'Geprüfte verfügbare Optionen für Ihre Reisedaten und Personenzahl: ',en:'Verified available options for your dates and party size: ',si:'Preverjene proste možnosti za vaš termin in število gostov: '})[language]||'A megadott időpontban a létszám alapján ellenőrzött, szabad lehetőségek: ';
  return intro+available.join(', ')+'.';
}
export function splitReviewSentence(result,language='hu'){
  const manual=(result?.manual_review_options||[]);
  if(!manual.length)return '';
  const lang=['hu','de','en','si'].includes(language)?language:'hu';
  const mode=manual[0]?.request_mode||'generic_capacity';
  const specific={
    single_two_person:{
      hu:'Egy 2 fős osztott apartman esetén a konkrét egységet a szabad A/B egységek közül választjuk ki.',
      de:'Bei einem geteilten 2-Personen-Apartment wählen wir die konkrete Einheit aus den freien A/B-Einheiten aus.',
      en:'For one 2-person split apartment, we choose the specific unit from the available A/B units.',
      si:'Pri enem 2-osebnem deljenem apartmaju izberemo konkretno enoto med prostimi enotami A/B.'
    },
    double_two_person:{
      hu:'Két 2 fős osztott apartmannál elsőként ugyanazon faház egymás melletti A+B egységét keressük. Ha csak különböző faházakból állítható össze, azt külön emberi jóváhagyással ajánljuk.',
      de:'Bei zwei geteilten 2-Personen-Apartments suchen wir zuerst das A+B-Paar im selben Haus. Eine Kombination aus verschiedenen Häusern wird nur nach manueller Freigabe angeboten.',
      en:'For two 2-person split apartments, we first look for the A+B pair in the same house. A combination across different houses is offered only after human approval.',
      si:'Pri dveh 2-osebnih deljenih apartmajih najprej iščemo par A+B v isti hiški. Kombinacijo iz različnih hišk ponudimo le po ročni potrditvi.'
    },
    single_four_person:{
      hu:'A 4 fős osztott apartman az osztott faház emeleti egysége; a ténylegesen szabad 4 fős egységet ellenőrizzük.',
      de:'Das geteilte 4-Personen-Apartment ist die obere Einheit des Hauses; wir prüfen, welche 4-Personen-Einheit tatsächlich frei ist.',
      en:'The 4-person split apartment is the upper unit of the house; we check which 4-person unit is actually available.',
      si:'4-osebni deljeni apartma je zgornja enota hiške; preverimo, katera 4-osebna enota je dejansko prosta.'
    },
    two_plus_four:{
      hu:'A 2 fős és 4 fős osztott egységet elsőként ugyanabban a fizikai faházban keressük. Különböző házak kombinációja csak emberi jóváhagyással ajánlható.',
      de:'Die 2- und 4-Personen-Einheit suchen wir zuerst im selben Haus. Eine Kombination aus verschiedenen Häusern wird nur nach manueller Freigabe angeboten.',
      en:'We first look for the 2-person and 4-person split units in the same physical house. A cross-house combination is offered only after human approval.',
      si:'2- in 4-osebno deljeno enoto najprej iščemo v isti hiški. Kombinacijo iz različnih hišk ponudimo le po ročni potrditvi.'
    },
    full_split_house:{
      hu:'Teljes osztott faház igénynél elsőként ugyanazon fizikai faház A+B+C egységeit keressük együtt.',
      de:'Bei einem vollständigen geteilten Haus suchen wir zuerst A+B+C gemeinsam im selben Haus.',
      en:'For a full split house, we first look for A+B+C together in the same physical house.',
      si:'Pri celotni deljeni hiški najprej iščemo A+B+C skupaj v isti fizični hiški.'
    },
    exact:{
      hu:'A megjelölt osztott egységek elérhetőségét külön ellenőrizzük; a végleges elhelyezést csak ezután igazoljuk vissza.',
      de:'Die Verfügbarkeit der angegebenen geteilten Einheiten prüfen wir separat; die endgültige Unterbringung bestätigen wir erst danach.',
      en:'We will check the availability of the specified split units separately and only then confirm the final accommodation.',
      si:'Razpoložljivost navedenih deljenih enot preverimo posebej; končno namestitev potrdimo šele nato.'
    }
  };
  if(specific[mode])return specific[mode][lang];
  const joiner=({hu:' vagy ',de:' oder ',en:' or ',si:' ali '})[lang];
  const labels=manual.map(x=>localizedOptionLabel(x.label,lang)).join(joiner);
  return ({hu:`Kapacitás alapján szóba jöhet ${labels}; az együttes elérhetőséget külön ellenőrizzük, és ezt csak utána tudjuk visszaigazolni.`,de:`Nach Kapazität kommen ${labels} infrage; die gemeinsame Verfügbarkeit prüfen und bestätigen wir separat.`,en:`Capacity options may include ${labels}; we will check and confirm their combined availability separately.`,si:`Glede na kapaciteto pridejo v poštev ${labels}; skupno razpoložljivost preverimo in potrdimo posebej.`})[lang];
}

function hasSpecificCabin(value=''){return /vip|családi|deluxe|osztott|különálló|2 fős/iu.test(value);}
export function replaceCapacityPlaceholder(draft,sentence,manual){
  const placeholders=[
    'A megadott létszám alapján megkeressük a megfelelő szabad szállástípusokat.',
    'Anhand der angegebenen Personenzahl suchen wir die passenden verfügbaren Unterkunftstypen.',
    'Based on the stated party size, we will find the suitable available accommodation types.',
    'Glede na navedeno število gostov poiščemo primerne razpoložljive vrste nastanitve.'
  ];
  const combined=[sentence,manual].filter(Boolean).join('\n');
  for(const placeholder of placeholders){
    if(draft.includes(placeholder)) return draft.replace(placeholder,combined);
  }

  const signatures=[
    '\n\nÜdvözlettel:\nSárberki Horgásztó',
    '\n\nMit freundlichen Grüßen\nSárberki Horgásztó',
    '\n\nKind regards,\nSárberki Horgásztó',
    '\n\nLep pozdrav\nSárberki Horgásztó',
    '\n\nLep pozdrav,\nSárberki Horgásztó'
  ];
  for(const signature of signatures){
    if(draft.includes(signature)) return draft.replace(signature,'\n\n'+combined+signature);
  }
  return draft+'\n\n'+combined;
}

function removeListItems(id,patterns){
  const root=$(id);
  if(!root?.children)return;
  for(const li of [...root.children]){
    if(patterns.some(pattern=>pattern.test(li.textContent||''))) li.remove();
  }
  if(!root.children.length){
    const li=document.createElement('li');
    li.textContent='Nincs további tétel';
    root.append(li);
  }
}

function syncGmailRecordAfterAvailability(){
  removeListItems('gmail_missing',[
    /Kívánt háztípus/iu,
    /Kapacitás és ár/iu
  ]);
  removeListItems('gmail_review',[
    /A dátumot ellenőrizni kell/iu,
    /háztípust nem választott/iu,
    /Szabad hely és ár nincs igazolva/iu
  ]);
  const state=$('gmail_record_state');
  if(state) state.textContent='Kapacitás ellenőrizve · ár csak külön árlekérés után';
}
function currentReplyBase(){
  const normalize=window.SarberkiNormalize;
  if(!normalize?.buildReplyDraft)return $('draft')?.value||'';
  const original=$('message')?.value||$('gmail_original')?.textContent||'';
  const rawLang=($('f_language')?.value||'HU').toLowerCase();
  const language=rawLang==='sl'?'si':rawLang;
  const childrenRaw=$('f_children')?.value;
  const childAges=($('f_child_ages')?.value||'').split(',').filter(x=>x.trim()!=='').map(x=>Number(x.trim())).filter(Number.isFinite);
  const fishing=window.SarberkiFishingQuestion?.(original,language);
  return normalize.buildReplyDraft({
    language,
    name:$('f_name')?.value||null,
    original,
    arrival:$('f_arrival')?.value||null,
    departure:$('f_departure')?.value||null,
    guests:$('f_guests')?.value?Number($('f_guests').value):null,
    adults:$('f_adults')?.value?Number($('f_adults').value):null,
    children:childrenRaw===''||childrenRaw==null?null:Number(childrenRaw),
    childAges,
    phone:normalize.phoneFromText?.(original)||null,
    cabin:'? – emberi döntésre vár',
    pier:/(?:stég|pier)/iu.test(original),
    hotTub:/(?:dézs|hot[ -]?tub|jacuzzi|badefass)/iu.test(original),
    dog:/(?:kuty|dog|pet|hund|pes)/iu.test(original),
    intent:'booking_request',
    brandName:window.SarberkiConfig?.brandName||'Sárberki Horgásztó',
    bookingRules:window.SarberkiConfig?.bookingRules||null,
    operationalRules:window.SarberkiConfig?.operationalRules||null,
    pricingRules:window.SarberkiConfig?.pricingRules||null,
    knowledgeLines:fishing?[fishing.answer]:[]
  });
}
let inflightKey=null;
function renderSplitInternalNote(options=[],request=null){
  const el=$('split_internal_note');
  if(!el)return;
  const summary=window.SarberkiSplitUnits?.splitInternalSummary?.(options,request)||'';
  el.textContent=summary;
  if(el.classList?.toggle)el.classList.toggle('hidden',!summary);
}
async function enrich(){
  const arrival=$('f_arrival')?.value||'', departure=$('f_departure')?.value||'', guests=Number($('f_guests')?.value||0), cabin=$('f_unit')?.value||'';
  const original=$('message')?.value||$('gmail_original')?.textContent||'';
  const splitCabin=/^Osztott$/iu.test(cabin.trim());
  const mustClarify=Boolean(window.SarberkiNormalize?.cabinClarificationRequired?.(original,guests));
  const initialSplitRequest=splitCabin?(window.SarberkiSplitUnits?.splitRequestFromText?.(original)||null):null;
  const initialSplitPlan=splitCabin?(window.SarberkiSplitUnits?.splitCapacityOptions?.(guests,{},initialSplitRequest)||[]):[];
  if(splitCabin)renderSplitInternalNote(initialSplitPlan,initialSplitRequest);
  if(!arrival||!departure||!Number.isInteger(guests)||guests<1||(hasSpecificCabin(cabin)&&!splitCabin)||mustClarify){
    if(!splitCabin)renderSplitInternalNote([],null);
    return;
  }
  const fingerprint=()=>[ $('f_arrival')?.value||'', $('f_departure')?.value||'', $('f_guests')?.value||'', $('f_unit')?.value||'', $('message')?.value||'', $('gmail_original')?.textContent||'', $('f_language')?.value||'' ].join('|');
  const key=fingerprint();
  const caseState=window.SarberkiCaseController?.snapshot();
  const caseKey=caseState&&window.SarberkiCaseState?.caseFingerprint(caseState.values);
  if(inflightKey===key)return;
  inflightKey=key;
  const status=$('status'), draft=$('draft');
  if(!draft)return;
  if(status){status.className='warning';status.textContent='Kapacitás-ellenőrzés folyamatban a teszt Previo-forrásból…';}
  try{
    const response=await fetch('/api/availability-options',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({arrival,departure,guests})});
    const data=await response.json();
    if(key!==fingerprint())return;
    if(!response.ok)throw Error(data.error||'Nem sikerült a kapacitás-ellenőrzés.');
    const rawLang=($('f_language')?.value||'HU').toLowerCase();
    const lang=rawLang==='sl'?'si':rawLang;
    const splitRequest=initialSplitRequest||(window.SarberkiSplitUnits?.splitRequestFromText?.(original)||null);
    const planned=window.SarberkiSplitUnits?.splitCapacityOptions?.(guests,data.split_pool_checks||{},splitCabin?splitRequest:null);
    const manualOptions=Array.isArray(planned)?planned:(data.manual_review_options||[]);
    const manualData={...data,manual_review_options:manualOptions};
    const sentence=splitCabin?'':availabilitySentence(data,lang);
    const manual=splitReviewSentence(manualData,lang);
    renderSplitInternalNote(manualOptions,splitCabin?splitRequest:null);
    if(caseState){window.SarberkiCaseController.apply({type:'availability',fingerprint:caseKey,lines:[sentence,manual].filter(Boolean)});if(status){status.className='warning';status.textContent='Kapacitás ellenőrizve; további feltételek kezelői ellenőrzésre várnak.';}return;}
    const fresh=currentReplyBase();
    draft.value=replaceCapacityPlaceholder(fresh,sentence,manual);
    const gmailDraft=$('gmail_draft');
    if(gmailDraft) gmailDraft.value=draft.value;
    draft.dispatchEvent(new Event('input',{bubbles:true}));
    syncGmailRecordAfterAvailability();
    if(status){status.className='ok';status.textContent='Kapacitás ellenőrizve; a tervezet frissítve.';}
  }catch(error){
    if(key!==fingerprint())return;
    renderSplitInternalNote([],null);
    if(status){status.className='warning';status.textContent='A kapacitás nem volt hitelesen ellenőrizhető: '+error.message;}
  }finally{
    if(inflightKey===key)inflightKey=null;
  }
}

if(typeof document!=='undefined'){
  document.addEventListener('sarberki:analysis-ready',()=>{void enrich();});
  document.addEventListener('sarberki:gmail-normalized',()=>{setTimeout(()=>void enrich(),0);});
  window.SarberkiAvailabilityReady=true;
  document.dispatchEvent(new Event('sarberki:availability-ready'));
  if($('results')&&!$('results').classList.contains('hidden')) setTimeout(()=>void enrich(),0);
}
