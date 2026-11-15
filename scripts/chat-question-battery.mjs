// Chat "bombázás" (owner 2026-11-15): many realistic guest questions; reports which ones the rule-based chatbot answers
// and which fall back to "our team will help". `--live` also asks the TEST chat-assist endpoint (language model) for the
// unanswered ones (fictional questions only; ~1 request / 3.5 s). Output: a table per topic, no personal data.
import {createChatInquirySession} from '../sarberki-chatbot-project/chat-session.mjs';

export const QUESTIONS=[
 // topic, language, question
 ['horgászat','hu','Mik a horgászati szabályok?'],['horgászat','hu','Milyen horgot lehet használni?'],['horgászat','hu','Szakállas horog engedélyezett?'],
 ['horgászat','hu','Kell állami horgászjegy?'],['horgászat','hu','Milyen felszerelés kötelező a horgászathoz?'],['horgászat','hu','Mekkora a minimális méret a pontynál?'],
 ['horgászat','hu','Elvihetem a kifogott halat?'],['horgászat','hu','Mennyibe kerül a hal elvitele kilónként?'],['horgászat','hu','Lehet éjszaka horgászni?'],
 ['horgászat','hu','Hány bottal lehet horgászni?'],['horgászat','hu','Van ragadozó horgászat?'],['horgászat','hu','Lehet csónakból horgászni?'],
 ['jegyek','hu','Mik a napijegy árak?'],['jegyek','hu','Mennyi a hetijegy?'],['jegyek','hu','Van gyerekjegy?'],['jegyek','hu','Mennyibe kerül a jegy a rekord tóra?'],
 ['jegyek','hu','Mennyibe kerül egy horgászjegy?'],['jegyek','hu','Van 12 órás jegy?'],['jegyek','hu','Faházvendégként milyen jegyet kell venni?'],
 ['jegyek','hu','Mi a különbség a normál és a rekord tó között?'],['jegyek','hu','Hol lehet jegyet venni?'],
 ['érkezés','hu','Mikor lehet érkezni?'],['érkezés','hu','Hánykor kell elhagyni a házat?'],['érkezés','hu','Késő este is érkezhetünk?'],['érkezés','hu','Éjjel is van recepció?'],
 ['dézsa','hu','Van dézsa?'],['dézsa','hu','Mennyibe kerül a dézsa?'],['dézsa','hu','Melyik házhoz van dézsa?'],
 ['állat','hu','Hozhatunk kutyát?'],['állat','hu','Mennyibe kerül a kutya?'],['állat','hu','Macskát lehet hozni?'],
 ['házak','hu','Milyen házak vannak?'],['házak','hu','Hány faház van?'],['házak','hu','Hány fő fér el a családi házban?'],['házak','hu','Mekkora a Deluxe ház?'],
 ['házak','hu','Van saját stég a házakhoz?'],['házak','hu','Van terasz?'],['házak','hu','Van grillezési lehetőség?'],['házak','hu','Van konyha a házban?'],
 ['házak','hu','Van ágynemű és törölköző?'],['házak','hu','Van légkondi?'],['házak','hu','Van wifi?'],['házak','hu','Van TV?'],
 ['árak','hu','Mennyibe kerül egy éjszaka?'],['árak','hu','Mennyi az idegenforgalmi adó?'],['árak','hu','Van kedvezmény visszatérő vendégeknek?'],
 ['árak','hu','Mennyi az előleg?'],['árak','hu','Hogyan lehet fizetni?'],['árak','hu','Lehet kártyával fizetni?'],['árak','hu','Mennyibe kerül az áram?'],
 ['árak','hu','Szép kártyát elfogadnak?'],['árak','hu','Mennyi a pótágy?'],
 ['foglalás','hu','Hogyan tudok foglalni?'],['foglalás','hu','Le tudom mondani a foglalást?'],['foglalás','hu','Mi a lemondási feltétel?'],
 ['foglalás','hu','Mikor kell kifizetni a foglalót?'],['foglalás','hu','Kapok visszaigazolást?'],
 ['egyéb','hu','Van parkolás?'],['egyéb','hu','Van étterem?'],['egyéb','hu','Lehet főzni?'],['egyéb','hu','Van tűzifa?'],['egyéb','hu','Hol vagytok pontosan?'],
 ['egyéb','hu','Mi a címetek?'],['egyéb','hu','Mi a telefonszámotok?'],['egyéb','hu','Van bolt a közelben?'],['egyéb','hu','Van játszótér a gyerekeknek?'],
 ['egyéb','hu','Lehet fürödni a tóban?'],['egyéb','hu','Van strand a közelben?'],['egyéb','hu','Milyen programok vannak a környéken?'],
 ['köszönés','hu','Szia!'],['köszönés','hu','Köszönöm szépen!'],['köszönés','hu','Jó napot, kérdeznék valamit.'],
 // German
 ['horgászat','de','Was sind die Angelregeln?'],['jegyek','de','Was kostet die Tageskarte zum Angeln?'],['érkezés','de','Ab wann ist Check-in?'],
 ['állat','de','Dürfen wir einen Hund mitbringen?'],['dézsa','de','Gibt es einen Badezuber?'],['házak','de','Welche Häuser gibt es?'],['házak','de','Gibt es WLAN?'],
 ['árak','de','Wie hoch ist die Anzahlung?'],['egyéb','de','Wo seid ihr genau?'],['köszönés','de','Danke schön!'],
 // English
 ['horgászat','en','What are the fishing rules?'],['jegyek','en','How much is a day ticket for fishing?'],['érkezés','en','What time is check-in?'],
 ['állat','en','Can we bring a dog?'],['dézsa','en','Do you have a hot tub?'],['házak','en','What kind of cabins do you have?'],['házak','en','Is there wifi?'],
 ['árak','en','How much is the deposit?'],['egyéb','en','Is there parking?'],['köszönés','en','Thank you!'],
 // Slovenian
 ['horgászat','si','Kakšna so pravila za ribolov?'],['jegyek','si','Koliko stane dnevna ribolovna karta?'],['érkezés','si','Kdaj je prijava?'],
 ['állat','si','Ali lahko pripeljemo psa?'],['dézsa','si','Ali imate masažno kad?'],['házak','si','Kakšne hiške imate?'],['árak','si','Koliko znaša predplačilo?'],
 ['egyéb','si','Ali je parkirišče?'],['köszönés','si','Hvala!'],['egyéb','si','Kje ste?'],
];
const UNKNOWN=/nem tudom hitelesen|keine verlässlich|cannot reliably|ne morem zanesljivo/i;
export function runRules(){
 return QUESTIONS.map(([topic,lang,q])=>{const s=createChatInquirySession({language:lang,clock:()=>new Date('2026-11-15T12:00:00Z')});
  const r=s.reply(q);return {topic,lang,q,intent:r.response?.intent||'booking',info:!r.decision,answered:!UNKNOWN.test(r.text),text:r.text};});
}
if(import.meta.url===`file://${process.argv[1]}`){
 const rows=runRules(),live=process.argv.includes('--live');
 if(live){
  for(const r of rows.filter(x=>x.info)){ // the page asks the model for every informational question
   await new Promise(res=>setTimeout(res,3500));
   try{const resp=await fetch('https://leafy-chimera-2403e5.netlify.app/.netlify/functions/chat-assist',{method:'POST',
    headers:{'content-type':'application/json',origin:'https://leafy-chimera-2403e5.netlify.app','sec-fetch-site':'same-origin'},body:JSON.stringify({message:r.q,language:r.lang})});
    const b=await resp.json();r.model=b.answer||null;}catch{r.model=null;}
  }
 }
 const by={};for(const r of rows){(by[r.topic]??=[]).push(r);}
 let ok=0,mok=0;
 for(const [t,list] of Object.entries(by)){
  console.log('\n## '+t);
  for(const r of list){const m=r.model!==undefined?(r.model?' | MODELL: '+r.model.replace(/\s+/g,' ').slice(0,110):' | MODELL: –'):'';
   const good=live?(r.model||r.answered):r.answered;if(r.model)mok++;else if(r.answered)ok++;
   console.log((r.model?'🤖':r.answered?'✅':'❌')+' ['+r.lang+'] '+r.q+(r.model?'':r.answered?' → '+r.text.replace(/\s+/g,' ').slice(0,90):'')+m);}
 }
 console.log('\nÖSSZESEN:',rows.length,'| modell válaszolt:',mok,'| szabályalapú válasz maradt:',ok,'| megválaszolatlan:',rows.length-ok-mok);
}
