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
export function cabinFromText(text=''){
  const found=[];
  if (/\bvip\b/iu.test(text)) found.push('VIP');
  if (/\b(?:családi|csaladi)\b/iu.test(text)
      || /\bfamily\s+(?:cabin|house|accommodation|unit)\b/iu.test(text)
      || /\b(?:familien(?:haus|hütte|unterkunft)|familien\s+(?:haus|unterkunft))\b/iu.test(text)
      || /\bdružinsk\w*\s+(?:hišk\w*|koč\w*|nastanitev)\b/iu.test(text)) found.push('Családi');
  if (/\bdeluxe\b/iu.test(text)) found.push('Deluxe');
  if (/\b(?:osztott|split|geteilte[rs]?|deljen[ai]?)\b/iu.test(text)) found.push('Osztott');
  return found.length===1 ? found[0] : '? – emberi döntésre vár';
}
export function guestCountFromText(text=''){
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
  const m=text.match(/\b(\d{1,2})\s*(?:gyerek\w*|gyermek\w*|children|child|kinder|kind|(?:otrok|otroc)\w*)\b/iu);
  if(m) return Number(m[1]);
  const huWords={egy:1,két:2,ket:2,kettő:2,ketto:2,három:3,harom:3,négy:4,negy:4,öt:5,ot:5,hat:6};
  const hw=text.match(/\b(egy|két|ket|kettő|ketto|három|harom|négy|negy|öt|ot|hat)\s+(?:gyerek\w*|gyermek\w*)\b/iu)?.[1]?.toLocaleLowerCase('hu-HU');
  if(hw) return huWords[hw];
  const siWords={en:1,ena:1,eno:1,dva:2,dve:2,trije:3,tri:3,štirje:4,stirje:4,štiri:4,stiri:4,pet:5,šest:6,sest:6};
  const sw=text.match(/\b(en|ena|eno|dva|dve|trije|tri|štirje|stirje|štiri|stiri|pet|šest|sest)\s+(?:otrok|otroc)\w*\b/iu)?.[1]?.toLocaleLowerCase('sl-SI');
  return sw ? siWords[sw] : null;
}
export function dateRangeFromText(text='', now=new Date(), timeZone='Europe/Budapest'){
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

export function phoneFromText(text=''){
  const m=text.match(/(?:\+\d{1,3}[\s()./-]*)?(?:\d[\s()./-]*){8,15}/u);
  return m ? m[0].trim().replace(/[.,;:]+$/u,'') : null;
}
export function childAgesFromText(text=''){
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
  const open=/\b(?:több|multiple|several|mehrere|več)\s+(?:szállás)?(?:egység\w*|faház\w*|ház\w*|apartman\w*|units?|cabins?|houses?|einheiten|enot\w*)\b/iu.test(text);
  if(open) return {count:null,open:true,evidence:text.match(/\b(?:több|multiple|several|mehrere|več)\s+(?:szállás)?(?:egység\w*|faház\w*|ház\w*|apartman\w*|units?|cabins?|houses?|einheiten|enot\w*)\b/iu)?.[0]||''};
  const m=text.match(/\b(egy|1|két|kettő|2|három|3|négy|4|öt|5|hat|6|one|two|three|four|five|six|ein|eine|zwei|drei|vier|fünf|funf|sechs|en|ena|eno|dva|dve|tri|štiri|stiri|pet|šest|sest)\s+(?:külön\s*)?(?:db\s*)?(?:vip|családi|deluxe|osztott|family|familien|družinsk\w*)?(?:\s*[-–]?\s*)(?:házat?|faházat?|apartmant?|egységet?|cabins?|houses?|units?|cottages?|häuser|hauser|einheiten|hišk\w*|hisk\w*|koč\w*|enot\w*)\b/iu);
  if(!m) return {count:0,open:false,evidence:''};
  const values={egy:1,'1':1,két:2,kettő:2,'2':2,három:3,'3':3,négy:4,'4':4,öt:5,'5':5,hat:6,'6':6,one:1,two:2,three:3,four:4,five:5,six:6,ein:1,eine:1,zwei:2,drei:3,vier:4,'fünf':5,funf:5,sechs:6,en:1,ena:1,eno:1,dva:2,dve:2,tri:3,'štiri':4,stiri:4,pet:5,'šest':6,sest:6};
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
export function replySummary(language='hu', {arrival=null,departure=null,guests=null,children=null,childAges=[],pier=false,hotTub=false,dog=false}={}){
  if(!arrival||!departure||!guests) return '';
  const fmt=iso=>{const [y,m,d]=iso.split('-');return `${d}.${m}.${y}`;};
  const adults=Number.isFinite(children)?Math.max(0,guests-children):null;
  const ageList=(lang)=>{
    if(!Array.isArray(childAges)||!childAges.length) return '';
    if(childAges.length===1) return String(childAges[0]);
    const joiner={hu:' és ',de:' und ',en:' and ',si:' in '}[lang]||' and ';
    if(childAges.length===2) return childAges.join(joiner);
    return childAges.slice(0,-1).join(', ')+joiner+childAges.at(-1);
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
  if(q.cancellation&&Number.isFinite(Number(guests))){
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


function operationalTopicLines(language='hu',original='',rules=null){
  if(!rules||!original) return [];
  const lang=['hu','de','en','si'].includes(language)?language:'hu';
  const asks={
    electricity:/(?:áram|villany|mérőóra|electricity|power\s+consumption|strom|stromverbrauch|elektrik|elektrika)/iu.test(original),
    firewood:/(?:tűzifa|tüzifa|firewood|brennholz|drva)/iu.test(original),
    parking:/(?:parkol|parking|parkplatz|parkplätze|parkiriš|parkiris|\b(?:cars?|vehicles?)\b|\bautos?\b|\bvozil\w*\b)/iu.test(original),
    arrival:/(?:érkez|check[- ]?in|arriv|ankunft|anreise|prihod)[^.!?\n]{0,80}\d{1,2}[:.]\d{2}/iu.test(original),
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
  if(asks.parking&&rules.parking==='available_large_group_review') lines.push({
    hu:'Parkolási lehetőség biztosított; több autó esetén a rendelkezésre álló helyet külön ellenőrizzük.',
    de:'Parkmöglichkeiten sind vorhanden; bei mehreren Fahrzeugen prüfen wir die verfügbaren Stellplätze separat.',
    en:'Parking is available; for several vehicles we will confirm the available spaces separately.',
    si:'Parkiranje je na voljo; pri več vozilih posebej preverimo razpoložljiva parkirna mesta.'
  }[lang]);
  if(asks.arrival&&rules.reception24h&&rules.confirmedLateArrivalExample) lines.push({
    hu:`A ${rules.confirmedLateArrivalExample}-as érkezés megoldható; 24 órás portaszolgálat működik.`,
    de:`Eine Anreise gegen ${rules.confirmedLateArrivalExample} ist möglich; es gibt einen 24-Stunden-Portierdienst.`,
    en:`Arrival at around ${rules.confirmedLateArrivalExample} is possible; there is 24-hour reception/porter service.`,
    si:`Prihod okoli ${rules.confirmedLateArrivalExample} je mogoč; na voljo je 24-urna receptorska/portirska služba.`
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
    lines.push({
      hu:rules.petFeeVerified?'Háziállat hozható a beállított díj mellett.':'Háziállat hozható térítés ellenében; a pontos díjat kezelői ellenőrzéssel kell megerősíteni.',
      de:rules.petFeeVerified?'Haustiere sind gegen die hinterlegte Gebühr erlaubt.':'Haustiere sind gegen Aufpreis erlaubt; die genaue Gebühr muss vom Betreiber bestätigt werden.',
      en:rules.petFeeVerified?'Pets are allowed for the configured fee.':'Pets are allowed for an additional charge; the exact fee must be confirmed by the operator.',
      si:rules.petFeeVerified?'Hišni ljubljenčki so dovoljeni ob nastavljeni pristojbini.':'Hišni ljubljenčki so dovoljeni z doplačilom; natančno pristojbino mora potrditi upravljavec.'
    }[lang]);
  }
  if(asks.hotTub&&rules.hotTubAvailabilityRequiresCheck){
    lines.push({
      hu:rules.hotTubFeeVerified?'A dézsa elérhetőségét külön ellenőrizzük; a beállított díj alkalmazható.':'A dézsa elérhetőségét és díját külön ellenőrizzük; pontos dézsadíjat csak hiteles ellenőrzés után adunk meg.',
      de:rules.hotTubFeeVerified?'Die Verfügbarkeit des Badefasses wird separat geprüft; die hinterlegte Gebühr kann angewendet werden.':'Verfügbarkeit und Preis des Badefasses werden separat geprüft; einen genauen Preis nennen wir erst nach bestätigter Prüfung.',
      en:rules.hotTubFeeVerified?'Hot-tub availability is checked separately; the configured fee can be applied.':'Hot-tub availability and its charge are checked separately; we only quote the exact hot-tub fee after a verified check.',
      si:rules.hotTubFeeVerified?'Razpoložljivost vroče kadi preverimo posebej; uporabi se lahko nastavljena pristojbina.':'Razpoložljivost in doplačilo za vročo kad preverimo posebej; natančno ceno navedemo šele po zanesljivem preverjanju.'
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

export function buildReplyDraft({language='hu',name=null,original='',arrival=null,departure=null,guests=null,children=null,childAges=[],phone=null,cabin='? – emberi döntésre vár',pier=false,hotTub=false,dog=false,intent='booking_request',brandName='Sárberki Horgásztó',bookingRules=null,operationalRules=null,pricingRules=null,knowledgeLines=[]}={}){
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
  const policyLines=bookingPolicyLines(lang,original,guests,bookingRules);
  const operationalLines=operationalTopicLines(lang,original,operationalRules);
  const pricingLines=pricingTopicLines(lang,original,arrival,departure,pricingRules);
  const extraKnowledge=Array.isArray(knowledgeLines)?knowledgeLines.filter(Boolean):[];
  const asksAvailability=/(?:szabad|elérhető|van[- ]?e .*szállás|van.*hely|available|frei|prosto|verfügbar|razpolož)/iu.test(original);
  const asksPrice=/(?:mennyi|mennyibe|ár|ára|árat|price|cost|kosten|preis|cena)/iu.test(original);
  const checks={
    hu: asksAvailability||asksPrice?'A szabad kapacitást és az árat külön ellenőrizzük; ezekről csak hiteles ellenőrzés után adunk biztos tájékoztatást.':'A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.',
    de: asksAvailability||asksPrice?'Verfügbarkeit und Preis prüfen wir separat; eine verbindliche Auskunft geben wir erst nach bestätigter Prüfung.':'Wir prüfen die angegebenen Daten und melden uns mit den nötigen Details.',
    en: asksAvailability||asksPrice?'We check availability and price separately and will only confirm them after a verified check.':'We will review the details provided and reply with any required information.',
    si: asksAvailability||asksPrice?'Razpoložljivost in ceno preverimo posebej in ju potrdimo šele po zanesljivem preverjanju.':'Preverili bomo navedene podatke in odgovorili s potrebnimi podrobnostmi.'
  };
  return `${greetings[lang]}\n\n${intros[lang]}${summary?'\n\n'+summary:''}${policyLines.length?'\n\n'+policyLines.join('\n'):''}${operationalLines.length?'\n\n'+operationalLines.join('\n'):''}${pricingLines.length?'\n\n'+pricingLines.join('\n'):''}${extraKnowledge.length?'\n\n'+extraKnowledge.join('\n'):''}${questions.length?'\n\n'+questions.join(' '):''}\n\n${checks[lang]}\n\n${closings[lang]}\n${brandName}`;
}
// Preserve explicitly labelled requests without interpreting them as booking facts.
export function specialRequestsFromText(text='') {
  const requests=[];
  const pattern=/(?:^|[.!?\n]\s*)(?:külön\s+kérés|kulon\s+keres|special\s+requests?|besondere(?:r|s)?\s+w(?:u|ü)nsch(?:e)?|posebn(?:a|e)\s+(?:želja|zelja|zahteva))\s*:\s*([^\n.!?]+)/giu;
  for(const match of text.matchAll(pattern)) if(match[1].trim()) requests.push(match[1].trim());
  return requests;
}
