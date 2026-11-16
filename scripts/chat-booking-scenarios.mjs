// Targeted multi-turn booking conversations (owner 2026-11-16: „célzottan teszteket a chatbottal”). Each scenario is a
// list of guest messages and the facts the chatbot must have understood at the end. Rules only (no network).
import {createChatInquirySession} from '../sarberki-chatbot-project/chat-session.mjs';

const NOW=new Date('2026-11-16T09:00:00Z');
export const SCENARIOS=[
 {name:'egyszerű HU',msgs:['Deluxe faházat szeretnénk 2027. június 10-től 13-ig, 2 felnőtt.'],want:{arrival:'2027-06-10',departure:'2027-06-13',adults:2,cabin:'Deluxe'}},
 {name:'évszám nélkül',msgs:['Július 5-8 között jönnénk ketten egy családi házba'],want:{arrival:'2027-07-05',departure:'2027-07-08',cabin:'Családi'}},
 {name:'pontos dátumforma',msgs:['2027.08.01-2027.08.04 VIP 4 fő'],want:{arrival:'2027-08-01',departure:'2027-08-04',cabin:'VIP'}},
 {name:'perjeles dátum',msgs:['Szeretnénk foglalni 08/14-08/17 Deluxe házat, 3 felnőtt'],want:{arrival:'2027-08-14',departure:'2027-08-17',adults:3,cabin:'Deluxe'}},
 {name:'éjszakák száma',msgs:['Augusztus 10-től 3 éjszakára kérnénk Deluxe-ot, 2 felnőtt'],want:{arrival:'2027-08-10',departure:'2027-08-13',adults:2,cabin:'Deluxe'}},
 {name:'gyerekek korral',msgs:['Családi faház július 20-23, 2 felnőtt és 2 gyerek (5 és 9 évesek)'],want:{arrival:'2027-07-20',departure:'2027-07-23',adults:2,children:2,child_ages:[5,9],cabin:'Családi'}},
 {name:'gyerek kor később',msgs:['Családi faház július 20-23, 2 felnőtt 1 gyerek','A gyerek 7 éves'],want:{adults:2,children:1,child_ages:[7],cabin:'Családi'}},
 {name:'több lépésben',msgs:['Szia, foglalnék','Deluxe faházat','június 1-től 4-ig','négyen jönnénk, felnőttek'],want:{arrival:'2027-06-01',departure:'2027-06-04',adults:4,cabin:'Deluxe'}},
 {name:'elírás delux',msgs:['delux hazat kernenk jun 5-7 ketten'],want:{arrival:'2027-06-05',departure:'2027-06-07',cabin:'Deluxe'}},
 {name:'ékezet nélkül',msgs:['csaladi fahazat szeretnenk julius 1-4 kozott 3 felnott'],want:{arrival:'2027-07-01',departure:'2027-07-04',adults:3,cabin:'Családi'}},
 {name:'mellékkérdés kutya',msgs:['Deluxe faház május 22-25, három felnőtt. Hozhatunk kutyát?'],want:{arrival:'2027-05-22',departure:'2027-05-25',adults:3,cabin:'Deluxe'}},
 {name:'dátumváltoztatás',msgs:['Deluxe június 10-13, 2 felnőtt','Bocsánat, inkább június 12-től 15-ig'],want:{arrival:'2027-06-12',departure:'2027-06-15',adults:2,cabin:'Deluxe'}},
 {name:'létszámváltozás',msgs:['Családi faház július 1-4, 4 felnőtt','Mégis öten leszünk, 5 felnőtt'],want:{adults:5,cabin:'Családi'}},
 {name:'osztott apartman',msgs:['Osztott apartmant kérnénk augusztus 2-4, 2 fő'],want:{arrival:'2027-08-02',departure:'2027-08-04',cabin:'Osztott'}},
 {name:'két ház',msgs:['2 Deluxe faházat szeretnénk június 10-13, 8 felnőtt'],want:{adults:8,cabin:'Deluxe',units_requested:2}},
 {name:'különálló',msgs:['Különálló 2 fős faház szeptember 3-6, 2 felnőtt'],want:{arrival:'2027-09-03',departure:'2027-09-06',adults:2,cabin:'Különálló 2 fős'}},
 {name:'telefonszám',msgs:['Deluxe június 10-13, 2 felnőtt. Telefonszámom: +36 30 123 4567'],want:{adults:2,phone:'+36 30 123 4567'}},
 {name:'pünkösd/hétvége szöveg',msgs:['Jövő hétvégére lenne szabad Deluxe ház 2 főre?'],want:{cabin:'Deluxe'}},
 {name:'DE',msgs:['Wir möchten ein Deluxe-Haus vom 10. bis 13. Juni 2027 für 2 Erwachsene buchen.'],want:{arrival:'2027-06-10',departure:'2027-06-13',adults:2,cabin:'Deluxe'}},
 {name:'DE gyerek',msgs:['Familienhaus 5.-8. Juli, 2 Erwachsene und 1 Kind (6 Jahre)'],want:{arrival:'2027-07-05',departure:'2027-07-08',adults:2,children:1,child_ages:[6],cabin:'Családi'}},
 {name:'EN',msgs:['We would like a family cabin from July 5 to July 8, 2 adults and 2 kids aged 4 and 10'],want:{arrival:'2027-07-05',departure:'2027-07-08',adults:2,children:2,child_ages:[4,10],cabin:'Családi'}},
 {name:'SI',msgs:['Želimo družinsko hiško od 5. do 8. julija, 2 odrasla'],want:{arrival:'2027-07-05',departure:'2027-07-08',adults:2,cabin:'Családi'}},
 {name:'nyelvváltás',msgs:['Hello, do you have a Deluxe cabin?','június 10-13, 2 felnőtt'],want:{arrival:'2027-06-10',departure:'2027-06-13',adults:2,cabin:'Deluxe'}},
 {name:'"ketten a párommal"',msgs:['Szeptember 17-20 jönnénk ketten a párommal, Deluxe'],want:{arrival:'2027-09-17',departure:'2027-09-20',cabin:'Deluxe'}},
 {name:'csak gyerek szám',msgs:['VIP apartman augusztus 1-5, 2 felnőtt, 3 gyerek'],want:{adults:2,children:3,cabin:'VIP'}},
 {name:'túl nagy létszám egy házba',msgs:['Deluxe június 10-13, 9 felnőtt'],want:{adults:9,cabin:'Deluxe'}},
];
function check(facts,want){
 const bad=[];
 for(const [k,v] of Object.entries(want)){
  let got;
  if(k==='arrival'||k==='departure')got=facts.dates?.[k];
  else if(k==='cabin')got=facts.cabin;
  else got=facts[k];
  const same=Array.isArray(v)?JSON.stringify(got)===JSON.stringify(v):got===v;
  if(!same)bad.push(k+': várt '+JSON.stringify(v)+', kapott '+JSON.stringify(got));
 }
 return bad;
}
export function runScenarios(){
 return SCENARIOS.map(sc=>{const s=createChatInquirySession({clock:()=>NOW});let last;for(const m of sc.msgs)last=s.reply(m);
  const bad=check(s.snapshot(),sc.want);return {name:sc.name,ok:!bad.length,bad,lastText:last.text};});
}
if(import.meta.url===`file://${process.argv[1]}`){
 const res=runScenarios();
 for(const r of res)console.log((r.ok?'✅ ':'❌ ')+r.name+(r.ok?'':' – '+r.bad.join('; ')));
 console.log('\nÖSSZESEN:',res.length,'| jó:',res.filter(r=>r.ok).length,'| hibás:',res.filter(r=>!r.ok).length);
}
