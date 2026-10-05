# Sárberki e-mail stresszteszt és hibanapló – 2026-10-05

Kiindulópont: `4aa78f3048b2d02b5207be30f7295609eaccef98`, kizárólag a `gmail-test-subject-allowlist` ág. A párhuzamosan érkezett `cc2ef8d216b0817aa950efc7db96de4bc2506c86` javításait és logóját az összevezetés megőrzi.

245 szintetikus tesztlevél, minden esetben közös feldolgozó + kézi kezelőfelület + valódi Gmail-transzformáló függvény helyi futtatása. További 11 kapacitásválasz-teszt. A teljes összevezetett csomag: 500/500 PASS. A kiinduló 245 levélből 96 nem teljesítette az adat/válasz-ellenőrzést; a javított változatban 0. A régi kapacitásmodul külön ellenőrzésének hibái az availability-before.log fájlban láthatók.

27 elkülönített hibabejegyzés: 9 kritikus, 15 közepes, 3 kisebb. A súlyosság helyi kockázati besorolás, nem automatikus eszközmérés. Az azonos hiba több levélváltozatban nem számít új hibának. A H18 a javítás közben előhozott és megszüntetett regresszió.

Nincs ismert nyitott hiba a rögzített tesztekben. Ez nem jelenti tetszőleges vendéglevél teljes nyelvi lefedettségét vagy éles üzemre alkalmasságot. Relatív/bizonytalan dátumokra pontosító kérdés kell; ezekből nem készül kitalált pontos időszak. Ritka idézetformátumok és összetett tagadások további valós, anonimizált mintákat igényelnek.

A korábbi, visszakérdezést tiltó két elvárást a felhasználó jelenlegi utasításához igazítottuk: kapacitás alapján ajánlás, majd háztípus-választás bekérése; ismeretlen felnőttszámot be kell kérni. A Gmail szó szerinti forrásregex-tesztjeit a közös segédfüggvényre frissítettük; helyettük is 245 viselkedési Gmail-ellenőrzés fut.

Nincs élő Gmail/PMS hálózati hívás, levélküldés, Previo-foglalás vagy production-változtatás. A pushhoz tartozó opcionális élő Previo-smoke teszt nem indul el automatikusan; külön kézi workflow-indítás szükséges hozzá.

Következő lépés: anonimizált valódi válaszláncok tesztkészlete, különösen Outlook-idézetek, több alternatív időszak és egymást javító állítások. Az Osztott A/B/C egyedi egységmegfeleltetés és az élő Previo mellékhatásmentesség igazolása külön korábbi nyitott projektpont.

## H01 – Érvénytelen és fordított naptári időszak

- Típus: dátum; súlyosság: kritikus.
- Javítás: Naptári érvényesség és távozás > érkezés ellenőrzése minden dátumformátum után..
- Állapot: JAVÍTVA; célzott regresszió és teljes csomag PASS.

Tesztazonosító: `invalid-53`

Bemeneti levél:
```text
2026-02-30 – 2026-03-02. Deluxe, 4 fő.
```

Elvárt értelmezés:
```json
{
  "arrival": null,
  "departure": null,
  "nights": null
}
```

Tényleges értelmezés a javítás előtt:
```json
{
  "core": {
    "arrival": "2026-02-30",
    "departure": "2026-03-02",
    "nights": 0,
    "adults": null,
    "children": null,
    "childAges": [],
    "guests": 4,
    "cabin": "Deluxe",
    "unitsRequested": null,
    "hotTubRequested": false,
    "petRequested": false,
    "fishingQuestion": false,
    "parking": false,
    "phone": "2026-02-30",
    "specialRequests": []
  },
  "ui": {
    "arrival": "2026-02-30",
    "departure": "2026-03-02",
    "email": "2026-02-30",
    "name": "",
    "adults": "",
    "children": "",
    "child_ages": "",
    "guests": "4",
    "units_requested": "",
    "unit": "Deluxe",
    "nights": "",
    "language": "HU",
    "request": ""
  },
  "gmail": {
    "language": "hu",
    "cabin": "Deluxe",
    "dates": {
      "arrival": "2026-02-30",
      "departure": "2026-03-02",
      "inferredYear": false
    },
    "guests": 4,
    "adults": null,
    "children": null,
    "child_ages": [],
    "phone": "2026-02-30",
    "units_requested": null,
    "units_open": false,
    "pier_requested": false,
    "hot_tub_requested": false,
    "pet_requested": false
  }
}
```

Elvárt válasz: Naptári érvényesség és távozás > érkezés ellenőrzése minden dátumformátum után.
Automatikus válaszelvárás: `/pontos.*dátum|érkezési/`; tiltott részlet: ``.

Tényleges válasz a javítás előtt (core / UI / Gmail):
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

30.02.2026 és 02.03.2026 között összesen 4 fő szeretnének érkezni.

Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is.

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- UI ---
Kedves Vendégünk!

Köszönjük érdeklődését.

30.02.2026 és 02.03.2026 között összesen 4 fő szeretnének érkezni.

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- Gmail ---
Kedves Vendégünk!

Köszönjük érdeklődését.

30.02.2026 és 02.03.2026 között összesen 4 fő szeretnének érkezni.

Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is.

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

Javítás utáni válasz:
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

A kért háztípus: Deluxe.

Kérjük, írja meg a pontos érkezési és távozási dátumot. Kérjük, írja meg, hány felnőtt érkezik. Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is. Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

## H02 – Több időszakból az első csendes kiválasztása

- Típus: dátum; súlyosság: kritikus.
- Javítás: Több eltérő értelmezhető időszak esetén null és pontosító kérdés; UI-fallback nem állíthatja vissza..
- Állapot: JAVÍTVA; célzott regresszió és teljes csomag PASS.

Tesztazonosító: `two-ranges`

Bemeneti levél:
```text
2026. október 16-18. vagy 2026. november 20-22. Deluxe, 4 fő.
```

Elvárt értelmezés:
```json
{
  "arrival": null,
  "departure": null,
  "nights": null
}
```

Tényleges értelmezés a javítás előtt:
```json
{
  "core": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "nights": 2,
    "adults": null,
    "children": null,
    "childAges": [],
    "guests": 4,
    "cabin": "Deluxe",
    "unitsRequested": null,
    "hotTubRequested": false,
    "petRequested": false,
    "fishingQuestion": false,
    "parking": false,
    "phone": null,
    "specialRequests": []
  },
  "ui": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "email": "test@example.invalid",
    "name": "",
    "adults": "",
    "children": "",
    "child_ages": "",
    "guests": "4",
    "units_requested": "",
    "unit": "Deluxe",
    "nights": "2",
    "language": "HU",
    "request": ""
  },
  "gmail": {
    "language": "hu",
    "cabin": "Deluxe",
    "dates": {
      "arrival": "2026-10-16",
      "departure": "2026-10-18",
      "inferredYear": false
    },
    "guests": 4,
    "adults": null,
    "children": null,
    "child_ages": [],
    "phone": null,
    "units_requested": null,
    "units_open": false,
    "pier_requested": false,
    "hot_tub_requested": false,
    "pet_requested": false
  }
}
```

Elvárt válasz: Több eltérő értelmezhető időszak esetén null és pontosító kérdés; UI-fallback nem állíthatja vissza.
Automatikus válaszelvárás: `/pontos/`; tiltott részlet: ``.

Tényleges válasz a javítás előtt (core / UI / Gmail):
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő szeretnének érkezni.

Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is. Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- UI ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő szeretnének érkezni.

Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- Gmail ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő szeretnének érkezni.

Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is. Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

Javítás utáni válasz:
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

A kért háztípus: Deluxe.

Kérjük, írja meg a pontos érkezési és távozási dátumot. Kérjük, írja meg, hány felnőtt érkezik. Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is. Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

## H03 – Dátum telefonszámként felismerése

- Típus: parsing; súlyosság: közepes.
- Javítás: Telefonjelölés és nemzetközi előhívó előnyt élvez; dátumminták kizárása..
- Állapot: JAVÍTVA; célzott regresszió és teljes csomag PASS.

Tesztazonosító: `date-phone`

Bemeneti levél:
```text
2026.10.16-2026.10.18. Deluxe. 4 fő.
```

Elvárt értelmezés:
```json
{
  "arrival": "2026-10-16",
  "departure": "2026-10-18",
  "nights": 2,
  "phone": null
}
```

Tényleges értelmezés a javítás előtt:
```json
{
  "core": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "nights": 2,
    "adults": null,
    "children": null,
    "childAges": [],
    "guests": 4,
    "cabin": "Deluxe",
    "unitsRequested": null,
    "hotTubRequested": false,
    "petRequested": false,
    "fishingQuestion": false,
    "parking": false,
    "phone": "2026.10.16-2026.10.1",
    "specialRequests": []
  },
  "ui": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "email": "2026.10.16-2026.10.1",
    "name": "",
    "adults": "",
    "children": "",
    "child_ages": "",
    "guests": "4",
    "units_requested": "",
    "unit": "Deluxe",
    "nights": "2",
    "language": "HU",
    "request": ""
  },
  "gmail": {
    "language": "hu",
    "cabin": "Deluxe",
    "dates": {
      "arrival": "2026-10-16",
      "departure": "2026-10-18",
      "inferredYear": false
    },
    "guests": 4,
    "adults": null,
    "children": null,
    "child_ages": [],
    "phone": "2026.10.16-2026.10.1",
    "units_requested": null,
    "units_open": false,
    "pier_requested": false,
    "hot_tub_requested": false,
    "pet_requested": false
  }
}
```

Elvárt válasz: Telefonjelölés és nemzetközi előhívó előnyt élvez; dátumminták kizárása.
Automatikus válaszelvárás: `/telefonszám/`; tiltott részlet: ``.

Tényleges válasz a javítás előtt (core / UI / Gmail):
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő szeretnének érkezni.

Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is.

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- UI ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő szeretnének érkezni.

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- Gmail ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő szeretnének érkezni.

Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is.

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

Javítás utáni válasz:
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő szeretnének érkezni.

A kért háztípus: Deluxe.

Kérjük, írja meg, hány felnőtt érkezik. Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is. Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

## H04 – Foglalási azonosító telefonszámként felismerése

