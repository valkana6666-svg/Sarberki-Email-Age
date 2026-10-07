// Shared accommodation-email core: multilingual, conservative parsing helpers.
// Single source of truth for Gmail, manual paste and future input channels.
// Business-specific values are supplied by configuration/adapters.
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
// Csak az aktuális üzenet tényeit használjuk, az idézett előzményt megőrzi a hívó.
export function activeMessageText(text=''){
  const lines=String(text).replace(/\r\n?/g,'\n').split('\n');
  const current=[];
  const outlookFrom=/^\s*(?:from|feladó|felado|von|od)\s*:/iu;
  const outlookSent=/^\s*(?:sent|elküldve|elkuldve|gesendet|poslano)\s*:/iu;
  const outlookSubject=/^\s*(?:subject|tárgy|targy|betreff|zadeva)\s*:/iu;
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    const headerWindow=lines.slice(i+1,i+6);
    const outlookReplyStart=outlookFrom.test(line)
      && headerWindow.some(next=>outlookSent.test(next))
      && headerWindow.some(next=>outlookSubject.test(next));
    if(outlookReplyStart||/^\s*>/.test(line)||/^\s*-{2,}\s*(?:original message|eredeti üzenet|ursprüngliche nachricht|forwarded message)/iu.test(line)
      ||/^\s*On .{1,200}wrote:\s*$/iu.test(line)||/^\s*Am .{1,200}schrieb.{0,100}:\s*$/iu.test(line)
      ||/^\s*.+(?:írta|napisal(?:a)?):\s*$/iu.test(line)) break;
    current.push(line);
  }
  return current.join('\n').trim();
}
export function nameFromText(text=''){
  const current=activeMessageText(text);
  const fullName='([A-ZÁÉÍÓÖŐÚÜŰČŠŽÄÖÜ][\\p{L}-]+\\s+[A-ZÁÉÍÓÖŐÚÜŰČŠŽÄÖÜ][\\p{L}-]+)';
  const patterns=[
    new RegExp('(?:^|\\n)\\s*(?:üdv(?:özlettel)?|tisztelettel|köszönettel)\\s*\\.?\\s*[:,-]?\\s*'+fullName+'\\s*$','imu'),
    new RegExp('(?:^|\\n)\\s*(?:mit\\s+freundlichen\\s+grüßen|viele\\s+grüße|freundliche\\s+grüße)\\s*[,.:;-]?\\s*'+fullName+'\\s*$','imu'),
    new RegExp('(?:^|\\n)\\s*(?:best\\s+regards|kind\\s+regards|regards|thank\\s+you)\\s*[,.:;-]?\\s*'+fullName+'\\s*$','imu'),
    new RegExp('(?:^|\\n)\\s*(?:hvala\\s+in\\s+lep\\s+pozdrav|lep\\s+pozdrav|pozdrav)\\s*[,.:;-]?\\s*'+fullName+'\\s*$','imu'),
    new RegExp('(?:^|\\n)\\s*'+fullName+'\\s*$','mu')
  ];
  for(const pattern of patterns){
    const match=current.match(pattern);
    if(match?.[1]) return match[1].trim();
  }
  return null;
}

export function requestFlagsFromText(text=''){
  text=activeMessageText(text);
  const pet=/(?:kuty\p{L}*|háziállat\p{L}*|dogs?|pets?|hund\p{L}*|haustier\p{L}*|\bpes\b|\bpsa\b)/iu;
  const tub=/(?:dézs\p{L}*|dezsa\p{L}*|hot[ -]?tub|whirlpool|badefass|jacuzzi|(?:vroč\p{L}*|masaž\p{L}*)\s*kad)/iu;
  const negation=/(?<!\p{L})(?:nem|mégsem|megsem|nincs|nélkül|nelkul|not|no|without|kein\p{L}*|nicht|ohne|brez|ne)(?!\p{L})/iu;
  const requested=pattern=>{
    const mentions=text.split(/[.!?\n]|\b(?:de|but|aber|ampak)\b/iu).filter(s=>pattern.test(s));
    return mentions.length? !negation.test(mentions.at(-1)):false;
  };
  return {petRequested:requested(pet),hotTubRequested:requested(tub),parkingQuestion:/(?:parkol|parking|parkpl(?:atz|ätze)|parkiriš|parkiris)/iu.test(text)};
}
export function cabinFromText(text=''){
  text=activeMessageText(text);
  const found=[];
  if (/\bvip\b/iu.test(text)) found.push('VIP');
  if (/\b(?:családi|csaladi)\b/iu.test(text)
      || /\bfamily\s+(?:cabin|house|accommodation|unit)\b/iu.test(text)
      || /\b(?:familien(?:haus|hütte|unterkunft)|familien\s+(?:haus|unterkunft))\b/iu.test(text)
      || /\bdružinsk\w*\s+(?:hišk\w*|koč\w*|nastanitev)\b/iu.test(text)) found.push('Családi');
  if (/\bdeluxe\b/iu.test(text)) found.push('Deluxe');
  if (/\b(?:osztott|split|geteilte[rs]?|deljen[ai]?)\b/iu.test(text)) found.push('Osztott');
  if (/(?<!\p{L})(?:különálló|kulonallo|külön\s+álló)(?!\p{L})/iu.test(text)
      || /\b(?:standalone|detached)\s+(?:cabin|house|accommodation|unit)\b/iu.test(text)
      || /\bfreistehend\w*\s+(?:hütte|haus|unterkunft)\b/iu.test(text)
      || /\bsamostojn\w*\s+(?:hišk\w*|koč\w*|nastanitev)\b/iu.test(text)) found.push('Különálló 2 fős');
  return found.length===1 ? found[0] : '? – emberi döntésre vár';
}
export function cabinClarificationRequired(text='',guests=null){
  const parsed=cabinFromText(text);
  if(parsed&&!parsed.startsWith('?')) return false;
  const count=Number(guests);
  return count===2||count===4;
}

