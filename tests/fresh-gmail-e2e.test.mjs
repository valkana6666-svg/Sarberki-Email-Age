import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as core from '../sarberki-core.mjs';
import {BUSINESS} from '../business-config.mjs';
import * as fishing from '../fishing-rules.mjs';
import * as policy from '../gmail-policy.mjs';

const source=fs.readFileSync(new URL('../gmail-readonly.js',import.meta.url),'utf8')
  .replace(/await import\('\.\/([^']+)'\)/gu,(_,name)=>`modules[${JSON.stringify(name.split('?')[0])}]`);

async function createTransform(){
  const button={disabled:false,addEventListener(){}};
  const status={textContent:'',insertAdjacentElement(){}};
  const window={};
  const document={
    getElementById:id=>id==='read_gmail'?button:status,
    querySelector:()=>({content:'test-client'})
  };
  const context=vm.createContext({
    modules:{
      'sarberki-core.mjs':core,
      'business-config.mjs':{BUSINESS},
      'fishing-rules.mjs':fishing,
      'gmail-policy.mjs':policy
    },
    document,window,console,URL,Date,Number,Intl,TextDecoder,Uint8Array,atob
  });
  await vm.runInContext(source,context);
  assert.equal(typeof window.sarberkiGmailTransform,'function');
  return window.sarberkiGmailTransform;
}

function message(body,subject,id){
  const data=Buffer.from(body,'utf8').toString('base64url');
  return {
    id,threadId:id+'-thread',internalDate:String(Date.parse('2026-10-05T15:44:00Z')),
    labelIds:['INBOX'],
    payload:{
      mimeType:'text/plain',
      body:{data},
      headers:[
        {name:'From',value:'"László Kovács" <valkana6666@gmail.com>'},
        {name:'To',value:'sarberkiprojecttest@gmail.com'},
        {name:'Subject',value:subject}
      ]
    }
  };
}

const cases=[
  {
    subject:'Teszt – 6 fő, horgászat, parkolás',
    body:`Jó napot!

2026. október 9–13. között 6 felnőtt mennénk, gyermek nélkül.
Van szabad hely? Horgászni szeretnénk, és parkolás is érdekel.
Milyen lehetőségek vannak erre az időpontra, és mik a horgászat feltételei?

Üdvözlettel,
Teszt Vendég`,
    language:'hu',arrival:'2026-10-09',departure:'2026-10-13',
    parking:/Parkolási lehetőség biztosított/u,
    fishing:/állami horgászjegy/u,
    childQuestion:/érkezik-e gyermek/u
  },
  {
    subject:'Random subject 8472',
    body:`Hello!

We would like to stay from 30 October to 1 November 2026.
We are 6 adults, no children. We have not chosen a cabin type yet.
Please tell us what accommodation options are available.
We would also like to fish and need parking for two cars.

Best regards,
Test Guest`,
    language:'en',arrival:'2026-10-30',departure:'2026-11-01',
    parking:/Parking is available/u,
    fishing:/state fishing licence valid in Hungary/u,
    childQuestion:/whether any children will be staying/u
  },
  {
    subject:'Anfrage ohne Haustyp',
    body:`Guten Tag!

Wir möchten vom 6. bis 8. November 2026 mit 6 Erwachsenen und ohne Kinder kommen.
Einen Haustyp haben wir noch nicht ausgewählt.
Welche Unterkünfte sind verfügbar?
Wir möchten auch angeln und benötigen Parkplätze für zwei Autos.

Mit freundlichen Grüßen
Test Gast`,
    language:'de',arrival:'2026-11-06',departure:'2026-11-08',
    parking:/Parkmöglichkeiten sind vorhanden/u,
    fishing:/staatlicher Angelschein/u,
    childQuestion:/ob auch Kinder mitreisen/u
  },
  {
    subject:'Preizkus 2026-10-05',
    body:`Pozdravljeni!

Od 13. do 15. novembra 2026 bi prišlo 6 odraslih, brez otrok.
Tipa hiške še nismo izbrali.
Katere nastanitve so proste?
Radi bi tudi lovili ribe in potrebujemo parkirišče za dva avtomobila.

Lep pozdrav,
Test Gost`,
    language:'si',arrival:'2026-11-13',departure:'2026-11-15',
    parking:/Parkiranje je na voljo/u,
    fishing:/državna ribolovna dovolilnica/u,
    childQuestion:/ali tudi otroci/u
  }
];

test('fresh Gmail inbox fixtures survive Gmail transform and reply drafting',async()=>{
  const transform=await createTransform();
  let i=0;
  for(const item of cases){
    const record=transform(message(item.body,item.subject,'fresh-'+(++i)));
    assert.equal(record.source.from_email,'valkana6666@gmail.com',item.subject);
    assert.equal(record.source.subject,item.subject);
    assert.equal(record.normalized.language,item.language,item.subject);
    assert.equal(record.normalized.dates?.arrival,item.arrival,item.subject);
    assert.equal(record.normalized.dates?.departure,item.departure,item.subject);
    assert.equal(record.normalized.guests,6,item.subject);
    assert.equal(record.normalized.adults,6,item.subject);
    assert.equal(record.normalized.children,0,item.subject);
    assert.match(record.normalized.cabin,/emberi döntésre vár/u,item.subject);
    assert.match(record.reply_draft,item.parking,item.subject);
    assert.match(record.reply_draft,item.fishing,item.subject);
    assert.doesNotMatch(record.reply_draft,item.childQuestion,item.subject);
    assert.doesNotMatch(record.reply_draft,/Melyik háztípust|requested cabin type|gewünschter Haustyp|želeni tip hiške/u,item.subject);
    assert.doesNotMatch(record.reply_draft,/\b\d{2,3}[ .]?\d{3}\s*Ft\b/u,item.subject);
  }
});