- Típus: parsing; súlyosság: közepes.
- Javítás: Címkézett foglalási azonosítók kizárása a telefonszámkeresésből..
- Állapot: JAVÍTVA; célzott regresszió és teljes csomag PASS.

Tesztazonosító: `booking-phone`

Bemeneti levél:
```text
Foglalási szám: 2026101618. Deluxe, október 16-18. 4 fő.
```

Elvárt értelmezés:
```json
{
  "arrival": "2026-10-16",
  "departure": "2026-10-18",
  "nights": 2,
  "phone": null
}
```

Tényleges értelmezés a javítás előtt:
```json
{
  "core": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "nights": 2,
    "adults": null,
    "children": null,
    "childAges": [],
    "guests": 4,
    "cabin": "Deluxe",
    "unitsRequested": null,
    "hotTubRequested": false,
    "petRequested": false,
    "fishingQuestion": false,
    "parking": false,
    "phone": "2026101618",
    "specialRequests": []
  },
  "ui": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "email": "2026101618",
    "name": "",
    "adults": "",
    "children": "",
    "child_ages": "",
    "guests": "4",
    "units_requested": "",
    "unit": "Deluxe",
    "nights": "2",
    "language": "HU",
    "request": ""
  },
  "gmail": {
    "language": "hu",
    "cabin": "Deluxe",
    "dates": {
      "arrival": "2026-10-16",
      "departure": "2026-10-18",
      "inferredYear": true
    },
    "guests": 4,
    "adults": null,
    "children": null,
    "child_ages": [],
    "phone": "2026101618",
    "units_requested": null,
    "units_open": false,
    "pier_requested": false,
    "hot_tub_requested": false,
    "pet_requested": false
  }
}
```

Elvárt válasz: Címkézett foglalási azonosítók kizárása a telefonszámkeresésből.
Automatikus válaszelvárás: ``; tiltott részlet: ``.

Tényleges válasz a javítás előtt (core / UI / Gmail):
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő szeretnének érkezni.

Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is.

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- UI ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő szeretnének érkezni.

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- Gmail ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő szeretnének érkezni.

Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is.

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

Javítás utáni válasz:
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő szeretnének érkezni.

A kért háztípus: Deluxe.

Kérjük, írja meg, hány felnőtt érkezik. Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is. Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

## H05 – Idézett előzményből háztípus és létszám átvétele

- Típus: parsing; súlyosság: kritikus.
- Javítás: Aktuális üzenetrész közös leválasztása; az eredeti teljes levél megmarad a Gmail rekordban..
- Állapot: JAVÍTVA; célzott regresszió és teljes csomag PASS.

Tesztazonosító: `quote-68`

Bemeneti levél:
```text
2026. október 16-18. Családi. 2 felnőtt és 1 gyerek, 7 éves. Telefon: +36 30 555 1234.
On Monday, Guest wrote:
2025. november 10-12. VIP. 8 fő. Telefon: +36 20 111 2222.
```

Elvárt értelmezés:
```json
{
  "arrival": "2026-10-16",
  "departure": "2026-10-18",
  "nights": 2,
  "cabin": "Családi",
  "guests": 3,
  "children": 1,
  "childAges": [
    7
  ],
  "phone": "+36 30 555 1234"
}
```

Tényleges értelmezés a javítás előtt:
```json
{
  "core": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "nights": 2,
    "adults": 2,
    "children": 1,
    "childAges": [
      7
    ],
    "guests": 8,
    "cabin": "? – emberi döntésre vár",
    "unitsRequested": null,
    "hotTubRequested": false,
    "petRequested": false,
    "fishingQuestion": false,
    "parking": false,
    "phone": "+36 30 555 1234",
    "specialRequests": []
  },
  "ui": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "email": "+36 30 555 1234",
    "name": "",
    "adults": "2",
    "children": "1",
    "child_ages": "7",
    "guests": "8",
    "units_requested": "",
    "unit": "Családi",
    "nights": "2",
    "language": "HU",
    "request": ""
  },
  "gmail": {
    "language": "hu",
    "cabin": "? – emberi döntésre vár",
    "dates": {
      "arrival": "2026-10-16",
      "departure": "2026-10-18",
      "inferredYear": false
    },
    "guests": 8,
    "adults": 2,
    "children": 1,
    "child_ages": [
      7
    ],
    "phone": "+36 30 555 1234",
    "units_requested": null,
    "units_open": false,
    "pier_requested": false,
    "hot_tub_requested": false,
    "pet_requested": false
  }
}
```

Elvárt válasz: Aktuális üzenetrész közös leválasztása; az eredeti teljes levél megmarad a Gmail rekordban.
Automatikus válaszelvárás: ``; tiltott részlet: ``.

Tényleges válasz a javítás előtt (core / UI / Gmail):
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 8 fő (7 felnőtt és 1 gyermek, 7 évesek) szeretnének érkezni.

A megadott létszám alapján ellenőrizzük az összes megfelelő szállástípust és csak a ténylegesen szabad lehetőségeket ajánljuk fel.

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- UI ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 8 fő (7 felnőtt és 1 gyermek, 7 évesek) szeretnének érkezni.

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- Gmail ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 8 fő (7 felnőtt és 1 gyermek, 7 évesek) szeretnének érkezni.

A megadott létszám alapján ellenőrizzük az összes megfelelő szállástípust és csak a ténylegesen szabad lehetőségeket ajánljuk fel.

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

Javítás utáni válasz:
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 3 fő (2 felnőtt és 1 gyermek, 7 éves) szeretnének érkezni.

A kért háztípus: Családi.

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

## H06 – Szöveges összlétszám figyelmen kívül hagyása

- Típus: létszám; súlyosság: kritikus.
- Javítás: Az összesen hárman típusú kifejezés elsőbbséget kap az összegzett komponensekkel szemben..
- Állapot: JAVÍTVA; célzott regresszió és teljes csomag PASS.

Tesztazonosító: `word-conflict`

Bemeneti levél:
```text
2026. október 16-18. Deluxe. 2 felnőtt és 2 gyerek, de összesen hárman mennénk.
```

Elvárt értelmezés:
```json
{
  "arrival": "2026-10-16",
  "departure": "2026-10-18",
  "nights": 2,
  "guests": 3,
  "adults": 2,
  "children": 2
}
```

Tényleges értelmezés a javítás előtt:
```json
{
  "core": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "nights": 2,
    "adults": 2,
    "children": 2,
    "childAges": [],
    "guests": 4,
    "cabin": "Deluxe",
    "unitsRequested": null,
    "hotTubRequested": false,
    "petRequested": false,
    "fishingQuestion": false,
    "parking": false,
    "phone": null,
    "specialRequests": []
  },
  "ui": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "email": "test@example.invalid",
    "name": "",
    "adults": "2",
    "children": "2",
    "child_ages": "",
    "guests": "4",
    "units_requested": "",
    "unit": "Deluxe",
    "nights": "2",
    "language": "HU",
    "request": ""
  },
  "gmail": {
    "language": "hu",
    "cabin": "Deluxe",
    "dates": {
      "arrival": "2026-10-16",
      "departure": "2026-10-18",
      "inferredYear": false
    },
    "guests": 4,
    "adults": 2,
    "children": 2,
    "child_ages": [],
    "phone": null,
    "units_requested": null,
    "units_open": false,
    "pier_requested": false,
    "hot_tub_requested": false,
    "pet_requested": false
  }
}
```

Elvárt válasz: Az összesen hárman típusú kifejezés elsőbbséget kap az összegzett komponensekkel szemben.
Automatikus válaszelvárás: `/pontosít|clarif/`; tiltott részlet: `/1 felnőtt/`.

Tényleges válasz a javítás előtt (core / UI / Gmail):
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő (2 felnőtt és 2 gyermek) szeretnének érkezni.

Kérjük, írja meg a gyermek életkorát, több gyermek esetén mindegyikét. Megírna egy telefonszámot, amelyen elérhetjük?

A szabad kapacitást és az árat külön ellenőrizzük; ezekről csak hiteles ellenőrzés után adunk biztos tájékoztatást.

Üdvözlettel:
Sárberki Horgásztó

--- UI ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő (2 felnőtt és 2 gyermek) szeretnének érkezni.

Kérjük, írja meg a gyermek életkorát, több gyermek esetén mindegyikét. Megírna egy telefonszámot, amelyen elérhetjük?

A szabad kapacitást és az árat külön ellenőrizzük; ezekről csak hiteles ellenőrzés után adunk biztos tájékoztatást.

Üdvözlettel:
Sárberki Horgásztó

--- Gmail ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő (2 felnőtt és 2 gyermek) szeretnének érkezni.

Kérjük, írja meg a gyermek életkorát, több gyermek esetén mindegyikét. Megírna egy telefonszámot, amelyen elérhetjük?

A szabad kapacitást és az árat külön ellenőrizzük; ezekről csak hiteles ellenőrzés után adunk biztos tájékoztatást.

Üdvözlettel:
Sárberki Horgásztó
```

Javítás utáni válasz:
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

A kért háztípus: Deluxe.

Kérjük, pontosítsa a létszámot: az összlétszám eltér a megadott felnőttek és gyermekek összegétől. Kérjük, írja meg a gyermek életkorát, több gyermek esetén mindegyikét. Megírna egy telefonszámot, amelyen elérhetjük?

A szabad kapacitást és az árat külön ellenőrizzük; ezekről csak hiteles ellenőrzés után adunk biztos tájékoztatást.

Üdvözlettel:
Sárberki Horgásztó
```

## H07 – Ellentmondó létszámhoz kitalált felnőttszám

- Típus: üzleti logika; súlyosság: kritikus.
- Javítás: Eltérő összlétszám esetén nincs megerősítő összefoglaló; célzott pontosítás kérendő. Mindkét adapter átadja a felnőttszámot..
- Állapot: JAVÍTVA; célzott regresszió és teljes csomag PASS.

Tesztazonosító: `digit-conflict`

Bemeneti levél:
```text
2026. október 16-18. Deluxe. Összesen 3 fő: 2 felnőtt és 2 gyermek, 7 és 11 évesek.
```

Elvárt értelmezés:
```json
{
  "arrival": "2026-10-16",
  "departure": "2026-10-18",
  "nights": 2,
  "guests": 3,
  "adults": 2,
  "children": 2
}
```

