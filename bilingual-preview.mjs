// Safe, local bilingual display. Translation requires an explicitly configured trusted service.
// Never sends customer text to an unapproved third party.
export function detectForeignLanguage(text=''){
 const s=String(text).trim();
 if(!s)return 'unknown';
 if(/[čšžđć]/iu.test(s))return 'sl';
 if(/\b(guten tag|sehr geehrte|wir möchten|mit freundlichen grüßen|buchung|ferienhaus)\b/iu.test(s))return 'de';
 if(/\b(hello|dear|we would like|booking|kind regards|availability)\b/iu.test(s))return 'en';
 if(/[őű]/iu.test(s)||/\b(jó napot|szeretnénk|foglalás|üdvözlettel|érdeklődöm)\b/iu.test(s))return 'hu';
 return 'unknown'; // Heuristics must never be treated as authoritative translation.
}
export function protectedTokens(text=''){
 return [...String(text).matchAll(/\b\d{1,4}(?:[.,\s]\d{3})*(?:[.,]\d+)?(?:\s*(?:Ft|EUR|fő|éj|%|€))?(?![\p{L}\d])/giu)].map(x=>x[0].replace(/\s+/g,' ').trim());
}
export function sameProtectedTokens(a,b){
 const x=protectedTokens(a),y=protectedTokens(b);
 return x.length===y.length && x.every(v=>y.includes(v));
}
export function mountBilingualPanels(doc=document){
 const insertAfter=(anchor,id,label,editable=false)=>{
  if(!anchor || doc.getElementById(id))return;
  const wrap=doc.createElement('div');wrap.className='bilingual-panel';
  const title=doc.createElement('label');title.htmlFor=id;title.textContent=label;
  const area=doc.createElement('textarea');area.id=id;area.readOnly=!editable;area.placeholder='A megbízható fordítókapcsolat még nincs beállítva.';area.style.minHeight='150px';
  const state=doc.createElement('small');state.id=id+'_status';state.textContent='Fordítás nincs ellenőrizve; az eredeti üzenet változatlan.';
  wrap.append(title,area,state);anchor.insertAdjacentElement('afterend',wrap);
  return area;
 };
 const original=doc.getElementById('gmail_original');
 const guest=doc.getElementById('gmail_draft');
 const manual=doc.getElementById('message');
 const draft=doc.getElementById('draft');
 const server=doc.getElementById('server_preview_text');
 const inGmail=insertAfter(original,'gmail_original_hu','Magyar fordítás – beérkező üzenet');
 const inManual=insertAfter(manual,'message_hu','Magyar fordítás – vendégüzenet');
 const outGmail=insertAfter(guest,'gmail_draft_hu','Magyar munkaváltozat – választervezet',true);
 const outDraft=insertAfter(draft,'draft_hu','Magyar munkaváltozat – választervezet',true);
 const outServer=insertAfter(server,'server_preview_hu','Magyar fordítás – szerveres előnézet');
 const pairs=[[original,inGmail,false],[manual,inManual,false],[guest,outGmail,true],[draft,outDraft,true],[server,outServer,false]];
 for(const [source,target,editable] of pairs){
  if(!source||!target)continue;
  const update=()=>{
   const lang=detectForeignLanguage(source.value??source.textContent??'');
   target.closest('.bilingual-panel').hidden=lang==='hu'||!(source.value??source.textContent??'').trim();
   const status=doc.getElementById(target.id+'_status');
   if(lang==='unknown')status.textContent='A nyelv nem azonosítható biztosan. Fordítás szükséges.';
   else status.textContent='Felismert nyelv (előzetes): '+lang.toUpperCase()+'. Fordítószolgáltatás hiányában nincs automatikus fordítás.';
   if(!editable)target.value='';
  };
  source.addEventListener('input',update);
  if(typeof MutationObserver!=='undefined')new MutationObserver(update).observe(source,{childList:true,characterData:true,subtree:true,attributes:false});
  if(editable)target.addEventListener('input',()=>{
   doc.getElementById(target.id+'_status').textContent='Magyar szerkesztés folyamatban. Az idegen nyelvű változat NEM frissült; küldéshez külön fordítás és ellenőrzés szükséges.';
  });
  update();
 }
 return pairs.length;
}
if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>mountBilingualPanels());
 else mountBilingualPanels();
}
