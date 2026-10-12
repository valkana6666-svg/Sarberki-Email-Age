import {createChatInquirySession} from './chat-session.mjs';
import {renderChatbotIntent} from '../chatbot-v1.mjs';

// The audience is chosen by the host, never by a guest-controlled URL parameter.
// Guest rendering never inserts operator review text or server controls.
export function mountChatView(root,{audience='guest',language='auto',clock}={}){
 const operator=audience==='operator',session=createChatInquirySession({language,clock});
 const log=root.querySelector('[data-chat-log]'),input=root.querySelector('[data-chat-input]');
 const form=root.querySelector('[data-chat-form]'),reset=root.querySelector('[data-chat-reset]');
 const select=operator?root.querySelector('[data-chat-language]'):null;
 const status=root.querySelector('[data-chat-status]');
 let messages=0;
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
   append('Sárberki',result.text,session.language,result.operatorReviewText);
   messages++;updateStatus();input.value='';
  }catch{input.setCustomValidity('Új beszélgetés szükséges / Please start a new chat.');input.reportValidity();}
 }
 function newChat(){session.reset();messages=0;input.value='';input.setCustomValidity('');greeting();}
 function changeLanguage(){session.setLanguage(select.value);if(messages===0)greeting();else updateStatus();}
 form.addEventListener('submit',submit);reset.addEventListener('click',newChat);
 select?.addEventListener('change',changeLanguage);greeting();
 return {destroy(){form.removeEventListener('submit',submit);reset.removeEventListener('click',newChat);select?.removeEventListener('change',changeLanguage);session.reset();log.replaceChildren();}};
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