Tényleges értelmezés a javítás előtt:
```json
{
  "core": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "nights": 2,
    "adults": 2,
    "children": 2,
    "childAges": [
      7,
      11
    ],
    "guests": 3,
    "cabin": "Deluxe",
    "unitsRequested": null,
    "hotTubRequested": false,
    "petRequested": false,
    "fishingQuestion": false,
    "parking": false,
    "phone": null,
    "specialRequests": []
  },
  "ui": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "email": "test@example.invalid",
    "name": "",
    "adults": "2",
    "children": "2",
    "child_ages": "7, 11",
    "guests": "3",
    "units_requested": "",
    "unit": "Deluxe",
    "nights": "2",
    "language": "HU",
    "request": ""
  },
  "gmail": {
    "language": "hu",
    "cabin": "Deluxe",
    "dates": {
      "arrival": "2026-10-16",
      "departure": "2026-10-18",
      "inferredYear": false
    },
    "guests": 3,
    "adults": 2,
    "children": 2,
    "child_ages": [
      7,
      11
    ],
    "phone": null,
    "units_requested": null,
    "units_open": false,
    "pier_requested": false,
    "hot_tub_requested": false,
    "pet_requested": false
  }
}
```

Elvárt válasz: Eltérő összlétszám esetén nincs megerősítő összefoglaló; célzott pontosítás kérendő. Mindkét adapter átadja a felnőttszámot.
Automatikus válaszelvárás: `/pontosít/`; tiltott részlet: `/1 felnőtt/`.

Tényleges válasz a javítás előtt (core / UI / Gmail):
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 3 fő (1 felnőtt és 2 gyermek, 7 és 11 évesek) szeretnének érkezni.

Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- UI ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 3 fő (1 felnőtt és 2 gyermek, 7 és 11 évesek) szeretnének érkezni.

Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- Gmail ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 3 fő (1 felnőtt és 2 gyermek, 7 és 11 évesek) szeretnének érkezni.

Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

Javítás utáni válasz:
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

A kért háztípus: Deluxe.

Kérjük, pontosítsa a létszámot: az összlétszám eltér a megadott felnőttek és gyermekek összegétől. Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

## H08 – Hiányzó gyermekadat nullának kezelése

- Típus: hiányzó adat; súlyosság: közepes.
- Javítás: A null/üres gyermekadat ismeretlen marad; a Number(null) nem szolgálhat következtetés alapjául..
- Állapot: JAVÍTVA; célzott regresszió és teljes csomag PASS.

Tesztazonosító: `unknown-children`

Bemeneti levél:
```text
2026. október 16-18. Deluxe. 6 fő.
```

Elvárt értelmezés:
```json
{
  "arrival": "2026-10-16",
  "departure": "2026-10-18",
  "nights": 2,
  "children": null,
  "adults": null,
  "childAges": []
}
```

Tényleges értelmezés a javítás előtt:
```json
{
  "core": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "nights": 2,
    "adults": null,
    "children": null,
    "childAges": [],
    "guests": 6,
    "cabin": "Deluxe",
    "unitsRequested": null,
    "hotTubRequested": false,
    "petRequested": false,
    "fishingQuestion": false,
    "parking": false,
    "phone": null,
    "specialRequests": []
  },
  "ui": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "email": "test@example.invalid",
    "name": "",
    "adults": "",
    "children": "",
    "child_ages": "",
    "guests": "6",
    "units_requested": "",
    "unit": "Deluxe",
    "nights": "2",
    "language": "HU",
    "request": ""
  },
  "gmail": {
    "language": "hu",
    "cabin": "Deluxe",
    "dates": {
      "arrival": "2026-10-16",
      "departure": "2026-10-18",
      "inferredYear": false
    },
    "guests": 6,
    "adults": null,
    "children": null,
    "child_ages": [],
    "phone": null,
    "units_requested": null,
    "units_open": false,
    "pier_requested": false,
    "hot_tub_requested": false,
    "pet_requested": false
  }
}
```

Elvárt válasz: A null/üres gyermekadat ismeretlen marad; a Number(null) nem szolgálhat következtetés alapjául.
Automatikus válaszelvárás: `/érkezik-e gyermek|gyermekek száma/`; tiltott részlet: `/6 felnőtt/`.

Tényleges válasz a javítás előtt (core / UI / Gmail):
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 6 fő szeretnének érkezni.

Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is. Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- UI ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 6 fő szeretnének érkezni.

Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- Gmail ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 6 fő szeretnének érkezni.

Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is. Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

Javítás utáni válasz:
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 6 fő szeretnének érkezni.

A kért háztípus: Deluxe.

Kérjük, írja meg, hány felnőtt érkezik. Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is. Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

## H09 – Hiányzó háztípusnál nincs konkrét kapacitásajánlás és visszakérdezés

- Típus: háztípus; súlyosság: közepes.
- Javítás: Kapacitásból lehetséges típusok felsorolása, tényleges elérhetőségi állítás nélkül, majd típusválasztás bekérése..
- Állapot: JAVÍTVA; célzott regresszió és teljes csomag PASS.

Tesztazonosító: `cabin-0`

Bemeneti levél:
```text
2026. október 16-18. 6 fő. faház.
```

Elvárt értelmezés:
```json
{
  "arrival": "2026-10-16",
  "departure": "2026-10-18",
  "nights": 2,
  "cabin": "? – emberi döntésre vár",
  "adults": null,
  "children": null
}
```

Tényleges értelmezés a javítás előtt:
```json
{
  "core": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "nights": 2,
    "adults": null,
    "children": null,
    "childAges": [],
    "guests": 6,
    "cabin": "? – emberi döntésre vár",
    "unitsRequested": null,
    "hotTubRequested": false,
    "petRequested": false,
    "fishingQuestion": false,
    "parking": false,
    "phone": null,
    "specialRequests": []
  },
  "ui": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "email": "test@example.invalid",
    "name": "",
    "adults": "",
    "children": "",
    "child_ages": "",
    "guests": "6",
    "units_requested": "",
    "unit": "faház",
    "nights": "2",
    "language": "HU",
    "request": ""
  },
  "gmail": {
    "language": "hu",
    "cabin": "? – emberi döntésre vár",
    "dates": {
      "arrival": "2026-10-16",
      "departure": "2026-10-18",
      "inferredYear": false
    },
    "guests": 6,
    "adults": null,
    "children": null,
    "child_ages": [],
    "phone": null,
    "units_requested": null,
    "units_open": false,
    "pier_requested": false,
    "hot_tub_requested": false,
    "pet_requested": false
  }
}
```

Elvárt válasz: Kapacitásból lehetséges típusok felsorolása, tényleges elérhetőségi állítás nélkül, majd típusválasztás bekérése.
Automatikus válaszelvárás: `/háztípus|accommodation|Unterkunft/`; tiltott részlet: `/6 felnőtt/`.

Tényleges válasz a javítás előtt (core / UI / Gmail):
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 6 fő szeretnének érkezni.

A megadott létszám alapján ellenőrizzük az összes megfelelő szállástípust és csak a ténylegesen szabad lehetőségeket ajánljuk fel.

Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is. Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- UI ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 6 fő szeretnének érkezni.

Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- Gmail ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 6 fő szeretnének érkezni.

A megadott létszám alapján ellenőrizzük az összes megfelelő szállástípust és csak a ténylegesen szabad lehetőségeket ajánljuk fel.

Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is. Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

Javítás utáni válasz:
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 6 fő szeretnének érkezni.

A megadott létszám alapján ellenőrizzük az összes megfelelő szállástípust és csak a ténylegesen szabad lehetőségeket ajánljuk fel.
Kapacitás alapján szóba jöhet: Deluxe, Családi, VIP vagy több egység kombinációja. Ezek elérhetőségét külön ellenőrizzük.

Kérjük, írja meg, hány felnőtt érkezik. Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is. Megírna egy telefonszámot, amelyen elérhetjük? Melyik háztípust szeretné: VIP, Családi, Deluxe vagy Osztott?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

## H10 – Deluxe vagy családi esetén UI egy típust választ

- Típus: háztípus; súlyosság: közepes.
- Javítás: A teljes üzenet közös típusértékelése elsőbbséget kap az első kulcsszóval szemben; általános faház nem konkrét típus..
- Állapot: JAVÍTVA; célzott regresszió és teljes csomag PASS.

Tesztazonosító: `cabin-4`

Bemeneti levél:
```text
2026. október 16-18. 6 fő. Deluxe vagy családi, mindegy.
```

Elvárt értelmezés:
```json
{
  "arrival": "2026-10-16",
  "departure": "2026-10-18",
  "nights": 2,
  "cabin": "? – emberi döntésre vár",
  "adults": null,
  "children": null
}
```

Tényleges értelmezés a javítás előtt:
```json
{
  "core": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "nights": 2,
    "adults": null,
    "children": null,
    "childAges": [],
    "guests": 6,
    "cabin": "? – emberi döntésre vár",
    "unitsRequested": null,
    "hotTubRequested": false,
    "petRequested": false,
    "fishingQuestion": false,
    "parking": false,
    "phone": null,
    "specialRequests": []
  },
  "ui": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "email": "test@example.invalid",
    "name": "",
    "adults": "",
    "children": "",
    "child_ages": "",
    "guests": "6",
    "units_requested": "",
    "unit": "Deluxe",
    "nights": "2",
    "language": "HU",
    "request": ""
  },
  "gmail": {
    "language": "hu",
    "cabin": "? – emberi döntésre vár",
    "dates": {
      "arrival": "2026-10-16",
      "departure": "2026-10-18",
      "inferredYear": false
    },
    "guests": 6,
    "adults": null,
    "children": null,
    "child_ages": [],
    "phone": null,
    "units_requested": null,
    "units_open": false,
    "pier_requested": false,
    "hot_tub_requested": false,
    "pet_requested": false
  }
}
```

Elvárt válasz: A teljes üzenet közös típusértékelése elsőbbséget kap az első kulcsszóval szemben; általános faház nem konkrét típus.
Automatikus válaszelvárás: `/háztípus|accommodation|Unterkunft/`; tiltott részlet: `/6 felnőtt/`.

Tényleges válasz a javítás előtt (core / UI / Gmail):
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 6 fő szeretnének érkezni.

