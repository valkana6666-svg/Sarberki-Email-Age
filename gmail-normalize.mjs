// Multilingual, conservative parsing helpers for the Gmail bridge.
// Pure functions: safe to test without Gmail or browser access.
const MONTHS = {
  január:1,januar:1,február:2,februar:2,március:3,marcius:3,április:4,aprilis:4,május:5,majus:5,június:6,junius:6,július:7,julius:7,augusztus:8,szeptember:9,október:10,oktober:10,november:11,december:12,
  jan:1,febr:2,márc:3,ápr:4,máj:5,jún:6,júl:7,aug:8,szept:9,okt:10,nov:11,dec:12,
  january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12,
  januar:1,februar:2,märz:3,maerz:3,mai:5,juni:6,juli:7,oktober:10,dezember:12,
  januar_si:1,februar_si:2,marec:3,april_si:4,maj:5,junij:6,julij:7,avgust:8,september_si:9,oktober_si:10,november_si:11,december_si:12
};
function monthNumber(raw){
  const k=raw.toLowerCase().replace(/\.$/,'');
  if (MONTHS[k]) return MONTHS[k];
  return MONTHS[k+'_si'] || null;
}
export function cabinFromText(text=''){
  const found=[];
  if (/\bvip\b/iu.test(text)) found.push('VIP');
  if (/\b(?:családi|csaladi|family|familien)\b/iu.test(text)) found.push('Családi');
  if (/\bdeluxe\b/iu.test(text)) found.push('Deluxe');
  if (/\b(?:osztott|split|geteilte[rs]?|deljen[ai]?)\b/iu.test(text)) found.push('Osztott');
  return found.length===1 ? found[0] : '? – emberi döntésre vár';
}
export function guestCountFromText(text=''){
  const m=text.match(/(?:^|\s)(\d{1,2})\s*(?:fő|fo|személy|szemely|persons?|people|guests?|gäste|personen|oseb)(?=\s|$|[,.!?])/iu);
  if(m) return Number(m[1]);
  const words={ketten:2,kéten:2,hárman:3,harman:3,négyen:4,negyen:4,öten:5,oten:5,hatan:6,heten:7,nyolcan:8,kilencen:9,tízen:10,tizen:10};
  const w=text.match(/\b(ketten|kéten|hárman|harman|négyen|negyen|öten|oten|hatan|heten|nyolcan|kilencen|tízen|tizen)\b/iu)?.[1]?.toLocaleLowerCase('hu-HU');
  return w ? words[w] : null;
}
export function childCountFromText(text=''){
  const m=text.match(/\b(\d{1,2})\s*(?:gyerek\w*|gyermek\w*|children|child|kinder|kind|otrok\w*)\b/iu);
  if(m) return Number(m[1]);
  const words={egy:1,két:2,ket:2,kettő:2,ketto:2,három:3,harom:3,négy:4,negy:4,öt:5,ot:5,hat:6};
  const w=text.match(/\b(egy|két|ket|kettő|ketto|három|harom|négy|negy|öt|ot|hat)\s+(?:gyerek\w*|gyermek\w*)\b/iu)?.[1]?.toLocaleLowerCase('hu-HU');
  return w ? words[w] : null;
}
export function dateRangeFromText(text='', now=new Date()){
  const iso=text.match(/\b(20\d{2})[-./](\d{1,2})[-./](\d{1,2})\s*(?:[-–]|to|bis|do)\s*(?:(20\d{2})[-./](\d{1,2})[-./])?(\d{1,2})\b/iu);
  if(iso) return {arrival:`${iso[1]}-${String(iso[2]).padStart(2,'0')}-${String(iso[3]).padStart(2,'0')}`,departure:`${iso[4]||iso[1]}-${String(iso[5]||iso[2]).padStart(2,'0')}-${String(iso[6]).padStart(2,'0')}`,inferredYear:false};
  const names='január|januar|február|februar|március|marcius|április|aprilis|május|majus|június|junius|július|julius|augusztus|szeptember|október|oktober|november|december|jan\\.?|febr\\.?|márc\\.?|marc\\.?|ápr\\.?|apr\\.?|máj\\.?|maj\\.?|jún\\.?|jun\\.?|júl\\.?|jul\\.?|aug\\.?|szept\\.?|okt\\.?|nov\\.?|dec\\.?|january|february|march|april|may|june|july|august|september|october|november|december|märz|maerz|mai|juni|juli|dezember|marec|junij|julij|avgust';
  const r=text.match(new RegExp(`\\b(?:20\\d{2}\\s*[.\\/-]?\\s*)?(${names})\\s+(\\d{1,2})\\s*(?:[-–]|to|bis|do|(?:-?(?:től|tól|tol)))\\s*(?:(?:${names})\\s+)?(\\d{1,2})(?:-?ig)?\\b`,'iu'));
  if(!r) return null;
  const month=monthNumber(r[1]); if(!month) return null;
  const explicit=text.match(/\b20\d{2}\b/u)?.[0];
  const next=/\b(?:jövőre|következő évben|next year|nächstes jahr|naslednje leto)\b/iu.test(text);
  const local=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit'}).format(now).split('-').map(Number);
  let year=explicit?Number(explicit):local[0]+(next?1:0);
  if(!explicit&&!next&&(month<local[1]||(month===local[1]&&Number(r[2])<local[2]))) year++;
  return {arrival:`${year}-${String(month).padStart(2,'0')}-${String(r[2]).padStart(2,'0')}`,departure:`${year}-${String(month).padStart(2,'0')}-${String(r[3]).padStart(2,'0')}`,inferredYear:!explicit&&!next};
}

export function phoneFromText(text=''){
  const m=text.match(/(?:\+\d{1,3}[\s()./-]*)?(?:\d[\s()./-]*){8,15}/u);
  return m ? m[0].trim().replace(/[.,;:]+$/u,'') : null;
}
export function childAgesFromText(text=''){
  const m=text.match(/(?:gyerek\w*|gyermek\w*|children|kinder|otrok\w*)[^.!?\n]{0,80}?(\d{1,2})\s*(?:és|es|meg|,|and|und|in)\s*(\d{1,2})\s*(?:éves|eves|years? old|jahre alt|let)/iu)
    || text.match(/(\d{1,2})\s*(?:és|es|meg|,|and|und|in)\s*(\d{1,2})\s*(?:éves|eves|years? old|jahre alt|let)/iu);
  return m ? [Number(m[1]),Number(m[2])] : [];
}
export function languageFromText(text=''){
  const scores={
    hu:(text.match(/\b(?:szeretn|erdekl|érdekl|faház|fahaz|szállás|szallas|gyermek|gyerek|fő|fo|dézsa|dezsa|mennénk|mennenk|jönnénk|jonnenk)\w*/giu)||[]).length,
    de:(text.match(/\b(?:möchte|anfrage|unterkunft|buchung|gäste|personen|kinder|verfügbar)\w*/giu)||[]).length,
    en:(text.match(/\b(?:would|booking|reservation|accommodation|guests|children|available|cabin)\w*/giu)||[]).length,
    si:(text.match(/\b(?:nastanitev|rezervacij|oseb|otrok|prosto|koča|ribolov)\w*/giu)||[]).length
  };
  const best=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  return best[0][1]>0 && best[0][1]>best[1][1] ? best[0][0] : 'unknown';
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