export function guestCountFromText(text=''){
  text=activeMessageText(text);
  const wordTotal=text.match(/(?:összesen|osszesen)\s+(ketten|hárman|harman|négyen|negyen|öten|oten|hatan|heten|nyolcan|kilencen|tízen|tizen)\b/iu);
  if(wordTotal)return ({ketten:2,hárman:3,harman:3,négyen:4,negyen:4,öten:5,oten:5,hatan:6,heten:7,nyolcan:8,kilencen:9,tízen:10,tizen:10})[wordTotal[1].toLowerCase()];
  const explicitTotal=
    text.match(/(?:^|\s)(?:összesen|osszesen)\s+(\d{1,2})\s*(?:fő|fo|személy|szemely)(?=\s|$|[,.!?:;])/iu)
    || text.match(/\b(?:total(?:\s+of)?|altogether)\s+(\d{1,2})\s*(?:persons?|people|guests?)\b/iu)
    || text.match(/\b(\d{1,2})\s*(?:persons?|people|guests?)\s+(?:in\s+total|altogether)\b/iu)
    || text.match(/\binsgesamt\s+(\d{1,2})\s*(?:gäste|personen)\b/iu)
    || text.match(/\bskupaj\s+(\d{1,2})\s*oseb\b/iu);
  if(explicitTotal) return Number(explicitTotal[1]);
  const total=text.match(/(?:^|\s)(\d{1,2})\s*(?:fő|fo|személy|szemely|persons?|people|guests?|gäste|personen|oseb)(?=\s|$|[,.!?:;])/iu);
  if(total) return Number(total[1]);
  const adultChildPairs=[
    /\b(\d{1,2})\s*(?:felnőtt|felnott)\w*\s*(?:és|es|,|\+)\s*(\d{1,2})\s*(?:gyerek|gyermek)\w*\b/iu,
    /\b(\d{1,2})\s*adults?\s*(?:and|,|\+)\s*(\d{1,2})\s*(?:children|child)\b/iu,
    /\b(\d{1,2})\s*erwachsene\w*\s*(?:und|,|\+)\s*(\d{1,2})\s*kinder?\b/iu,
    /\b(\d{1,2})\s*odrasl\w*\s*(?:in|,|\+)\s*(\d{1,2})\s*(?:otrok|otroc)\w*\b/iu
  ];
  for(const pattern of adultChildPairs){
    const pair=text.match(pattern);
    if(pair) return Number(pair[1])+Number(pair[2]);
  }
  const adultOnly=adultCountFromText(text);
  if(Number.isInteger(adultOnly)&&adultOnly>0&&childCountFromText(text)===0)return adultOnly;
  const huCountWords={egy:1,két:2,ket:2,kettő:2,ketto:2,három:3,harom:3,négy:4,negy:4,öt:5,ot:5,hat:6,hét:7,het:7,nyolc:8};
  const siCountWords={en:1,ena:1,eno:1,dva:2,dve:2,trije:3,tri:3,štirje:4,stirje:4,štiri:4,stiri:4,pet:5,šest:6,sest:6,sedem:7,osem:8};
  const huWordPair=text.match(/\b(egy|két|ket|kettő|ketto|három|harom|négy|negy|öt|ot|hat|hét|het|nyolc)\s+(?:felnőtt|felnott)\w*\s*(?:és|es|,|\+)\s*(egy|két|ket|kettő|ketto|három|harom|négy|negy|öt|ot|hat|hét|het|nyolc)\s+(?:gyerek|gyermek)\w*\b/iu);
  if(huWordPair) return huCountWords[huWordPair[1].toLocaleLowerCase('hu-HU')]+huCountWords[huWordPair[2].toLocaleLowerCase('hu-HU')];
  const siWordPair=text.match(/\b(en|ena|eno|dva|dve|trije|tri|štirje|stirje|štiri|stiri|pet|šest|sest|sedem|osem)\s+odrasl\w*\s*(?:in|,|\+)\s*(en|ena|eno|dva|dve|trije|tri|štirje|stirje|štiri|stiri|pet|šest|sest|sedem|osem)\s+(?:otrok|otroc)\w*\b/iu);
  if(siWordPair) return siCountWords[siWordPair[1].toLocaleLowerCase('sl-SI')]+siCountWords[siWordPair[2].toLocaleLowerCase('sl-SI')];
  const siArrival=text.match(/\b(?:prišli|prisli)\s+bi\s+(\d{1,2})(?=\s|$|[,.!?:;])/iu)
    || text.match(/\bskupaj\s+(\d{1,2})(?:\s+oseb)?(?=\s|$|[,.!?:;])/iu);
  if(siArrival) return Number(siArrival[1]);
  const words={ketten:2,kéten:2,hárman:3,harman:3,négyen:4,negyen:4,öten:5,oten:5,hatan:6,heten:7,nyolcan:8,kilencen:9,tízen:10,tizen:10};
  const w=text.match(/\b(ketten|kéten|hárman|harman|négyen|negyen|öten|oten|hatan|heten|nyolcan|kilencen|tízen|tizen)\b/iu)?.[1]?.toLocaleLowerCase('hu-HU');
  return w ? words[w] : null;
}
export function adultCountFromText(text=''){
  text=activeMessageText(text);
  const m=text.match(/\b(\d{1,2})\s*(?:felnőtt\w*|felnott\w*|adults?|erwachsene\w*|odrasl\w*)\b/iu);
  if(m) return Number(m[1]);
  const huWords={egy:1,két:2,ket:2,kettő:2,ketto:2,három:3,harom:3,négy:4,negy:4,öt:5,ot:5,hat:6,hét:7,het:7,nyolc:8};
  const hw=text.match(/\b(egy|két|ket|kettő|ketto|három|harom|négy|negy|öt|ot|hat|hét|het|nyolc)\s+(?:felnőtt|felnott)\w*\b/iu)?.[1]?.toLocaleLowerCase('hu-HU');
  if(hw) return huWords[hw];
  const siWords={en:1,ena:1,eno:1,dva:2,dve:2,trije:3,tri:3,štirje:4,stirje:4,štiri:4,stiri:4,pet:5,šest:6,sest:6,sedem:7,osem:8};
  const sw=text.match(/\b(en|ena|eno|dva|dve|trije|tri|štirje|stirje|štiri|stiri|pet|šest|sest|sedem|osem)\s+odrasl\w*\b/iu)?.[1]?.toLocaleLowerCase('sl-SI');
  return sw ? siWords[sw] : null;
}
export function childCountFromText(text=''){
  text=activeMessageText(text);
  if(/\b(?:nincs(?:enek)?\s+(?:gyerek|gyermek)|(?:gyermek|gyerek)\s+(?:nélkül|nelkul)|no\s+children|without\s+children|keine\s+kinder|ohne\s+kinder|brez\s+otrok|ni\s+otrok)\b/iu.test(text))return 0;
  const m=text.match(/\b(\d{1,2})\s*(?:gyerek\w*|gyermek\w*|children|child|kinder|kind|(?:otrok|otroc)\w*)\b/iu);
  if(m) return Number(m[1]);
  const huWords={egy:1,két:2,ket:2,kettő:2,ketto:2,három:3,harom:3,négy:4,negy:4,öt:5,ot:5,hat:6};
  const hw=text.match(/\b(egy|két|ket|kettő|ketto|három|harom|négy|negy|öt|ot|hat)\s+(?:gyerek\w*|gyermek\w*)\b/iu)?.[1]?.toLocaleLowerCase('hu-HU');
  if(hw) return huWords[hw];
  const siWords={en:1,ena:1,eno:1,dva:2,dve:2,trije:3,tri:3,štirje:4,stirje:4,štiri:4,stiri:4,pet:5,šest:6,sest:6};
  const sw=text.match(/\b(en|ena|eno|dva|dve|trije|tri|štirje|stirje|štiri|stiri|pet|šest|sest)\s+(?:otrok|otroc)\w*\b/iu)?.[1]?.toLocaleLowerCase('sl-SI');
  return sw ? siWords[sw] : null;
}
function parseDateRange(text='', now=new Date(), timeZone='Europe/Budapest'){
  const enCrossMonth=text.match(/\b(?:from\s+)?(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(?:to|[-–])\s+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December),?\s+(20\d{2})\b/iu);
  if(enCrossMonth){
    const m1=monthNumber(enCrossMonth[2]),m2=monthNumber(enCrossMonth[4]),year=Number(enCrossMonth[5]);
    return {arrival:`${year}-${String(m1).padStart(2,'0')}-${String(enCrossMonth[1]).padStart(2,'0')}`,departure:`${year+(m2<m1?1:0)}-${String(m2).padStart(2,'0')}-${String(enCrossMonth[3]).padStart(2,'0')}`,inferredYear:false};
  }
  // Real-world Hungarian numeric form: "2026.10.09-től 10.13.ig".
  // The year is stated once, while month/day are repeated for departure.
  const huNumericSuffix=text.match(/\b(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})\.?\s*-?\s*(?:től|tól|tol)\s+(\d{1,2})[.\/-](\d{1,2})\.?\s*-?\s*ig\b/iu);
  if(huNumericSuffix){
    const startYear=Number(huNumericSuffix[1]);
    const startMonth=Number(huNumericSuffix[2]), startDay=Number(huNumericSuffix[3]);
    const endMonth=Number(huNumericSuffix[4]), endDay=Number(huNumericSuffix[5]);
    if(startMonth<1||startMonth>12||endMonth<1||endMonth>12||startDay<1||startDay>31||endDay<1||endDay>31) return null;
    const endYear=startYear+(endMonth<startMonth?1:0);
    return {
      arrival:`${startYear}-${String(startMonth).padStart(2,'0')}-${String(startDay).padStart(2,'0')}`,
      departure:`${endYear}-${String(endMonth).padStart(2,'0')}-${String(endDay).padStart(2,'0')}`,
      inferredYear:false
    };
  }
  const iso=text.match(/\b(20\d{2})[-./](\d{1,2})[-./](\d{1,2})\s*(?:[-–]|to|bis|do)\s*(?:(20\d{2})[-./](\d{1,2})[-./])?(\d{1,2})\b/iu);
  if(iso) return {arrival:`${iso[1]}-${String(iso[2]).padStart(2,'0')}-${String(iso[3]).padStart(2,'0')}`,departure:`${iso[4]||iso[1]}-${String(iso[5]||iso[2]).padStart(2,'0')}-${String(iso[6]).padStart(2,'0')}`,inferredYear:false};
  const europeanNumeric=text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\s*(?:[-–]|to|bis|do)\s*(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/iu);
  if(europeanNumeric){
    return {
      arrival:`${europeanNumeric[3]}-${String(europeanNumeric[2]).padStart(2,'0')}-${String(europeanNumeric[1]).padStart(2,'0')}`,
      departure:`${europeanNumeric[6]}-${String(europeanNumeric[5]).padStart(2,'0')}-${String(europeanNumeric[4]).padStart(2,'0')}`,
      inferredYear:false
    };
  }
  const europeanCompactRange=text.match(/\b(\d{1,2})\s*[./]\s*(\d{1,2})\s*[./]?\s*(?:[-–]|to|bis|do|tól|tol)\s*(\d{1,2})\s*[./]\s*(\d{1,2})(?:\s*[./]?\s*(20\d{2}))?\b/iu);
  if(europeanCompactRange){
    const local=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now).split('-').map(Number);
    const startDay=Number(europeanCompactRange[1]), startMonth=Number(europeanCompactRange[2]);
    const endDay=Number(europeanCompactRange[3]), endMonth=Number(europeanCompactRange[4]);
    if(startMonth<1||startMonth>12||endMonth<1||endMonth>12||startDay<1||startDay>31||endDay<1||endDay>31) return null;
    let startYear=europeanCompactRange[5]?Number(europeanCompactRange[5]):local[0];
    const inferred=!europeanCompactRange[5];
    if(inferred&&(startMonth<local[1]||(startMonth===local[1]&&startDay<local[2]))) startYear++;
    const endYear=startYear+(endMonth<startMonth?1:0);
    return {arrival:`${startYear}-${String(startMonth).padStart(2,'0')}-${String(startDay).padStart(2,'0')}`,departure:`${endYear}-${String(endMonth).padStart(2,'0')}-${String(endDay).padStart(2,'0')}`,inferredYear:inferred};
  }
  const huNaturalRange=text.match(/\b(?:(20\d{2})\.?\s*)?(január|januar|február|februar|március|marcius|április|aprilis|május|majus|június|junius|július|julius|augusztus|szeptember|október|oktober|november|december)\s+(\d{1,2})\.?\s+(?:és|es)\s+(\d{1,2})\.?\s+között\b/iu);
  if(huNaturalRange){
    const month=monthNumber(huNaturalRange[2]);
    const local=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now).split('-').map(Number);
    let year=huNaturalRange[1]?Number(huNaturalRange[1]):local[0];
    const inferred=!huNaturalRange[1];
    const startDay=Number(huNaturalRange[3]), endDay=Number(huNaturalRange[4]);
    if(inferred&&(month<local[1]||(month===local[1]&&startDay<local[2]))) year++;
    return {arrival:`${year}-${String(month).padStart(2,'0')}-${String(startDay).padStart(2,'0')}`,departure:`${year}-${String(month).padStart(2,'0')}-${String(endDay).padStart(2,'0')}`,inferredYear:inferred};
  }
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
    const local=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now).split('-').map(Number);
    let year=siRange[4]?Number(siRange[4]):local[0];
    const inferred=!siRange[4];
    if(inferred&&(month<local[1]||(month===local[1]&&Number(siRange[1])<local[2]))) year++;
    return {arrival:`${year}-${String(month).padStart(2,'0')}-${String(siRange[1]).padStart(2,'0')}`,departure:`${year}-${String(month).padStart(2,'0')}-${String(siRange[2]).padStart(2,'0')}`,inferredYear:inferred};
  }

  if(deRange){
    const month=monthNumber(deRange[3]);
    const local=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now).split('-').map(Number);
    let year=deRange[4]?Number(deRange[4]):local[0];
    const inferred=!deRange[4];
    if(inferred&&(month<local[1]||(month===local[1]&&Number(deRange[1])<local[2]))) year++;
    return {arrival:`${year}-${String(month).padStart(2,'0')}-${String(deRange[1]).padStart(2,'0')}`,departure:`${year}-${String(month).padStart(2,'0')}-${String(deRange[2]).padStart(2,'0')}`,inferredYear:inferred};
  }
  const names='január|januar|február|februar|március|marcius|április|aprilis|május|majus|június|junius|július|julius|augusztus|szeptember|október|oktober|november|december|jan\\.?|febr\\.?|márc\\.?|marc\\.?|ápr\\.?|apr\\.?|máj\\.?|maj\\.?|jún\\.?|jun\\.?|júl\\.?|jul\\.?|aug\\.?|szept\\.?|okt\\.?|nov\\.?|dec\\.?|january|february|march|april|may|june|july|august|september|october|november|december|märz|maerz|mai|juni|juli|dezember|marec|marca|april_si|aprila|maj|maja|junij|junija|julij|julija|avgust|avgusta|septembra|oktobra|novembra|decembra';
  const monthFirstCross=text.match(new RegExp(`\\b(${names})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(20\\d{2}))?\\s*(?:[-–]|to|until|through)\\s*(${names})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(20\\d{2}))?\\b`,'iu'));
  const dayFirstCross=text.match(new RegExp(`\\b(?:from\\s+|vom\\s+|od\\s+)?(\\d{1,2})\\.?\\s+(${names})(?:\\s+(20\\d{2}))?\\s*(?:[-–]|to|bis|do)\\s*(\\d{1,2})\\.?\\s+(${names})(?:\\s+(20\\d{2}))?\\b`,'iu'));
  if(monthFirstCross||dayFirstCross){
    const firstMonth=monthNumber(monthFirstCross?monthFirstCross[1]:dayFirstCross[2]);
    const secondMonth=monthNumber(monthFirstCross?monthFirstCross[4]:dayFirstCross[5]);
    const firstDay=Number(monthFirstCross?monthFirstCross[2]:dayFirstCross[1]);
    const secondDay=Number(monthFirstCross?monthFirstCross[5]:dayFirstCross[4]);
    const startExplicit=monthFirstCross?monthFirstCross[3]:dayFirstCross[3];
    const endExplicit=monthFirstCross?monthFirstCross[6]:dayFirstCross[6];
    if(firstMonth&&secondMonth){
      const local=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now).split('-').map(Number);
      const next=/\b(?:jövőre|következő évben|next year|nächstes jahr|naslednje leto)\b/iu.test(text);
      let startYear;
      let endYear;
      if(startExplicit){
        startYear=Number(startExplicit);
        endYear=endExplicit?Number(endExplicit):startYear+(secondMonth<firstMonth?1:0);
      }else if(endExplicit){
        endYear=Number(endExplicit);
        startYear=endYear-(secondMonth<firstMonth?1:0);
      }else{
        startYear=local[0]+(next?1:0);
        if(!next&&(firstMonth<local[1]||(firstMonth===local[1]&&firstDay<local[2]))) startYear++;
        endYear=startYear+(secondMonth<firstMonth?1:0);
      }
      return {arrival:`${startYear}-${String(firstMonth).padStart(2,'0')}-${String(firstDay).padStart(2,'0')}`,departure:`${endYear}-${String(secondMonth).padStart(2,'0')}-${String(secondDay).padStart(2,'0')}`,inferredYear:!startExplicit&&!endExplicit&&!next};
    }
  }
  const dayFirst=text.match(new RegExp(`\\b(?:vom\\s+)?(\\d{1,2})\\.?\\s*(?:bis|[-–])\\s*(\\d{1,2})\\.?\\s+(${names})\\b`,'iu'));
  const r=text.match(new RegExp(`\\b(?:20\\d{2}\\s*[.\\/-]?\\s*)?(${names})\\s+(\\d{1,2})\\s*(?:[-–]|to|bis|do|(?:-?(?:től|tól|tol)))\\s*(?:(?:${names})\\s+)?(\\d{1,2})(?:-?ig)?\\b`,'iu'));
  if(!r&&!dayFirst) return null;
  const month=monthNumber(r ? r[1] : dayFirst[3]); if(!month) return null;
  const explicit=text.match(/\b20\d{2}\b/u)?.[0];
  const next=/\b(?:jövőre|következő évben|next year|nächstes jahr|naslednje leto)\b/iu.test(text);
  const local=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now).split('-').map(Number);
  let year=explicit?Number(explicit):local[0]+(next?1:0);
  const startDay=Number(r ? r[2] : dayFirst[1]);
  const endDay=Number(r ? r[3] : dayFirst[2]);
  if(!explicit&&!next&&(month<local[1]||(month===local[1]&&startDay<local[2]))) year++;
  return {arrival:`${year}-${String(month).padStart(2,'0')}-${String(startDay).padStart(2,'0')}`,departure:`${year}-${String(month).padStart(2,'0')}-${String(endDay).padStart(2,'0')}`,inferredYear:!explicit&&!next};
}