A megadott létszám alapján ellenőrizzük az összes megfelelő szállástípust és csak a ténylegesen szabad lehetőségeket ajánljuk fel.

Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is. Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- UI ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 6 fő szeretnének érkezni.

Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- Gmail ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 6 fő szeretnének érkezni.

A megadott létszám alapján ellenőrizzük az összes megfelelő szállástípust és csak a ténylegesen szabad lehetőségeket ajánljuk fel.

Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is. Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

Javítás utáni válasz:
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 6 fő szeretnének érkezni.

A megadott létszám alapján ellenőrizzük az összes megfelelő szállástípust és csak a ténylegesen szabad lehetőségeket ajánljuk fel.
Kapacitás alapján szóba jöhet: Deluxe, Családi, VIP vagy több egység kombinációja. Ezek elérhetőségét külön ellenőrizzük.

Kérjük, írja meg, hány felnőtt érkezik. Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is. Megírna egy telefonszámot, amelyen elérhetjük? Melyik háztípust szeretné: VIP, Családi, Deluxe vagy Osztott?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

## H11 – Az ismert háztípus hiányzik a vendégválaszból

- Típus: stílus; súlyosság: kisebb.
- Javítás: Ismert, konkrét kért háztípus külön megjelenik a válaszban..
- Állapot: JAVÍTVA; célzott regresszió és teljes csomag PASS.

Tesztazonosító: `known-cabin`

Bemeneti levél:
```text
2026. október 16-18. Családi. 2 felnőtt és 1 gyerek, 7 éves.
```

Elvárt értelmezés:
```json
{
  "arrival": "2026-10-16",
  "departure": "2026-10-18",
  "nights": 2,
  "cabin": "Családi"
}
```

Tényleges értelmezés a javítás előtt:
```json
{
  "core": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "nights": 2,
    "adults": 2,
    "children": 1,
    "childAges": [
      7
    ],
    "guests": 3,
    "cabin": "Családi",
    "unitsRequested": null,
    "hotTubRequested": false,
    "petRequested": false,
    "fishingQuestion": false,
    "parking": false,
    "phone": null,
    "specialRequests": []
  },
  "ui": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "email": "test@example.invalid",
    "name": "",
    "adults": "2",
    "children": "1",
    "child_ages": "7",
    "guests": "3",
    "units_requested": "",
    "unit": "Családi",
    "nights": "2",
    "language": "HU",
    "request": ""
  },
  "gmail": {
    "language": "hu",
    "cabin": "Családi",
    "dates": {
      "arrival": "2026-10-16",
      "departure": "2026-10-18",
      "inferredYear": false
    },
    "guests": 3,
    "adults": 2,
    "children": 1,
    "child_ages": [
      7
    ],
    "phone": null,
    "units_requested": null,
    "units_open": false,
    "pier_requested": false,
    "hot_tub_requested": false,
    "pet_requested": false
  }
}
```

Elvárt válasz: Ismert, konkrét kért háztípus külön megjelenik a válaszban.
Automatikus válaszelvárás: `/Családi/`; tiltott részlet: ``.

Tényleges válasz a javítás előtt (core / UI / Gmail):
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 3 fő (2 felnőtt és 1 gyermek, 7 évesek) szeretnének érkezni.

Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- UI ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 3 fő (2 felnőtt és 1 gyermek, 7 évesek) szeretnének érkezni.

Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- Gmail ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 3 fő (2 felnőtt és 1 gyermek, 7 évesek) szeretnének érkezni.

Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

Javítás utáni válasz:
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 3 fő (2 felnőtt és 1 gyermek, 7 éves) szeretnének érkezni.

A kért háztípus: Családi.

Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

## H12 – Jövőre megfogalmazás egyes dátumformátumoknál elveszik

- Típus: dátum; súlyosság: közepes.
- Javítás: A következő év értelmezése az összes dátumág után egységesen történik..
- Állapot: JAVÍTVA; célzott regresszió és teljes csomag PASS.

Tesztazonosító: `next-year-de`

Bemeneti levél:
```text
Nächstes Jahr vom 16. bis 18. Oktober, 4 Personen. Deluxe.
```

Elvárt értelmezés:
```json
{
  "arrival": "2027-10-16",
  "departure": "2027-10-18",
  "nights": 2
}
```

Tényleges értelmezés a javítás előtt:
```json
{
  "core": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "nights": 2,
    "adults": null,
    "children": null,
    "childAges": [],
    "guests": 4,
    "cabin": "Deluxe",
    "unitsRequested": null,
    "hotTubRequested": false,
    "petRequested": false,
    "fishingQuestion": false,
    "parking": false,
    "phone": null,
    "specialRequests": []
  },
  "ui": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "email": "test@example.invalid",
    "name": "",
    "adults": "",
    "children": "",
    "child_ages": "",
    "guests": "4",
    "units_requested": "",
    "unit": "Deluxe",
    "nights": "2",
    "language": "DE",
    "request": ""
  },
  "gmail": {
    "language": "de",
    "cabin": "Deluxe",
    "dates": {
      "arrival": "2026-10-16",
      "departure": "2026-10-18",
      "inferredYear": true
    },
    "guests": 4,
    "adults": null,
    "children": null,
    "child_ages": [],
    "phone": null,
    "units_requested": null,
    "units_open": false,
    "pier_requested": false,
    "hot_tub_requested": false,
    "pet_requested": false
  }
}
```

Elvárt válasz: A következő év értelmezése az összes dátumág után egységesen történik.
Automatikus válaszelvárás: ``; tiltott részlet: ``.

Tényleges válasz a javítás előtt (core / UI / Gmail):
```text
Guten Tag!

Vielen Dank für Ihre Anfrage.

Sie möchten vom 16.10.2026 bis 18.10.2026 mit 4 Personen bei uns übernachten.

Bitte teilen Sie uns mit, ob auch Kinder mitreisen. Falls ja, teilen Sie uns bitte auch das Alter der Kinder mit. Bitte teilen Sie uns eine Telefonnummer mit, unter der wir Sie erreichen können.

Wir prüfen die angegebenen Daten und melden uns mit den nötigen Details.

Mit freundlichen Grüßen
Sárberki Horgásztó

--- UI ---
Guten Tag!

Vielen Dank für Ihre Anfrage.

Sie möchten vom 16.10.2026 bis 18.10.2026 mit 4 Personen bei uns übernachten.

Bitte teilen Sie uns eine Telefonnummer mit, unter der wir Sie erreichen können.

Wir prüfen die angegebenen Daten und melden uns mit den nötigen Details.

Mit freundlichen Grüßen
Sárberki Horgásztó

--- Gmail ---
Guten Tag!

Vielen Dank für Ihre Anfrage.

Sie möchten vom 16.10.2026 bis 18.10.2026 mit 4 Personen bei uns übernachten.

Bitte teilen Sie uns mit, ob auch Kinder mitreisen. Falls ja, teilen Sie uns bitte auch das Alter der Kinder mit. Bitte teilen Sie uns eine Telefonnummer mit, unter der wir Sie erreichen können.

Wir prüfen die angegebenen Daten und melden uns mit den nötigen Details.

Mit freundlichen Grüßen
Sárberki Horgásztó
```

Javítás utáni válasz:
```text
Guten Tag!

Vielen Dank für Ihre Anfrage.

Sie möchten vom 16.10.2027 bis 18.10.2027 mit 4 Personen bei uns übernachten.

Gewünschter Haustyp: Deluxe.

Bitte teilen Sie uns mit, wie viele Erwachsene anreisen. Bitte teilen Sie uns mit, ob auch Kinder mitreisen. Falls ja, teilen Sie uns bitte auch das Alter der Kinder mit. Bitte teilen Sie uns eine Telefonnummer mit, unter der wir Sie erreichen können.

Wir prüfen die angegebenen Daten und melden uns mit den nötigen Details.

Mit freundlichen Grüßen
Sárberki Horgásztó
```

## H13 – Gyermekéletkor listába telefon részei kerülnek

- Típus: parsing; súlyosság: kritikus.
- Javítás: Életkorlista csak összekötött számokból áll; telefon és dátum nem kerülhet a listába..
- Állapot: JAVÍTVA; célzott regresszió és teljes csomag PASS.

Tesztazonosító: `age-phone`

Bemeneti levél:
```text
We would like Deluxe October 16-18 2026, 2 adults and 1 child aged 7, phone +36 30 555 1234.
```

Elvárt értelmezés:
```json
{
  "arrival": "2026-10-16",
  "departure": "2026-10-18",
  "nights": 2,
  "childAges": [
    7
  ],
  "phone": "+36 30 555 1234"
}
```

Tényleges értelmezés a javítás előtt:
```json
{
  "core": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "nights": 2,
    "adults": 2,
    "children": 1,
    "childAges": [
      7,
      36,
      30
    ],
    "guests": 3,
    "cabin": "Deluxe",
    "unitsRequested": null,
    "hotTubRequested": false,
    "petRequested": false,
    "fishingQuestion": false,
    "parking": false,
    "phone": "16-18 2026",
    "specialRequests": []
  },
  "ui": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "email": "16-18 2026",
    "name": "",
    "adults": "2",
    "children": "1",
    "child_ages": "7, 36, 30",
    "guests": "3",
    "units_requested": "",
    "unit": "Deluxe",
    "nights": "2",
    "language": "EN",
    "request": ""
  },
  "gmail": {
    "language": "en",
    "cabin": "Deluxe",
    "dates": {
      "arrival": "2026-10-16",
      "departure": "2026-10-18",
      "inferredYear": false
    },
    "guests": 3,
    "adults": 2,
    "children": 1,
    "child_ages": [
      7,
      36,
      30
    ],
    "phone": "16-18 2026",
    "units_requested": null,
    "units_open": false,
    "pier_requested": false,
    "hot_tub_requested": false,
    "pet_requested": false
  }
}
```

Elvárt válasz: Életkorlista csak összekötött számokból áll; telefon és dátum nem kerülhet a listába.
Automatikus válaszelvárás: ``; tiltott részlet: ``.

