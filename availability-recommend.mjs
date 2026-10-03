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
  return draft+'\n\n'+combined;
}
async function enrich(){
  const arrival=$('f_arrival')?.value||'', departure=$('f_departure')?.value||'', guests=Number($('f_guests')?.value||0), cabin=$('f_unit')?.value||'';
  if(!arrival||!departure||!Number.isInteger(guests)||guests<1||hasSpecificCabin(cabin))return;
  const status=$('status'), draft=$('draft');
  if(!draft)return;
  if(status){status.className='warning';status.textContent='Kapacitás-ellenőrzés folyamatban a teszt Previo-forrásból…';}
  try{
    const response=await fetch('/api/availability-options',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({arrival,departure,guests})});
    const data=await response.json();
    if(!response.ok)throw Error(data.error||'Nem sikerült a kapacitás-ellenőrzés.');
    const sentence=availabilitySentence(data), manual=splitReviewSentence(data);
    draft.value=replaceCapacityPlaceholder(draft.value,sentence,manual);
    draft.dispatchEvent(new Event('input',{bubbles:true}));
    if(status){status.className='warning';status.textContent='Kapacitás ellenőrizve; a tervezet frissítve. Emberi jóváhagyás szükséges.';}
  }catch(error){
    if(status){status.className='warning';status.textContent='A kapacitás nem volt hitelesen ellenőrizhető: '+error.message;}
  }
}
document.addEventListener('sarberki:analysis-ready',()=>{void enrich();});
document.addEventListener('sarberki:gmail-normalized',()=>{setTimeout(()=>void enrich(),0);});
