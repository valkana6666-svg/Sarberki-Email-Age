export const PUBLIC_REPLY_DATA_VERSION='2026-10-07-prep-1';

export const PUBLIC_REPLY_DATA=Object.freeze({
  brandName:'Sárberki Horgásztó',
  cabins:Object.freeze({
    vip:Object.freeze({label:Object.freeze({hu:'VIP faház',de:'VIP-Haus',en:'VIP cabin',si:'VIP hiška'}),capacityText:Object.freeze({hu:'legfeljebb 5+2 fő',de:'bis zu 5+2 Personen',en:'up to 5+2 guests',si:'do 5+2 oseb'})}),
    family:Object.freeze({label:Object.freeze({hu:'Családi faház',de:'Familienhaus',en:'Family cabin',si:'Družinska hiška'}),capacityText:Object.freeze({hu:'legfeljebb 8 fő',de:'bis zu 8 Personen',en:'up to 8 guests',si:'do 8 oseb'})}),
    deluxe:Object.freeze({label:Object.freeze({hu:'Deluxe faház',de:'Deluxe-Haus',en:'Deluxe cabin',si:'Deluxe hiška'}),capacityText:Object.freeze({hu:'legfeljebb 5+1 fő',de:'bis zu 5+1 Personen',en:'up to 5+1 guests',si:'do 5+1 oseb'})}),
    split2:Object.freeze({label:Object.freeze({hu:'2 fős osztott apartman',de:'geteiltes Apartment für 2 Personen',en:'2-person split apartment',si:'deljeni apartma za 2 osebi'}),capacityText:Object.freeze({hu:'2 fő',de:'2 Personen',en:'2 guests',si:'2 osebi'})}),
    split4:Object.freeze({label:Object.freeze({hu:'4 fős osztott apartman',de:'geteiltes Apartment für 4 Personen',en:'4-person split apartment',si:'deljeni apartma za 4 osebe'}),capacityText:Object.freeze({hu:'4 fő',de:'4 Personen',en:'4 guests',si:'4 osebe'})}),
    standalone2:Object.freeze({label:Object.freeze({hu:'Különálló 2 fős faház',de:'freistehende Hütte für 2 Personen',en:'standalone 2-person cabin',si:'samostojna hiška za 2 osebi'}),capacityText:Object.freeze({hu:'2 fő, gyermek-pótágy lehetőséggel',de:'2 Personen, mit möglichem Kinder-Zustellbett',en:'2 guests, with a possible child extra bed',si:'2 osebi, z možnostjo dodatnega ležišča za otroka'})})
  }),
  hotTub:Object.freeze({
    separateRental:true,
    baseHufPer24Hours:30000,
    includedPeople:6,
    extraPersonHufPer24Hours:4000,
    text:Object.freeze({
      hu:'A dézsa külön bérelhető, külön díj ellenében.',
      de:'Das Badefass kann separat gegen Aufpreis gemietet werden.',
      en:'The hot tub can be rented separately for an additional fee.',
      si:'Masažna kad se najame posebej proti doplačilu.'
    })
  }),
  fishing:Object.freeze({
    text:Object.freeze({
      hu:'A horgászathoz érvényes magyar állami horgászjegy szükséges. Szakáll nélküli, legfeljebb 6-os horog használható. Kötelező a pontybölcső, merítőháló, sebfertőtlenítő és pontyzsák. A Sárberki horgászjegy külön váltandó.',
      de:'Zum Angeln ist ein gültiger ungarischer staatlicher Angelschein erforderlich. Es darf nur ein widerhakenloser Haken bis Größe 6 verwendet werden. Abhakmatte/Karpfenwiege, Kescher, Wunddesinfektionsmittel und Karpfensack sind Pflicht. Die Sárberki-Angelkarte ist separat zu lösen.',
      en:'A valid Hungarian state fishing licence is required. Only barbless hooks up to size 6 may be used. A carp cradle/unhooking mat, landing net, wound disinfectant and carp sack are required. The Sárberki fishing ticket is purchased separately.',
      si:'Za ribolov je potrebna veljavna madžarska državna ribolovna dovolilnica. Dovoljen je trnek brez zalusti največ velikosti 6. Obvezni so podloga/zibelka za krape, podmetalka, razkužilo za rane in vreča za krape. Ribolovno dovolilnico Sárberki je treba kupiti posebej.'
    })
  }),
  booking:Object.freeze({
    depositDueDays:10,
    depositPctUnder15Guests:50,
    depositPctFrom15Guests:null,
    cancellationDaysUnder15Guests:14,
    cancellationDaysFrom15Guests:30
  }),
  operations:Object.freeze({
    checkinFrom:'14:00',
    checkoutBy:'10:00',
    petFeeHufPerPetPerDay:2000,
    parkingAvailable:true
  }),
  pending:Object.freeze({
    price:Object.freeze({hu:'A pontos árat ellenőrzés után tudjuk visszaigazolni.',de:'Den genauen Preis können wir erst nach Prüfung bestätigen.',en:'We can confirm the exact price after checking.',si:'Točno ceno bomo potrdili po preverjanju.'}),
    availability:Object.freeze({hu:'A szabad kapacitást ellenőrzés után tudjuk visszaigazolni.',de:'Die Verfügbarkeit können wir erst nach Prüfung bestätigen.',en:'We can confirm availability after checking.',si:'Razpoložljivost bomo potrdili po preverjanju.'})
  }),
  questions:Object.freeze({
    dates:Object.freeze({hu:'Kérjük, írja meg a pontos érkezési és távozási dátumot.',de:'Bitte teilen Sie uns das genaue An- und Abreisedatum mit.',en:'Please tell us the exact arrival and departure dates.',si:'Prosimo, sporočite točen datum prihoda in odhoda.'}),
    adults:Object.freeze({hu:'Kérjük, írja meg, hány felnőtt érkezik.',de:'Bitte teilen Sie uns mit, wie viele Erwachsene anreisen.',en:'Please tell us how many adults will be staying.',si:'Prosimo, sporočite, koliko odraslih oseb bo prišlo.'}),
    childrenStatus:Object.freeze({hu:'Kérjük, írja meg, érkezik-e gyermek is.',de:'Bitte teilen Sie uns mit, ob auch Kinder mitreisen.',en:'Please tell us whether any children will be staying.',si:'Prosimo, sporočite, ali bodo z vami tudi otroci.'}),
    childAges:Object.freeze({hu:'Ha gyermek is érkezik, kérjük, adja meg minden gyermek életkorát.',de:'Falls Kinder mitreisen, teilen Sie uns bitte das Alter jedes Kindes mit.',en:'If children are staying, please give the age of each child.',si:'Če bodo z vami otroci, prosimo navedite starost vsakega otroka.'}),
    phone:Object.freeze({hu:'Kérjük, írjon egy telefonszámot, amelyen elérhetjük.',de:'Bitte teilen Sie uns eine Telefonnummer mit, unter der wir Sie erreichen können.',en:'Please send us a phone number where we can reach you.',si:'Prosimo, sporočite telefonsko številko, na kateri ste dosegljivi.'}),
    cabin:Object.freeze({hu:'Kérjük, írja meg, melyik háztípust szeretné.',de:'Bitte teilen Sie uns mit, welchen Haustyp Sie wünschen.',en:'Please tell us which cabin type you would like.',si:'Prosimo, sporočite, kateri tip hiške želite.'})
  })
});

export const PUBLIC_MISSING_FIELDS=Object.freeze(['dates','adults','children_status','child_ages','phone','cabin']);
export const PUBLIC_TOPICS=Object.freeze(['accommodation','availability','price','hot_tub','fishing','booking_terms','parking','pet','arrival_departure']);
