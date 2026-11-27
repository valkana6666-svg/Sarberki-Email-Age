import {createChatInquirySession} from './chat-session.mjs';
import {renderChatbotIntent} from '../chatbot-v1.mjs';
import {REQUEST_TEXT,requestFacts} from './chat-request-client.mjs';
import {nameFromText,replyQuestions,requestFlagsFromText} from '../sarberki-core.mjs';

const ASSIST_NOTE={hu:'(Automatikus tájékoztatás – a részleteket munkatársunk szívesen megerősíti.)',de:'(Automatische Auskunft – Details bestätigt unser Team gerne.)',
 en:'(Automatic information – our team will gladly confirm the details.)',si:'(Samodejna informacija – podrobnosti vam z veseljem potrdi naša ekipa.)'};
// Owner iPhone test 2026-11-15: where the request form (which asks for phone/e-mail) is shown, the reply does not ask
// for a phone number again; an emptied "details still needed" block is dropped too.
const MISSING_TITLE={hu:'Az ajánlathoz még szükségünk van',de:'Noch benötigte Angaben',en:'Details still needed',si:'Podatki za dopolnitev'};
// The short request lists the phone as a bullet ("– egy telefonszámot, amelyen elérhetjük."); the chat form asks for it.
const PHONE_BULLET={hu:'egy telefonszámot, amelyen elérhetjük',de:'eine Telefonnummer, unter der wir Sie erreichen können',en:'a phone number where we can reach you',si:'telefonsko številko, na kateri vas lahko dosežemo'};
function withoutPhoneBullet(text,lang){
 const b=PHONE_BULLET[lang];if(!b||typeof text!=='string')return text;
 const lines=text.split('\n'),i=lines.findIndex(l=>/^\s*[–-]\s*/.test(l)&&l.replace(/^\s*[–-]\s*/,'').replace(/[.,;]\s*$/,'')===b);
 if(i<0)return text;
 const last=/\.\s*$/.test(lines[i]);lines.splice(i,1);
 if(last&&i>0&&/^\s*[–-]\s*/.test(lines[i-1]))lines[i-1]=lines[i-1].replace(/[,;]\s*$/,'.');
 return lines.join('\n');
}
export function withoutPhoneQuestion(text,lang){
 text=withoutPhoneBullet(text,lang);
 const q=replyQuestions(lang,{needPhone:true})[0];if(!q||typeof text!=='string'||!text.includes(q))return text;
 const lines=text.split('\n').filter(l=>l.trim()!==q);
 const i=lines.findIndex(l=>l.trim()===MISSING_TITLE[lang]);
 if(i>=0&&(i+1>=lines.length||!lines[i+1].trim())){lines.splice(i,1);if(i<lines.length&&!lines[i]?.trim()&&i>0&&!lines[i-1].trim())lines.splice(i,1);}
 return lines.join('\n');
}
// The audience is chosen by the host, never by a guest-controlled URL parameter.
// Guest rendering never inserts operator review text or server controls.
// A hot tub WISH (not a question about it): the engine's own request detector (negation-aware), and either not a
// question or with a wish verb ("Van dézsa? Mennyibe kerül?" is a question; "dézsát is szeretnénk" is a wish).
const WISH=/szeretn|kérn|kérünk|bérel(?:né|nénk|ünk)|foglaln[áé]|would like|we'?d like|(?<!do you )want|möchten|hätten gern|buchen\b(?!\?)|želi|radi bi/iu; // not an infinitive question ("lehet dézsát bérelni?")
const tubWish=t=>requestFlagsFromText(t).hotTubRequested&&(!/\?\s*$/.test(t.trim())||WISH.test(t));
// Tricky test 2026-11-27: the Slovene „brez kadi” (no tub) names the tub without „masažna”.
const TUB_WORD=/dézs|dezsa|hot[ -]?tub|whirlpool|badefass|badezuber|jacuzzi|masaž\p{L}*\s*kad|(?<!\p{L})kad(?:i|jo|e)?(?!\p{L})/iu;
// The guest's latest decision counts: a wish, or a refusal ("dézsát mégsem kérünk"); a mere question decides nothing.
export function hotTubWished(messages){
 const decisive=messages.filter(t=>TUB_WORD.test(t)&&(tubWish(t)||!requestFlagsFromText(t).hotTubRequested));
 return decisive.length>0&&tubWish(decisive.at(-1));
}
export function mountChatView(root,{audience='guest',language='auto',clock,capacityProvider=null,requestSender=null,assistProvider=null,offerProvider=null}={}){
 const operator=audience==='operator',session=createChatInquirySession({language,clock});
 const log=root.querySelector('[data-chat-log]'),input=root.querySelector('[data-chat-input]');
 const form=root.querySelector('[data-chat-form]'),reset=root.querySelector('[data-chat-reset]');
 const select=operator?root.querySelector('[data-chat-language]'):null;
 const status=root.querySelector('[data-chat-status]');
 let messages=0,said=[];
 // Owner 2026-11-19: as soon as dates, party and type are clear, the chat checks the free cabin and the price at once.
 let autoOffer=null; // {key, offer}
 const factsKey=f=>f?JSON.stringify(f):null;
 // The stay facts plus the hot tub wish (owner chat test 2026-11-24); one definition for the offer, the form and the send.
 const stayFacts=()=>{const f=requestFacts(session.snapshot());if(f&&hotTubWished(said))f.hotTub=true;return f;};
 // V3-3: once the stay facts are known, the guest may send them to reception (only with a requestSender).
 const box=requestSender?document.createElement('div'):null;
 function renderRequest(){
  if(!box)return;
  const facts=stayFacts(),t=REQUEST_TEXT[session.language]||REQUEST_TEXT.hu;
  box.hidden=!facts;if(!facts){box.replaceChildren();return;}
  if(box.dataset.sent==='1')return;
  // Keep what the guest already typed when the form is rebuilt after a new message (e.g. the children's ages).
  const keep=(sel,prop='value')=>box.querySelector(sel)?.[prop];
  const kept={name:keep('input[type=text]'),phone:keep('input[type=tel]'),mail:keep('input[type=email]'),consent:keep('input[type=checkbox]','checked')};
  const title=document.createElement('strong');title.textContent=t.title;
  const label=document.createElement('label');label.textContent=t.phone;const phone=document.createElement('input');phone.type='tel';phone.maxLength=24;phone.autocomplete='tel';label.append(phone);
  // Owner 2026-11-14: the guest's name (prefilled from a signature like "Üdv: Kiss Anna") and e-mail too.
  const nlabel=document.createElement('label');nlabel.textContent=t.name;const pname=document.createElement('input');pname.type='text';pname.maxLength=80;pname.autocomplete='name';
  pname.value=said.map(m=>nameFromText(m)).filter(Boolean).at(-1)||'';nlabel.append(pname);
  // Owner 2026-11-14: e-mail too, so the confirmation and the voucher can go out by e-mail.
  const elabel=document.createElement('label');elabel.textContent=t.email;const mail=document.createElement('input');mail.type='email';mail.maxLength=254;mail.autocomplete='email';elabel.append(mail);
  const consent=document.createElement('label');const check=document.createElement('input');check.type='checkbox';consent.append(check,document.createTextNode(' '+t.consent));
  const known=autoOffer&&autoOffer.key===factsKey(facts)?autoOffer.offer:null;
  const send=document.createElement('button');send.type='button';send.textContent=known?.status==='AVAILABLE'?t.confirm:known?.status==='UNAVAILABLE'?t.toTeam:t.send;
  const note=document.createElement('p');note.textContent=known?.status==='AVAILABLE'?t.confirmNote:known?.status==='UNAVAILABLE'?'':t.note;if(known?.status==='AVAILABLE')note.className='chat-hint';const result=document.createElement('p');result.setAttribute('role','status');
  const phoneOk=()=>/^\+?[0-9][0-9 ()\/-]{5,22}$/.test(phone.value.trim()),mailVal=()=>mail.value.trim().replace(/[.,;]+$/u,''),mailOk=()=>/^[^\s@<>"(),;:]{1,64}@[^\s@<>"(),;:]{1,190}\.[A-Za-z]{2,}$/.test(mailVal());
  // Owner iPhone test 2026-11-15: iOS adds a trailing "." (double space) - it is dropped; a wrong address is explained.
  const hint=document.createElement('p');hint.className='chat-hint';hint.setAttribute('role','status');
  const explain=()=>{hint.textContent=mail.value.trim()&&!mailOk()?t.emailBad:phone.value.trim()&&!phoneOk()?t.phoneBad:'';};
  const valid=()=>check.checked&&(phoneOk()||mailOk())&&(!phone.value.trim()||phoneOk())&&(!mail.value.trim()||mailOk());
  mail.addEventListener('blur',()=>{if(mailOk())mail.value=mailVal();explain();});for(const x of [phone,mail])x.addEventListener('input',explain);
  // Owner iPhone test 2026-11-15: a disabled button gave no reason (and iOS autofill fires no input event), so the
  // button stays tappable and a tap explains what is still missing.
  send.addEventListener('click',async()=>{
   if(send.dataset.busy==='1')return;
   if(mailOk())mail.value=mailVal();
   if(!valid()){explain();if(!hint.textContent)hint.textContent=!check.checked?t.needConsent:t.needContact;return;}
   hint.textContent='';send.dataset.busy='1';send.disabled=true;
   const base={facts:stayFacts(),phone:phone.value.trim(),email:mailOk()?mailVal():mail.value.trim(),name:pname.value.trim(),language:session.language,transcript:said.slice(-12)};
   const lang=session.language;
   // One final button (step 2 or the team path): sends the request; on success the box shows its thank-you text.
   const finalStep=(label,extra,doneText)=>{
    const go=document.createElement('button');go.type='button';go.textContent=label;const res=document.createElement('p');res.setAttribute('role','status');
    go.addEventListener('click',async()=>{if(go.dataset.busy==='1')return;go.dataset.busy='1';go.disabled=true;
     const ok=await requestSender({...base,...extra});
     if(ok){box.dataset.sent='1';box.replaceChildren(Object.assign(document.createElement('p'),{textContent:doneText}));append('Sárberki',doneText,lang);}
     else{res.textContent=t.fail;go.disabled=false;delete go.dataset.busy;}});
    return [go,res];
   };
   const known=autoOffer&&autoOffer.key===factsKey(base.facts)?autoOffer.offer:null;
   if(known?.status==='AVAILABLE'){ // the offer is already in the chat: this button finalises it
    const ok=await requestSender({...base,acceptedTotal:known.total});
    if(ok){box.dataset.sent='1';box.replaceChildren(Object.assign(document.createElement('p'),{textContent:t.confirmed}));append('Sárberki',t.confirmed,lang);}
    else{result.textContent=t.fail;send.disabled=false;delete send.dataset.busy;}
    return;
   }
   if(known?.status==='UNAVAILABLE'){
    const ok=await requestSender(base);
    if(ok){box.dataset.sent='1';box.replaceChildren(Object.assign(document.createElement('p'),{textContent:t.sent}));}
    else{result.textContent=t.fail;send.disabled=false;delete send.dataset.busy;}
    return;
   }
   if(!offerProvider){ // no offer service: the request goes to the team at once (as before)
    const ok=await requestSender(base);
    if(ok){box.dataset.sent='1';box.replaceChildren(Object.assign(document.createElement('p'),{textContent:t.sent}));}
    else{result.textContent=t.fail;send.disabled=false;delete send.dataset.busy;}
    return;
   }
   // Owner 2026-11-19, step 1: the chat answers with the checked free cabin and price; step 2 is a separate button.
   result.textContent=t.checking;
   const offer=await offerProvider({facts:base.facts,language:lang});
   // Owner 2026-11-19: say exactly what is missing; a fixable gap keeps the form – the guest answers, presses again.
   if(offer?.status==='MISSING'&&offer.fixable){append('Sárberki',offer.text,lang);result.textContent=offer.text;send.disabled=false;delete send.dataset.busy;return;}
   box.dataset.sent='1'; // the form is done; changing the facts later starts a new request
   if(offer?.status==='AVAILABLE'){
    append('Sárberki',offer.text,lang);
    const warn=document.createElement('p');warn.className='chat-hint';warn.textContent=t.confirmNote;
    box.replaceChildren(warn,...finalStep(t.confirm,{acceptedTotal:offer.total},t.confirmed));
   }else{
    append('Sárberki',offer&&['UNAVAILABLE','MISSING'].includes(offer.status)?offer.text:t.noOffer,lang);
    box.replaceChildren(...finalStep(t.toTeam,{},t.sent));
   }
  });
  if(kept.name)pname.value=kept.name;if(kept.phone)phone.value=kept.phone;if(kept.mail)mail.value=kept.mail;if(kept.consent)check.checked=true;
  box.replaceChildren(title,nlabel,label,elabel,hint,consent,send,note,result);
 }
 if(box){box.className='chat-request';box.hidden=true;log.after(box);}
 function append(who,text,lang,review=''){
  const item=document.createElement('div');item.className='entry';item.lang=lang==='si'?'sl':lang;
  const name=document.createElement('div');name.className='sender';name.textContent=who;
  const body=document.createElement('div');body.textContent=text;item.append(name,body);
  if(operator&&lang!=='hu'&&review){
   const box=document.createElement('div');box.className='operator-review';box.lang='hu';
   const title=document.createElement('strong');title.textContent='Magyar kezelői ellenőrző szöveg';
   const translated=document.createElement('div');translated.textContent=review;box.append(title,translated);item.append(box);
  }
  log.append(item);log.scrollTop=log.scrollHeight;
 }
 function updateStatus(){
  if(status)status.textContent=(session.languageMode==='auto'?'Automatikus nyelv':'Kézi nyelv')+': '+session.language.toUpperCase();
 }
 function greeting(){
  log.replaceChildren();append('Sárberki',renderChatbotIntent('welcome',session.language),session.language,renderChatbotIntent('welcome','hu'));updateStatus();
 }
 function submit(event){
  event.preventDefault();const question=input.value.trim();if(!question)return;
  try{
   const result=session.reply(question);
   // Replace only the untouched greeting; history is never translated or erased.
   if(messages===0)greeting();
   append('Vendég / Guest',question,session.language);
   said.push(question);
   append('Sárberki',requestSender?withoutPhoneQuestion(result.text,session.language):result.text,session.language,result.operatorReviewText);
   messages++;updateStatus();input.value='';
   renderRequest();
   const f=offerProvider&&box&&box.dataset.sent!=='1'?stayFacts():null; // hot tub wish included (owner 2026-11-24)
   const key=factsKey(f);
   // Same stay, a booking reply again ("Mennyi lesz összesen?"): show the checked offer again, not a price-less draft.
   if(f&&autoOffer&&autoOffer.key===key&&result.decision&&['AVAILABLE','UNAVAILABLE'].includes(autoOffer.offer?.status)){
    log.lastElementChild?.remove();append('Sárberki',autoOffer.offer.text,session.language);
   }
   if(f&&(!autoOffer||autoOffer.key!==key)){
    const turn=session.turn,entry=log.lastElementChild,lang=session.language;
    offerProvider({facts:f,language:lang}).then(offer=>{
     if(session.turn!==turn||!offer||offer.status==='MISSING'&&offer.fixable)return; // the engine already asks for the missing detail
     autoOffer={key,offer};
     // The checked answer replaces the generic "not yet verified" reply when nothing newer was said.
     if(['AVAILABLE','UNAVAILABLE'].includes(offer.status)){if(log.lastElementChild===entry)entry.remove();append('Sárberki',offer.text,lang);}
     renderRequest();
    }).catch(()=>{});
   }
   // V3-SMALLTALK (owner 2026-11-15): a question the rules did not understand may get a fact-bound model answer;
   // it replaces the "our team will help" line in place, only if nothing newer was said meanwhile.
   // Owner 2026-11-15 („tesztekkel bombázni”): every informational question (not only an unknown one) gets the
   // fact-bound model answer; the rule-based answer stays when the model has nothing approved to say.
   if(assistProvider&&!result.decision&&!result.noAssist){
    const turn=session.turn,entry=log.lastElementChild,lang=session.language;
    assistProvider({message:question,language:lang}).then(answer=>{
     if(!answer||session.turn!==turn||log.lastElementChild!==entry)return;
     entry.remove();append('Sárberki',answer+'\n\n'+(ASSIST_NOTE[lang]||ASSIST_NOTE.hu),lang,lang!=='hu'?'[Gépi válasz a jóváhagyott tájékoztató alapján]':'');
    }).catch(()=>{});
   }
   // Operator test only: a verified Previo TEST read replaces the last answer in place (never the guest widget).
   if(operator&&capacityProvider&&result.capacityInput){
    const turn=session.turn,entry=log.lastElementChild;
    capacityProvider(result.capacityInput).then(capacity=>{
     const updated=capacity&&session.withCapacity(capacity,{turn});
     if(!updated||session.turn!==turn||log.lastElementChild!==entry)return;
     entry.remove();append('Sárberki',updated.text+'\n\n[Previo-teszt: szabad hely ellenőrizve]',session.language,updated.operatorReviewText);
    }).catch(()=>{});
   }
  }catch{input.setCustomValidity('Új beszélgetés szükséges / Please start a new chat.');input.reportValidity();}
 }
 function newChat(){session.reset();messages=0;said=[];autoOffer=null;if(box){delete box.dataset.sent;renderRequest();}input.value='';input.setCustomValidity('');greeting();}
 function changeLanguage(){session.setLanguage(select.value);if(messages===0)greeting();else updateStatus();}
 form.addEventListener('submit',submit);reset.addEventListener('click',newChat);
 select?.addEventListener('change',changeLanguage);greeting();
 return {destroy(){box?.remove();form.removeEventListener('submit',submit);reset.removeEventListener('click',newChat);select?.removeEventListener('change',changeLanguage);session.reset();log.replaceChildren();}};
}