Tényleges válasz a javítás előtt (core / UI / Gmail):
```text
Dear Guest,

Thank you for your inquiry.

You would like to stay from 16.10.2026 to 18.10.2026 with 3 guests (2 adults and 1 children, aged 7, 36 and 30).

We will review the details provided and reply with any required information.

Kind regards,
Sárberki Horgásztó

--- UI ---
Dear Guest,

Thank you for your inquiry.

You would like to stay from 16.10.2026 to 18.10.2026 with 3 guests (2 adults and 1 children, aged 7, 36 and 30).

We will review the details provided and reply with any required information.

Kind regards,
Sárberki Horgásztó

--- Gmail ---
Dear Guest,

Thank you for your inquiry.

You would like to stay from 16.10.2026 to 18.10.2026 with 3 guests (2 adults and 1 children, aged 7, 36 and 30).

We will review the details provided and reply with any required information.

Kind regards,
Sárberki Horgásztó
```

Javítás utáni válasz:
```text
Dear Guest,

Thank you for your inquiry.

You would like to stay from 16.10.2026 to 18.10.2026 with 3 guests (2 adults and 1 children, aged 7).

Requested cabin type: Deluxe.

We will review the details provided and reply with any required information.

Kind regards,
Sárberki Horgásztó
```

## H14 – Külön-külön leírt gyermekkorokból csak az első kerül be

- Típus: parsing; súlyosság: közepes.
- Javítás: Külön éves/years old/jahre alt jelölések összegyűjtése..
- Állapot: JAVÍTVA; célzott regresszió és teljes csomag PASS.

Tesztazonosító: `separate-ages`

Bemeneti levél:
```text
2026. október 16-18. Deluxe. 2 felnőtt és 2 gyerek, az egyik 7 éves, a másik 11 éves.
```

Elvárt értelmezés:
```json
{
  "arrival": "2026-10-16",
  "departure": "2026-10-18",
  "nights": 2,
  "childAges": [
    7,
    11
  ]
}
```

Tényleges értelmezés a javítás előtt:
```json
{
  "core": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "nights": 2,
    "adults": 2,
    "children": 2,
    "childAges": [
      7
    ],
    "guests": 4,
    "cabin": "Deluxe",
    "unitsRequested": null,
    "hotTubRequested": false,
    "petRequested": false,
    "fishingQuestion": false,
    "parking": false,
    "phone": null,
    "specialRequests": []
  },
  "ui": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "email": "test@example.invalid",
    "name": "",
    "adults": "2",
    "children": "2",
    "child_ages": "7",
    "guests": "4",
    "units_requested": "",
    "unit": "Deluxe",
    "nights": "2",
    "language": "HU",
    "request": ""
  },
  "gmail": {
    "language": "hu",
    "cabin": "Deluxe",
    "dates": {
      "arrival": "2026-10-16",
      "departure": "2026-10-18",
      "inferredYear": false
    },
    "guests": 4,
    "adults": 2,
    "children": 2,
    "child_ages": [
      7
    ],
    "phone": null,
    "units_requested": null,
    "units_open": false,
    "pier_requested": false,
    "hot_tub_requested": false,
    "pet_requested": false
  }
}
```

Elvárt válasz: Külön éves/years old/jahre alt jelölések összegyűjtése.
Automatikus válaszelvárás: ``; tiltott részlet: ``.

Tényleges válasz a javítás előtt (core / UI / Gmail):
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő (2 felnőtt és 2 gyermek, 7 évesek) szeretnének érkezni.

Kérjük, írja meg a gyermek életkorát, több gyermek esetén mindegyikét. Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- UI ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő (2 felnőtt és 2 gyermek, 7 évesek) szeretnének érkezni.

Kérjük, írja meg a gyermek életkorát, több gyermek esetén mindegyikét. Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- Gmail ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő (2 felnőtt és 2 gyermek, 7 évesek) szeretnének érkezni.

Kérjük, írja meg a gyermek életkorát, több gyermek esetén mindegyikét. Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

Javítás utáni válasz:
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő (2 felnőtt és 2 gyermek, 7 és 11 évesek) szeretnének érkezni.

A kért háztípus: Deluxe.

Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

## H15 – Felnőtt saját életkora gyermekéletkornak számít

- Típus: létszám; súlyosság: kritikus.
- Javítás: Gyermekkontextus megkövetelése és explicit saját felnőttéletkor eltávolítása..
- Állapot: JAVÍTVA; célzott regresszió és teljes csomag PASS.

Tesztazonosító: `age-adult-child`

Bemeneti levél:
```text
2026. október 16-18. Deluxe. 2 felnőtt és 1 gyerek. Én 42 éves vagyok, a gyermek 7 éves.
```

Elvárt értelmezés:
```json
{
  "arrival": "2026-10-16",
  "departure": "2026-10-18",
  "nights": 2,
  "childAges": [
    7
  ]
}
```

Tényleges értelmezés a javítás előtt:
```json
{
  "core": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "nights": 2,
    "adults": 2,
    "children": 1,
    "childAges": [
      42
    ],
    "guests": 3,
    "cabin": "Deluxe",
    "unitsRequested": null,
    "hotTubRequested": false,
    "petRequested": false,
    "fishingQuestion": false,
    "parking": false,
    "phone": null,
    "specialRequests": []
  },
  "ui": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "email": "test@example.invalid",
    "name": "",
    "adults": "2",
    "children": "1",
    "child_ages": "42",
    "guests": "3",
    "units_requested": "",
    "unit": "Deluxe",
    "nights": "2",
    "language": "HU",
    "request": ""
  },
  "gmail": {
    "language": "hu",
    "cabin": "Deluxe",
    "dates": {
      "arrival": "2026-10-16",
      "departure": "2026-10-18",
      "inferredYear": false
    },
    "guests": 3,
    "adults": 2,
    "children": 1,
    "child_ages": [
      42
    ],
    "phone": null,
    "units_requested": null,
    "units_open": false,
    "pier_requested": false,
    "hot_tub_requested": false,
    "pet_requested": false
  }
}
```

Elvárt válasz: Gyermekkontextus megkövetelése és explicit saját felnőttéletkor eltávolítása.
Automatikus válaszelvárás: ``; tiltott részlet: `/42 éves/`.

Tényleges válasz a javítás előtt (core / UI / Gmail):
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 3 fő (2 felnőtt és 1 gyermek, 42 évesek) szeretnének érkezni.

Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- UI ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 3 fő (2 felnőtt és 1 gyermek, 42 évesek) szeretnének érkezni.

Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- Gmail ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 3 fő (2 felnőtt és 1 gyermek, 42 évesek) szeretnének érkezni.

Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

Javítás utáni válasz:
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 3 fő (2 felnőtt és 1 gyermek, 7 éves) szeretnének érkezni.

A kért háztípus: Deluxe.

Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

## H16 – Egy gyermekre többes számú évesek megfogalmazás

- Típus: nyelvtan; súlyosság: kisebb.
- Javítás: Egy gyermeknél éves, több gyermeknél évesek..
- Állapot: JAVÍTVA; célzott regresszió és teljes csomag PASS.

Tesztazonosító: `single-age`

Bemeneti levél:
```text
2026. október 16-18. Deluxe. 2 felnőtt és 1 gyermek, 7 éves.
```

Elvárt értelmezés:
```json
{
  "arrival": "2026-10-16",
  "departure": "2026-10-18",
  "nights": 2,
  "guests": 3,
  "adults": 2,
  "children": 1,
  "childAges": [
    7
  ]
}
```

Tényleges értelmezés a javítás előtt:
```json
{
  "core": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "nights": 2,
    "adults": 2,
    "children": 1,
    "childAges": [
      7
    ],
    "guests": 3,
    "cabin": "Deluxe",
    "unitsRequested": null,
    "hotTubRequested": false,
    "petRequested": false,
    "fishingQuestion": false,
    "parking": false,
    "phone": null,
    "specialRequests": []
  },
  "ui": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "email": "test@example.invalid",
    "name": "",
    "adults": "2",
    "children": "1",
    "child_ages": "7",
    "guests": "3",
    "units_requested": "",
    "unit": "Deluxe",
    "nights": "2",
    "language": "HU",
    "request": ""
  },
  "gmail": {
    "language": "hu",
    "cabin": "Deluxe",
    "dates": {
      "arrival": "2026-10-16",
      "departure": "2026-10-18",
      "inferredYear": false
    },
    "guests": 3,
    "adults": 2,
    "children": 1,
    "child_ages": [
      7
    ],
    "phone": null,
    "units_requested": null,
    "units_open": false,
    "pier_requested": false,
    "hot_tub_requested": false,
    "pet_requested": false
  }
}
```

Elvárt válasz: Egy gyermeknél éves, több gyermeknél évesek.
Automatikus válaszelvárás: `/7 éves/`; tiltott részlet: `/7 évesek/`.

Tényleges válasz a javítás előtt (core / UI / Gmail):
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 3 fő (2 felnőtt és 1 gyermek, 7 évesek) szeretnének érkezni.

Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- UI ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 3 fő (2 felnőtt és 1 gyermek, 7 évesek) szeretnének érkezni.

Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- Gmail ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 3 fő (2 felnőtt és 1 gyermek, 7 évesek) szeretnének érkezni.

Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

Javítás utáni válasz:
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 3 fő (2 felnőtt és 1 gyermek, 7 éves) szeretnének érkezni.

A kért háztípus: Deluxe.

Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

## H17 – Visszavont kutya vagy dézsaigény továbbra is kérés

- Típus: üzleti logika; súlyosság: közepes.
- Javítás: A legutolsó vonatkozó közlés és annak tagadása határozza meg az igényt..
- Állapot: JAVÍTVA; célzott regresszió és teljes csomag PASS.

Tesztazonosító: `dog-retracted`

Bemeneti levél:
```text
2026. október 16-18. Deluxe, 4 fő. Kutyát hoznánk, de mégsem hozunk kutyát.
```

Elvárt értelmezés:
```json
{
  "arrival": "2026-10-16",
  "departure": "2026-10-18",
  "nights": 2,
  "petRequested": false
}
```