function validIsoDate(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;
  const d=new Date(value+'T00:00:00Z');
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}
export function dateRangeFromText(text='',now=new Date(),timeZone='Europe/Budapest'){
  text=activeMessageText(text);
  const explicitDates=[...text.matchAll(/\b20\d{2}[./-]\d{1,2}[./-]\d{1,2}\b/gu)].map(m=>m[0]);
  if(new Set(explicitDates).size>2)return null;
  // Több külön időszakból soha ne válasszuk ki csendben az elsőt.
  const parts=text.split(/\b(?:vagy|or|oder|ali)\b|[;\n]/iu);
  const ranges=parts.map(p=>parseDateRange(p,now,timeZone)).filter(Boolean);
  if(new Set(ranges.map(r=>r.arrival+'|'+r.departure)).size>1)return null;
  let result=parseDateRange(text,now,timeZone);
  if(!result)return null;
  if(/(?:jövőre|jovore|következő évben|next year|nächstes jahr|naslednje leto)/iu.test(text)&&result.inferredYear){
    const year=Number(new Intl.DateTimeFormat('en',{timeZone,year:'numeric'}).format(now))+1;
    const cross=result.departure.slice(0,4)!==result.arrival.slice(0,4);
    result={arrival:year+result.arrival.slice(4),departure:(year+(cross?1:0))+result.departure.slice(4),inferredYear:false};
  }
  if(!validIsoDate(result.arrival)||!validIsoDate(result.departure)||result.departure<=result.arrival)return null;
  return result;
}
export function phoneFromText(text=''){
  text=activeMessageText(text);
  const international=text.match(/\+\d(?:[ ()-]*\d){7,14}(?!\d)/u);
  if(international)return international[0].trim().replace(/\s+/g,' ');
  const labelled=text.match(/(?:telefon\p{L}*|phone|tel\.?|mobil\p{L}*)\s*[:：]?\s*((?:\d[ ()/-]*){8,15})/iu);
  if(labelled)return labelled[1].trim().replace(/[ /-]+$/u,'').replace(/\s+/g,' ');
  // Dátum és foglalási azonosító nem lehet elérhetőség.
  const scrubbed=text.replace(/\b20\d{2}[./-]\d{1,2}[./-]\d{1,2}\.?/gu,' ')
    .replace(/\b\d{1,2}[./-]\d{1,2}[./-]20\d{2}\b/gu,' ')
    .replace(/\b\d{1,2}\s*[-–]\s*\d{1,2}\s+20\d{2}\b/gu,' ')
    .replace(/(?:foglalási\s*(?:szám|azonosító)|booking\s*(?:id|number)|reservierungsnummer|številka rezervacije)\s*[:#]?\s*[\w-]+/giu,' ');
  const m=scrubbed.match(/(?<!\d)(?:0\d|\d{3})(?:[ ()-]*\d){6,11}(?!\d)/u);
  return m?m[0].trim().replace(/\s+/g,' '):null;
}
export function childAgesFromText(text=''){
  text=activeMessageText(text);
  text=text.replace(/(?<!\p{L})(?:én|en|i am|ich bin|star sem)\s+\d{1,2}\s*(?:éves|eves|years? old|jahre alt|let)(?:\s+vagyok)?/giu,'');
  if(!/(?:gyerek|gyermek|child|children|kinder|kind\b|otrok|otroc)/iu.test(text))return [];
  const separate=[...text.matchAll(/\b(\d{1,2})\s*(?:éves|eves|years? old|jahre alt)\b/giu)];
  if(separate.length>1)return separate.map(m=>Number(m[1]));
  const ageList=text.match(/\b(?:aged|im\s+alter\s+von|star(?:a|i|e)?)\s+((?:\d{1,2})(?:\s*(?:,|and|und|in|és|es)\s*\d{1,2})*)/iu);
  if(ageList)return [...ageList[1].matchAll(/\d{1,2}/g)].map(m=>Number(m[0]));
  const segments=[
    text.match(/\baged\s+([^.!?]{1,120})/iu)?.[1],
    text.match(/\bim\s+alter\s+von\s+([^.!?]{1,120}?)(?=\s+jahren?\b|[.!?]|$)/iu)?.[1],
    text.match(/\bstar(?:a|i|e)?\s+([^.!?]{1,120}?)(?=\s+let\b|[.!?]|$)/iu)?.[1],
    text.match(/\b(?:children|kinder|kindern|gyerek\w*|gyermek\w*|(?:otrok|otroc)\w*)\b[^0-9.!?\n]{0,40}((?:\d{1,2}\s*(?:(?:,|and|und|in|és|es|meg)\s*)?){1,6})(?=\s*(?:years? old|years?|jahre(?:n)?(?: alt)?|évesek?|evesek?|let)\b)/iu)?.[1],
    text.match(/((?:\d{1,2}\s*(?:(?:,|és|es|meg)\s*)?){1,6})(?=\s+(?:évesek|éves|evesek|eves)\b)/iu)?.[1]
  ].filter(Boolean);
  for(const segment of segments){
    const nums=[...segment.matchAll(/\b\d{1,2}\b/gu)].map(m=>Number(m[0]));
    if(nums.length) return nums;
  }
  const m=text.match(/(?:gyerek\w*|gyermek\w*|children|kinder|(?:otrok|otroc)\w*)[^.!?\n]{0,80}?(\d{1,2})\s*(?:és|es|meg|,|and|und|in)\s*(\d{1,2})\s*(?:éves|eves|years? old|jahre alt|jahren?|let)/iu)
    || text.match(/(\d{1,2})\s*(?:és|es|meg|,|and|und|in)\s*(\d{1,2})\s*(?:éves|eves|years? old|jahre alt|jahren?|let)/iu);
  return m ? [Number(m[1]),Number(m[2])] : [];
}
export function requestedUnitsFromText(text=''){
  text=activeMessageText(text);
  const open=/\b(?:több|multiple|several|mehrere|več)\s+(?:szállás)?(?:egység\w*|faház\w*|ház\w*|apartman\w*|units?|cabins?|houses?|einheiten|enot\w*)\b/iu.test(text);
  if(open) return {count:null,open:true,evidence:text.match(/\b(?:több|multiple|several|mehrere|več)\s+(?:szállás)?(?:egység\w*|faház\w*|ház\w*|apartman\w*|units?|cabins?|houses?|einheiten|enot\w*)\b/iu)?.[0]||''};
  const values={egy:1,'1':1,két:2,kettő:2,'2':2,három:3,'3':3,négy:4,'4':4,öt:5,'5':5,hat:6,'6':6,one:1,two:2,three:3,four:4,five:5,six:6,ein:1,eine:1,zwei:2,drei:3,vier:4,'fünf':5,funf:5,sechs:6,en:1,ena:1,eno:1,dva:2,dve:2,tri:3,'štiri':4,stiri:4,pet:5,'šest':6,sest:6};
  const sized=text.match(/\b(egy|1|két|kettő|2|három|3|négy|4|one|two|three|four|ein|eine|zwei|drei|vier|en|ena|dva|dve|tri|štiri|stiri)\s*(?:db|darab)\s*(?:2|két|kettő)\s*[- ]?fős\s+(?:osztott\s+)?apartman\w*/iu);
  if(sized) return {count:values[sized[1].toLocaleLowerCase()]||0,open:false,evidence:sized[0]};
  const m=text.match(/\b(egy|1|két|kettő|2|három|3|négy|4|öt|5|hat|6|one|two|three|four|five|six|ein|eine|zwei|drei|vier|fünf|funf|sechs|en|ena|eno|dva|dve|tri|štiri|stiri|pet|šest|sest)\s+(?:külön\s*)?(?:db\s*)?(?:vip|családi|deluxe|osztott|family|familien|družinsk\w*)?(?:\s*[-–]?\s*)(?:házat?|faházat?|apartmant?|egységet?|cabins?|houses?|units?|cottages?|häuser|hauser|einheiten|hišk\w*|hisk\w*|koč\w*|enot\w*)\b/iu);
  if(!m) return {count:0,open:false,evidence:''};
  return {count:values[m[1].toLocaleLowerCase()]||0,open:false,evidence:m[0]};
}

export function pierPreferenceFromText(text=''){
  return /(?:saját|sajat|külön|kulon)\s+stég|stég\w*\s+(?:saját|sajat|külön|kulon)|(?:eigene[rmns]?|privat(?:e[rmns]?)?)\s+steg|(?:own|private)\s+(?:fishing\s+)?(?:pier|dock)|(?:lasten|zaseben)\s+pomol/iu.test(text);
}
export function languageFromText(text=''){
  const scores={
    hu:(text.match(/\b(?:szia|üdv|szeretn|erdekl|érdekl|faház|fahaz|szállás|szallas|felnőtt|felnott|gyermek|gyerek|fő|fo|dézsa|dezsa|mennénk|mennenk|jönnénk|jonnenk|ár|ára|mennyibe|éjszaka)\w*/giu)||[]).length,
    de:(text.match(/\b(?:hallo|guten tag|möchte|möchten|würde|würden|hätte|hätten|anfrage|unterkunft|buchung|gäste|personen|erwachsene|kinder|verfügbar|übernacht|preis|nächte|telefon|freundlichen grüßen|für|wäre|eigenem|möglich)\w*/giu)||[]).length
       + ((text.match(/[äöüß]/giu)||[]).length ? 2 : 0),
    en:(text.match(/\b(?:would|booking|reservation|accommodation|guests|adults|children|available|availability|cabin|stay|nights?|price|please|phone|total price|thank you|aged)\w*/giu)||[]).length,
    si:(text.match(/\b(?:pozdravljeni|pozdrav|nastanitev|rezervacij|oseb|odrasl|otrok|prosto|koča|hiška|ribolov|želimo|želeli|prosimo|sporočite|lahko|bivali|prihod|odhod|cena|noči|telefon|lastnim|pomolom|hvala|lep pozdrav)\w*/giu)||[]).length
       + ((text.match(/[čšž]/giu)||[]).length ? 2 : 0)
  };
  const best=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  return best[0][1]>0 && best[0][1]>best[1][1] ? best[0][0] : 'unknown';
}
export function replySummary(language='hu', {arrival=null,departure=null,guests=null,adults:knownAdults=null,children=null,childAges=[],pier=false,hotTub=false,dog=false}={}){
  if(!arrival||!departure||!guests) return '';
  const fmtNumeric=iso=>{const [y,m,d]=iso.split('-');return `${d}.${m}.${y}`;};
  const enMonths=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const fmtEnglish=iso=>{const [y,m,d]=iso.split('-');return `${Number(d)} ${enMonths[Number(m)-1]} ${y}`;};
  const adults=Number.isInteger(knownAdults)?knownAdults:Number.isFinite(children)?Math.max(0,guests-children):null;
  const ageList=(lang)=>{
    if(!Array.isArray(childAges)||!childAges.length) return '';
    if(childAges.length===1) return String(childAges[0]);
    const joiner={hu:' és ',de:' und ',en:' and ',si:' in '}[lang]||' and ';
    if(childAges.length===2) return childAges.join(joiner);
    return childAges.slice(0,-1).join(', ')+joiner+childAges.at(-1);
  };
  const siAdults=n=>{
    if(n===1)return '1 odrasla oseba';
    if(n===2)return '2 odrasli osebi';
    if(n===3||n===4)return `${n} odrasle osebe`;
    return `${n} odraslih oseb`;
  };
  const siChildren=n=>{
    if(n===1)return '1 otrok';
    if(n===2)return '2 otroka';
    if(n===3||n===4)return `${n} otroci`;
    return `${n} otrok`;
  };
  const packs={
    hu:{
      people:()=>children?`${guests} fő (${adults} felnőtt és ${children} gyermek${ageList('hu')?`, ${ageList('hu')} ${children===1?'éves':'évesek'}`:''})`:`${guests} fő${adults!==null?` (${adults} felnőtt)`:''}`,
      base:p=>`${fmtNumeric(arrival)} és ${fmtNumeric(departure)} között ${p} részére keresnek szállást.`,
      pier:'Ha lehetséges, saját / külön stéget kérnek.',
      hotTub:'Dézsát is szeretnének.',
      dog:'Kutyát is hoznának.'
    },
    de:{
      people:()=>children?`${guests} Personen (${adults} Erwachsene und ${children} ${children===1?'Kind':'Kinder'}${ageList('de')?` im Alter von ${ageList('de')} Jahren`:''})`:`${guests} Personen`,
      base:p=>`Sie möchten vom ${fmtNumeric(arrival)} bis ${fmtNumeric(departure)} mit ${p} bei uns übernachten.`,
      pier:'Wenn möglich, wünschen Sie ein Haus mit eigenem Steg.',
      hotTub:'Außerdem wünschen Sie ein Badefass / einen Whirlpool.',
      dog:'Sie möchten einen Hund mitbringen.'
    },
    en:{
      people:()=>children?`${guests} guests (${adults} adults and ${children} ${children===1?'child':'children'}${ageList('en')?`, aged ${ageList('en')}`:''})`:`${guests} guests`,
      base:p=>`You would like to stay with us from ${fmtEnglish(arrival)} to ${fmtEnglish(departure)} with ${p}.`,
      pier:'If possible, you would like a cabin with its own fishing pier.',
      hotTub:'You would also like a hot tub.',
      dog:'You would like to bring a dog.'
    },
    si:{
      people:()=>children?`${guests} oseb (${siAdults(adults)} in ${siChildren(children)}${ageList('si')?`; starost otrok: ${ageList('si')} let`:''})`:`${guests} oseb`,
      base:p=>`Pri nas želite bivati od ${fmtNumeric(arrival)} do ${fmtNumeric(departure)}, skupaj ${p}.`,
      pier:'Če je mogoče, želite hiško z lastnim pomolom.',
      hotTub:'Želite tudi masažno / vročo kad.',
      dog:'S seboj želite pripeljati psa.'
    }
  };
  const pack=packs[language]||packs.hu;
  const extras=[pier?pack.pier:null,hotTub?pack.hotTub:null,dog?pack.dog:null].filter(Boolean).join(' ');
  return `${pack.base(pack.people())}${extras?' '+extras:''}`;
}

export function replyQuestions(language='hu', {needDates=false,needAdults=false,needChildStatus=false,needPhone=false,needCabin=false,needChildAge=false,guests=null}={}){
  const q={
    hu:{dates:'Kérjük, írja meg a pontos érkezési és távozási dátumot.',adults:'Kérjük, írja meg, hány felnőtt érkezik.',childStatus:'Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is.',phone:'Megírna egy telefonszámot, amelyen elérhetjük?',cabin:'Melyik háztípust szeretné: VIP, Családi, Deluxe vagy Osztott?',cabinTwo:'Melyik háztípust szeretné: VIP, Családi, Deluxe, Osztott vagy Különálló 2 fős?',child:'Kérjük, írja meg a gyermek életkorát, több gyermek esetén mindegyikét.'},
    de:{dates:'Könnten Sie uns bitte das genaue An- und Abreisedatum nennen?',adults:'Wie viele Erwachsene reisen an?',childStatus:'Reisen auch Kinder mit? Falls ja, wie alt sind sie?',phone:'Könnten Sie uns bitte noch eine Telefonnummer mitteilen, unter der wir Sie erreichen können?',cabin:'Welchen Haustyp wünschen Sie: VIP, Familienhaus, Deluxe oder geteiltes Haus?',cabinTwo:'Welchen Haustyp wünschen Sie: VIP, Familienhaus, Deluxe, geteiltes Haus oder freistehende Hütte für 2 Personen?',child:'Wie alt sind die mitreisenden Kinder?'},
    en:{dates:'Could you please confirm the exact arrival and departure dates?',adults:'Could you please tell us how many adults will be staying?',childStatus:'Will any children be staying with you? If so, please let us know their ages.',phone:'Could you please send us a phone number where we can reach you?',cabin:'Which cabin type would you like: VIP, Family cabin, Deluxe or Split cabin?',cabinTwo:'Which cabin type would you like: VIP, Family cabin, Deluxe, Split cabin or the standalone 2-person cabin?',child:"Could you please tell us the children's ages?"},
    si:{dates:'Prosimo, sporočite točen datum prihoda in odhoda.',adults:'Prosimo, sporočite, koliko odraslih oseb bo prišlo.',childStatus:'Prosimo, sporočite, ali bodo z vami tudi otroci. Če bodo z vami otroci, prosimo navedite tudi njihovo starost.',phone:'Prosimo, sporočite telefonsko številko, na kateri ste dosegljivi.',cabin:'Kateri tip hiške želite: VIP, Družinska hiška, Deluxe ali Deljena hiška?',cabinTwo:'Kateri tip hiške želite: VIP, Družinska hiška, Deluxe, Deljena hiška ali samostojna hiška za 2 osebi?',child:'Prosimo, sporočite starost otrok.'}
  }[language]||null;
  if(!q) return [];
  const cabinQuestion=Number(guests)===2?q.cabinTwo:q.cabin;
  return [needDates&&q.dates,needAdults&&q.adults,needChildStatus&&q.childStatus,needChildAge&&q.child,needPhone&&q.phone,needCabin&&cabinQuestion].filter(Boolean);
}


function bookingQuestionFlags(text=''){
  const general=/(?:foglalási\s+(?:feltételek|szabályok)|hogyan\s+(?:lehet|tudok|tudunk)\s+foglalni|booking\s+(?:conditions|terms)|buchungsbedingungen|reservierungsbedingungen|rezervacijski\s+pogoji|pogoji\s+rezervacije)/iu.test(text);
  const depositAmount=general||/(?:mekkora|mennyi(?:\s+az|\s+a)?|hány\s*%)\s*(?:előleg|foglaló)|(?:előleg|foglaló)[^.!?\n]{0,80}(?:mekkora|mennyi|hány\s*%)|(?:how\s+much|what\s+percentage)[^.!?\n]{0,80}(?:deposit)|(?:deposit)[^.!?\n]{0,80}(?:how\s+much|what\s+percentage)|(?:wie\s+hoch|wie\s+viel)[^.!?\n]{0,80}(?:anzahlung)|(?:anzahlung)[^.!?\n]{0,80}(?:wie\s+hoch|wie\s+viel)|(?:kolikšno|koliko)[^.!?\n]{0,80}(?:predplačilo)|(?:predplačilo)[^.!?\n]{0,80}(?:kolikšno|koliko)/iu.test(text);
  const depositDeadline=general||/(?:hány\s+nap|mennyi\s+(?:nap|idő))[^.!?\n]{0,100}(?:előleg|foglaló)|(?:előleg|foglaló)[^.!?\n]{0,120}(?:mikor|meddig|határidő|hány\s+nap|mennyi\s+idő|befizet|átutal)|(?:when|how\s+soon)[^.!?\n]{0,100}(?:deposit)[^.!?\n]{0,60}(?:paid|due)?|(?:deposit)[^.!?\n]{0,100}(?:when|due|paid)|(?:wann|bis\s+wann)[^.!?\n]{0,100}(?:anzahlung)|(?:anzahlung)[^.!?\n]{0,100}(?:wann|fällig|bezahlt)|(?:kdaj|do\s+kdaj)[^.!?\n]{0,100}(?:predplačilo)|(?:predplačilo)[^.!?\n]{0,100}(?:kdaj|rok|plač)/iu.test(text);
  const cancellation=general||/(?:lemondási\s+(?:feltétel|szabály|határidő)|meddig[^.!?\n]{0,60}lemond|hány\s+nap[^.!?\n]{0,60}lemond|cancellation\s+(?:conditions|terms|deadline)|stornierungsbedingungen|stornofrist|pogoji\s+odpovedi|odpovedn(?:i|e)\s+pogoji)/iu.test(text);
  return {general,depositAmount,depositDeadline,cancellation};
}
function bookingPolicyLines(language='hu',original='',guests=null,rules=null){
  if(!rules) return [];
  const q=bookingQuestionFlags(original), lines=[];
  const lang=['hu','de','en','si'].includes(language)?language:'hu';
  if(q.depositAmount){
    const g=Number(guests);
    const knownGuests=Number.isFinite(g)&&g>0;
    const under15=Number(rules.depositPctUnder15Guests ?? rules.depositPct);
    const from15=Number(rules.depositPctFrom15Guests ?? rules.depositPct);
    const pct=knownGuests?(g<15?under15:from15):null;
    if(Number.isFinite(pct)) lines.push({
      hu:`A foglaláshoz ${pct}% előleg szükséges.`,
      de:`Für die Buchung ist eine Anzahlung von ${pct}% erforderlich.`,
      en:`A ${pct}% deposit is required for the booking.`,
      si:`Za rezervacijo je potrebno ${pct}% predplačilo.`
    }[lang]);
    else if(Number.isFinite(under15)&&Number.isFinite(from15)&&under15!==from15) lines.push({
      hu:`Az előleg mértéke létszámfüggő: 15 fő alatt ${under15}%, 15 főtől ${from15}%.`,
      de:`Die Anzahlung hängt von der Gruppengröße ab: unter 15 Personen ${under15}%, ab 15 Personen ${from15}%.`,
      en:`The deposit depends on group size: ${under15}% for fewer than 15 guests and ${from15}% for 15 guests or more.`,
      si:`Višina predplačila je odvisna od velikosti skupine: ${under15}% za manj kot 15 oseb in ${from15}% za 15 oseb ali več.`
    }[lang]);
  }
  if(q.depositDeadline&&Number.isFinite(Number(rules.depositDueDays))){
    const days=Number(rules.depositDueDays);
    lines.push({
      hu:`Az előleget a foglalási szándék rögzítésétől számított ${days} napon belül kell befizetni; ha ez határidőn belül nem érkezik meg, a foglalást töröljük.`,
      de:`Die Anzahlung muss innerhalb von ${days} Tagen nach Erfassung der Buchungsabsicht eingehen; andernfalls wird die Buchung storniert.`,
      en:`The deposit must be paid within ${days} days after the booking request is recorded; if it is not received by then, the booking is cancelled.`,
      si:`Predplačilo mora biti poravnano v ${days} dneh po evidentiranju namere rezervacije; če ga do takrat ne prejmemo, se rezervacija prekliče.`
    }[lang]);
  }
  if(q.general)lines.push({hu:'A foglalás az előleg beérkezése után válik véglegessé.',de:'Die Buchung wird erst nach Eingang der Anzahlung verbindlich.',en:'The booking becomes final once the deposit has been received.',si:'Rezervacija postane dokončna po prejemu predplačila.'}[lang]);
  if(q.cancellation&&guests!==null&&guests!==undefined&&Number(guests)>0){
    const g=Number(guests);
    const days=g<15?Number(rules.cancellationDaysUnder15Guests):Number(rules.cancellationDaysFrom15Guests);
    if(Number.isFinite(days)){
      lines.push({
        hu:`${g<15?'15 fő alatti':'15 fő vagy nagyobb'} foglalásnál a lemondási határidő az érkezés előtt ${days} nap.`,
        de:`Bei Buchungen ${g<15?'mit weniger als 15 Personen':'ab 15 Personen'} beträgt die Stornierungsfrist ${days} Tage vor der Anreise.`,
        en:`For bookings ${g<15?'with fewer than 15 guests':'of 15 guests or more'}, the cancellation deadline is ${days} days before arrival.`,
        si:`Pri rezervacijah ${g<15?'za manj kot 15 oseb':'za 15 oseb ali več'} je rok za odpoved ${days} dni pred prihodom.`
      }[lang]);
    }
  }
  return lines;
}


function operationalTopicLines(language='hu',original='',rules=null,caseContext=null){
  if(!rules||!original) return [];
  const lang=['hu','de','en','si'].includes(language)?language:'hu';
  const asks={
    electricity:/(?:áram|villany|mérőóra|electricity|power\s+consumption|strom|stromverbrauch|elektrik|elektrika)/iu.test(original),
    firewood:/(?:tűzifa|tüzifa|firewood|brennholz|drva)/iu.test(original),
    parking:/(?:parkol|parking|parkplatz|parkplätze|parkiriš|parkiris|\b(?:cars?|vehicles?)\b|\bautos?\b|\bvozil\w*\b)/iu.test(original),
    arrival:/(?:érkez|check[- ]?in|arriv|ankunft|anreise|prihod)/iu.test(original),
    departure:/(?:távoz|kijelentkez|check[- ]?out|what\s+time[^.!?\n]{0,40}(?:leave|departure)|abreise|abreisen|odhod)/iu.test(original),
    returning:/(?:törzsvend|visszatérő|korábban[^.!?\n]{0,80}(?:száll|járt)|returning\s+guest|stayed[^.!?\n]{0,100}(?:before|ago)|previous\s+stay|stammgast|schon[^.!?\n]{0,80}(?:bei\s+ihnen|übernachtet)|povratn|že[^.!?\n]{0,80}bivali)/iu.test(original),
    pet:/(?:kuty|háziállat|dog|pet\b|hund|haustier|pes|psa)/iu.test(original),
    hotTub:/(?:dézs|dézsafürdő|hot[ -]?tub|whirlpool|badefass|vroč\w*\s*kad|masaž\w*\s*kad)/iu.test(original)
  };
  const lines=[];
  if(asks.electricity&&rules.electricitySettlement==='metered_separate') lines.push({
    hu:'Az áramfogyasztás külön fizetendő a tényleges fogyasztás alapján; a pontos végösszeg a mérőállás után állapítható meg.',
    de:'Der Stromverbrauch wird separat nach dem tatsächlichen Verbrauch berechnet; der genaue Betrag steht erst nach dem Ablesen des Zählers fest.',
    en:'Electricity is charged separately according to actual consumption; the exact amount can only be determined after the meter is read.',
    si:'Elektrika se obračuna posebej glede na dejansko porabo; natančen znesek je mogoče določiti šele po odčitku števca.'
  }[lang]);
  if(asks.firewood&&rules.firewood==='surcharge_price_unverified') lines.push({
    hu:'Tűzifa elérhető felár ellenében; a pontos díjat még kezelői ellenőrzéssel kell megerősíteni.',
    de:'Brennholz ist gegen Aufpreis erhältlich; der genaue Preis muss noch vom Betreiber bestätigt werden.',
    en:'Firewood is available for an additional charge; the exact fee still needs to be confirmed by the operator.',
    si:'Drva so na voljo z doplačilom; natančno ceno mora še potrditi upravljavec.'
  }[lang]);
  if(!caseContext&&asks.parking&&rules.parking==='available_large_group_review') lines.push({
    hu:'Parkolási lehetőség biztosított; több autó esetén a rendelkezésre álló helyet külön ellenőrizzük.',
    de:'Parkmöglichkeiten sind vorhanden; bei mehreren Fahrzeugen prüfen wir die verfügbaren Stellplätze separat.',
    en:'Parking is available; for several vehicles we will confirm the available spaces separately.',
    si:'Parkiranje je na voljo; pri več vozilih posebej preverimo razpoložljiva parkirna mesta.'
  }[lang]);
  const arrivalMatch=
    original.match(/(?:érkez|check[- ]?in|arriv|ankunft|anreise|prihod)[^!?\n]{0,80}?(?<!\d)((?:[01]?\d|2[0-3])[:.][0-5]\d)(?!\d)(?:\s*(AM|PM)\b)?/iu)
    || original.match(/(?<!\d)((?:[01]?\d|2[0-3])[:.][0-5]\d)(?!\d)(?:\s*(AM|PM)\b)?[^!?\n]{0,40}(?:érkez|check[- ]?in|arriv|ankunft|anreise|prihod)/iu);
  let arrivalTime=arrivalMatch?.[1];
  if(arrivalTime&&arrivalMatch[2]){
    const [h,m]=arrivalTime.split(/[:.]/u).map(Number);
    if(h>=1&&h<=12)arrivalTime=String(h%12+(arrivalMatch[2].toUpperCase()==='PM'?12:0)).padStart(2,'0')+':'+String(m).padStart(2,'0');
    else arrivalTime=null;
  }
  if(asks.arrival&&rules.reception24h&&arrivalTime) lines.push({
    hu:`Az érkezés ${arrivalTime}-kor megoldható; 24 órás portaszolgálat működik.`,
    de:`Eine Anreise gegen ${arrivalTime} ist möglich; es gibt einen 24-Stunden-Portierdienst.`,
    en:`Arrival at around ${arrivalTime} is possible; there is 24-hour reception/porter service.`,
    si:`Prihod okoli ${arrivalTime} je mogoč; na voljo je 24-urna receptorska/portirska služba.`
  }[lang]);
  else if(asks.arrival&&rules.checkinFrom) lines.push({
    hu:`A szállás elfoglalása az érkezés napján ${rules.checkinFrom}-tól lehetséges.`,
    de:`Am Anreisetag ist der Check-in ab ${rules.checkinFrom} Uhr möglich.`,
    en:`On the day of arrival, check-in is available from ${rules.checkinFrom}.`,
    si:`Na dan prihoda je prijava mogoča od ${rules.checkinFrom} dalje.`
  }[lang]);
  if(asks.departure&&rules.checkoutBy) lines.push({
    hu:`A szállást a távozás napján ${rules.checkoutBy}-ig kell elhagyni.`,
    de:`Am Abreisetag ist die Unterkunft bis ${rules.checkoutBy} Uhr zu verlassen.`,
    en:`On the day of departure, the accommodation must be vacated by ${rules.checkoutBy}.`,
    si:`Na dan odhoda je treba nastanitev zapustiti do ${rules.checkoutBy}.`
  }[lang]);
  if(asks.returning&&Number.isFinite(Number(rules.returningGuestDiscountPct))&&Number.isFinite(Number(rules.returningGuestLookbackDays))){
    const pct=Number(rules.returningGuestDiscountPct),days=Number(rules.returningGuestLookbackDays);
    lines.push({
      hu:`A visszatérő vendég kedvezmény lehetséges mértéke ${pct}%, ha az előző tartózkodás utolsó napja ${days} napon belül volt és a vendég szerepel a vendégkönyvben. Ezt a korábbi foglalás alapján külön ellenőrizni kell; a kedvezményt most nem alkalmazzuk automatikusan.`,
      de:`Für wiederkehrende Gäste kann ein Rabatt von ${pct}% gelten, wenn der letzte Aufenthalt höchstens ${days} Tage zurückliegt und der Gast im Gästebuch geführt wird. Dies muss anhand der früheren Buchung separat geprüft werden; der Rabatt wird nicht automatisch angewendet.`,
      en:`A returning-guest discount of ${pct}% may apply if the last day of the previous stay was within ${days} days and the guest is recorded in the guest book. This must be checked against the previous booking; the discount is not applied automatically.`,
      si:`Za povratne goste je lahko na voljo ${pct}% popust, če je bil zadnji dan prejšnjega bivanja v zadnjih ${days} dneh in je gost vpisan v knjigo gostov. To je treba posebej preveriti po prejšnji rezervaciji; popust se ne uporabi samodejno.`
    }[lang]);
  }
  if(asks.pet&&rules.petAllowedForFee){
    const petFee=Number(rules.petFeeHufPerPetPerDay);
    const hasVerifiedPetFee=rules.petFeeVerified&&Number.isFinite(petFee)&&petFee>=0;
    const feeText=hasVerifiedPetFee?String(petFee).replace(/\B(?=(\d{3})+(?!\d))/g,' '):null;
    lines.push({
      hu:hasVerifiedPetFee?`Háziállat hozható, díja ${feeText} Ft/nap/állat.`:'Háziállat hozható térítés ellenében; a pontos díjat kezelői ellenőrzéssel kell megerősíteni.',
      de:hasVerifiedPetFee?`Haustiere sind erlaubt; die Gebühr beträgt ${feeText} Ft pro Tag und Tier.`:'Haustiere sind gegen Aufpreis erlaubt; die genaue Gebühr muss vom Betreiber bestätigt werden.',
      en:hasVerifiedPetFee?`Pets are allowed; the fee is ${feeText} Ft per pet per day.`:'Pets are allowed for an additional charge; the exact fee must be confirmed by the operator.',
      si:hasVerifiedPetFee?`Hišni ljubljenčki so dovoljeni; pristojbina znaša ${feeText} Ft na žival na dan.`:'Hišni ljubljenčki so dovoljeni z doplačilom; natančno pristojbino mora potrditi upravljavec.'
    }[lang]);
  }
  if(!caseContext&&asks.hotTub&&rules.hotTubAvailabilityRequiresCheck){
    const separate=rules.hotTubSeparateRental===true;
    lines.push({
      hu:separate?(rules.hotTubFeeVerified?'A dézsa külön bérelhető, nem tartozik automatikusan a házhoz. Az elérhetőségét külön ellenőrizzük; a beállított díj alkalmazható.':'A dézsa külön bérelhető, nem tartozik automatikusan a házhoz. Az elérhetőségét és díját külön ellenőrizzük; pontos dézsadíjat csak hiteles ellenőrzés után adunk meg.'):(rules.hotTubFeeVerified?'A dézsa elérhetőségét külön ellenőrizzük; a beállított díj alkalmazható.':'A dézsa elérhetőségét és díját külön ellenőrizzük; pontos dézsadíjat csak hiteles ellenőrzés után adunk meg.'),
      de:separate?(rules.hotTubFeeVerified?'Das Badefass kann separat gemietet werden und gehört nicht automatisch zur Unterkunft. Die Verfügbarkeit wird separat geprüft; die hinterlegte Gebühr kann angewendet werden.':'Das Badefass kann separat gemietet werden und gehört nicht automatisch zur Unterkunft. Verfügbarkeit und Preis werden separat geprüft; einen genauen Preis nennen wir erst nach bestätigter Prüfung.'):(rules.hotTubFeeVerified?'Die Verfügbarkeit des Badefasses wird separat geprüft; die hinterlegte Gebühr kann angewendet werden.':'Verfügbarkeit und Preis des Badefasses werden separat geprüft; einen genauen Preis nennen wir erst nach bestätigter Prüfung.'),
      en:separate?(rules.hotTubFeeVerified?'The hot tub is rented separately and is not automatically included with the house. Availability is checked separately; the configured fee can be applied.':'The hot tub is rented separately and is not automatically included with the house. Availability and its charge are checked separately; we only quote the exact hot-tub fee after a verified check.'):(rules.hotTubFeeVerified?'Hot-tub availability is checked separately; the configured fee can be applied.':'Hot-tub availability and its charge are checked separately; we only quote the exact hot-tub fee after a verified check.'),
      si:separate?(rules.hotTubFeeVerified?'Masažna kad se najame posebej in ni samodejno vključena v nastanitev. Razpoložljivost preverimo posebej; uporabi se lahko nastavljena pristojbina.':'Masažna kad se najame posebej in ni samodejno vključena v nastanitev. Razpoložljivost in doplačilo preverimo posebej; natančno ceno navedemo šele po zanesljivem preverjanju.'):(rules.hotTubFeeVerified?'Razpoložljivost vroče kadi preverimo posebej; uporabi se lahko nastavljena pristojbina.':'Razpoložljivost in doplačilo za vročo kad preverimo posebej; natančno ceno navedemo šele po zanesljivem preverjanju.')
    }[lang]);
  }
  return lines;
}


function pricingTopicLines(language='hu',original='',arrival=null,departure=null,rules=null){
  const lang=['hu','de','en','si'].includes(language)?language:'hu';
  const lines=[];
  const asksSeason=/(?:szezonfelár|főszezon|seasonal\s+surcharge|high[- ]season|saisonaufschlag|hoch saison|sezonsk\w*\s+doplačil)/iu.test(original);
  const asksTax=/(?:idegenforgalmi\s+adó|ifa\b|tourist\s+tax|tourism\s+tax|kurtaxe|turističn\w*\s+tak)/iu.test(original);
  const asksAlternative=/(?:ha[^.!?\n]{0,80}nem[^.!?\n]{0,80}(?:elérhető|szabad)|if[^.!?\n]{0,80}not\s+available|alternative\s+(?:cabin|accommodation)|another\s+suitable|alternative\s+unterkunft|falls[^.!?\n]{0,80}nicht\s+verfügbar|druga\s+nastanitev|alternativn\w*\s+nastanitev)/iu.test(original);
  if(asksSeason&&rules&&Number.isFinite(Number(rules.highSeasonSurchargePct))){
    const pct=Number(rules.highSeasonSurchargePct);
    let overlaps=null;
    if(/^\d{4}-\d{2}-\d{2}$/.test(arrival||'')&&/^\d{4}-\d{2}-\d{2}$/.test(departure||'')&&rules.highSeasonStart&&rules.highSeasonEnd){
      const year=arrival.slice(0,4);
      const start=`${year}-${rules.highSeasonStart}`, end=`${year}-${rules.highSeasonEnd}`;
      overlaps=arrival<=end && departure>start;
    }
    if(overlaps===false) lines.push({
      hu:`A megadott időszak nem esik a ${pct}%-os főszezoni felár időszakába.`,
      de:`Der angegebene Zeitraum liegt nicht im Zeitraum des ${pct}%-Saisonaufschlags.`,
      en:`The requested dates are outside the period with the ${pct}% high-season surcharge.`,
      si:`Izbrani termin je zunaj obdobja ${pct}% sezonskega doplačila.`
    }[lang]);
    else if(overlaps===true) lines.push({
      hu:`A megadott időszak érinti a ${pct}%-os főszezoni felár időszakát; ez a szállásdíjra vonatkozik, a dézsára nem.`,
      de:`Der angegebene Zeitraum überschneidet sich mit dem ${pct}%-Saisonaufschlag; dieser gilt für die Unterkunft, nicht für das Badefass.`,
      en:`The requested dates overlap the ${pct}% high-season surcharge period; it applies to accommodation, not to the hot tub.`,
      si:`Izbrani termin se prekriva z obdobjem ${pct}% sezonskega doplačila; velja za nastanitev, ne za vročo kad.`
    }[lang]);
    else lines.push({
      hu:`A főszezoni felár ${pct}%; a pontos alkalmazását a megadott dátumok alapján ellenőrizzük.`,
      de:`Der Saisonaufschlag beträgt ${pct}%; die genaue Anwendung prüfen wir anhand der Reisedaten.`,
      en:`The high-season surcharge is ${pct}%; its exact application will be checked against the requested dates.`,
      si:`Sezonsko doplačilo znaša ${pct}%; natančno uporabo preverimo glede na izbrane datume.`
    }[lang]);
  }
  if(asksTax&&rules&&Number.isFinite(Number(rules.tourismTaxAdultNightlyHuf))){
    const tax=Number(rules.tourismTaxAdultNightlyHuf).toLocaleString('hu-HU');
    lines.push({
      hu:`Az idegenforgalmi adó jelenlegi beállított összege ${tax} Ft / felnőtt / éjszaka; a végösszegben ezt is külön ellenőrizzük.`,
      de:`Die aktuell hinterlegte Kurtaxe beträgt ${tax} Ft pro Erwachsenem und Nacht; sie wird in der Gesamtsumme separat geprüft.`,
      en:`The currently configured tourist tax is ${tax} HUF per adult per night; it will also be checked separately in the final total.`,
      si:`Trenutno nastavljena turistična taksa je ${tax} HUF na odraslo osebo na noč; posebej jo preverimo tudi v končnem znesku.`
    }[lang]);
  }
  if(asksAlternative) lines.push({
    hu:'Ha a kért háztípus nem elérhető, megfelelő másik háztípust vagy több egységből álló megoldást is ellenőrzünk; ezt csak a tényleges szabad kapacitás alapján javasoljuk.',
    de:'Falls der gewünschte Haustyp nicht verfügbar ist, prüfen wir auch einen passenden anderen Haustyp oder eine Kombination mehrerer Einheiten; einen Vorschlag machen wir erst anhand der tatsächlichen Verfügbarkeit.',
    en:'If the requested cabin type is unavailable, we will also check another suitable cabin type or a combination of units; any suggestion will be based on actual availability.',
    si:'Če želeni tip hiške ni na voljo, preverimo tudi drug primeren tip ali kombinacijo več enot; predlog podamo šele na podlagi dejanske razpoložljivosti.'
  }[lang]);
  return lines;
}

function cabinDisplayName(cabin,language='hu'){
  const lang=['hu','de','en','si'].includes(language)?language:'hu';
  const names={
    'Családi':{hu:'Családi',de:'Familienhaus',en:'Family cabin',si:'Družinska hiška'},
    'Osztott':{hu:'Osztott',de:'Geteiltes Haus',en:'Split cabin',si:'Deljena hiška'},
    'Különálló 2 fős':{hu:'Különálló 2 fős',de:'Freistehende Hütte für 2 Personen',en:'Standalone 2-person cabin',si:'Samostojna hiška za 2 osebi'}
  };
  return names[cabin]?.[lang]||cabin;
}

function capacityOptionText(guests,language='hu'){
  const lang=['hu','de','en','si'].includes(language)?language:'hu';
  const family=cabinDisplayName('Családi',lang);
  if(Number(guests)<=6)return `Deluxe, ${family}, VIP`;
  if(Number(guests)<=7)return `${family}, VIP`;
  if(Number(guests)<=8)return family;
  return {hu:'több ház',de:'mehrere Häuser',en:'multiple cabins',si:'več hišk'}[lang];
}

export function buildReplyDraft({language='hu',name=null,original='',arrival=null,departure=null,guests=null,adults=null,children=null,childAges=[],phone=null,cabin='? – emberi döntésre vár',pier=false,hotTub=false,dog=false,intent='booking_request',brandName='Sárberki Horgásztó',bookingRules=null,operationalRules=null,pricingRules=null,knowledgeLines=[],caseContext=null}={}){
  original=activeMessageText(original);
  const lang=['hu','de','en','si'].includes(language)?language:'hu';
  const flags=requestFlagsFromText(original);
  if(/kuty|dog|hund|\\bpes\\b|\\bpsa\\b/iu.test(original)) dog=flags.petRequested;
  if(/dézs|dezsa|hot.?tub|badefass|whirlpool/iu.test(original)) hotTub=flags.hotTubRequested;

  const resolvedName=name?.trim()||nameFromText(original);
  const nameParts=resolvedName?.replace(/^["']|["']$/gu,'').split(/\s+/u).filter(Boolean)||[];
  const first=nameParts.length?(lang==='hu'?nameParts.at(-1):nameParts[0]):null;
  const greetings={hu:first?`Kedves ${first}!`:'Kedves Vendégünk!',de:first?`Guten Tag, ${first}!`:'Guten Tag!',en:first?`Dear ${first},`:'Dear Guest,',si:first?`Pozdravljeni, ${first}!`:'Pozdravljeni!'};
  const intros={hu:'Köszönjük érdeklődését.',de:'Vielen Dank für Ihre Anfrage.',en:'Thank you for your enquiry.',si:'Hvala za vaše povpraševanje.'};
  const closings={hu:'Üdvözlettel:',de:'Mit freundlichen Grüßen',en:'Kind regards,',si:'Lep pozdrav'};
  const titles={
    hu:{stay:'Szállás',extras:'Kiegészítő információk',price:'Ár és díjak',fishing:'Horgászat',booking:'Foglalási feltételek',missing:'Pontosítandó adatok'},
    de:{stay:'Unterkunft',extras:'Weitere Informationen',price:'Preis und Gebühren',fishing:'Angeln',booking:'Buchungsbedingungen',missing:'Noch benötigte Angaben'},
    en:{stay:'Accommodation',extras:'Additional information',price:'Price and charges',fishing:'Fishing',booking:'Booking terms',missing:'Details still needed'},
    si:{stay:'Nastanitev',extras:'Dodatne informacije',price:'Cena in doplačila',fishing:'Ribolov',booking:'Pogoji rezervacije',missing:'Podatki za dopolnitev'}
  }[lang];

  if(intent==='cancellation_request'||intent==='modification_request'){
    const action={hu:intent==='cancellation_request'?'lemondási':'foglalásmódosítási',de:intent==='cancellation_request'?'Stornierungs':'Änderungs',en:intent==='cancellation_request'?'cancellation':'booking change',si:intent==='cancellation_request'?'odpovedi':'spremembe rezervacije'}[lang]||'foglalási';
    const received={hu:`Megkaptuk a ${action} kérelmét. Hamarosan pontos visszajelzést adunk.`,de:`Wir haben Ihre ${action}anfrage erhalten und prüfen sie.`,en:`We have received your ${action} request and will review it.`,si:`Prejeli smo vašo zahtevo za ${action} in jo bomo preverili.`}[lang];
    return `${greetings[lang]}\n\n${received}\n\n${closings[lang]}\n${brandName}`;
  }

  const mismatch=Number.isInteger(guests)&&Number.isInteger(adults)&&Number.isInteger(children)&&guests!==adults+children;
  const summary=mismatch?'':replySummary(lang,{arrival,departure,guests,adults,children,childAges,pier,hotTub,dog});
  const needCabin=!cabin||String(cabin).startsWith('?')||cabinFromText(String(cabin)).startsWith('?');
  const needDates=!arrival||!departure;
  const mustClarifyCabin=needCabin&&cabinClarificationRequired(original,guests);
  const canRecommendByCapacity=needCabin&&!mustClarifyCabin&&!needDates&&Number.isInteger(Number(guests))&&Number(guests)>0;
  const derivedAdults=(children!==null&&children!==undefined&&children!==''&&Number.isInteger(Number(guests))&&Number.isInteger(Number(children))&&Number(children)>=0&&Number(guests)>=Number(children)&&!mismatch)?Number(guests)-Number(children):null;
  const effectiveAdults=(Number.isInteger(Number(adults))&&Number(adults)>0)?Number(adults):derivedAdults;
  const needAdults=!(Number.isInteger(effectiveAdults)&&effectiveAdults>0);
  const childStatusKnown=children!==null&&children!==undefined&&children!==''&&Number.isInteger(Number(children))&&Number(children)>=0;
  const needChildStatus=!childStatusKnown;
  const needChildAge=childStatusKnown&&Number(children)>0&&childAges.length<Number(children);
  const questions=replyQuestions(lang,{needDates,needAdults,needChildStatus,needPhone:!phone,needCabin:needCabin&&!canRecommendByCapacity,needChildAge,guests});
  if(mismatch) questions.unshift({hu:'Kérjük, pontosítsa a létszámot: az összlétszám eltér a megadott felnőttek és gyermekek összegétől.',de:'Bitte klären Sie die Personenzahl: Die Gesamtzahl stimmt nicht mit der Zahl der Erwachsenen und Kinder überein.',en:'Please clarify the party size: the total differs from the number of adults and children.',si:'Prosimo, pojasnite število gostov: skupno število se ne ujema s številom odraslih in otrok.'}[lang]);

  const stayLines=[];
  if(summary) stayLines.push(summary);
  if(!needCabin){
    const displayCabin=cabinDisplayName(cabin,lang);
    stayLines.push({hu:`A kért háztípus: ${displayCabin}.`,de:`Gewünschter Haustyp: ${displayCabin}.`,en:`Requested cabin type: ${displayCabin}.`,si:`Želeni tip hiške: ${displayCabin}.`}[lang]);
  }else if(canRecommendByCapacity){
    stayLines.push({
      hu:'A megadott létszám alapján megkeressük a megfelelő szabad szállástípusokat.',
      de:'Anhand der angegebenen Personenzahl suchen wir die passenden verfügbaren Unterkunftstypen.',
      en:'Based on the stated party size, we will find the suitable available accommodation types.',
      si:'Glede na navedeno število gostov poiščemo primerne razpoložljive vrste nastanitve.'
    }[lang]);
  }

  const asksAvailability=/(?:szabad|elérhető|van[- ]?e .*szállás|van.*hely|available|frei|prosto|verfügbar|razpolož)/iu.test(original);
  const asksPrice=/(?:mennyi|mennyibe|ár|ára|árat|price|cost|kosten|preis|cena)/iu.test(original);
  if(asksAvailability&&!canRecommendByCapacity) stayLines.push({
    hu:'A megadott időszak szabad kapacitását megnézzük.',
    de:'Wir prüfen die freie Kapazität für den gewünschten Zeitraum.',
    en:'We will check availability for the requested dates.',
    si:'Preverimo proste kapacitete za izbrani termin.'
  }[lang]);

  const operationalLines=operationalTopicLines(lang,original,operationalRules,caseContext);
  if(caseContext) operationalLines.push(...caseContext.extraLines);
  const pricingLines=pricingTopicLines(lang,original,arrival,departure,pricingRules);
  if(asksPrice&&!caseContext?.priceApproved) pricingLines.push({
    hu:'A teljes árat a ténylegesen szabad lehetőség alapján adjuk meg.',
    de:'Den Gesamtpreis nennen wir anhand der tatsächlich verfügbaren Möglichkeit.',
    en:'We will quote the total price for the option that is actually available.',
    si:'Skupno ceno navedemo za možnost, ki je dejansko na voljo.'
  }[lang]);

  const fishingAsked=/(?:horgász|horgasz|angeln|fish(?:ing)?|ribolov|ribe)/iu.test(original);
  const fishingLines=fishingAsked&&Array.isArray(knowledgeLines)?knowledgeLines.filter(Boolean):[];
  if(caseContext) pricingLines.push(...caseContext.priceLines);
  const bookingLines=caseContext?caseContext.bookingLines:bookingPolicyLines(lang,original,guests,bookingRules);
  if(caseContext?.availabilityLines?.length) {
    if(canRecommendByCapacity||asksAvailability) stayLines.pop();
    stayLines.push(...caseContext.availabilityLines);
  }
  const blocks=[];
  const add=(title,lines)=>{const clean=lines.filter(Boolean);if(clean.length)blocks.push([title,...clean].join('\n'));};
  add(titles.stay,stayLines);
  add(titles.extras,operationalLines);
  add(titles.price,pricingLines);
  add(titles.fishing,fishingLines);
  add(titles.booking,bookingLines);
  add(titles.missing,questions);

  return `${greetings[lang]}\n\n${intros[lang]}${blocks.length?'\n\n'+blocks.join('\n\n'):''}\n\n${closings[lang]}\n${brandName}`;
}

// Preserve explicitly labelled requests without interpreting them as booking facts.
export function specialRequestsFromText(text='') {
  const requests=[];
  const pattern=/(?:^|[.!?\n]\s*)(?:külön\s+kérés|kulon\s+keres|special\s+requests?|besondere(?:r|s)?\s+w(?:u|ü)nsch(?:e)?|posebn(?:a|e)\s+(?:želja|zelja|zahteva))\s*:\s*([^\n.!?]+)/giu;
  for(const match of text.matchAll(pattern)) if(match[1].trim()) requests.push(match[1].trim());
  return requests;
}
