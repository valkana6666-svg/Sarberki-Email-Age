// Read-only bilingual preview for the isolated TEST interface.
// Translation never changes the source, approved reply, or Gmail state.
import {sameProtectedTokens} from './bilingual-preview.mjs';
export const LANGS={de:'Német',en:'Angol',si:'Szlovén',sl:'Szlovén'};
const TEST_FIXTURES={
 de:{incoming:'Guten Tag! Wir möchten vom 16. bis 18. Oktober 2026 für zwei Erwachsene ein Deluxe-Ferienhaus buchen. Ist es verfügbar?',huIncoming:'Jó napot! 2026. október 16–18. között két felnőtt részére szeretnénk egy Deluxe faházat foglalni. Szabad a szállás?',
 reply:'Guten Tag! Vielen Dank für Ihre Anfrage. Wir prüfen die Verfügbarkeit. Mit freundlichen Grüßen, Sárberki Horgásztó',huReply:'Jó napot! Köszönjük érdeklődését. Ellenőrizzük a szabad kapacitást. Üdvözlettel: Sárberki Horgásztó'},
 en:{incoming:'Hello! We would like to book a Deluxe cabin for two adults from 16 to 18 October 2026. Is it available?',huIncoming:'Üdvözlöm! 2026. október 16–18. között két felnőtt részére szeretnénk Deluxe faházat foglalni. Szabad a szállás?',
 reply:'Hello! Thank you for your enquiry. We will check availability. Kind regards, Sárberki Horgásztó',huReply:'Üdvözlöm! Köszönjük érdeklődését. Ellenőrizzük a szabad kapacitást. Üdvözlettel: Sárberki Horgásztó'},
 si:{incoming:'Pozdravljeni! Od 16. do 18. oktobra 2026 bi radi rezervirali hiško Deluxe za dve odrasli osebi. Je prosta?',huIncoming:'Üdvözlöm! 2026. október 16–18. között két felnőtt részére szeretnénk Deluxe faházat foglalni. Szabad a szállás?',
 reply:'Pozdravljeni! Hvala za vaše povpraševanje. Preverili bomo razpoložljivost. Lep pozdrav, Sárberki Horgásztó',huReply:'Üdvözlöm! Köszönjük érdeklődését. Ellenőrizzük a szabad kapacitást. Üdvözlettel: Sárberki Horgásztó'}
};
export function fixtureTranslation(text,lang,kind){
 const f=TEST_FIXTURES[lang==='sl'?'si':lang];
 if(!f)return null;
 const source=kind==='incoming'?f.incoming:f.reply;
 return text.trim()===source?f[kind==='incoming'?'huIncoming':'huReply']:null;
}
export function detectForeign(text,normalize){
 const language=normalize?.languageFromText?.(text)||'hu';
 return LANGS[language]?language:null;
}
export function initBilingualClone({doc=document,translate=null}={}){
 const get=id=>doc.getElementById(id);
 const incoming=get('message'),draft=get('draft');
 if(!incoming||!draft)return false;
 const insert=(source,id,title,readOnly=true)=>{
  const wrap=doc.createElement('div');wrap.id=id+'_wrapper';wrap.hidden=true;
  const label=doc.createElement('label');label.htmlFor=id;label.textContent=title;
  const area=doc.createElement('textarea');area.id=id;area.readOnly=readOnly;area.style.minHeight='150px';
  const status=doc.createElement('small');status.id=id+'_status';status.setAttribute('role','status');
  wrap.append(label,area,status);source.insertAdjacentElement('afterend',wrap);
  return {wrap,area,status};
 };
 const first=insert(incoming,'foreign_incoming_hu','Magyar fordítás – beérkező üzenet');
 const second=insert(draft,'foreign_reply_hu','Magyar munkaváltozat – választervezet (szerkeszthető)',false);
 const gmailIncoming=get('gmail_original'),gmailDraft=get('gmail_draft');
 const gmailFirst=gmailIncoming?insert(gmailIncoming,'gmail_foreign_incoming_hu','Magyar fordítás – beérkezett Gmail-levél'):null;
 const gmailSecond=gmailDraft?insert(gmailDraft,'gmail_foreign_reply_hu','Magyar munkaváltozat – Gmail-választervezet',false):null;
 const all=[first,second,gmailFirst,gmailSecond].filter(Boolean);
 let generation=0,activeLanguage=null,lastDraft='',manualRevision=0,locked=false;
 const approval=get('approve');
 approval?.addEventListener('click',event=>{if(locked){event.stopImmediatePropagation();event.preventDefault();second.status.textContent='A magyar módosítás visszafordítása nincs jóváhagyva, ezért a belső jóváhagyás tiltott.';}},true);
 function invalidate(message){manualRevision++;locked=true;if(approval)approval.disabled=true;second.status.textContent=message;}
 function unlock(){locked=false;/* Never force-enable approval: original case safety rules decide. */}
 async function applyHungarianEdit(sourceView){
  if(!activeLanguage)return;
  pendingForeign=null;
  invalidate('Magyar módosítás: az idegen nyelvű válasz még NEM frissült. Jóváhagyás tiltva.');
  if(sourceView===gmailSecond)second.area.value=gmailSecond.area.value;
  else if(gmailSecond)gmailSecond.area.value=second.area.value;
  const version=manualRevision,hu=second.area.value;
  if(!hu.trim()||typeof translate!=='function'){
   second.status.textContent='Biztonságos visszafordító nincs bekötve. Az eredeti idegen nyelvű tervezet változatlan; jóváhagyás tiltva.';return;
  }
  const original=draft.value;
  try{
   const foreign=await translate({text:hu,sourceLanguage:'hu',targetLanguage:activeLanguage,purpose:'edited_reply'});
   if(version!==manualRevision||!activeLanguage)return;
   if(typeof foreign!=='string'||!foreign.trim()||!sameProtectedTokens(original,foreign))throw Error('MISMATCH');
   // Allow a human to inspect first. Never overwrite the guest-language reply automatically.
   second.status.textContent='Visszafordítás előkészítve. Kézi ellenőrzés és külön jóváhagyás szükséges; az eredeti tervezet nem módosult.';
   pendingForeign=foreign;
  }catch{if(version===manualRevision)second.status.textContent='Visszafordítás vagy számellenőrzés sikertelen. Jóváhagyás tiltva.';}
 }
 let pendingForeign=null;
 const clear=()=>{generation++;manualRevision++;pendingForeign=null;activeLanguage=null;lastDraft='';unlock();for(const x of all){x.wrap.hidden=true;x.area.value='';x.status.textContent='';}};
 async function translateOne(view,text,lang,kind,version){
  view.area.value='';view.status.textContent='Fordítás ellenőrzése…';
  const demo=fixtureTranslation(text,lang,kind);
  if(demo){view.area.value=demo;view.status.textContent='Mesterséges tesztmondat ellenőrzött mintafordítása – nem általános fordítómotor.';return;}
  if(typeof translate!=='function'){
   view.status.textContent='A magyar fordítás még nem érhető el: biztonságos fordítómotor nincs bekötve. Az eredeti szöveg változatlan.';
   return;
  }
  try{
   const result=await translate({text,sourceLanguage:lang,targetLanguage:'hu',purpose:kind});
   if(version!==generation)return;
   if(typeof result!=='string'||!result.trim())throw Error('NO_VERIFIED_TRANSLATION');
   view.area.value=result;view.status.textContent='Gépi magyar fordítás – kezelői ellenőrzés szükséges.';
  }catch{if(version===generation)view.status.textContent='A fordítás sikertelen. Az eredeti szöveg változatlan, küldés nem történt.';}
 }
 async function sync({force=false}={}){
  const lang=detectForeign(incoming.value,globalThis.window?.SarberkiNormalize);
  if(!lang){clear();return;}
  const version=++generation;activeLanguage=lang;
  if(force){manualRevision++;pendingForeign=null;unlock();}
  first.wrap.hidden=false;second.wrap.hidden=false;
  if(force||first.area.dataset.original!==incoming.value){
   first.area.dataset.original=incoming.value;await translateOne(first,incoming.value,lang,'incoming',version);
  }
  if(version!==generation)return;
  const current=draft.value;
  if(force||lastDraft!==current){
   lastDraft=current;await translateOne(second,current,lang,'reply',version);
  }
  if(version!==generation)return;
  if(gmailFirst&&gmailSecond){
   const visible=!!gmailIncoming?.closest('#gmail_record')&&!gmailIncoming.closest('#gmail_record').classList.contains('hidden');
   gmailFirst.wrap.hidden=!visible;gmailSecond.wrap.hidden=!visible;
   if(visible){gmailFirst.area.value=first.area.value;gmailFirst.status.textContent=first.status.textContent;gmailSecond.area.value=second.area.value;gmailSecond.status.textContent=second.status.textContent;}
  }
 }
 // Only update on explicit processing or text revisions; never transmit the text to a third-party service by default.
 second.area.addEventListener('input',()=>{void edit(second);});
 gmailSecond?.area.addEventListener('input',()=>{void edit(gmailSecond);});
 // Explicit human action to copy a checked back-translation; never automatic guest communication.
 const accept=doc.createElement('button');accept.type='button';accept.textContent='Ellenőrzött idegen nyelvű változat átvétele';accept.disabled=true;
 second.wrap.append(accept);
 // The asynchronous result may only enable review after an unchanged edit revision.
 const doEdit=applyHungarianEdit;
 const edit=async view=>{accept.disabled=true;await doEdit(view);if(pendingForeign&&locked)accept.disabled=false;};
 accept.addEventListener('click',()=>{if(!pendingForeign||!locked)return;draft.value=pendingForeign;if(gmailDraft)gmailDraft.value=pendingForeign;pendingForeign=null;accept.disabled=true;second.status.textContent='Az idegen nyelvű tervezet frissült, de külön ellenőrzés és új jóváhagyás szükséges.';locked=false;draft.dispatchEvent(new Event('input',{bubbles:true}));});
 doc.addEventListener('sarberki:analysis-ready',()=>{void sync({force:true});});
 doc.addEventListener('sarberki:gmail-normalized',()=>{void sync({force:true});});
 draft.addEventListener('input',()=>{if(activeLanguage)void sync();});
 get('refresh')?.addEventListener('click',()=>{if(activeLanguage)void sync({force:true});});
 incoming.addEventListener('input',()=>{if(activeLanguage&&detectForeign(incoming.value,globalThis.window?.SarberkiNormalize)!==activeLanguage)clear();});
 return {sync,clear};
}
if(typeof document!=='undefined')initBilingualClone();
