# Sárberki V1 – folytatási pont (élő dokumentum)

Érzékeny adatot, tokent, valódi vendégadatot nem tartalmaz. Minden interaktív és óránkénti futás végén frissítendő.

## Állandó folytatási szabály (tulajdonosi utasítás, 2026-11-01)
- A „Folytasd” vagy „Y” mindig azt jelenti: folytatás a legutóbbi **ténylegesen igazolt** állapottól, a kijelölt terv következő hiányzó feladatával. Nem új projekt, nem újratervezés, nem kész munka megismétlése.
- Minden futás elején: tesztági `AGENTS.md` teljes beolvasása (ha nem elérhető: NEM IGAZOLT, szabályzatot igénylő módosítás nincs) → GitHub HEAD → utolsó igazolt eredmény → kész fejlesztések és tesztek → következő valódi hiány → onnan folytatás.
- Prioritás: (1) Gmail-integráció célzott hiánypótlása, (2) központi AI-feldolgozás és ügymentés, (3) napi kezelő, (4) Writer + független Approver, (5) jogosultsági/biztonsági tesztek, (6) mobil kezelhetőség, (7) tesztelés és dokumentálás.
- Blokkolt feladat: dokumentálás, majd a következő biztonságosan elvégezhető feladat. Ha minden blokkolt: akadályjelentés, látszatfejlesztés nélkül.
- A „Folytasd” nem ad engedélyt telepítésre, hosztolt migrációra, éles műveletre vagy biztonsági korlát feloldására. Kizárólag `gmail-test-subject-allowlist`; main/production, éles levélküldés, Previo-írás tilos; a Work telepítési/hosztolt ellenőrzésével nem ütközhet.
- Futás végi jelentés: kiindulási HEAD, elvégzett feladat, fájlok és commit, tesztek és bizonyítékok, akadályok, következő feladat, pontos folytatási pont.

## Igazolt állapot (2026-11-01)
| Lépés | Commit | Bizonyíték |
|---|---|---|
| WP2 Gmail-forrástanúsítás | korábbi | unit + CI |
| WP3 offline SQL + rollback | korábbi | PGlite |
| WP4a Gmail → közös AI → `sc_tm_create` | `58fcf1d`, `9a1747f` | PGlite |
| Szerver: ingest / redraft / decide (alapból tiltva) | `bbbd79d`, `5729a2c` | PGlite a valódi kezelőn |
| Napi kezelő bekötése (mentés, megnyitás, Writer, Approver) | `484c668` | `npm test` 2488/2488, Chromium + WebKit napi próba, CI zöld |
| Mobil böngészőpróba a tesztlevél-ügy teljes körére | `52eb26e` | Chromium 22/22 helyben; Chromium + WebKit CI #39 |
| Biztonsági rés-ellenőrzés: `test-mailbox-record` + napi lista | `a09c9d4` | PGlite a hosztolt rétegsoron (valódi RLS); nem talált hiányt, kódjavítás nem kellett; 3 mutáció bukik |
| Tulajdonosi élesítési ellenőrzőlista | ez a commit | `docs/V1-TEST-MAILBOX-ACTIVATION-CHECKLIST.md` (dokumentum; tények a telepítő/rollback/kapu fájlokból ellenőrizve) |

## NEM IGAZOLT / tulajdonosi döntésre vár
- Hosztolt migráció: `deployment/test-mailbox/install.sql` (TEST projekt).
- Kapcsolók: Netlify `CASE_TEST_MAILBOX_INGEST_ENABLED=sarberki-test-fictional-only` és DB `sc_test_mailbox_config`.
- TEST-telepítés (`[netlify-test-release]`), élő Gmail → ügy → Writer → független Approver próba, fizikai iPhone.

## Pontos folytatási pont
- Igazolt (szintetikus): a lista azonosítói egyediek; idegen tenant, Bearer, hiányzó CSRF → 403; `.invalid` feladós vagy más tenantbeli `tm-` sor nem jelenik meg (404, listában sincs); bejelentkezés után visszavont tagság → nincs ügyadat.
- Megfigyelés (nem biztonsági): a napi lista 100 tételnél vág; 100 normál ügy mellett a tesztlevél-ügy kimaradhat. Jelenlegi szintetikus mennyiségnél nem releváns; csak igazolt igény esetén javítandó.
- Kódoldalon nincs ismert, engedély nélkül elvégezhető V1-hiány a tesztlevél-láncban. Következő lépés: tulajdonosi döntés az ellenőrzőlista 1–4. pontjáról (mentés → migráció → kapcsolók → TEST-telepítés), majd az 5. pont élő próbája. Addig az óránkénti futás csak ellenőrizzen és jelentsen; látszatfejlesztés nem indokolt.
- Élő lépések kizárólag tulajdonosi döntés után.
