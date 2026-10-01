// Sárberki shared core: multilingual, conservative parsing helpers.
// Single source of truth for Gmail, manual paste and future input channels.
// Pure functions: safe to test without Gmail or browser access.
const MONTHS = {
  január:1,januar:1,február:2,februar:2,március:3,marcius:3,április:4,aprilis:4,május:5,majus:5,június:6,junius:6,július:7,julius:7,augusztus:8,szeptember:9,október:10,oktober:10,november:11,december:12,
  jan:1,febr:2,márc:3,ápr:4,máj:5,jún:6,júl:7,aug:8,szept:9,okt:10,nov:11,dec:12,
  january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12,
  januar:1,februar:2,märz:3,maerz:3,mai:5,juni:6,juli:7,oktober:10,dezember:12,
  januar_si:1,januarja:1,februar_si:2,februarja:2,marec:3,marca:3,april_si:4,aprila:4,maj:5,maja:5,junij:6,junija:6,julij:7,julija:7,avgust:8,avgusta:8,september_si:9,septembra:9,oktober_si:10,oktobra:10,november_si:11,novembra:11,december_si:12,decembra:12
};
function monthNumber(raw){
  const k=raw.toLowerCase().replace(/\.$/,'');
  if (MONTHS[k]) return MONTHS[k];
  return MONTHS[k+'_si'] || null;
}
export function cabinFromText(text=''){
  const found=[];
  if (/\bvip\b/iu.test(text)) found.push('VIP');
  if (/\b(?:családi|csaladi)\b/iu.test(text)
      || /\bfamily\s+(?:cabin|house|accommodation|unit)\b/iu.test(text)
      || /\b(?:familien(?:haus|hütte|unterkunft)|familien\s+(?:haus|unterkunft))\b/iu.test(text)) found.push('Családi');
  if (/\bdeluxe\b/iu.test(text)) found.push('Deluxe');
  if (/\b(?:osztott|split|geteilte[rs]?|deljen[ai]?)\b/iu.test(text)) found.push('Osztott');
  return found.length===1 ? found[0] : '? – emberi döntésre vár';
}
export function guestCountFromText(text=''){
  const dePair=text.match(/\b(\d{1,2})\s*erwachsene\w*\s*(?:und|,|\+)\s*(\d{1,2})\s*kinder?\b/iu);
  if(dePair) return Number(dePair[1])+Number(dePair[2]);
  const siArrival=text.match(/\b(?:prišli|prisli)\s+bi\s+(\d{1,2})(?=\s|$|[,.!?:;])/iu)
    || text.match(/\bskupaj\s+(\d{1,2})(?:\s+oseb)?(?=\s|$|[,.!?:;])/iu);
  if(siArrival) return Number(siArrival[1]);
  const m=text.match(/(?:^|\s)(\d{1,2})\s*(?:fő|fo|személy|szemely|persons?|people|guests?|gäste|personen|oseb)(?=\s|$|[,.!?:;])/iu);
  if(m) return Number(m[1]);
  const words={ketten:2,kéten:2,hárman:3,harman:3,négyen:4,negyen:4,öten:5,oten:5,hatan:6,heten:7,nyolcan:8,kilencen:9,tízen:10,tizen:10};
  const w=text.match(/\b(ketten|kéten|hárman|harman|négyen|negyen|öten|oten|hatan|heten|nyolcan|kilencen|tízen|tizen)\b/iu)?.[1]?.toLocaleLowerCase('hu-HU');
  return w ? words[w] : null;
}
export function childCountFromText(text=''){
  const m=text.match(/\b(\d{1,2})\s*(?:gyerek\w*|gyermek\w*|children|child|kinder|kind|otrok\w*)\b/iu);
  if(m) return Number(m[1]);
  const huWords={egy:1,két:2,ket:2,kettő:2,ketto:2,három:3,harom:3,négy:4,negy:4,öt:5,ot:5,hat:6};
  const hw=text.match(/\b(egy|két|ket|kettő|ketto|három|harom|négy|negy|öt|ot|hat)\s+(?:gyerek\w*|gyermek\w*)\b/iu)?.[1]?.toLocaleLowerCase('hu-HU');
  if(hw) return huWords[hw];
  const siWords={en:1,ena:1,eno:1,dva:2,dve:2,trije:3,tri:3,štirje:4,stirje:4,štiri:4,stiri:4,pet:5,šest:6,sest:6};
  const sw=text.match(/\b(en|ena|eno|dva|dve|trije|tri|štirje|stirje|štiri|stiri|pet|šest|sest)\s+otrok\w*\b/iu)?.[1]?.toLocaleLowerCase('sl-SI');
  return sw ? siWords[sw] : null;
}
export function dateRangeFromText(text='', now=new Date()){
  const iso=text.match(/\b(20\d{2})[-./](\d{1,2})[-./](\d{1,2})\s*(?:[-–]|to|bis|do)\s*(?:(20\d{2})[-./](\d{1,2})[-./])?(\d{1,2})\b/iu);
  if(iso) return {arrival:`${iso[1]}-${String(iso[2]).padStart(2,'0')}-${String(iso[3]).padStart(2,'0')}`,departure:`${iso[4]||iso[1]}-${String(iso[5]||iso[2]).padStart(2,'0')}-${String(iso[6]).padStart(2,'0')}`,inferredYear:false};
  const enLong=text.match(/\b(?:from\s+)?(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\s+(?:to|[-–])\s+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/iu);
  if(enLong){
    const m1=monthNumber(enLong[2]), m2=monthNumber(enLong[5]);
    if(!m1||!m2) return null;
    return {arrival:`${enLong[3]}-${String(m1).padStart(2,'0')}-${String(enLong[1]).padStart(2,'0')}`,departure:`${enLong[6]}-${String(m2).padStart(2,'0')}-${String(enLong[4]).padStart(2,'0')}`,inferredYear:false};
  }
  const deRange=text.match(/\b(?:vom\s+)?(\d{1,2})\.?\s*(?:bis|[-–])\s*(\d{1,2})\.?\s+(Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)(?:\s+(20\d{2}))?\b/iu);
  const siRange=text.match(/\bod\s+(\d{1,2})\.?\s+do\s+(\d{1,2})\.?\s+(januarja|februarja|marca|aprila|maja|junija|julija|avgusta|septembra|oktobra|novembra|decembra)(?:\s+(20\d{2}))?\b/iu);
  if(siRange){
    const month=monthNumber(siRange[3]);
    const local=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit'}).format(now).split('-').map(Number);
    let year=siRange[4]?Number(siRange[4]):local[0];
    const inferred=!siRange[4];
    if(inferred&&(month<local[1]||(month===local[1]&&Number(siRange[1])<local[2]))) year++;
    return {arrival:`${year}-${String(month).padStart(2,'0')}-${String(siRange[1]).padStart(2,'0')}`,departure:`${year}-${String(month).padStart(2,'0')}-${String(siRange[2]).padStart(2,'0')}`,inferredYear:inferred};
  }

  if(deRange){
    const month=monthNumber(deRange[3]);
    const local=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit'}).format(now).split('-').map(Number);
    let year=deRange[4]?Number(deRange[4]):local[0];
    const inferred=!deRange[4];
    if(inferred&&(month<local[1]||(month===local[1]&&Number(deRange[1])<local[2]))) year++;
    return {arrival:`${year}-${String(month).padStart(2,'0')}-${String(deRange[1]).padStart(2,'0')}`,departure:`${year}-${String(month).padStart(2,'0')}-${String(deRange[2]).padStart(2,'0')}`,inferredYear:inferred};
  }
  const names='január|januar|február|februar|március|marcius|április|aprilis|május|majus|június|junius|július|julius|augusztus|szeptember|október|oktober|november|december|jan\\.?|febr\\.?|márc\\.?|marc\\.?|ápr\\.?|apr\\.?|máj\\.?|maj\\.?|jún\\.?|jun\\.?|júl\\.?|jul\\.?|aug\\.?|szept\\.?|okt\\.?|nov\\.?|dec\\.?|january|february|march|april|may|june|july|august|september|october|november|december|märz|maerz|mai|juni|juli|dezember|marec|marca|april_si|aprila|maj|maja|junij|junija|julij|julija|avgust|avgusta|septembra|oktobra|novembra|decembra';
  const dayFirst=text.match(new RegExp(`\\b(?:vom\\s+)?(\\d{1,2})\\.?\\s*(?:bis|[-–])\\s*(\\d{1,2})\\.?\\s+(${names})\\b`,'iu'));
  const r=text.match(new RegExp(`\\b(?:20\\d{2}\\s*[.\\/-]?\\s*)?(${names})\\s+(\\d{1,2})\\s*(?:[-–]|to|bis|do|(?:-?(?:től|tól|tol)))\\s*(?:(?:${names})\\s+)?(\\d{1,2})(?:-?ig)?\\b`,'iu'));
  if(!r&&!dayFirst) return null;
  const month=monthNumber(r ? r[1] : dayFirst[3]); if(!month) return null;
  const explicit=text.match(/\b20\d{2}\b/u)?.[0];
  const next=/\b(?:jövőre|következő évben|next year|nächstes jahr|naslednje leto)\b/iu.test(text);
  const local=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit'}).format(now).split('-').map(Number);
  let year=explicit?Number(explicit):local[0]+(next?1:0);
  const startDay=Number(r ? r[2] : dayFirst[1]);
  const endDay=Number(r ? r[3] : dayFirst[2]);
  if(!explicit&&!next&&(month<local[1]||(month===local[1]&&startDay<local[2]))) year++;
  return {arrival:`${year}-${String(month).padStart(2,'0')}-${String(startDay).padStart(2,'0')}`,departure:`${year}-${String(month).padStart(2,'0')}-${String(endDay).padStart(2,'0')}`,inferredYear:!explicit&&!next};
}

export function phoneFromText(text=''){
  const m=text.match(/(?:\+\d{1,3}[\s()./-]*)?(?:\d[\s()./-]*){8,15}/u);
  return m ? m[0].trim().replace(/[.,;:]+$/u,'') : null;
}
export function childAgesFromText(text=''){
  const segments=[
    text.match(/\baged\s+([^.!?]{1,120})/iu)?.[1],
    text.match(/\bim\s+alter\s+von\s+([^.!?]{1,120}?)(?=\s+jahren?\b|[.!?]|$)/iu)?.[1],
    text.match(/\bstar(?:a|i|e)?\s+([^.!?]{1,120}?)(?=\s+let\b|[.!?]|$)/iu)?.[1],
    text.match(/((?:\d{1,2}\s*(?:(?:,|és|es|meg)\s*)?){1,6})(?=\s+(?:évesek|éves|evesek|eves)\b)/iu)?.[1]
  ].filter(Boolean);
  for(const segment of segments){
    const nums=[...segment.matchAll(/\b\d{1,2}\b/gu)].map(m=>Number(m[0]));
    if(nums.length) return nums;
  }
  const m=text.match(/(?:gyerek\w*|gyermek\w*|children|kinder|otrok\w*)[^.!?\n]{0,80}?(\d{1,2})\s*(?:és|es|meg|,|and|und|in)\s*(\d{1,2})\s*(?:éves|eves|years? old|jahre alt|jahren?|let)/iu)
    || text.match(/(\d{1,2})\s*(?:és|es|meg|,|and|und|in)\s*(\d{1,2})\s*(?:éves|eves|years? old|jahre alt|jahren?|let)/iu);
  return m ? [Number(m[1]),Number(m[2])] : [];
}
export function pierPreferenceFromText(text=''){
  return /(?:saját|sajat|külön|kulon)\s+stég|stég\w*\s+(?:saját|sajat|külön|kulon)|(?:eigene[rmns]?|privat(?:e[rmns]?)?)\s+steg|(?:own|private)\s+(?:fishing\s+)?(?:pier|dock)|(?:lasten|zaseben)\s+pomol/iu.test(text);
}
export function languageFromText(text=''){
  const scores={
    hu:(text.match(/\b(?:szeretn|erdekl|érdekl|faház|fahaz|szállás|szallas|gyermek|gyerek|fő|fo|dézsa|dezsa|mennénk|mennenk|jönnénk|jonnenk)\w*/giu)||[]).length,
    de:(text.match(/\b(?:möchte|möchten|würde|würden|hätte|hätten|anfrage|unterkunft|buchung|gäste|personen|kinder|verfügbar|übernacht|freundlichen grüßen|für|wäre|eigenem|möglich)\w*/giu)||[]).length
       + ((text.match(/[äöüß]/giu)||[]).length ? 2 : 0),
    en:(text.match(/\b(?:would|booking|reservation|accommodation|guests|children|available|cabin|please|total price|thank you|aged)\w*/giu)||[]).length,
    si:(text.match(/\b(?:nastanitev|rezervacij|oseb|otrok|prosto|koča|hiška|ribolov|želimo|želeli|prosimo|sporočite|lahko|bivali|prihod|odhod|lastnim|pomolom|hvala|lep pozdrav)\w*/giu)||[]).length
       + ((text.match(/[čšž]/giu)||[]).length ? 2 : 0)
  };
  const best=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  return best[0][1]>0 && best[0][1]>best[1][1] ? best[0][0] : 'unknown';
}
export function replySummary(language='hu', {arrival=null,departure=null,guests=null,children=null,childAges=[],pier=false,hotTub=false,dog=false}={}){
  if(!arrival||!departure||!guests) return '';
  const fmt=iso=>{const [y,m,d]=iso.split('-');return `${d}.${m}.${y}`;};
  const adults=Number.isFinite(children)?Math.max(0,guests-children):null;
  const ageList=(lang)=>{
    if(!Array.isArray(childAges)||!childAges.length) return '';
    const joiner={hu:' és ',de:' und ',en:' and ',si:' in '}[lang]||', ';
    return childAges.join(joiner);
  };
  const packs={
    hu:{
      people:()=>children?`${guests} fő (${adults} felnőtt és ${children} gyermek${ageList('hu')?`, ${ageList('hu')} évesek`:''})`:`${guests} fő`,
      base:p=>`${fmt(arrival)} és ${fmt(departure)} között összesen ${p} szeretnének érkezni.`,
      pier:'Ha lehetséges, saját / külön stéget kérnek.',
      hotTub:'Dézsát is szeretnének.',
      dog:'Kutyát is hoznának.'
    },
    de:{
      people:()=>children?`${guests} Personen (${adults} Erwachsene und ${children} Kinder${ageList('de')?` im Alter von ${ageList('de')} Jahren`:''})`:`${guests} Personen`,
      base:p=>`Sie möchten vom ${fmt(arrival)} bis ${fmt(departure)} mit ${p} bei uns übernachten.`,
      pier:'Wenn möglich, wünschen Sie ein Haus mit eigenem Steg.',
      hotTub:'Außerdem wünschen Sie ein Badefass / einen Whirlpool.',
      dog:'Sie möchten einen Hund mitbringen.'
    },
    en:{
      people:()=>children?`${guests} guests (${adults} adults and ${children} children${ageList('en')?`, aged ${ageList('en')}`:''})`:`${guests} guests`,
      base:p=>`You would like to stay from ${fmt(arrival)} to ${fmt(departure)} with ${p}.`,
      pier:'If possible, you would like a cabin with its own fishing pier.',
      hotTub:'You would also like a hot tub.',
      dog:'You would like to bring a dog.'
    },
    si:{
      people:()=>children?`${guests} oseb (${adults} odraslih in ${children} otrok${ageList('si')?`, starih ${ageList('si')} let`:''})`:`${guests} oseb`,
      base:p=>`Pri nas želite bivati od ${fmt(arrival)} do ${fmt(departure)} za skupaj ${p}.`,
      pier:'Če je mogoče, želite hiško z lastnim pomolom.',
      hotTub:'Želite tudi masažno / vročo kad.',
      dog:'S seboj želite pripeljati psa.'
    }
  };
  const pack=packs[language]||packs.hu;
  const extras=[pier?pack.pier:null,hotTub?pack.hotTub:null,dog?pack.dog:null].filter(Boolean).join(' ');
  return `${pack.base(pack.people())}${extras?' '+extras:''}`;
}

export function replyQuestions(language='hu', {needPhone=false,needCabin=false,needChildAge=false}={}){
  const q={
    hu:{phone:'Megírna egy telefonszámot, amelyen elérhetjük?',cabin:'Melyik háztípust szeretné: VIP, Családi, Deluxe vagy Osztott?',child:'Megírná a gyermek életkorát?'},
    de:{phone:'Bitte teilen Sie uns eine Telefonnummer mit, unter der wir Sie erreichen können.',cabin:'Welchen Haustyp wünschen Sie: VIP, Családi (Familienhaus), Deluxe oder Osztott (geteiltes Haus)?',child:'Bitte teilen Sie uns das Alter des Kindes mit.'},
    en:{phone:'Please send us a phone number where we can reach you.',cabin:'Which cabin type would you like: VIP, Családi (Family), Deluxe or Osztott (Split)?',child:'Please tell us the age of the child.'},
    si:{phone:'Prosimo, sporočite telefonsko številko, na kateri ste dosegljivi.',cabin:'Kateri tip hiške želite: VIP, Családi (družinska), Deluxe ali Osztott (deljena)?',child:'Prosimo, sporočite starost otroka.'}
  }[language]||null;
  if(!q) return [];
  return [needChildAge&&q.child,needPhone&&q.phone,needCabin&&q.cabin].filter(Boolean);
}


export function buildReplyDraft({language='hu',name=null,original='',arrival=null,departure=null,guests=null,children=null,childAges=[],phone=null,cabin='? – emberi döntésre vár',pier=false,hotTub=false,dog=false,intent='booking_request',brandName='Sárberki Horgásztó'}={}){
  const lang=language==='unknown'?'hu':language;
  const first=name?.trim()?.split(/\s+/u)?.slice(-1)[0]||null;
  const greetings={hu:first?`Kedves ${first}!`:'Kedves Vendégünk!',de:first?`Guten Tag ${first}!`:'Guten Tag!',en:first?`Dear ${first},`:'Dear Guest,',si:first?`Pozdravljeni ${first}!`:'Pozdravljeni!'};
  const intros={hu:'Köszönjük érdeklődését.',de:'Vielen Dank für Ihre Anfrage.',en:'Thank you for your inquiry.',si:'Hvala za vaše povpraševanje.'};
  const closings={hu:'Üdvözlettel:',de:'Mit freundlichen Grüßen',en:'Kind regards,',si:'Lep pozdrav,'};
  if(intent==='cancellation_request'||intent==='modification_request'){
    const action={hu:intent==='cancellation_request'?'lemondási':'foglalásmódosítási',de:intent==='cancellation_request'?'Stornierungs':'Änderungs',en:intent==='cancellation_request'?'cancellation':'booking change',si:intent==='cancellation_request'?'odpovedi':'spremembe rezervacije'}[lang]||'foglalási';
    const received={hu:`Megkaptuk a ${action} kérelmét. Hamarosan pontos visszajelzést adunk.`,de:`Wir haben Ihre ${action}anfrage erhalten und prüfen sie.`,en:`We have received your ${action} request and will review it.`,si:`Prejeli smo vašo zahtevo za ${action} in jo bomo preverili.`}[lang];
    return `${greetings[lang]}\n\n${received}\n\n${closings[lang]}\n${brandName}`;
  }
  const summary=replySummary(lang,{arrival,departure,guests,children,childAges,pier,hotTub,dog});
  const needCabin=!cabin||String(cabin).startsWith('?');
  const questions=replyQuestions(lang,{needPhone:!phone,needCabin,needChildAge:Boolean(children&&childAges.length<children)});
  const asksAvailability=/(?:szabad|elérhető|van[- ]?e .*szállás|van.*hely|available|frei|prosto|verfügbar|razpolož)/iu.test(original);
  const asksPrice=/(?:mennyi|mennyibe|ár|ára|árat|price|cost|kosten|preis|cena)/iu.test(original);
  const checks={
    hu: asksAvailability||asksPrice?'A szabad kapacitást és az árat külön ellenőrizzük; ezekről csak hiteles ellenőrzés után adunk biztos tájékoztatást.':'A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.',
    de: asksAvailability||asksPrice?'Verfügbarkeit und Preis prüfen wir separat; eine verbindliche Auskunft geben wir erst nach bestätigter Prüfung.':'Wir prüfen die angegebenen Daten und melden uns mit den nötigen Details.',
    en: asksAvailability||asksPrice?'We check availability and price separately and will only confirm them after a verified check.':'We will review the details provided and reply with any required information.',
    si: asksAvailability||asksPrice?'Razpoložljivost in ceno preverimo posebej in ju potrdimo šele po zanesljivem preverjanju.':'Preverili bomo navedene podatke in odgovorili s potrebnimi podrobnostmi.'
  };
  return `${greetings[lang]}\n\n${intros[lang]}${summary?'\n\n'+summary:''}${questions.length?'\n\n'+questions.join(' '):''}\n\n${checks[lang]}\n\n${closings[lang]}\n${brandName}`;
}