Tényleges értelmezés a javítás előtt:
```json
{
  "core": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "nights": 2,
    "adults": null,
    "children": null,
    "childAges": [],
    "guests": 4,
    "cabin": "Deluxe",
    "unitsRequested": null,
    "hotTubRequested": false,
    "petRequested": true,
    "fishingQuestion": false,
    "parking": false,
    "phone": null,
    "specialRequests": []
  },
  "ui": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "email": "test@example.invalid",
    "name": "",
    "adults": "",
    "children": "",
    "child_ages": "",
    "guests": "4",
    "units_requested": "",
    "unit": "Deluxe",
    "nights": "2",
    "language": "HU",
    "request": "kis kutya / háziállat"
  },
  "gmail": {
    "language": "hu",
    "cabin": "Deluxe",
    "dates": {
      "arrival": "2026-10-16",
      "departure": "2026-10-18",
      "inferredYear": false
    },
    "guests": 4,
    "adults": null,
    "children": null,
    "child_ages": [],
    "phone": null,
    "units_requested": null,
    "units_open": false,
    "pier_requested": false,
    "hot_tub_requested": false,
    "pet_requested": true
  }
}
```

Elvárt válasz: A legutolsó vonatkozó közlés és annak tagadása határozza meg az igényt.
Automatikus válaszelvárás: ``; tiltott részlet: `/Kutyát is hoznának/`.

Tényleges válasz a javítás előtt (core / UI / Gmail):
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő szeretnének érkezni. Kutyát is hoznának.

Háziállat hozható térítés ellenében; a pontos díjat kezelői ellenőrzéssel kell megerősíteni.

Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is. Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- UI ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő szeretnének érkezni. Kutyát is hoznának.

Háziállat hozható térítés ellenében; a pontos díjat kezelői ellenőrzéssel kell megerősíteni.

Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- Gmail ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő szeretnének érkezni. Kutyát is hoznának.

Háziállat hozható térítés ellenében; a pontos díjat kezelői ellenőrzéssel kell megerősíteni.

Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is. Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

Javítás utáni válasz:
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő szeretnének érkezni.

Háziállat hozható térítés ellenében; a pontos díjat kezelői ellenőrzéssel kell megerősíteni.

A kért háztípus: Deluxe.

Kérjük, írja meg, hány felnőtt érkezik. Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is. Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

## H18 – Szlovén masažno szóban a no téves tagadás

- Típus: parsing; súlyosság: közepes.
- Javítás: A stresszfejlesztés köztes változatában talált regresszió: tagadószó teljes szónak számít, szótöredék nem lehet tagadás..
- Állapot: JAVÍTVA; célzott regresszió és teljes csomag PASS.

Tesztazonosító: `mixed-si-0`

Bemeneti levél:
```text
Dve Deluxe hiški prosim. 2 odrasla in 2 otroka, stara 7 in 11 let. Želimo bivati od 16. do 18. oktobra 2026. S seboj pripeljemo psa. Telefon: +36 30 555 1234. Je parkiranje na parkirišču za 2 vozili mogoče?. Posebna želja: sosednji hiški. Želimo masažno kad. Želeli bi ribolov; kakšna so pravila?.
```

Elvárt értelmezés:
```json
{
  "arrival": "2026-10-16",
  "departure": "2026-10-18",
  "nights": 2,
  "guests": 4,
  "adults": 2,
  "children": 2,
  "childAges": [
    7,
    11
  ],
  "cabin": "Deluxe",
  "unitsRequested": 2,
  "hotTubRequested": true,
  "petRequested": true,
  "fishingQuestion": true,
  "parking": true,
  "phone": "+36 30 555 1234",
  "specialRequests": [
    "sosednji hiški"
  ]
}
```

Tényleges értelmezés a javítás előtt:
```json
{
  "core": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "nights": 2,
    "adults": 2,
    "children": 2,
    "childAges": [
      7,
      11
    ],
    "guests": 4,
    "cabin": "Deluxe",
    "unitsRequested": 2,
    "hotTubRequested": false,
    "petRequested": true,
    "fishingQuestion": true,
    "parking": true,
    "phone": "+36 30 555 1234",
    "specialRequests": [
      "sosednji hiški"
    ]
  },
  "ui": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "email": "+36 30 555 1234",
    "name": "",
    "adults": "2",
    "children": "2",
    "child_ages": "7, 11",
    "guests": "4",
    "units_requested": "2",
    "unit": "Deluxe",
    "nights": "2",
    "language": "SL",
    "request": "kis kutya / háziállat; sosednji hiški"
  },
  "gmail": {
    "language": "si",
    "cabin": "Deluxe",
    "dates": {
      "arrival": "2026-10-16",
      "departure": "2026-10-18",
      "inferredYear": false
    },
    "guests": 4,
    "adults": 2,
    "children": 2,
    "child_ages": [
      7,
      11
    ],
    "phone": "+36 30 555 1234",
    "nights": 2,
    "special_requests": [
      "sosednji hiški"
    ],
    "fishing_question": true,
    "parking_question": true,
    "units_requested": 2,
    "units_open": false,
    "pier_requested": false,
    "hot_tub_requested": false,
    "pet_requested": true
  }
}
```

Elvárt válasz: A stresszfejlesztés köztes változatában talált regresszió: tagadószó teljes szónak számít, szótöredék nem lehet tagadás.
Automatikus válaszelvárás: ``; tiltott részlet: ``.

Tényleges válasz a javítás előtt (core / UI / Gmail):
```text
Pozdravljeni!

Hvala za vaše povpraševanje.

Pri nas želite bivati od 16.10.2026 do 18.10.2026 za skupaj 4 oseb (2 odraslih in 2 otrok, starih 7 in 11 let). S seboj želite pripeljati psa.

Parkiranje je na voljo; pri več vozilih posebej preverimo razpoložljiva parkirna mesta.
Hišni ljubljenčki so dovoljeni z doplačilom; natančno pristojbino mora potrditi upravljavec.
Razpoložljivost in doplačilo za vročo kad preverimo posebej; natančno ceno navedemo šele po zanesljivem preverjanju.

Želeni tip hiške: Deluxe.

Preverili bomo navedene podatke in odgovorili s potrebnimi podrobnostmi.

Lep pozdrav,
Sárberki Horgásztó

--- UI ---
Pozdravljeni!

Hvala za vaše povpraševanje.

Pri nas želite bivati od 16.10.2026 do 18.10.2026 za skupaj 4 oseb (2 odraslih in 2 otrok, starih 7 in 11 let). S seboj želite pripeljati psa.

Parkiranje je na voljo; pri več vozilih posebej preverimo razpoložljiva parkirna mesta.
Hišni ljubljenčki so dovoljeni z doplačilom; natančno pristojbino mora potrditi upravljavec.
Razpoložljivost in doplačilo za vročo kad preverimo posebej; natančno ceno navedemo šele po zanesljivem preverjanju.

Želeni tip hiške: Deluxe.
Za ribolov je potrebna državna ribolovna dovolilnica, veljavna na Madžarskem. Dovoljeni so le trnki brez zalusti do največ velikosti 6. Potrebni so podloga za krape, podmetalka, razkužilo za rane in vreča za krape. Ribolovna karta Sárberki se izbere posebej glede na jezero in trajanje. Za otroke je potrebna ločena karta; natančna cena je odvisna od jezera in trajanja karte.

Preverili bomo navedene podatke in odgovorili s potrebnimi podrobnostmi.

Lep pozdrav,
Sárberki Horgásztó

--- Gmail ---
Pozdravljeni!

Hvala za vaše povpraševanje.

Pri nas želite bivati od 16.10.2026 do 18.10.2026 za skupaj 4 oseb (2 odraslih in 2 otrok, starih 7 in 11 let). S seboj želite pripeljati psa.

Parkiranje je na voljo; pri več vozilih posebej preverimo razpoložljiva parkirna mesta.
Hišni ljubljenčki so dovoljeni z doplačilom; natančno pristojbino mora potrditi upravljavec.
Razpoložljivost in doplačilo za vročo kad preverimo posebej; natančno ceno navedemo šele po zanesljivem preverjanju.

Želeni tip hiške: Deluxe.
Za ribolov je potrebna državna ribolovna dovolilnica, veljavna na Madžarskem. Dovoljeni so le trnki brez zalusti do največ velikosti 6. Potrebni so podloga za krape, podmetalka, razkužilo za rane in vreča za krape. Ribolovna karta Sárberki se izbere posebej glede na jezero in trajanje. Za otroke je potrebna ločena karta; natančna cena je odvisna od jezera in trajanja karte.

Preverili bomo navedene podatke in odgovorili s potrebnimi podrobnostmi.

Lep pozdrav,
Sárberki Horgásztó
```

Javítás utáni válasz:
```text
Pozdravljeni!

Hvala za vaše povpraševanje.

Pri nas želite bivati od 16.10.2026 do 18.10.2026 za skupaj 4 oseb (2 odraslih in 2 otrok, starih 7 in 11 let). Želite tudi masažno / vročo kad. S seboj želite pripeljati psa.

Parkiranje je na voljo; pri več vozilih posebej preverimo razpoložljiva parkirna mesta.
Hišni ljubljenčki so dovoljeni z doplačilom; natančno pristojbino mora potrditi upravljavec.
Razpoložljivost in doplačilo za vročo kad preverimo posebej; natančno ceno navedemo šele po zanesljivem preverjanju.

Želeni tip hiške: Deluxe.
Za ribolov je potrebna državna ribolovna dovolilnica, veljavna na Madžarskem. Dovoljeni so le trnki brez zalusti do največ velikosti 6. Potrebni so podloga za krape, podmetalka, razkužilo za rane in vreča za krape. Ribolovna karta Sárberki se izbere posebej glede na jezero in trajanje. Za otroke je potrebna ločena karta; natančna cena je odvisna od jezera in trajanja karte.

Preverili bomo navedene podatke in odgovorili s potrebnimi podrobnostmi.

Lep pozdrav,
Sárberki Horgásztó
```

## H19 – Explicit gyermek nélkül Gmailben ismeretlen marad

- Típus: hiányzó adat; súlyosság: közepes.
- Javítás: A közös gyermekparser mind a négy nyelv explicit gyermek nélküli állítását kezeli; párhuzamosan érkezett javítás megőrizve..
- Állapot: JAVÍTVA; célzott regresszió és teljes csomag PASS.

Tesztazonosító: `no-child`

Bemeneti levél:
```text
2026. október 16-18. Deluxe, 2 felnőtt, gyermek nélkül.
```

