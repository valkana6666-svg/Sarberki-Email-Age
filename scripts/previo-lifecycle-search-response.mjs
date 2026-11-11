// Recognize the Previo reservation-list envelope, including its observed empty form.
// This does not grant write permission or parse reservation identities.
export function isReservationListResponse(value){
 if(typeof value!=='string')return false;
 const xml=value.replace(/^\uFEFF/,'').trim().replace(/^<\?xml\s[^?]*\?>\s*/,'');
 if(/<error(?:\s|>)/.test(xml))return false;
 return /^<reservations\s*\/>$/.test(xml)||
  /^<reservations>[\s\S]*<\/reservations>$/.test(xml);
}
