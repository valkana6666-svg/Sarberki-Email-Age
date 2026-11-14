import {createChatInquirySession} from './chat-session.mjs';
import {renderChatbotIntent} from '../chatbot-v1.mjs';
import {REQUEST_TEXT,requestFacts} from './chat-request-client.mjs';

// The audience is chosen by the host, never by a guest-controlled URL parameter.
// Guest rendering never inserts operator review text or server controls.
export function mountChatView(root,{audience='guest',language='auto',clock,capacityProvider=null,requestSender=null}={}){
 const operator=audience==='operator',session=createChatInquirySession({language,clock});
 const log=root.querySelector('[data-chat-log]'),input=root.querySelector('[data-chat-input]');
 const form=root.querySelector('[data-chat-form]'),reset=root.querySelector('[data-chat-reset]');
 const select=operator?root.querySelector('[data-chat-language]'):null;
 const status=root.querySelector('[data-chat-status]');
 let messages=0,said=[];
 // V3-3: once the stay facts are known, the guest may send them to reception (only with a requestSender).
 const box=requestSender?document.createElement('div'):null;
 function renderRequest(){
  if(!box)return;
  const facts=requestFacts(session.snapshot()),t=REQUEST_TEXT[session.language]||REQUEST_TEXT.hu;
  box.hidden=!facts;if(!facts){box.replaceChildren();return;}
  if(box.dataset.sent==='1')return;
  const title=document.createElement('strong');title.textContent=t.title;
  const label=document.createElement('label');label.textContent=t.phone;const phone=document.createElement('input');phone.type='tel';phone.maxLength=24;phone.autocomplete='tel';label.append(phone);
  // Owner 2026-11-14: e-mail too, so the confirmation and the voucher can go out by e-mail.
  const elabel=document.createElement('label');elabel.textContent=t.email;const mail=document.createElement('input');mail.type='email';mail.maxLength=254;mail.autocomplete='email';elabel.append(mail);
  const consent=document.createElement('label');const check=document.createElement('input');check.type='checkbox';consent.append(check,document.createTextNode(' '+t.consent));
  const send=document.createElement('button');send.type='button';send.textContent=t.send;send.disabled=true;
  const note=document.createElement('p');note.textContent=t.note;const result=document.createElement('p');result.setAttribute('role','status');
  const phoneOk=()=>/^\+?[0-9][0-9 ()\/-]{5,22}$/.test(phone.value.trim()),mailOk=()=>/^[^\s@<>"(),;:]{1,64}@[^\s@<>"(),;:]{1,190}\.[A-Za-z]{2,}$/.test(mail.value.trim());
  const valid=()=>check.checked&&(phoneOk()||mailOk())&&(!phone.value.trim()||phoneOk())&&(!mail.value.trim()||mailOk());
  for(const x of [phone,mail,check])x.addEventListener('input',()=>{send.disabled=!valid();});check.addEventListener('change',()=>{send.disabled=!valid();});
  send.addEventListener('click',async()=>{
   if(!valid())return;send.disabled=true;
   const ok=await requestSender({facts:requestFacts(session.snapshot()),phone:phone.value.trim(),email:mail.value.trim(),language:session.language,transcript:said.slice(-12)});
   if(ok){box.dataset.sent='1';box.replaceChildren(Object.assign(document.createElement('p'),{textContent:t.sent}));}
   else{result.textContent=t.fail;send.disabled=false;}
  });
  box.replaceChildren(title,label,elabel,consent,send,note,result);
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
   append('Sárberki',result.text,session.language,result.operatorReviewText);
   messages++;updateStatus();input.value='';
   renderRequest();
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
 function newChat(){session.reset();messages=0;said=[];if(box){delete box.dataset.sent;renderRequest();}input.value='';input.setCustomValidity('');greeting();}
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
