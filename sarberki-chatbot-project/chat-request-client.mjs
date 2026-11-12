// V3-3: the guest sends the chat's booking facts as a REQUEST to the reception (operator approval; not a booking).
// The server is off unless the owner switches it on; any failure shows a neutral "try later".
const CABIN_KEYS={'vip':'vip','családi':'family','deluxe':'deluxe','különálló 2 fős':'small','osztott':'split','osztott a':'splitA','osztott b':'splitB','osztott c':'splitC'};
export const REQUEST_TEXT={
 hu:{title:'Foglalási igény küldése a recepciónak',phone:'Telefonszám',consent:'Hozzájárulok, hogy a Sárberki a megadott adatokkal felvegye velem a kapcsolatot.',send:'Igény elküldése',note:'Ez még nem foglalás: a recepció visszahívja és visszaigazolja.',sent:'Köszönjük! A recepció hamarosan visszahívja.',fail:'Most nem sikerült elküldeni, kérjük, próbálja később.'},
 de:{title:'Buchungsanfrage an die Rezeption senden',phone:'Telefonnummer',consent:'Ich bin einverstanden, dass Sárberki mich mit diesen Angaben kontaktiert.',send:'Anfrage senden',note:'Dies ist noch keine Buchung: Die Rezeption ruft Sie zurück und bestätigt.',sent:'Vielen Dank! Die Rezeption ruft Sie bald zurück.',fail:'Das Senden ist gerade nicht möglich, bitte versuchen Sie es später.'},
 en:{title:'Send a booking request to reception',phone:'Phone number',consent:'I agree that Sárberki may contact me using these details.',send:'Send request',note:'This is not a booking yet: reception will call you back to confirm.',sent:'Thank you! Reception will call you back soon.',fail:'Sending is not possible right now, please try again later.'},
 si:{title:'Pošlji zahtevo za rezervacijo recepciji',phone:'Telefonska številka',consent:'Strinjam se, da me Sárberki kontaktira s temi podatki.',send:'Pošlji zahtevo',note:'To še ni rezervacija: recepcija vas bo poklicala in potrdila.',sent:'Hvala! Recepcija vas bo kmalu poklicala.',fail:'Pošiljanje trenutno ni mogoče, poskusite pozneje.'}
};
// Chat session facts -> intake facts (the server validates again and drops anything invalid).
export function requestFacts(snapshot={}){
 const cabin=CABIN_KEYS[String(snapshot.cabin||'').trim().toLowerCase()];
 if(!snapshot.dates?.arrival||!snapshot.dates?.departure||!Number.isInteger(snapshot.adults)||!cabin)return null;
 return {arrival:snapshot.dates.arrival,departure:snapshot.dates.departure,adults:snapshot.adults,
  ...(Number.isInteger(snapshot.children)?{children:snapshot.children}:{}),...(Array.isArray(snapshot.child_ages)&&snapshot.child_ages.length?{childAges:snapshot.child_ages}:{}),
  cabin,...(Number.isInteger(snapshot.units_requested)?{units:snapshot.units_requested}:{})};
}
export function createChatRequestSender({request=fetch}={}){
 return async({facts,phone,language,transcript})=>{
  try{
   const r=await request('/.netlify/functions/chat-intake',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({consent:true,facts,language,phone,transcript})});
   return r.ok;
  }catch{return false;}
 };
}
