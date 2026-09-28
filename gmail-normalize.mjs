// Multilingual, conservative parsing helpers for the Gmail bridge.
// Pure functions: safe to test without Gmail or browser access.
const MONTHS = {
  január:1,február:2,március:3,április:4,május:5,június:6,július:7,augusztus:8,szeptember:9,október:10,november:11,december:12,
  january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12,
  januar:1,februar:2,märz:3,maerz:3,mai:5,juni:6,juli:7,oktober:10,dezember:12,
  januar_si:1,februar_si:2,marec:3,april_si:4,maj:5,junij:6,julij:7,avgust:8,september_si:9,oktober_si:10,november_si:11,december_si:12
};
function monthNumber(raw){
  const k=raw.toLowerCase();
  if (MONTHS[k]) return MONTHS[k];
  return MONTHS[k+'_si'] || null;
}
export function cabinFromText(text=''){
  const found=[];
  if (/\bvip\b/iu.test(text)) found.push('VIP');
  if (/\b(?:családi|family|familien)\b/iu.test(text)) found.push('Családi');
  if (/\bdeluxe\b/iu.test(text)) found.push('Deluxe');
  if (/\b(?:osztott|split|geteilte[rs]?|deljen[ai]?)\b/iu.test(text)) found.push('Osztott');
  return found.length===1 ? found[0] : '? – emberi döntésre vár';
}
export function guestCountFromText(text=''){
  const m=text.match(/\b(\d{1,2})\s*(?:fő|személy|persons?|people|guests?|gäste|personen|oseb)\b/iu);
  return m ? Number(m[1]) : null;
}
export function childCountFromText(text=''){
  const m=text.match(/\b(\d{1,2})\s*(?:gyerek\w*|gyermek\w*|children|child|kinder|kind|otrok\w*)\b/iu);
  return m ? Number(m[1]) : null;
}
export function dateRangeFromText(text='', now=new Date()){
  const iso=text.match(/\b(20\d{2})[-./](\d{1,2})[-./](\d{1,2})\s*(?:[-–]|to|bis|do)\s*(?:(20\d{2})[-./](\d{1,2})[-./])?(\d{1,2})\b/iu);
  if(iso) return {arrival:`${iso[1]}-${String(iso[2]).padStart(2,'0')}-${String(iso[3]).padStart(2,'0')}`,departure:`${iso[4]||iso[1]}-${String(iso[5]||iso[2]).padStart(2,'0')}-${String(iso[6]).padStart(2,'0')}`,inferredYear:false};
  const names=Object.keys(MONTHS).filter(x=>!x.endsWith('_si')).join('|');
  const r=text.match(new RegExp(`\\b(${names})\\s+(\\d{1,2})\\s*(?:[-–]|to|bis|do|(?:-től|-tól))\\s*(\\d{1,2})(?:-ig)?\\b`,'iu'));
  if(!r) return null;
  const month=monthNumber(r[1]); if(!month) return null;
  const explicit=text.match(/\b20\d{2}\b/u)?.[0];
  const next=/\b(?:jövőre|következő évben|next year|nächstes jahr|naslednje leto)\b/iu.test(text);
  const local=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit'}).format(now).split('-').map(Number);
  let year=explicit?Number(explicit):local[0]+(next?1:0);
  if(!explicit&&!next&&(month<local[1]||(month===local[1]&&Number(r[2])<local[2]))) year++;
  return {arrival:`${year}-${String(month).padStart(2,'0')}-${String(r[2]).padStart(2,'0')}`,departure:`${year}-${String(month).padStart(2,'0')}-${String(r[3]).padStart(2,'0')}`,inferredYear:!explicit&&!next};
}
