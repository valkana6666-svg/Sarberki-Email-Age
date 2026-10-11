// Sárberki V1 chatbot: safe, informational-only responses. No PMS, booking or outbound mail.
import {BUSINESS} from './business-config.mjs';
const WORDS={
 hu:{welcome:'Üdvözöljük a Sárberki Horgásztónál! Miben segíthetünk?',unknown:'Ezt jelenleg nem tudom hitelesen megválaszolni. Munkatársunk segít a pontosításban.',availability:'Szabad helyet csak a teljes időszakra elvégzett kapacitásellenőrzés után tudunk igazolni. Kérjük, írja meg az érkezés és távozás dátumát, valamint a felnőttek és gyermekek számát.',hotTub:'A dézsa egyes faházaknál külön bérelhető, külön díj ellenében. Elérhetőségét külön ellenőrizzük.',deposit:'A foglalási előleg befizetésére 10 nap áll rendelkezésre. Az előleg mértékét a jóváhagyott ajánlat tartalmazza.',checkin:'Érkezés 14:00 órától, távozás 10:00 óráig.',booking:'Foglalás csak külön visszaigazolás után érvényes. A chatbot nem hoz létre foglalást.'},
 de:{welcome:'Willkommen am Sárberki Angelsee! Wie können wir helfen?',unknown:'Dazu liegen mir keine verlässlich bestätigten Informationen vor. Unser Team hilft gerne weiter.',availability:'Verfügbarkeit kann nur für den gesamten Zeitraum geprüft werden. Bitte nennen Sie Anreise, Abreise sowie Erwachsene und Kinder.',hotTub:'Ein Badezuber kann bei bestimmten Häusern separat gegen Aufpreis gemietet werden. Die Verfügbarkeit muss geprüft werden.',deposit:'Die Anzahlung ist innerhalb von 10 Tagen fällig. Die Höhe steht im bestätigten Angebot.',checkin:'Check-in ab 14:00 Uhr, Check-out bis 10:00 Uhr.',booking:'Eine Buchung gilt erst nach gesonderter Bestätigung. Dieser Chatbot bucht nicht.'},
 en:{welcome:'Welcome to Sárberki Fishing Lake! How can we help?',unknown:'I cannot reliably confirm that information. Our team can clarify it.',availability:'Availability must be checked for the entire stay. Please provide arrival and departure dates and the numbers of adults and children.',hotTub:'A hot tub is available for separate rental at certain cabins for an additional fee. Availability requires checking.',deposit:'The deposit is due within 10 days. Its amount is stated in the approved offer.',checkin:'Check-in from 2 PM and check-out by 10 AM.',booking:'A booking is valid only after separate confirmation. This chatbot cannot make bookings.'},
 si:{welcome:'Dobrodošli pri ribiškem jezeru Sárberki! Kako vam lahko pomagamo?',unknown:'Tega podatka ne morem zanesljivo potrditi. Naša ekipa vam bo pomagala.',availability:'Razpoložljivost je treba preveriti za celotno obdobje. Sporočite datum prihoda, odhoda ter število odraslih in otrok.',hotTub:'Masažna kad je pri nekaterih hiškah na voljo za ločen najem z doplačilom. Razpoložljivost je treba preveriti.',deposit:'Akontacijo je treba plačati v 10 dneh. Znesek je naveden v potrjeni ponudbi.',checkin:'Prijava od 14.00, odjava do 10.00.',booking:'Rezervacija velja šele po ločeni potrditvi. Ta klepetalnik ne ustvarja rezervacij.'}
};
export function chatbotReply({message='',language='hu'}={}){
 const lang=language==='sl'?'si':language.toLowerCase();
 const t=WORDS[lang]||WORDS.hu;
 const text=String(message).slice(0,1000).toLowerCase();
 let intent='unknown';
 if(!text.trim())intent='welcome';
 else if(/foglal|reserv|buch|booking|potrditev|confirmation/u.test(text))intent='booking';
 else if(/szabad|kapacit|available|availability|frei|verfüg|prosto|termin|időpont/u.test(text))intent='availability';
 else if(/dézsa|dezsa|hot tub|badezuber|masažna kad|masazna kad/u.test(text))intent='hotTub';
 else if(/előleg|eloleg|deposit|anzahlung|akontacij/u.test(text))intent='deposit';
 else if(/érkez|távoz|check.?in|check.?out|anreise|abreise|prijava|odjava/u.test(text))intent='checkin';
 return {intent,language:WORDS[lang]?lang:'hu',reply:t[intent],bookingCreated:false,emailSent:false,availabilityVerified:false,brand:BUSINESS.brandName};
}