Elvárt értelmezés:
```json
{
  "arrival": "2026-10-16",
  "departure": "2026-10-18",
  "nights": 2,
  "children": 0
}
```

Tényleges értelmezés a javítás előtt:
```json
{
  "core": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "nights": 2,
    "adults": 2,
    "children": 0,
    "childAges": [],
    "guests": null,
    "cabin": "Deluxe",
    "unitsRequested": null,
    "hotTubRequested": false,
    "petRequested": false,
    "fishingQuestion": false,
    "parking": false,
    "phone": null,
    "specialRequests": []
  },
  "ui": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "email": "test@example.invalid",
    "name": "",
    "adults": "2",
    "children": "",
    "child_ages": "",
    "guests": "2",
    "units_requested": "",
    "unit": "Deluxe",
    "nights": "2",
    "language": "HU",
    "request": ""
  },
  "gmail": {
    "language": "unknown",
    "cabin": "Deluxe",
    "dates": {
      "arrival": "2026-10-16",
      "departure": "2026-10-18",
      "inferredYear": false
    },
    "guests": null,
    "adults": 2,
    "children": null,
    "child_ages": [],
    "phone": null,
    "units_requested": null,
    "units_open": false,
    "pier_requested": false,
    "hot_tub_requested": false,
    "pet_requested": false
  }
}
```

Elvárt válasz: A közös gyermekparser mind a négy nyelv explicit gyermek nélküli állítását kezeli; párhuzamosan érkezett javítás megőrizve.
Automatikus válaszelvárás: ``; tiltott részlet: `/érkezik-e gyermek/`.

Tényleges válasz a javítás előtt (core / UI / Gmail):
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- UI ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 2 fő szeretnének érkezni.

Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- Gmail ---
Kedves Vendégünk!

Köszönjük érdeklődését.

Kérjük, írja meg, hány felnőtt érkezik. Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is. Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

Javítás utáni válasz:
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 2 fő (2 felnőtt) szeretnének érkezni.

A kért háztípus: Deluxe.

Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

## H20 – Előleg utáni véglegesség hiányzik a feltételekből

- Típus: üzleti logika; súlyosság: közepes.
- Javítás: Foglalási feltételek kérdésnél 50%/10 nap/véglegesség/14 nap együtt szerepel a vizsgált kis csoportnál..
- Állapot: JAVÍTVA; célzott regresszió és teljes csomag PASS.

Tesztazonosító: `policy`

Bemeneti levél:
```text
2026. október 16-18. Deluxe, 4 fő. Mik a foglalási feltételek?
```

Elvárt értelmezés:
```json
{
  "arrival": "2026-10-16",
  "departure": "2026-10-18",
  "nights": 2
}
```

Tényleges értelmezés a javítás előtt:
```json
{
  "core": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "nights": 2,
    "adults": null,
    "children": null,
    "childAges": [],
    "guests": 4,
    "cabin": "Deluxe",
    "unitsRequested": null,
    "hotTubRequested": false,
    "petRequested": false,
    "fishingQuestion": false,
    "parking": false,
    "phone": null,
    "specialRequests": []
  },
  "ui": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "email": "test@example.invalid",
    "name": "",
    "adults": "",
    "children": "",
    "child_ages": "",
    "guests": "4",
    "units_requested": "",
    "unit": "Deluxe",
    "nights": "2",
    "language": "HU",
    "request": ""
  },
  "gmail": {
    "language": "hu",
    "cabin": "Deluxe",
    "dates": {
      "arrival": "2026-10-16",
      "departure": "2026-10-18",
      "inferredYear": false
    },
    "guests": 4,
    "adults": null,
    "children": null,
    "child_ages": [],
    "phone": null,
    "units_requested": null,
    "units_open": false,
    "pier_requested": false,
    "hot_tub_requested": false,
    "pet_requested": false
  }
}
```

Elvárt válasz: Foglalási feltételek kérdésnél 50%/10 nap/véglegesség/14 nap együtt szerepel a vizsgált kis csoportnál.
Automatikus válaszelvárás: `/50%[\s\S]*10 napon belül[\s\S]*előleg beérkezése.*végleges[\s\S]*14 nap/`; tiltott részlet: ``.

Tényleges válasz a javítás előtt (core / UI / Gmail):
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő szeretnének érkezni.

A foglaláshoz 50% előleg szükséges.
Az előleget a foglalási szándék rögzítésétől számított 10 napon belül kell befizetni; ha ez határidőn belül nem érkezik meg, a foglalást töröljük.
15 fő alatti foglalásnál a lemondási határidő az érkezés előtt 14 nap.

Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is. Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- UI ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő szeretnének érkezni.

A foglaláshoz 50% előleg szükséges.
Az előleget a foglalási szándék rögzítésétől számított 10 napon belül kell befizetni; ha ez határidőn belül nem érkezik meg, a foglalást töröljük.
15 fő alatti foglalásnál a lemondási határidő az érkezés előtt 14 nap.

Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- Gmail ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő szeretnének érkezni.

A foglaláshoz 50% előleg szükséges.
Az előleget a foglalási szándék rögzítésétől számított 10 napon belül kell befizetni; ha ez határidőn belül nem érkezik meg, a foglalást töröljük.
15 fő alatti foglalásnál a lemondási határidő az érkezés előtt 14 nap.

Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is. Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

Javítás utáni válasz:
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő szeretnének érkezni.

A foglaláshoz 50% előleg szükséges.
Az előleget a foglalási szándék rögzítésétől számított 10 napon belül kell befizetni; ha ez határidőn belül nem érkezik meg, a foglalást töröljük.
A foglalás az előleg beérkezése után válik véglegessé.
15 fő alatti foglalásnál a lemondási határidő az érkezés előtt 14 nap.

A kért háztípus: Deluxe.

Kérjük, írja meg, hány felnőtt érkezik. Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is. Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

## H21 – Más érkezési időre a rögzített 18:30 példával válaszol

- Típus: üzleti logika; súlyosság: közepes.
- Javítás: A vendég tényleges óra-perc adatát használja; AM/PM átváltás is tesztelve..
- Állapot: JAVÍTVA; célzott regresszió és teljes csomag PASS.

Tesztazonosító: `arrival-time-changed`

Bemeneti levél:
```text
2026. október 16-18. Deluxe, 4 fő. Érkezés 22:15-kor.
```

Elvárt értelmezés:
```json
{
  "arrival": "2026-10-16",
  "departure": "2026-10-18",
  "nights": 2
}
```

Tényleges értelmezés a javítás előtt:
```json
{
  "core": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "nights": 2,
    "adults": null,
    "children": null,
    "childAges": [],
    "guests": 4,
    "cabin": "Deluxe",
    "unitsRequested": null,
    "hotTubRequested": false,
    "petRequested": false,
    "fishingQuestion": false,
    "parking": false,
    "phone": null,
    "specialRequests": []
  },
  "ui": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "email": "test@example.invalid",
    "name": "",
    "adults": "",
    "children": "",
    "child_ages": "",
    "guests": "4",
    "units_requested": "",
    "unit": "Deluxe",
    "nights": "2",
    "language": "HU",
    "request": ""
  },
  "gmail": {
    "language": "hu",
    "cabin": "Deluxe",
    "dates": {
      "arrival": "2026-10-16",
      "departure": "2026-10-18",
      "inferredYear": false
    },
    "guests": 4,
    "adults": null,
    "children": null,
    "child_ages": [],
    "phone": null,
    "units_requested": null,
    "units_open": false,
    "pier_requested": false,
    "hot_tub_requested": false,
    "pet_requested": false
  }
}
```

Elvárt válasz: A vendég tényleges óra-perc adatát használja; AM/PM átváltás is tesztelve.
Automatikus válaszelvárás: `/22:15/`; tiltott részlet: `/18:30/`.

Tényleges válasz a javítás előtt (core / UI / Gmail):
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő szeretnének érkezni.

A 18:30-as érkezés megoldható; 24 órás portaszolgálat működik.

Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is. Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- UI ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő szeretnének érkezni.

A 18:30-as érkezés megoldható; 24 órás portaszolgálat működik.

Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- Gmail ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő szeretnének érkezni.

A 18:30-as érkezés megoldható; 24 órás portaszolgálat működik.

Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is. Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

Javítás utáni válasz:
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő szeretnének érkezni.

Az érkezés 22:15-kor megoldható; 24 órás portaszolgálat működik.

A kért háztípus: Deluxe.

Kérjük, írja meg, hány felnőtt érkezik. Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is. Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

## H22 – Kapacitásblokk magyarul kerül idegen nyelvű válaszba

- Típus: stílus; súlyosság: közepes.
- Javítás: HU/DE/EN/SI kapacitásmondatok; a felület nyelve vezérli a beillesztést..
- Állapot: JAVÍTVA; célzott regresszió és teljes csomag PASS.

Tesztazonosító: `tests/availability-reply.test.mjs`

Bemenet: Német/angol/szlovén levélhez hitelesített Deluxe és Családi kapacitás.
Elvárt értelmezés/válasz: A vendég nyelvén jelenjen meg a kapacitásblokk.
Tényleges válasz/viselkedés előtte: A megadott időpontban ... szabad lehetőségek: Deluxe, 2 × Családi.
Javítás után: A vendég nyelvén jelenjen meg a kapacitásblokk.

Reprodukció: a régi modul hibakimenete `availability-before.log`; az új modul négy nyelvi, belső szöveget tiltó és késleltetéses teszteket is teljesít.

## H23 – Belső Previo-megfeleltetés megjelenik a vendégnek

- Típus: stílus; súlyosság: közepes.
- Javítás: Csak kapacitás és külön ellenőrzendő együttes elérhetőség szerepel, belső PMS-technikai szöveg nem..
- Állapot: JAVÍTVA; célzott regresszió és teljes csomag PASS.

Tesztazonosító: `tests/availability-reply.test.mjs`

Bemenet: 6 fő; Osztott A+C kombináció ellenőrzést igényel.
Elvárt értelmezés/válasz: Vendégnek: az együttes elérhetőséget külön ellenőrizzük.
Tényleges válasz/viselkedés előtte: ... A/B/C Previo-megfeleltetés hitelesítése után ...
Javítás után: Vendégnek: az együttes elérhetőséget külön ellenőrizzük.

