const $=id=>document.getElementById(id);

function unitText(option){
  const count=Number(option.units)||1;
  return count===1?option.label:`${count} × ${option.label}`;
}
export function availabilitySentence(result){
  const available=(result?.available_options||[]).map(unitText);
  if(!available.length)return 'A megadott időszakra a hitelesen ellenőrizhető háztípusok között jelenleg nem találtunk megfelelő szabad kapacitást.';
  return 'A megadott időpontban a létszám alapján ellenőrzött, szabad lehetőségek: '+available.join(', ')+'.';
}
export function splitReviewSentence(result){
  const manual=(result?.manual_review_options||[]);
  if(!manual.length)return '';
  const labels=manual.map(x=>x.label).join(' vagy ');
  return 'Osztott ház esetén kapacitás alapján szóba jöhet '+labels+', de ennek tényleges elérhetőségét csak az A/B/C Previo-megfeleltetés hitelesítése után szabad visszaigazolni.';
}
function hasSpecificCabin(value=''){return /vip|családi|deluxe|osztott|különálló|2 fős/iu.test(value);}
function replaceCapacityPlaceholder(draft,sentence,manual){
  const placeholder='A megadott létszám alapján ellenőrizzük az összes megfelelő szállástípust, és csak a ténylegesen szabad lehetőségeket ajánljuk fel.';
  const combined=[sentence,manual].filter(Boolean).join('\n');
  if(draft.includes(placeholder))return draft.replace(placeholder,combined);
  const closing=/\n\n(?:Üdvözlettel:|Mit freundlichen Grüßen|Kind regards,|Lep pozdrav,)\nSárberki Horgásztó\s*$/u;
  if(closing.test(draft)) return draft.replace(closing, '\n\n'+combined+'function replaceCapacityPlaceholder(draft,sentence,manual){
  const placeholder='A megadott létszám alapján ellenőrizzük az összes megfelelő szállástípust, és csak a ténylegesen szabad lehetőségeket ajánljuk fel.';
  const combined=[sentence,manual].filter(Boolean).join('\n');
  if(draft.includes(placeholder))return draft.replace(placeholder,combined);
  return draft+'\n\n'+combined;
}');
  return draft+'\n\n'+combined;
}
function currentReplyBase(){
  const normalize=window.SarberkiNormalize;
  if(!normalize?.buildReplyDraft)return $('draft')?.value||'';
  const original=$('message')?.value||$('gmail_original')?.textContent||'';
  const rawLang=($('f_language')?.value||'HU').toLowerCase();
  const language=rawLang==='sl'?'si':rawLang;
  const childrenRaw=$('f_children')?.value;
  const childAges=($('f_child_ages')?.value||'').split(',').map(x=>Number(x.trim())).filter(Number.isFinite);
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
  const key=[arrival,departure,guests].join('|');
  if(inflightKey===key)return;
  inflightKey=key;
  const status=$('status'), draft=$('draft');
  if(!draft)return;
  if(status){status.className='warning';status.textContent='Kapacitás-ellenőrzés folyamatban a teszt Previo-forrásból…';}
  try{
    const response=await fetch('/api/availability-options',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({arrival,departure,guests})});
    const data=await response.json();
    if(!response.ok)throw Error(data.error||'Nem sikerült a kapacitás-ellenőrzés.');
    const sentence=availabilitySentence(data), manual=splitReviewSentence(data);
    const fresh=currentReplyBase();
    draft.value=replaceCapacityPlaceholder(fresh,sentence,manual);
    draft.dispatchEvent(new Event('input',{bubbles:true}));
    if(status){status.className='warning';status.textContent='Kapacitás ellenőrizve; a tervezet frissítve. Emberi jóváhagyás szükséges.';}
  }catch(error){
    if(status){status.className='warning';status.textContent='A kapacitás nem volt hitelesen ellenőrizhető: '+error.message;}
  }finally{
    if(inflightKey===key)inflightKey=null;
  }
}
if(typeof document!=='undefined'){
  document.addEventListener('sarberki:analysis-ready',()=>{void enrich();});
  document.addEventListener('sarberki:gmail-normalized',()=>{setTimeout(()=>void enrich(),0);});
}
