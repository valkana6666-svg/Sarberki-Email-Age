// Owner 2026-11-23: the guest letter also goes out as simple HTML (same text, phone-friendly). Synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {letterHtml,htmlVisibleText} from '../shared-core/letter-html.mjs';
import {newMessageMime,replyMime} from '../shared-core/server-test-mailbox-send.mjs';

const RULE='━'.repeat(28);
const LETTER=['Kedves Teszt Elek!','','Köszönjük foglalását!','','Ár','Szállásdíj: 181 500 Ft, összesen: 184 800 Ft.','',
 'Üdvözlettel:','Sárberki Horgásztó','',RULE,'VOUCHER',RULE,'Voucherszám: SC-0123456789ABCDEF','Összesen: 184 800 Ft (szállásdíj 181 500 Ft + idegenforgalmi adó 3 300 Ft)',
 RULE,'Kérjük, érkezéskor mutassa be ezt a vouchert.'].join('\n');
const words=t=>t.split(/\s+/).filter(w=>w&&!/^[━]+$/.test(w)).map(w=>w.replace(/:$/,'')); // voucher labels drop their colon in the table

test('every word of the plain text is kept, in order; the ━ rules become a framed voucher table',()=>{
 const html=letterHtml(LETTER);
 assert.deepEqual(words(htmlVisibleText(html)),words(LETTER));
 assert.doesNotMatch(html,/━/);
 assert.match(html,/<strong>Ár<\/strong>/,'short section title in bold');
 assert.doesNotMatch(html,/<strong>Üdvözlettel/,'a line ending with ":" is not a title');
 assert.match(html,/<td[^>]*>Voucherszám<\/td><td[^>]*>SC-0123456789ABCDEF<\/td>/);
 assert.match(html,/184&nbsp;800&nbsp;Ft/,'an amount never breaks across lines');
 assert.match(html,/max-width:560px/);
});

test('guest/operator text is escaped (no markup injection) and an empty or plain text still renders',()=>{
 const html=letterHtml('Kedves <script>alert(1)</script> "x" & y\n\nVége.');
 assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt; &quot;x&quot; &amp; y/);
 assert.match(letterHtml(''),/<body/);
 assert.deepEqual(words(htmlVisibleText(letterHtml('Egy sor.\nMásik sor.'))),['Egy','sor.','Másik','sor.']);
});

const decodeParts=mime=>{
 const boundary=mime.match(/boundary="([^"]+)"/)[1];
 return mime.split('--'+boundary).slice(1,-1).map(p=>{const [head,body]=p.split('\r\n\r\n');return {type:head.match(/Content-Type: ([^;]+)/)[1],text:Buffer.from(body.replace(/\r\n/g,''),'base64').toString('utf8')};});
};
test('the sent mail is multipart/alternative: the unchanged plain text first, then the HTML version',()=>{
 for(const mime of [newMessageMime({recipient:'valkana6666@gmail.com',text:LETTER,subject:'Teszt',marker:'tm-x:1'}),
  replyMime({recipient:'valkana6666@gmail.com',text:LETTER,subject:'Kérdés',inReplyTo:'<a@b>',marker:'tm-x:1'})]){
  assert.match(mime,/MIME-Version: 1\.0\r\nContent-Type: multipart\/alternative; boundary="sarberki-[0-9a-f]{24}"/);
  const parts=decodeParts(mime);
  assert.deepEqual(parts.map(p=>p.type),['text/plain','text/html']);
  assert.equal(parts[0].text,LETTER.replace(/\n/g,'\r\n'),'plain text byte-for-byte as before');
  assert.equal(parts[1].text,letterHtml(LETTER));
  assert.ok(mime.split('\r\n').every(l=>l.length<=998),'RFC 5322 line limit');
 }
});
