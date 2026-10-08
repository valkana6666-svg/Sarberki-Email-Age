// Csak a vendég levélből és a szerkesztett foglalási mezőkből készülhet bemenet.
// Nincs import a teljes üzleti konfigurációból, PMS-ből, ármodulból vagy ügyállapotból.
const cleanNumber=(value,min,max)=>{
  if(value===null||value===undefined||String(value).trim()==='')return null;
  const n=Number(value);
  return Number.isInteger(n)&&n>=min&&n<=max?n:null;
};
function cabinKey(value=''){
  const text=String(value).trim().toLowerCase();
  if(/\bdeluxe\b/u.test(text))return 'deluxe';
  if(/\bvip\b/u.test(text))return 'vip';
  if(/családi|csaladi|family|familien/iu.test(text))return 'family';
  if(/különálló|kulonallo|standalone|^small$/iu.test(text))return 'standalone2';
  if(/osztott\s*[ab]\b|split\s*[ab]\b|split2/iu.test(text))return 'split2';
  if(/osztott\s*c\b|split\s*c\b|split4/iu.test(text))return 'split4';
  return null; // az általános "faház" vagy "osztott" NEM konkrét háztípus
}
export function publicReplyInput({fields={},message=''}={}){
  const language=({HU:'hu',DE:'de',EN:'en',SL:'si',SI:'si'})[String(fields.language||'HU').toUpperCase()]||'hu';
  const guests=cleanNumber(fields.guests,1,60);
  const adults=cleanNumber(fields.adults,1,60);
  const children=cleanNumber(fields.children,0,30);
  const ages=String(fields.child_ages||'').split(/[;,]/u).map(s=>cleanNumber(s.trim(),0,17)).filter(n=>n!==null);
  const text=String(message).slice(0,20000);
  const isBooking=/(?:foglal|faház|szállás|apartman|házat|éjszak|reservation|reserv|book|cabin|accommodation|unterkunft|haus|hütte|buchen|nastanitev|hišk|rezervacij)/iu.test(text)
    ||Boolean(fields.arrival||fields.departure||fields.unit);
  const topics=[];
  if(isBooking)topics.push('accommodation');
  if(/(?:szabad|elérhet|férőhely|free|availab|verfügbar|frei|prosto|na voljo)/iu.test(text))topics.push('availability');
  if(/(?:mennyi|mennyibe|árak|ára|árat|ár\b|díj|price|cost|kosten|preis|cena|koliko stane)/iu.test(text))topics.push('price');
  if(/(?:dézs|jacuzzi|hot.?tub|badefass|masažna kad)/iu.test(text))topics.push('hot_tub');
  if(/(?:horgász|halat|pecáz|fishing|angeln|ribolov)/iu.test(text))topics.push('fishing');
  if(/(?:előleg|foglaló|lemond|storn|anzahlung|deposit|cancel|predplačil|odpoved)/iu.test(text))topics.push('booking_terms');
  if(/(?:parkol|autó|parking|parkplatz|parkir)/iu.test(text))topics.push('parking');
  if(/(?:kutya|kutyát|háziállat|dog|pet|haustier|hund|pes|psa|ljubljen)/iu.test(text))topics.push('pet');
  if(/(?:érkezési idő|érkezhet|hány órától|check.?in|check.?out|ankunft|abreise|prijava|odjava)/iu.test(text))topics.push('arrival_departure');
  const facts={
    language,name:fields.name||null,arrival:fields.arrival||null,departure:fields.departure||null,
    nights:cleanNumber(fields.nights,1,60),guests,adults,children,childAges:ages,
    phone:fields.phone||null,cabin:cabinKey(fields.unit),
    requestedUnits:cleanNumber(fields.units_requested,1,20)
  };
  const missing=[];
  if(isBooking){
    if(!facts.arrival||!facts.departure)missing.push('dates');
    if(adults===null)missing.push('adults');
    if(children===null)missing.push('children_status');
    if(children!==null&&children>0&&ages.length!==children)missing.push('child_ages');
    if(!facts.phone)missing.push('phone');
    if(!facts.cabin)missing.push('cabin');
  }
  // Sem ár, sem kapacitás nem jöhet a vendég szövegéből vagy egy belső rekordból.
  // Később kizárólag külön, ellenőrzött és aláírt publikus adapter adhatja át.
  return {facts,topics,missing};
}