Reprodukció: a régi modul hibakimenete `availability-before.log`; az új modul négy nyelvi, belső szöveget tiltó és késleltetéses teszteket is teljesít.

## H24 – Üres életkorból 0 éves gyermek lesz kapacitásfrissítéskor

- Típus: hiányzó adat; súlyosság: kritikus.
- Javítás: Üres listaelem eltávolítása a Number konverzió előtt..
- Állapot: JAVÍTVA; célzott regresszió és teljes csomag PASS.

Tesztazonosító: `tests/availability-reply.test.mjs`

Bemenet: 2026-10-16–18; 6 fő, 5 felnőtt, 1 gyermek, életkor üres.
Elvárt értelmezés/válasz: Gyermek életkora ismeretlen; kérjük be.
Tényleges válasz/viselkedés előtte: 1 gyermek, 0 évesek
Javítás után: Gyermek életkora ismeretlen; kérjük be.

Reprodukció: a régi modul hibakimenete `availability-before.log`; az új modul négy nyelvi, belső szöveget tiltó és késleltetéses teszteket is teljesít.

## H25 – Későn érkező kapacitásválasz felülír egy új érdeklődést

- Típus: Previo/ár; súlyosság: kritikus.
- Javítás: A kérés indításakor és a válaszkor ellenőrzött aktuális adatoknak egyezniük kell; elavult válasz eldobása..
- Állapot: JAVÍTVA; célzott regresszió és teljes csomag PASS.

Tesztazonosító: `tests/availability-reply.test.mjs`

Bemenet: Első érdeklődéshez kapacitáskérés indul; érkezés és tervezet közben megváltozik.
Elvárt értelmezés/válasz: A módosult érdeklődést és tervezetet a régi válasz nem változtathatja meg.
Tényleges válasz/viselkedés előtte: Régi kapacitásválasz az új tervezetbe kerül.
Javítás után: A módosult érdeklődést és tervezetet a régi válasz nem változtathatja meg.

Reprodukció: a régi modul hibakimenete `availability-before.log`; az új modul négy nyelvi, belső szöveget tiltó és késleltetéses teszteket is teljesít.

## H26 – Többszörös szóköz átkerül a telefonszámba

- Típus: stílus; súlyosság: kisebb.
- Javítás: A telefonszám szóközeinek normalizálása..
- Állapot: JAVÍTVA; célzott regresszió és teljes csomag PASS.

Tesztazonosító: `hu-space`

Bemeneti levél:
```text
2026.  október  16–18.  között  2  felnőtt  és  2  gyermek,  7  és  11  évesek.  Deluxe  ház.  Telefon:  +36  30  555  1234.
```

Elvárt értelmezés:
```json
{
  "arrival": "2026-10-16",
  "departure": "2026-10-18",
  "nights": 2,
  "guests": 4,
  "adults": 2,
  "children": 2,
  "childAges": [
    7,
    11
  ],
  "cabin": "Deluxe",
  "phone": "+36 30 555 1234"
}
```

Tényleges értelmezés a javítás előtt:
```json
{
  "core": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "nights": 2,
    "adults": 2,
    "children": 2,
    "childAges": [
      7,
      11
    ],
    "guests": 4,
    "cabin": "Deluxe",
    "unitsRequested": null,
    "hotTubRequested": false,
    "petRequested": false,
    "fishingQuestion": false,
    "parking": false,
    "phone": "+36  30  555  1234",
    "specialRequests": []
  },
  "ui": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "email": "+36  30  555  1234",
    "name": "",
    "adults": "2",
    "children": "2",
    "child_ages": "7, 11",
    "guests": "4",
    "units_requested": "",
    "unit": "Deluxe",
    "nights": "2",
    "language": "DE",
    "request": ""
  },
  "gmail": {
    "language": "de",
    "cabin": "Deluxe",
    "dates": {
      "arrival": "2026-10-16",
      "departure": "2026-10-18",
      "inferredYear": false
    },
    "guests": 4,
    "adults": 2,
    "children": 2,
    "child_ages": [
      7,
      11
    ],
    "phone": "+36  30  555  1234",
    "units_requested": null,
    "units_open": false,
    "pier_requested": false,
    "hot_tub_requested": false,
    "pet_requested": false
  }
}
```

Elvárt válasz: A telefonszám szóközeinek normalizálása.
Automatikus válaszelvárás: ``; tiltott részlet: ``.

Tényleges válasz a javítás előtt (core / UI / Gmail):
```text
Guten Tag!

Vielen Dank für Ihre Anfrage.

Sie möchten vom 16.10.2026 bis 18.10.2026 mit 4 Personen (2 Erwachsene und 2 Kinder im Alter von 7 und 11 Jahren) bei uns übernachten.

Wir prüfen die angegebenen Daten und melden uns mit den nötigen Details.

Mit freundlichen Grüßen
Sárberki Horgásztó

--- UI ---
Guten Tag!

Vielen Dank für Ihre Anfrage.

Sie möchten vom 16.10.2026 bis 18.10.2026 mit 4 Personen (2 Erwachsene und 2 Kinder im Alter von 7 und 11 Jahren) bei uns übernachten.

Wir prüfen die angegebenen Daten und melden uns mit den nötigen Details.

Mit freundlichen Grüßen
Sárberki Horgásztó

--- Gmail ---
Guten Tag!

Vielen Dank für Ihre Anfrage.

Sie möchten vom 16.10.2026 bis 18.10.2026 mit 4 Personen (2 Erwachsene und 2 Kinder im Alter von 7 und 11 Jahren) bei uns übernachten.

Wir prüfen die angegebenen Daten und melden uns mit den nötigen Details.

Mit freundlichen Grüßen
Sárberki Horgásztó
```

Javítás utáni válasz:
```text
Guten Tag!

Vielen Dank für Ihre Anfrage.

Sie möchten vom 16.10.2026 bis 18.10.2026 mit 4 Personen (2 Erwachsene und 2 Kinder im Alter von 7 und 11 Jahren) bei uns übernachten.

Gewünschter Haustyp: Deluxe.

Wir prüfen die angegebenen Daten und melden uns mit den nötigen Details.

Mit freundlichen Grüßen
Sárberki Horgásztó
```

## H27 – Ékezet nélküli horgászati kérdés kimarad

- Típus: üzleti logika; súlyosság: közepes.
- Javítás: Gyakori ékezet nélküli horgász/szabály/szakáll szavak normalizálása; rögzített feltételek változatlanok..
- Állapot: JAVÍTVA; célzott regresszió és teljes csomag PASS.

Tesztazonosító: `fishing-accentless`

Bemeneti levél:
```text
2026 oktober 16-18. Deluxe, 4 fo. Horgasznank, mik a horgaszati szabalyok? Parkolas van?
```

Elvárt értelmezés:
```json
{
  "arrival": "2026-10-16",
  "departure": "2026-10-18",
  "nights": 2,
  "fishingQuestion": true,
  "parking": true
}
```

Tényleges értelmezés a javítás előtt:
```json
{
  "core": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "nights": 2,
    "adults": null,
    "children": null,
    "childAges": [],
    "guests": 4,
    "cabin": "Deluxe",
    "unitsRequested": null,
    "hotTubRequested": false,
    "petRequested": false,
    "fishingQuestion": false,
    "parking": true,
    "phone": null,
    "specialRequests": []
  },
  "ui": {
    "arrival": "2026-10-16",
    "departure": "2026-10-18",
    "email": "test@example.invalid",
    "name": "",
    "adults": "",
    "children": "",
    "child_ages": "",
    "guests": "4",
    "units_requested": "",
    "unit": "Deluxe",
    "nights": "2",
    "language": "HU",
    "request": ""
  },
  "gmail": {
    "language": "hu",
    "cabin": "Deluxe",
    "dates": {
      "arrival": "2026-10-16",
      "departure": "2026-10-18",
      "inferredYear": false
    },
    "guests": 4,
    "adults": null,
    "children": null,
    "child_ages": [],
    "phone": null,
    "units_requested": null,
    "units_open": false,
    "pier_requested": false,
    "hot_tub_requested": false,
    "pet_requested": false
  }
}
```

Elvárt válasz: Gyakori ékezet nélküli horgász/szabály/szakáll szavak normalizálása; rögzített feltételek változatlanok.
Automatikus válaszelvárás: `/állami horgászjegy[\s\S]*szakáll nélküli[\s\S]*6-os[\s\S]*pontybölcső[\s\S]*merítőháló[\s\S]*sebfertőtlenítő[\s\S]*pontyzsák/`; tiltott részlet: ``.

Tényleges válasz a javítás előtt (core / UI / Gmail):
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő szeretnének érkezni.

Parkolási lehetőség biztosított; több autó esetén a rendelkezésre álló helyet külön ellenőrizzük.

Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is. Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- UI ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő szeretnének érkezni.

Parkolási lehetőség biztosított; több autó esetén a rendelkezésre álló helyet külön ellenőrizzük.

Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó

--- Gmail ---
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő szeretnének érkezni.

Parkolási lehetőség biztosított; több autó esetén a rendelkezésre álló helyet külön ellenőrizzük.

Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is. Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

Javítás utáni válasz:
```text
Kedves Vendégünk!

Köszönjük érdeklődését.

16.10.2026 és 18.10.2026 között összesen 4 fő szeretnének érkezni.

Parkolási lehetőség biztosított; több autó esetén a rendelkezésre álló helyet külön ellenőrizzük.

A kért háztípus: Deluxe.
A horgászathoz Magyarországra érvényes állami horgászjegy szükséges. Csak szakáll nélküli, legfeljebb 6-os méretű horog használható. Kötelező felszerelés a pontybölcső, merítőháló, sebfertőtlenítő és pontyzsák. A választott tóhoz és időtartamhoz tartozó Sárberki horgászjegyet külön kell kiválasztani.

Kérjük, írja meg, hány felnőtt érkezik. Kérjük, írja meg, érkezik-e gyermek is. Ha igen, kérjük, adja meg a gyermek(ek) életkorát is. Megírna egy telefonszámot, amelyen elérhetjük?

A megadott adatokat ellenőrizzük, és a szükséges részletekkel visszajelzünk.

Üdvözlettel:
Sárberki Horgásztó
```

