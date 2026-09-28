# Kérdések a Previo supportnak – Sárberki (hotId 753011)

Ezt a kérdéssort előkészítettük, **nem küldtük el**. Nincs hivatalos API-hozzáférésünk. A nyilvános Reservation+ foglalóban csak névtelen dátum-, kapacitás- és árlekérési lépésekre van szükségünk, vendégadat és foglalás létrehozása nélkül.

1. A `POST https://booking.previo.cz/` kérés `step=1`, `arrival=YYYY-MM-DD`, `departure=YYYY-MM-DD` törzzsel, anonim `PHPSESSID` munkamenetben kizárólag keresési/session állapotot hoz létre? Keletkezik-e bármilyen reservation, option, pending, waiting-list, hold vagy lock rekord a PMS-ben vagy a foglaló háttértárában?
2. A `POST /index/get-object-kind-occupancy/` (`hotId`, `obkId`, `newDesign=1`) csupán szabad kapacitást olvas, vagy bármennyi időre lefoglalhat/zárolhat egységet, illetve csökkentheti a másoknak látható kapacitást?
3. A `POST /index/get-occupancy-price/` (`formData` JSON, `rooms`, `guestCategories`) kizárólag árat számol? Létrehoz-e ideiglenes foglalást vagy holdot, és ha igen, milyen azonosítóval, élettartammal és törlési mechanizmussal?
4. A fenti három kérés után, a 3–5. foglalási lépés, vendégnév, e-mail, fizetési adat és megerősítés nélkül garantáltan nem jön létre sem foglalási rekord, sem kapacitászárolás? Pontosan melyik HTTP-végpont vagy UI-esemény az első, amelyik mentést/zárolást végez?
5. Ha az anonim munkamenetben keletkezhet átmeneti rekord, látszik-e a PMS naptárban, option/floating/várólistában vagy auditnaplóban? Hogyan ellenőrizhető a 2026-10-16–18. és 2026-10-16–19. időszak 2026-09-28-i tesztforgalma, amikor vendégnév nem szerepelt?
6. Van-e támogatott, kizárólag olvasási célú, foglalásmentes kapacitás- és **teljes ár** API/endpoint dátumra, háztípusra, felnőttszámra és gyermekek életkorára? Milyen jogosultság és dokumentáció szükséges hozzá?

Kérjük külön megerősíteni, hogy a válasz a **Previóban látható foglalások mellett a rövid életű háttérzárolásokra és függő rekordokra is** kiterjed. A válaszig a tesztági élő árlekérő biztonsági kapuja zárva marad.
