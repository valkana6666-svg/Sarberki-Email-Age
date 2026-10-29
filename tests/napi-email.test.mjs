import test from 'node:test';
import assert from 'node:assert/strict';
import {createDailyEmailReader} from '../napi-kezelo/napi-email.mjs';
class Element{
 constructor(){this.children=[];this.listeners={};this.textContent='';this.disabled=false;this.value='';this.attributes={};}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=children.flatMap(child=>child.fragment?child.children:[child]);}
 addEventListener(type,fn){this.listeners[type]=fn;}
 setAttribute(key,value){this.attributes[key]=value;}
 async click(){await this.listeners.click?.();}
}
function setup(){
 const elements=Object.fromEntries(['read-email','email-list','email-status','email-detail','email-picker','email-picker-wrap','email-previous','email-next'].map(id=>[id,new Element()]));
 const doc={getElementById:id=>elements[id],visibilityState:'visible',createElement:()=>new Element(),createDocumentFragment:()=>Object.assign(new Element(),{fragment:true})};
 let authenticated=true,callback,reads=0,restores=0,release;
 const google={accounts:{oauth2:{initTokenClient(options){assert.equal(options.scope,'https://www.googleapis.com/auth/gmail.readonly');assert.equal(options.include_granted_scopes,false);callback=options.callback;return {requestAccessToken(){}};}}}};
 const reader=createDailyEmailReader({documentImpl:doc,canRead:()=>authenticated,restoreSession:async()=>{restores++;if(!authenticated)throw Error('AUTH_REQUIRED');},loadGoogleImpl:async()=>google,clientId:'synthetic',readInbox:async token=>{assert.equal(token,'SYNTHETIC_TOKEN');reads++;if(release)await release;return [0,1,2].map(index=>({payload:{mimeType:'text/plain',headers:[{name:'Subject',value:'Kitalált levél '+(index+1)},{name:'From',value:'guest@synthetic.invalid'}],body:{data:Buffer.from('Kitalált érdeklődés. Levél '+(index+1)).toString('base64url')}}}));}});
 return {reader,e:elements,doc,get callback(){return callback;},get reads(){return reads;},get restores(){return restores;},logout(){authenticated=false;reader.clear();},delay(p){release=p;}};
}
test('daily Gmail uses readonly consent and shared reader, opens original without persisting or submitting a case',async()=>{
 const h=setup();h.reader.setEnabled(true);await Promise.resolve();await h.e['read-email'].click();
 await h.callback({access_token:'SYNTHETIC_TOKEN'});assert.equal(h.reads,1);assert.equal(h.restores,1);
 assert.equal(h.e['email-list'].children.length,3);await h.e['email-list'].children[0].children[0].click();
 assert.match(h.e['email-detail'].textContent,/Kitalált érdeklődés/);
 assert.equal(h.e['email-picker'].value,'0');assert.equal(h.e['email-previous'].disabled,true);
 await h.e['email-next'].click();assert.match(h.e['email-detail'].textContent,/Levél 2/);assert.equal(h.e['email-picker'].value,'1');
 h.e['email-picker'].value='2';await h.e['email-picker'].listeners.change();
 assert.match(h.e['email-detail'].textContent,/Levél 3/);assert.equal(h.e['email-next'].disabled,true);
 assert.equal(h.e['email-list'].children.length,3);
 await h.e['email-list'].children[0].children[0].click();assert.equal(h.e['email-picker'].value,'0');
 assert.equal(h.e['email-list'].children[0].children[0].attributes['aria-pressed'],'true');
 assert.match(h.e['email-detail'].textContent,/Levél 1/);assert.match(h.e['email-status'].textContent,/átadás még nem/);
 h.logout();assert.equal(h.e['email-picker'].children.length,0);assert.equal(h.e['email-picker-wrap'].hidden,true);assert.equal(h.e['email-list'].children.length,0);assert.equal(h.e['email-detail'].textContent,'');assert.equal(h.e['read-email'].disabled,true);
});
test('late OAuth and mailbox responses cannot reopen messages after logout',async()=>{
 for(const stage of ['consent','reading']){
  const h=setup();h.reader.setEnabled(true);await Promise.resolve();await h.e['read-email'].click();
  let release;h.delay(new Promise(resolve=>{release=resolve;}));
  if(stage==='consent'){h.logout();await h.callback({access_token:'SYNTHETIC_TOKEN'});assert.equal(h.reads,0);}
  else{const pending=h.callback({access_token:'SYNTHETIC_TOKEN'});await Promise.resolve();h.logout();release();await pending;}
  assert.equal(h.e['email-list'].children.length,0);assert.equal(h.e['email-detail'].textContent,'');
 }
});
test('failed consent allows manual retry without claiming successful reading',async()=>{
 const h=setup();h.reader.setEnabled(true);await Promise.resolve();await h.e['read-email'].click();await h.callback({error:'access_denied'});
 assert.equal(h.reads,0);assert.equal(h.e['read-email'].disabled,false);assert.match(h.e['email-status'].textContent,/nem sikerült/);
});