// Opt-in embedding preparation only. The production website does not load this.
export function mountGuestChat(container,options={}){
 const panel=document.createElement('details');panel.className='sarberki-guest-chat';
 const launcher=document.createElement('summary');
 const brandImage=document.createElement('img');brandImage.src=new URL('../sarberki-logo-orange.svg',import.meta.url).href;brandImage.alt='';brandImage.width=80;brandImage.height=56;
 launcher.append(brandImage,document.createTextNode('Sárberki chat'));panel.append(launcher);
 const log=document.createElement('div');log.dataset.chatLog='';log.setAttribute('role','log');log.setAttribute('aria-live','polite');
 const form=document.createElement('form');form.dataset.chatForm='';
 const input=document.createElement('textarea');input.dataset.chatInput='';input.maxLength=1000;input.rows=3;input.required=true;input.setAttribute('aria-label','Chat');
 const send=document.createElement('button');send.type='submit';send.textContent='➤';send.setAttribute('aria-label','Send');
 const reset=document.createElement('button');reset.type='button';reset.dataset.chatReset='';reset.textContent='↺';reset.setAttribute('aria-label','New chat');
 form.append(input,send,reset);panel.append(log,form);container.append(panel);
 const style=document.createElement('style');style.textContent='.sarberki-guest-chat{position:fixed;right:12px;bottom:12px;z-index:1000;background:#171717;color:#f5f5f5;border:1px solid #ff7a00;border-radius:12px;padding:12px;font:16px system-ui;max-width:calc(100vw - 24px);box-shadow:0 6px 24px #0008}.sarberki-guest-chat[open]{width:340px}.sarberki-guest-chat summary{cursor:pointer;min-height:44px;display:flex;align-items:center;gap:8px;color:#ff9d3d;font-weight:800}.sarberki-guest-chat summary img{display:block;width:80px;height:56px;object-fit:contain}.sarberki-guest-chat [data-chat-log]{max-height:45dvh;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;background:#101010;padding:8px;border-radius:8px}.sarberki-guest-chat textarea{width:100%;box-sizing:border-box;font:inherit;background:#0f0f0f;color:#f5f5f5;border:1px solid #555;border-radius:6px;padding:8px}.sarberki-guest-chat textarea:focus{outline:2px solid #ff7a00}.sarberki-guest-chat button{min-width:44px;min-height:44px;background:#ff7a00;color:#111;border:0;border-radius:6px;font-weight:800;cursor:pointer}.sarberki-guest-chat .entry{margin:12px 0}.sarberki-guest-chat .sender{font-weight:bold;color:#ff9d3d}';panel.append(style);
 const view=mountChatView(panel,{language:options.language||'auto',clock:options.clock,audience:'guest'});
 return {destroy(){view.destroy();panel.remove();}};
}
