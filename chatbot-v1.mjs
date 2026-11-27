// Sárberki V1 chatbot: safe, informational-only responses. No PMS, booking or outbound mail.
import {BUSINESS} from './business-config.mjs';
import {FISHING_GENERAL_TEXT,fishingQuestion,fishingRulesSummary} from './fishing-rules.mjs';
import {hotTubSentence} from './sarberki-core.mjs';
import {cabinPriceInfo,cabinCapacityInfo} from './business/sarberki/cabin-price-info.mjs';
const WORDS={
 hu:{cancel:'Lemondás: az érkezés előtt legalább 14 nappal díjmentes, a befizetett foglaló nem vész el. Későbbi lemondásnál a feltételeket munkatársunk egyezteti Önnel.',price:'A szállás ára az időszaktól, az éjszakák számától és a létszámtól függ. Kérjük, írja meg az érkezés és távozás dátumát, valamint a felnőttek és gyermekek számát (a gyermekek életkorával), és megadjuk a pontos árat.',welcome:'Üdvözöljük a Sárberki Horgásztónál! Miben segíthetünk?',unknown:'Ezt jelenleg nem tudom hitelesen megválaszolni. Munkatársunk segít a pontosításban.',availability:'Szabad helyet csak a teljes időszakra elvégzett kapacitásellenőrzés után tudunk igazolni. Kérjük, írja meg az érkezés és távozás dátumát, valamint a felnőttek és gyermekek számát.',hotTub:'A dézsa egyes faházaknál külön bérelhető, külön díj ellenében. Ha a ház mellett nincs dézsa, egy másik háznál lévő szabad dézsát is bérelhet. Elérhetőségét külön ellenőrizzük.',deposit:'A foglaló a szállásdíj 50%-a (16 főtől 80%-a), banki átutalással. Ha az érkezésig több mint 14 nap van hátra, a visszaigazolástól számított 7 napon belül, ha 14 nap vagy kevesebb, 24 órán belül kell befizetni.',checkin:'Érkezés 14:00 órától, távozás 10:00 óráig.',booking:'Foglalni itt a chatben is tud: írja meg az érkezés és távozás dátumát, a felnőttek és gyermekek számát (a gyermekek életkorával) és a választott háztípust. Megnézzük a szabad helyet és az árat, és ha megfelel, elküldheti foglalási igényét. A foglalás munkatársunk külön visszaigazolásával válik érvényessé.',fishing:'Horgászathoz érvényes állami horgászjegy és külön Sárberki horgászjegy szükséges. Legfeljebb 6-os méretű, szakáll nélküli horog használható; a kötelező horgászfelszerelésről is gondoskodni kell.',cabins:'Családi, VIP, Deluxe és osztott apartman típusok találhatók nálunk. A szabad helyeket és a megfelelő férőhelyet a teljes kért időszakra külön ellenőrizzük.'},
 de:{cancel:'Stornierung: bis spätestens 14 Tage vor Anreise kostenlos, die gezahlte Anzahlung verfällt nicht. Bei späterer Stornierung stimmt unser Team die Bedingungen mit Ihnen ab.',price:'Der Preis hängt vom Zeitraum, der Anzahl der Nächte und der Personenzahl ab. Bitte nennen Sie An- und Abreise sowie die Anzahl der Erwachsenen und Kinder (mit Alter der Kinder), dann nennen wir Ihnen den genauen Preis.',welcome:'Willkommen am Sárberki Angelsee! Wie können wir helfen?',unknown:'Dazu liegen mir keine verlässlich bestätigten Informationen vor. Unser Team hilft gerne weiter.',availability:'Verfügbarkeit kann nur für den gesamten Zeitraum geprüft werden. Bitte nennen Sie Anreise, Abreise sowie Erwachsene und Kinder.',hotTub:'Ein Badezuber kann bei bestimmten Häusern separat gegen Aufpreis gemietet werden. Hat Ihr Haus keinen, können Sie einen freien Badezuber bei einem anderen Haus mieten. Die Verfügbarkeit muss geprüft werden.',deposit:'Die Anzahlung beträgt 50 % des Unterkunftspreises (ab 16 Personen 80 %), per Banküberweisung. Bei mehr als 14 Tagen bis zur Anreise innerhalb von 7 Tagen nach der Bestätigung, bei 14 Tagen oder weniger innerhalb von 24 Stunden.',checkin:'Check-in ab 14:00 Uhr, Check-out bis 10:00 Uhr.',booking:'Sie können auch hier im Chat buchen: Nennen Sie An- und Abreise, die Zahl der Erwachsenen und Kinder (mit Alter) und den gewünschten Haustyp. Wir prüfen Verfügbarkeit und Preis, und wenn es passt, senden Sie Ihre Buchungsanfrage. Die Buchung gilt erst nach gesonderter Bestätigung durch unser Team.',fishing:'Zum Angeln sind eine gültige staatliche Angelberechtigung und eine separate Sárberki-Angelkarte erforderlich. Nur widerhakenlose Haken bis Größe 6 sind erlaubt; vorgeschriebene Angelausrüstung ist mitzubringen.',cabins:'Wir bieten Familien-, VIP- und Deluxe-Häuser sowie geteilte Apartments an. Freie Kapazitäten müssen für den gesamten Aufenthalt separat geprüft werden.'},
 en:{cancel:'Cancellation: free of charge at least 14 days before arrival, the deposit paid is not lost. For a later cancellation our team will agree the terms with you.',price:'The price depends on the dates, the number of nights and the number of guests. Please tell us your arrival and departure dates and the number of adults and children (with the children’s ages), and we will give you the exact price.',welcome:'Welcome to Sárberki Fishing Lake! How can we help?',unknown:'I cannot reliably confirm that information. Our team can clarify it.',availability:'Availability must be checked for the entire stay. Please provide arrival and departure dates and the numbers of adults and children.',hotTub:'A hot tub is available for separate rental at certain cabins for an additional fee. If your cabin has none, you can rent a free one at another cabin. Availability requires checking.',deposit:'The deposit is 50% of the accommodation price (80% from 16 guests), by bank transfer. With more than 14 days until arrival it is due within 7 days of the confirmation, with 14 days or less within 24 hours.',checkin:'Check-in from 2 PM and check-out by 10 AM.',booking:'You can book right here in the chat: tell us your arrival and departure dates, the number of adults and children (with ages) and the cabin type. We check availability and the price, and if it suits you, you can send your booking request. The booking is valid only after our team’s separate confirmation.',fishing:'Fishing requires a valid state fishing permit and a separate Sárberki fishing ticket. Only barbless hooks up to size 6 are allowed; mandatory fishing equipment is required.',cabins:'We offer Family, VIP and Deluxe cabins and split apartments. Availability and capacity must be checked for the entire requested stay.'},
 si:{cancel:'Odpoved: brezplačna najpozneje 14 dni pred prihodom, plačano predplačilo ne zapade. Pri kasnejši odpovedi pogoje uskladi naša ekipa z vami.',price:'Cena je odvisna od termina, števila noči in števila oseb. Prosimo, sporočite datum prihoda in odhoda ter število odraslih in otrok (s starostjo otrok), in posredovali vam bomo točno ceno.',welcome:'Dobrodošli pri ribiškem jezeru Sárberki! Kako vam lahko pomagamo?',unknown:'Tega podatka ne morem zanesljivo potrditi. Naša ekipa vam bo pomagala.',availability:'Razpoložljivost je treba preveriti za celotno obdobje. Sporočite datum prihoda, odhoda ter število odraslih in otrok.',hotTub:'Masažna kad je pri nekaterih hiškah na voljo za ločen najem z doplačilom. Če vaša hiška nima svoje, lahko najamete prosto kad pri drugi hiški. Razpoložljivost je treba preveriti.',deposit:'Predplačilo znaša 50 % cene nastanitve (od 16 oseb 80 %), z bančnim nakazilom. Če je do prihoda več kot 14 dni, v 7 dneh po potrditvi, če 14 dni ali manj, v 24 urah.',checkin:'Prijava od 14.00, odjava do 10.00.',booking:'Rezervirate lahko kar tukaj v klepetu: sporočite datum prihoda in odhoda, število odraslih in otrok (s starostjo) in tip hiške. Preverimo razpoložljivost in ceno, in če vam ustreza, pošljete povpraševanje za rezervacijo. Rezervacija velja šele po ločeni potrditvi naše ekipe.',fishing:'Za ribolov sta potrebni veljavna državna ribiška dovolilnica in ločena dovolilnica Sárberki. Dovoljeni so trnki brez zalusti do velikosti 6; potrebna je predpisana ribiška oprema.',cabins:'Na voljo so družinske, VIP in Deluxe hiške ter deljeni apartmaji. Razpoložljivost za celotno bivanje je treba posebej preveriti.'}
};
// Facts come only from the central sources (business-config.mjs, fishing-rules.mjs, the shared hot-tub
// sentence), so the chatbot and the email reply can never state different times, fees or rules.
{
 const o=BUSINESS.operationalRules,b=BUSINESS.bookingRules;
 const days=Math.round(b.depositNormalWindowHours/24),hours=b.depositShortWindowHours,lead=b.depositLeadDaysBoundary;
 // Owner 2026-11-27 (question bank): „Mennyi a foglaló?” names the percentage (config: 50%, from 16 guests 80%).
 const pct=b.depositPctUnder15Guests,pctL=b.depositPctFrom15Guests,big=b.depositLargeGroupMinGuests;
 const dot=t=>t.replace(':','.');
 const facts={
  hu:{checkin:`Érkezés ${o.checkinFrom} órától, távozás ${o.checkoutBy} óráig.`,
   deposit:`A foglaló a szállásdíj ${pct}%-a (${big} főtől ${pctL}%-a), banki átutalással. Ha az érkezésig több mint ${lead} nap van hátra, a visszaigazolástól számított ${days} napon belül, ha ${lead} nap vagy kevesebb, ${hours} órán belül kell befizetni.`},
  de:{checkin:`Check-in ab ${o.checkinFrom} Uhr, Check-out bis ${o.checkoutBy} Uhr.`,
   deposit:`Die Anzahlung beträgt ${pct} % des Unterkunftspreises (ab ${big} Personen ${pctL} %), per Banküberweisung. Bei mehr als ${lead} Tagen bis zur Anreise innerhalb von ${days} Tagen nach der Bestätigung, bei ${lead} Tagen oder weniger innerhalb von ${hours} Stunden.`},
  en:{checkin:`Check-in from ${o.checkinFrom} and check-out by ${o.checkoutBy}.`,
   deposit:`The deposit is ${pct}% of the accommodation price (${pctL}% from ${big} guests), by bank transfer. With more than ${lead} days until arrival it is due within ${days} days of the confirmation, with ${lead} days or less within ${hours} hours.`},
  si:{checkin:`Prijava od ${dot(o.checkinFrom)}, odjava do ${dot(o.checkoutBy)}.`,
   deposit:`Predplačilo znaša ${pct} % cene nastanitve (od ${big} oseb ${pctL} %), z bančnim nakazilom. Če je do prihoda več kot ${lead} dni, v ${days} dneh po potrditvi, če ${lead} dni ali manj, v ${hours} urah.`}
 };
  // Pets (owner demo check 2026-11-11): the same approved rule and fee as the e-mail reply (business-config).
 const r=o,fee=Number(r.petFeeHufPerPetPerDay),feeText=r.petFeeVerified&&Number.isFinite(fee)?String(fee).replace(/\B(?=(\d{3})+(?!\d))/g,' '):null;
 const pet=r.petAllowedForFee?(feeText?{hu:`Háziállat hozható, díja ${feeText} Ft/nap/állat.`,de:`Haustiere sind erlaubt; die Gebühr beträgt ${feeText} Ft pro Tag und Tier.`,
  en:`Pets are allowed; the fee is ${feeText} Ft per pet per day.`,si:`Hišni ljubljenčki so dovoljeni; pristojbina znaša ${feeText} Ft na žival na dan.`}:null):null;
 for(const lang of Object.keys(WORDS))Object.assign(WORDS[lang],facts[lang],{hotTub:hotTubSentence(lang),...(pet?{pet:pet[lang]}:{}),fishing:FISHING_GENERAL_TEXT[lang]});
}
// Presentation of an already selected intent; no second classification.
export function renderChatbotIntent(intent,language='hu'){
 const lang=language==='sl'?'si':String(language).toLowerCase();
 return (WORDS[lang]||WORDS.hu)[intent]||(WORDS[lang]||WORDS.hu).unknown;
}
export function chatbotReply({message='',language='hu'}={}){
 const lang=language==='sl'?'si':language.toLowerCase();
 const t=WORDS[lang]||WORDS.hu;
 const text=String(message).slice(0,1000).toLowerCase();
 let intent='unknown';
 const asksAvailability=/(?:szabad|kapacit|elérhető|van[- ]?e\s+hely|available|availability|vacan|frei|verfüg|prosto|razpoložljiv|termin|időpont)/u.test(text);
 const mentionsStay=/(?:faház|fahaz|apartman|cabin|accommodat|ferienhaus|hišk|apartma|deluxe|delux|vip|családi|family|familien|družinsk|különálló|kulonallo|csaladi|szállás|szallas|unterkunft|nastanit|(?<!\p{L})ház|wohnung|(?<!\p{L})haus|häuser|ferienhäus|apartment)/u.test(text);
 const hasStayDates=/(?:20\d{2}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[./]\s*\d{1,2}[./](?:\s*20\d{2})?|\b(?:november|október|december|január|február|március|április|május|június|július|augusztus|szeptember|january|february|march|april|may|june|july|august|september|october|november|december)\b)/u.test(text);
 const asksBooking=/(?:foglal|reserv|buch|book|rezerv|potrditev|confirmation)/u.test(text);
 // Tricky test 2026-11-27: „Actually, no hot tub. What's the total now?” is a stay question, not a hot tub question.
 const tubRefused=/(?:\bno\s+hot\s*tub|without\s+(?:the\s+|a\s+)?hot\s*tub|kein(?:en)?\s+badezuber|ohne\s+badezuber|brez\s+(?:\p{L}+\s+)?kad|(?:dézsa|dézsát?)\s+(?:mégse|nem\s+kell|nem\s+kér)|mégse(?:m)?\s+(?:kell\s+|kérünk\s+)?dézs)/u.test(text);
 const mentionsHotTub=!tubRefused&&/(?:dézsa|dezsa|hot tub|badezuber|masažna kad|masazna kad)/u.test(text);
 if(!text.trim())intent='welcome';
 // Owner 2026-11-27 (question bank): the stay's capacity, check-in/out, deposit and cancellation are answered by their
 // own fixed facts before the general booking/cabin answers (they all contain 'foglal' / 'ház' words).
 else if(/hány\s*fős|hányan\s+fér|hány\s+fő\s+fér|legnagyobb|mekkora|max(?:imum)?[^.?!]{0,20}(?:fő|személy)|wie\s+viele\s+personen|how\s+many\s+(?:people|guests|persons)|biggest|largest|koliko\s+oseb|največ\s+oseb|kapazit|capacity|kapaciteta/u.test(text)&&!asksAvailability)intent='capacity';
 else if(/lemond|le\s+(?:\p{L}+\s+){0,2}mond|storn|cancel|odpoved|refund/u.test(text))intent='cancel';
 else if(/előleg|eloleg|foglaló\p{L}{0,4}|deposit|anzahlung|akontacij|predplačil|predplacil/u.test(text))intent='deposit';
 else if(/érkez|távoz|check.?in|check.?out|anreise|abreise|prijava|odjava|kijelentkez|bejelentkez|elfoglal|elhagy|átvehet|átvenni|hánytól|hány\s+órá|meddig\s+kell/u.test(text)&&!/horgász|horgasz|jegy|dézsa|dezsa/u.test(text))intent='checkin';
 else if(mentionsHotTub&&!mentionsStay)intent='hotTub';
 else if(asksAvailability||(mentionsStay&&(hasStayDates||asksBooking)))intent='availability';
 // Owner chat test 2026-11-27: „Mennyibe kerül egy éjszakára a delux fahaz?” got the list of cabin types – a price
 // question about a stay (no dates yet) asks for the dates and guests to give the exact price.
 else if((mentionsStay&&/mennyi|(?<!\p{L})(?:ár|ara)(?:a|at|ak|ai|on)?(?!\p{L})|kerül|kerul|how\s+much|price|cost|preis|kostet|kosten(?!los)|teuer|expensive|koliko|cen[aoie](?!\p{L})|stane|drag/u.test(text)||/(?<!\p{L})(?:árak|árai|áraitok|árlista|arak)(?!\p{L})|prices|price\s+list|preise|preisliste|cene|cenik/u.test(text))&&!/jegy|ticket|karte|karta|dézsa|dezsa|horgász|horgasz/u.test(text))intent='price';
 else if(mentionsHotTub)intent='hotTub';
 else if(WORDS[lang]?.pet&&/(?:kutya|kutyá|macska|háziállat|haziallat|állat\b|\bdog|\bcat\b|\bpets?\b|hund|katze|haustier|pes\b|psa\b|mačk|hišn\w* ljubljen)/u.test(text))intent='pet';
 else if(/horgász|horgasz|angeln|fishing|ribolov|ribišk/u.test(text))intent='fishing';
 else if(asksBooking)intent='booking';
 else if(mentionsStay||/háztyp|szállástípus/u.test(text))intent='cabins';
 else if(/érkez|távoz|check.?in|check.?out|anreise|abreise|prijava|odjava/u.test(text))intent='checkin';
 // Owner iPhone chat test 2026-11-15: fishing questions get the specific approved answer (tickets, hooks, sizes,
 // take-away prices) or, for a rules question, the rules summary with the link - not always the same general sentence.
 // Owner iPhone chat test 2026-11-15: "Mik a napijegy árak?" has no fishing word, but the fishing module knows tickets.
 // A ticket question that also names a cabin ("Faházvendégként milyen jegyet kell venni?") is about fishing tickets.
 if(intent==='unknown'||intent==='cabins'&&/jegy|ticket|karte|karta/iu.test(text)){const q=fishingQuestion(text,lang);if(q&&q.kind!=='review')intent='fishing';}
 let reply=t[intent];
 // Owner 2026-11-27: the price question gets the prices themselves (signed 2027 tariff), per cabin type or all.
 if(intent==='price')reply=cabinPriceInfo(text,WORDS[lang]?lang:'hu');
 if(intent==='capacity')reply=cabinCapacityInfo(WORDS[lang]?lang:'hu');
 if(intent==='fishing'){
  if(/szabály|szabaly|regel|ordnung|\brules?\b|pravil|red\b/iu.test(text))reply=fishingRulesSummary(lang);
  else{const q=fishingQuestion(text,lang);if(q&&q.kind!=='review'&&q.kind!=='general_conditions')reply=q.answer;}
 }
 return {intent,language:WORDS[lang]?lang:'hu',reply,bookingCreated:false,emailSent:false,availabilityVerified:false,brand:BUSINESS.brandName};
}
