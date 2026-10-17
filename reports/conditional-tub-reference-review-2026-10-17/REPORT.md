# Feltételes dézsalemondás és eltérő hivatkozások – 2026-10-17

Kiindulás: `e37364677f28face43a38fc26042378bc95ef7ae`, kizárólag
`gmail-test-subject-allowlist`. A korábbi 1652 sikeres tesztet új változás nélkül
nem ismételtük; az új regresszió az itt módosított közös modul miatt szükséges.

## Igazolt hibák

1. A feltételes „If it rains, please cancel the hot tub” lemondásként értelmeződött.
   HU/DE/SI lemondási lehetőségre kérdező mondatok sem kaptak következetesen
   külön szándéktisztázást. Az új célzott teszt a javítás előtt hibázott.
2. A normál dézsakérés jelezte a több eltérő foglalási hivatkozást, a lemondás és
   tagadott lemondás azonban elhagyta ugyanezt a konfliktusjelzést. Emiatt egy
   levélszál alapján az ilyen szolgáltatáslevél tévesen meglévő ügyhöz kapcsolódhatott.
   A konfliktusjelzésre és egyező hivatkozások kontrolljára felvett tesztek hibáztak.
   Javítás előtti csomag: 21 PASS / 3 FAIL / 0 SKIP.

## Javítás

A közös értelmező a tesztelt HU/DE/EN/SI feltételes lemondási és lehetőségre
kérdező alakokat a meglévő `actionConflict`/`intent_unverified` útvonalra küldi.
A kérés nem válik tényleges visszavonássá vagy jóváhagyott új igénnyé.
A feltételt/kérdést ugyanabban a dézsalemondást említő mondatrészben vizsgáljuk;
egy külön kijelentkezési kérdés nem teszi bizonytalanná az egyértelmű lemondást.

Egyetlen közös hivatkozásfeldolgozó állítja elő a foglalási azonosítót és a
konfliktusjelzést a kérés, lemondás, tagadott/feltételes lemondás útvonalán.
Az eltérő azonosítókat tartalmazó, kizárólag szolgáltatásra vonatkozó levél a
meglévő emberi ügykapcsolási felülvizsgálatra kerül, a célügy módosítása nélkül.
Az ismételt azonos hivatkozás megengedett; az idézett régi azonosító nem aktuális bizonyíték.

## Bizonyíték

- Célzott csomag: **30 PASS / 0 FAIL / 0 SKIP**.
- Nyolc HU/DE/EN/SI feltételes/kérdező szintetikus példa; az egyértelmű lemondás,
  idézett előzmény és azonos hivatkozások negatív kontrollja.
- Izolált tényleges PostgreSQL/PGlite: normál Writer → külön felülvizsgálati ügy →
  tervezet → szolgáltatásjóváhagyási tiltás. Három eltérő hivatkozású változat után
  a célügy teljes adatbázissora változatlan; a normál ügyírások auditáltak.
- A feltételes, egyértelmű szálú üzenet a kapcsolt ügyben is `requested: null`
  állapotot és tisztázó tervezetet ad. Szolgáltatói kötés-/kapacitáshívás **0**,
  szolgáltatásjóváhagyási sor **0**.
- Ez meghatározott determinisztikus nyelvi minták és helyi adatbázis bizonyítéka;
  nem általános nyelvi garancia, új felhős hitelesítési vagy élő Gmail/Previo-próba.
- Teljes helyi `npm test`: **1656 PASS / 0 FAIL / 0 SKIP**.
- A commitazonos CI/deploy eredményét a zárójelentés rögzíti.

## Állapot és következő lépés

V1: továbbra is kb. 90%, mérnöki becslés. A szolgáltatói tesztkapcsolat,
tényleges iPhone-próba és végleges elfogadási ellenőrzés még hátravan.
A Previo-hozzáférés nem blokkolja a többi modul fejlesztését.
Következő ellenőrzés: egy levélen belüli több szolgáltatás szándékainak elkülönítése,
hogy például a szállás vagy más szolgáltatás lemondása ne váljon dézsalemondássá.

V2/V3: azonos közös feldolgozó és emberi visszaesési út marad; sem AI-kimenet,
sem tervezet nem ad végrehajtási jogot. Nincs új válaszmotor vagy jogosultságrendszer.
Csak szintetikus tesztadat, kijelölt tesztág. Nincs valódi vendégadat, küldés,
Previo-kapcsolat vagy írás, valódi foglalás, main- vagy production-módosítás.
