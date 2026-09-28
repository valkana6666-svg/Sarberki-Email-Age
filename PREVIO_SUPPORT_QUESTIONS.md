# Kérdések a Previo supportnak – Sárberki (hotId 753011)

Ezt a kérdéssort előkészítettük, **nem küldtük el**. Nincs hivatalos API-hozzáférésünk. A nyilvános Reservation+ foglalóban csak névtelen dátum-, kapacitás- és árlekérési lépésekre van szükségünk, vendégadat és foglalás létrehozása nélkül.

1. A `POST https://booking.previo.cz/` kérés `step=1`, `arrival=YYYY-MM-DD`, `departure=YYYY-MM-DD` törzzsel, anonim `PHPSESSID` munkamenetben kizárólag keresési/session állapotot hoz létre? Keletkezik-e bármilyen reservation, option, pending, waiting-list, hold vagy lock rekord a PMS-ben vagy a foglaló háttértárában?
2. A `POST /index/get-object-kind-occupancy/` (`hotId`, `obkId`, `newDesign=1`) csupán szabad kapacitást olvas, vagy bármennyi időre lefoglalhat/zárolhat egységet, illetve csökkentheti a másoknak látható kapacitást?
3. A `POST /index/get-occupancy-price/` (`formData` JSON, `rooms`, `guestCategories`) kizárólag árat számol? Létrehoz-e ideiglenes foglalást vagy holdot, és ha igen, milyen azonosítóval, élettartammal és törlési mechanizmussal?
4. A fenti három kérés után, a 3–5. foglalási lépés, vendégnév, e-mail, fizetési adat és megerősítés nélkül garantáltan nem jön létre sem foglalási rekord, sem kapacitászárolás? Pontosan melyik HTTP-végpont vagy UI-esemény az első, amelyik mentést/zárolást végez?
5. Ha az anonim munkamenetben keletkezhet átmeneti rekord, látszik-e a PMS naptárban, option/floating/várólistában vagy auditnaplóban? Hogyan ellenőrizhető a 2026-10-16–18. és 2026-10-16–19. időszak 2026-09-28-i tesztforgalma, amikor vendégnév nem szerepelt?
6. Van-e támogatott, kizárólag olvasási célú, foglalásmentes kapacitás- és **teljes ár** API/endpoint dátumra, háztípusra, felnőttszámra és gyermekek életkorára? Milyen jogosultság és dokumentáció szükséges hozzá?

Kérjük külön megerősíteni, hogy a válasz a **Previóban látható foglalások mellett a rövid életű háttérzárolásokra és függő rekordokra is** kiterjed. A válaszig a tesztági élő árlekérő biztonsági kapuja zárva marad.

## Elküldhető magyar üzenet – nem elküldve

**Tárgy:** Reservation+ névtelen árlekérés mellékhatásai – hotId 753011

Tisztelt Previo Support!

A Sárberki Horgásztó nyilvános Reservation+ foglalójából szeretnénk kizárólag szabad kapacitást és a Previo által számított teljes árat olvasni, foglalás létrehozása nélkül. Nincs hivatalos API-hozzáférésünk. A teszt után a PMS-ben nem látszott új foglalás, de az átmeneti zárolás hiánya nem igazolt, ezért a további élő lekéréseket leállítottuk.

Kérjük, erősítsék meg külön-külön, hogy az anonim PHPSESSID munkamenetben végzett (1) `POST /` (`step=1`, `arrival`, `departure`), (2) `POST /index/get-object-kind-occupancy/` (`hotId`, `obkId`, `newDesign=1`) és (3) `POST /index/get-occupancy-price/` (`formData`, `rooms`, `guestCategories`) létrehoz-e foglalást, függő/option/várólistás rekordot, rövid életű hold/lock rekordot, vagy akár átmenetileg csökkenti-e a más vendégeknek látható kapacitást? Melyik az első végpont vagy UI-művelet, amelyik ilyen mellékhatással jár?

Ha a három kérés bármelyike létrehozhat átmeneti rekordot, kérjük annak azonosítóját, élettartamát, megkeresési és biztonságos megszüntetési módját. Hogyan ellenőrizhető a 2026. szeptember 28-i névtelen tesztforgalom a 2026. október 16–18. és 16–19. tartózkodási időszakokra? Van-e támogatott, kizárólag olvasási célú kapacitás- és teljesár-API, amely kezeli a felnőtteket, gyermekek életkorát és háztípust, és milyen hozzáférés kell hozzá?

Köszönjük a technikai választ, amely a rövid idejű háttérzárolásokra is kiterjed.

Üdvözlettel,
Sárberki Horgásztó

## Sendable English message – not sent

**Subject:** Side effects of anonymous Reservation+ price queries – hotId 753011

Dear Previo Support,

We would like to read availability and the total price calculated by Previo from Sárberki Horgásztó’s public Reservation+ booking interface without creating a reservation. We do not have official API access. No new booking was visible in the PMS after our tests, but we cannot rule out transient holds, so we have stopped live queries.

Please confirm separately whether, in an anonymous PHPSESSID session, (1) `POST /` with `step=1`, `arrival`, `departure`, (2) `POST /index/get-object-kind-occupancy/` with `hotId`, `obkId`, `newDesign=1`, and (3) `POST /index/get-occupancy-price/` with `formData`, `rooms`, `guestCategories` create any reservation, pending/option/waitlist record, short-lived hold/lock, or temporarily reduce availability shown to other guests. Which endpoint or UI action is the first to do so?

If any of those calls can create a transient record, please provide its identifier, lifetime, and how to locate and safely release it. How can we audit anonymous traffic on 28 September 2026 for stays on 16–18 and 16–19 October 2026? Is there a supported read-only API for availability and the complete price by dates, accommodation type, adult count, and children’s ages, and what access is required?

Please include short-lived background holds in your technical answer.

Kind regards,
Sárberki Horgásztó
