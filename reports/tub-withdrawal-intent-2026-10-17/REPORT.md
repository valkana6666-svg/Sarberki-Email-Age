# Tagadott és ellentmondó dézsalemondás – 2026-10-17

Kiindulás: `bdc79b5e592d865a43ccfec8a4f9e0d6ca43dac6`, kizárólag
`gmail-test-subject-allowlist`. A kiinduló commit két branch-szűrt CI-je sikeres;
az előzőleg igazolt változtatásokat nem építettük újra.

## Hiba és változás

A „Please do not cancel the hot tub” korábban lemondásként értelmeződött.
HU/DE/SI tagadott lemondásoknál is hiányzott a külön biztonságos szándékállapot.
A három új regresszió a javítás előtt hibázott.

A közös szolgáltatásértelmező a tesztelt tagadott lemondási alakokat
`actionConflict: true` jelzéssel, emberi tisztázásra adja át. Nem aktiválja újra
és nem mondja le automatikusan a korábbi igényt. A meglévő ellentmondásos
„cancel ... and add ...” kérés is ugyanezt a biztonságos megjelenítést kapja.
A vetületben `requested: null`, `verificationStatus: intent_unverified` jelzi
az ismeretlen szándékot; a megszokott true/false nem helyettesíti a bizonytalanságot.
Azonos üzenetidőpontnál a konfliktus elsőbbséget élvez a lemondással és a kéréssel
szemben, így a feldolgozási sorrend nem tünteti el az emberi tisztázási igényt.

A Reader külön jelzi a bizonytalanságot. HU/DE/EN/SI választervezetben a rendszer
rákérdez a megtartásra vagy visszavonásra, és nem nyugtáz lemondást.
Vegyes szállás-/dézsalevélnél megmarad a szállásigény és annak válaszrésze;
a tisztázó dézsaszöveg ehhez kapcsolódik. A tárolás és az olvasási előnézet
azonos megjelenítési segédet használ. Nincs új jogosultság vagy második döntési motor.

## Bizonyíték és korlát

- Célzott csomag: 49 PASS / 0 FAIL / 0 SKIP (a négy nyelvű sablonra utána
  hozzáadott további tesztet a teljes regresszió ellenőrzi).
- Valódi izolált PostgreSQL/PGlite: normál Writer-ügyfrissítés → tárolt tervezet →
  Reader-előnézet → külön szolgáltatásjóváhagyás elutasítása.
- Öt bizonytalan üzenet függő állapotban mentődik; nincs szolgáltatásjóváhagyási sor.
  A kötés- és kapacitásszolgáltató hívásszáma **0**. Minden rendes ügyfrissítés auditált.
- Vegyes új szállásigény megőrzi az időszakát; a tervezet és előnézet is tartalmazza
  a tisztázó szöveget. A külön dézsajóváhagyás itt is tiltott.
- Régi idézett tagadás nem válik új kérésé; korábbi lemondás nem éled újra.
- Nyelvi bizonyíték: meghatározott szintetikus kifejezések és determinisztikus sablonok.
  Ez nem általános nyelvi megértési garancia vagy új élő OpenAI-/Gmail-próba.
- Javítás utáni teljes helyi `npm test`: **1652 PASS / 0 FAIL / 0 SKIP**.
- Az adott commit CI/deploy eredménye a koordinátori zárójelentésben.

## Napváltáskor feltárt tesztóra-hiba

Az első teljes futás 1630 PASS / 21 FAIL / 0 SKIP eredményt adott (1651 teszt).
Az érintett történelmi ár-/levélminták 2026-10-16-ra vonatkoztak, de a teszt
2026-10-17-én a valódi aktuális órát használta. A múltbeli időszak elutasítása helyes;
a tesztkörnyezet nem volt determinisztikus.

Öt érintett tesztfájl most saját, 2026-10-05T15:40:00Z tesztórát használ,
helyreállítással a tesztfájl végén. A valós futtatókörnyezet és a production
árvalidátor nem változott. Az érintett csomag **327 PASS / 0 FAIL / 0 SKIP**.
Külön árvalidátor-regresszió ellenőrzi az UTC-napváltást: tegnap elutasított,
a mai érkezés megengedett. Ez az időzóna-szabály meglévő működését őrzi meg,
nem új üzleti időzóna-döntés.

## További munka

A feltételes lemondási kérdések és több eltérő foglalási hivatkozás kombinációja
külön következő ellenőrzési kör. V1-becslés továbbra is 90%; a tesztszám növekedése
nem helyettesíti a szolgáltatói, tényleges iPhone- és végleges elfogadási bizonyítékot.
A Previo tesztcsatlakozás 2026-10-19–20-ra várható; addig a többi modul fejleszthető.

V2/V3 érték: az elkülönített bizonytalan szándék és a már létező szerveres
jóváhagyási tiltás később is megtartja az emberi visszaesési utat. A tervezet
nem küldési vagy foglalási engedély.

Csak szintetikus tesztadat és tesztág. Nincs Previo-kapcsolat/írás, valódi foglalás,
valódi vendégadat, e-mail-/Pushover-küldés, main- vagy production-módosítás.
