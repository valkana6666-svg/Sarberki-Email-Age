// Shared reply letters: nothing after the signature, questions inside the "still needed" section,
// and no generic all-types cabin question once capacity-suitable types were offered.
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEmailInquiryDraft,buildChatInquiryReply} from '../shared-core/inquiry-channel-adapters.mjs';
const now=new Date('2026-11-02T12:00:00Z');
const missing={hu:'Az ajánlathoz még szükségünk van',de:'Noch benötigte Angaben',en:'Details still needed',si:'Podatki za dopolnitev'};
const closing={hu:'Üdvözlettel:',de:'Mit freundlichen Grüßen',en:'Kind regards,',si:'Lep pozdrav'};
const generic=/VIP, Családi, Deluxe vagy Osztott|VIP, Family cabin, Deluxe or Split|Familienhaus, Deluxe oder|VIP, družinska/u;
const messages={
 hu:['Jó napot! Július 10-től 14-ig szeretnénk egy faházat 2 felnőtt és 1 gyerek (5 éves) részére. Mennyibe kerül?','Van szabad Deluxe faház 2027.11.13-15 között 2 felnőtt részére, gyermek nélkül? Telefon: +36 30 555 1234'],
 de:['Guten Tag, vom 3. bis 7. Juni 2027, 2 Erwachsene und 1 Kind (5 Jahre). Was kostet das?','Ist ein Deluxe Haus vom 2027-11-13 bis 2027-11-15 für 2 Erwachsene ohne Kinder frei?'],
 en:['We would like a cabin from 10 to 14 July 2027 for 2 adults and 1 child aged 5. What is the price?','Is a Deluxe cabin available from 2027-11-13 to 2027-11-15 for 2 adults and no children?'],
 si:['Od 10. do 14. julija 2027, 2 odrasla in 1 otrok (5 let). Koliko stane?','Ali je Deluxe hiška prosta od 2027-11-13 do 2027-11-15 za 2 odrasli osebi brez otrok?']
};
for(const [language,list] of Object.entries(messages))for(const message of list)for(const build of [buildEmailInquiryDraft,buildChatInquiryReply])
 test(`${language} ${build.name}: letter ends with the signature – ${message.slice(0,40)}`,()=>{
  const r=build({message,language,now});
  for(const [text,lang] of [[r.text,language],[r.operatorReviewText,'hu']]){
   const lines=text.trimEnd().split('\n');
   assert.equal(lines.at(-1),'Sárberki Horgásztó');assert.equal(lines.at(-2),closing[lang]);
   const at=lines.indexOf(missing[lang]);
   if(at>=0)assert.ok(at<lines.indexOf(closing[lang]));
   if(/felajánlott faháztípust|angebotenen Haustypen|offered cabin types|ponujenih vrst hišk/u.test(text))assert.doesNotMatch(text,generic);
  }
 });
