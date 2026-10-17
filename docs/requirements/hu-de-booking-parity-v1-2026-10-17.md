# Sárberki V1 – magyar/német honlap és foglalás egységesítése

Dátum: 2026-10-17. Státusz: követelmény és ellenőrzési terv; nem igazolt implementáció.

## Cél
A sarberkito.hu magyar és német nyelvű felülete ugyanazokat a jóváhagyott szállás-, horgászat-, dézsa-, ár-, fizetési és lemondási szabályokat kommunikálja. A vendég a választott nyelven haladjon a foglalási érdeklődéstől a visszaigazolásig. A Previo a kapacitás és foglalási állapot hiteles forrása, amint az integráció rendelkezésre áll.

## Auditálandó területek
- HU/DE menük, linkek, nyelvváltás, mobilnézet, kapcsolat, adatkezelés, ÁSZF.
- Háztípusok, egységek, férőhelyek, pótágy, osztott A/B/C és 15-ös ház.
- 2026/2027 dátumhoz kötött szállás-, horgászjegy-, dézsa- és rezsiárak, pénznemek, adók, kedvezmények.
- Foglalási űrlap és Previo átadás: nyelv, dátum, létszám, háztípus, kapacitás, végösszeg, visszaigazolás, hibakezelés.
- Fizetés, előleg, lemondás, gyermekek, 15 fő feletti csoportok, törzsvendégek.
- Német szövegek minősége, minden tranzakciós és hibaüzenet nyelve.

## Előzetes tulajdonosi szabályok – forrásellenőrzést igényelnek
- 15 fő felett 80% előleg, egyébként általában 50%; 14 napon túl 7 napos, 14 napon belül 24 órás beérkezési szabály.
- Törzsvendég: 20% szállás és dézsa, utolsó tartózkodás legfeljebb 730 napja.
- A/B és 15-ös kétfős alapár; VIP/Családi/Deluxe/C legalább négyfős alapár. Osztott C alap 4 fő, maximum 5 pótággyal.
- A 15-ös ház harmadik vendége csak gyermek lehet. A dézsa házhoz rögzített, külön bérelhető.
- Gyermekár-korhatárok és díjak: tulajdonossal pontosítandók a határnapok átfedése miatt.
- A 2027-es árak nem ismertek; tilos kitalálni vagy automatikusan publikálni.

## V1 elfogadási feltételek
1. Azonos bemenet esetén HU/DE felületen azonos foglalhatósági és áreredmény, azonos szabályok.
2. Nyelvi kontextus megőrzése a teljes folyamatban, beleértve az e-mail-tervezeteket.
3. Ismeretlen kapacitás/ár esetén nincs biztos ajánlat vagy automatikus véglegesítés.
4. Emberi jóváhagyás megmarad; automatikus küldés, Previo-írás és production-módosítás tilos V1 tesztben.
5. Tesztmátrix HU/DE/EN/SI, határértékek, visszautasítások, lemondások és ismételt kérések.
6. Minden eltéréshez forrás URL, ellenőrzés dátuma, súlyosság, felelős és megoldási státusz.

## Következő lépés
A tényleges honlap és foglalómotor böngészős végigtesztelése, hiteles árlista beszerzése, majd külön javítási feladatok. Ez a dokumentum önmagában nem jelenti a honlap vagy az AI-agent módosítását.
