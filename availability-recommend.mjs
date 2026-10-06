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
  const joiner=({hu:' vagy ',de:' oder ',en:' or ',si:' ali '})[language]||' vagy ';
  const labels=manual.map(x=>localizedOptionLabel(x.label,language)).join(joiner);
  return ({hu:`Kapacitás alapján szóba jöhet ${labels}; az együttes elérhetőséget külön ellenőrizzük, és ezt csak utána tudjuk visszaigazolni.`,de:`Nach Kapazität kommen ${labels} infrage; die gemeinsame Verfügbarkeit prüfen und bestätigen wir separat.`,en:`Capacity options may include ${labels}; we will check and confirm their combined availability separately.`,si:`Glede na kapaciteto pridejo v poštev ${labels}; skupno razpoložljivost preverimo in potrdimo posebej.`})[language]||splitReviewSentence(result,'hu');
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
async function enrich(){
  const arrival=$('f_arrival')?.value||'', departure=$('f_departure')?.value||'', guests=Number($('f_guests')?.value||0), cabin=$('f_unit')?.value||'';
  if(!arrival||!departure||!Number.isInteger(guests)||guests<1||hasSpecificCabin(cabin))return;
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
    const sentence=availabilitySentence(data,lang), manual=splitReviewSentence(data,lang);
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
