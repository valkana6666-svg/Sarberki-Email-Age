# Szállás- és szolgáltatáslemondások elkülönítése – 2026-10-17

Kiindulás: `a4abbd2e48f7997e32641fa93413c05b159ec8e5`, kizárólag
`gmail-test-subject-allowlist`. A korábbi sikeres ellenőrzések nem kerültek
újraépítésre; a közös értelmező módosítása indokolja az új regressziót.

## Igazolt hiba

A „Please cancel dinner. Please add a hot tub” lemondási szava az egész levélre
hatott. Emiatt a külön dézsaigény lemondásként jelenhetett meg. A szálláslemondást
és külön dézsaigényt tartalmazó levél szolgáltatás-only útvonalra kerülhetett.
A „Cancel dinner. And the hot tub” és az egymásnak ellentmondó külön dézsamondatok
sem kaptak következetesen emberi tisztázási jelzést.
A három új regresszió a javítás előtt hibázott: 24 PASS / 3 FAIL / 0 SKIP.

## Javítás

- A meglévő közös értelmező a lemondást és tagadott lemondást a dézsát említő
  mondatrészekben értékeli; a tesztelt HU/DE/EN/SI külön kéréseket elválasztja
  a más szolgáltatásra vonatkozó lemondástól.
- Az explicit dézsalemondás megmarad. A kétértelmű folytatás és ellentmondó
  dézsakérés a meglévő `actionConflict`/`intent_unverified` emberi útra kerül.
- Ha más szolgáltatás lemondása is szerepel, annak dátuma/kezdése/időtartama nem
  töltheti ki a dézsa hiányzó időpontját. A dézsa saját pontozott dátuma megmarad;
  a levél teljes foglalásihivatkozás-konfliktusellenőrzése változatlanul érvényes.
- Az explicit szálláslemondás és dézsaigény együtt normál szállásügy-útvonalon
  marad, emberi tisztázással. A dézsajóváhagyás itt tiltott, így egy bizonytalan
  szálláshelyzethez nem keletkezhet automatikusan jóváhagyható szolgáltatás.
  Ez nem valós szálláslemondási végrehajtás.

Nincs második döntési motor, új jogosultság vagy SQL-migráció.

## Bizonyíték

- Célzott csomag: **35 PASS / 0 FAIL / 0 SKIP**.
- Négy nyelvű más-szolgáltatás-lemondás és külön dézsaigény; négy nyelvű explicit
  szálláslemondás; kontrasztos mondat, tagadás, közös lemondás, ellentmondó mondatok,
  hiányzó és saját dézsaidőpont kontrollja.
- Izolált valódi PostgreSQL/PGlite: normál Writer-frissítés → mentett tervezet →
  Reader-preview. A szállás dátumai változatlanok. Más szolgáltatás lemondása mellett
  a megfelelő teljes szintetikus kapacitásbizonyíték engedi az emberi
  jóváhagyási előnézetet, de jóváhagyás nem történik.
- Szálláslemondással vegyes kérésnél a szolgáltatásjóváhagyás már a kötés-/kapacitás-
  szolgáltató előtt leáll: 0 ilyen hívás, 0 jóváhagyási sor. Két normál ügyírás
  auditált; a teszt nem SQL-adatmódosítással kerüli meg az ügy-API-t.
- Ez determinisztikus szintetikus nyelvi és izolált DB-bizonyíték; nem általános
  nyelvi garancia vagy új élő Gmail-/OpenAI-/Previo-teszt.
- Teljes helyi `npm test`: **1661 PASS / 0 FAIL / 0 SKIP**.
- A commitazonos CI/deploy eredménye a koordinátori zárójelentésben.

## Állapot és következő lépés

V1 továbbra is kb. 90%, mérnöki becslés; a szolgáltatói, tényleges iPhone- és
végleges elfogadási bizonyíték nincs kiváltva nyelvi regressziókkal.
Következő lépés: a Previo nélküli végponttól végpontig elfogadási bizonyítékok
összesítése és a tényleges Gmail OAuth-beolvasás fennmaradó hozzáférési kapujának
ellenőrzése, kizárólag az elkülönített szintetikus tesztpostaládában.

V2/V3 érték: a közös szándékbesorolás megőrzi a külön emberi szolgáltatásellenőrzést
és a későbbi önálló agent biztonságos visszaesési útját. A tervezet nem küldési vagy
foglalási engedély. Nincs valódi vendégadat, e-mail-/Pushover-küldés, Previo-hívás
vagy írás, valódi foglalás, main- vagy production-módosítás.
