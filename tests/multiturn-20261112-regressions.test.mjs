// Multi-turn sweep (owner/ChatGPT 2026-11-12, #9 6816734622): the same fictional conversations on both channels.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createChatInquirySession} from '../sarberki-chatbot-project/chat-session.mjs';
import {extractServerMessage} from '../shared-core/server-message-extraction.mjs';
import {serverInquiryOptions} from '../shared-core/server-inquiry-options.mjs';
import {buildEmailInquiryDraft} from '../shared-core/inquiry-channel-adapters.mjs';
const clock=()=>new Date('2026-11-12T09:00:00Z');

test('e-mail follow-up: a yearless date is the nearest future one (owner 2026-11-14)',()=>{
 const env={text:'Bocsánat, inkább június 26-tól 28-ig jönnénk. Gyerek nincs.',received_at:'2026-11-12T09:00:00Z'};
 assert.deepEqual([extractServerMessage(env,{previous:{arrival:'2027-06-24'}}).arrival,extractServerMessage(env,{previous:{arrival:'2027-06-24'}}).departure],['2027-06-26','2027-06-28']);
 assert.equal(extractServerMessage(env).arrival,'2027-06-26','first message: nearest future June');
 assert.equal(extractServerMessage(env,{previous:{arrival:'2028-06-24'}}).arrival,'2027-06-26','nobody books two years ahead');
});

test('e-mail follow-up: the questions of the newest guest message are answered (pet, parking)',()=>{
 const data={state:{original:'Jó napot! Deluxe faházat kérnénk 2027. június 24-től 26-ig, 2 felnőtt.',values:{arrival:'2027-06-26',departure:'2027-06-28',adults:'2',children:'0',guests:'2',unit:'Deluxe',language:'hu'}},
  messages:[{text:'Jó napot! Deluxe faházat kérnénk 2027. június 24-től 26-ig, 2 felnőtt.'},{text:'Telefonszámom +36 30 000 0000. Lehet kutyát hozni? Van parkoló?'}]};
 const options=serverInquiryOptions({tenantId:'sarberki',caseId:'tm-1',data},clock());
 assert.match(options.message,/kutyát/);
 const text=buildEmailInquiryDraft(options).text;
 assert.match(text,/Háziállat hozható, díja 2 000 Ft\/nap\/állat/);assert.match(text,/Parkolási lehetőség biztosított/);
 assert.match(text,/2027\.06\.26\. és 2027\.06\.28\./);
});

test('chatbot: date change without a year, cabin from an informational first turn, phone + pet question together',()=>{
 const a=createChatInquirySession({clock});
 a.reply('Jó napot! Deluxe faházat kérnénk 2027. június 24-től 26-ig, 2 felnőtt.');
 const changed=a.reply('Bocsánat, inkább június 26-tól 28-ig jönnénk. Gyerek nincs.');
 assert.match(changed.text,/2027\.06\.26\. és 2027\.06\.28\./);assert.doesNotMatch(changed.text,/erősítse meg az érkezés és távozás évét/);
 const both=a.reply('Telefonszámom +36 30 000 0000. Lehet kutyát hozni?');
 assert.match(both.text,/Háziállat hozható/);assert.doesNotMatch(both.text,/Megírna egy telefonszámot/);
 assert.equal(a.reply('Lehet kutyát hozni?').text.trim(),'Háziállat hozható, díja 2 000 Ft/nap/állat.');
 const b=createChatInquirySession({clock});
 b.reply('Pozdravljeni, zanima nas družinska hiška poleti 2027.');
 assert.deepEqual(b.snapshot(),{},'an informational turn is still not an active inquiry');
 const second=b.reply('Od 2. do 5. avgusta 2027, 2 odrasla in 2 otroka.');
 assert.match(second.text,/Želeni tip hiške: Družinska hiška/);assert.doesNotMatch(second.text,/katero vrsto hiške/);
});

test('e-mail follow-up: the stored guest name still greets when the newest reply is unsigned',()=>{
 const data={state:{original:'Jó napot! Deluxe faházat kérnénk 2027. június 24-től 26-ig, 2 felnőtt.\nÜdvözlettel:\nKovács Anna',values:{arrival:'2027-06-24',departure:'2027-06-26',adults:'2',children:'0',guests:'2',unit:'Deluxe',language:'hu',name:'Kovács Anna'}},
  messages:[{text:'Jó napot! Deluxe faházat kérnénk 2027. június 24-től 26-ig, 2 felnőtt.\nÜdvözlettel:\nKovács Anna'},{text:'Gyerek nincs. Telefonszámom +36 30 000 0000.'}]};
 const text=buildEmailInquiryDraft(serverInquiryOptions({tenantId:'sarberki',caseId:'tm-1',data},clock())).text;
 assert.match(text,/^Kedves Anna!/);
});
