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
| Tulajdonosi élesítési ellenőrzőlista | `676ee69` | `docs/V1-TEST-MAILBOX-ACTIVATION-CHECKLIST.md` (dokumentum; tények a telepítő/rollback/kapu fájlokból ellenőrizve) |

## NEM IGAZOLT / tulajdonosi döntésre vár
- Hosztolt migráció: `deployment/test-mailbox/install.sql` (TEST projekt).
- Kapcsolók: Netlify `CASE_TEST_MAILBOX_INGEST_ENABLED=sarberki-test-fictional-only` és DB `sc_test_mailbox_config`.
- TEST-telepítés (`[netlify-test-release]`), élő Gmail → ügy → Writer → független Approver próba, fizikai iPhone.

## Pontos folytatási pont
- Igazolt (szintetikus): a lista azonosítói egyediek; idegen tenant, Bearer, hiányzó CSRF → 403; `.invalid` feladós vagy más tenantbeli `tm-` sor nem jelenik meg (404, listában sincs); bejelentkezés után visszavont tagság → nincs ügyadat.
- Megfigyelés (nem biztonsági): a napi lista 100 tételnél vág; 100 normál ügy mellett a tesztlevél-ügy kimaradhat. Jelenlegi szintetikus mennyiségnél nem releváns; csak igazolt igény esetén javítandó.
- Kódoldalon nincs ismert, engedély nélkül elvégezhető V1-hiány a tesztlevél-láncban. Következő lépés: tulajdonosi döntés az ellenőrzőlista 1–4. pontjáról (mentés → migráció → kapcsolók → TEST-telepítés), majd az 5. pont élő próbája. Addig az óránkénti futás csak ellenőrizzen és jelentsen; látszatfejlesztés nem indokolt.
- Ellenőrzőlista 1.1–1.2 (mentés + elkülönített visszaállítás): PASS a Backup V2 41284787609-es futása alapján (2026-11-01, tulajdonosi engedéllyel kiolvasva). Hátralévő tulajdonosi döntés: 2. migráció → 3. kapcsolók → 4. TEST-telepítés → 5. élő próba.
- Élő lépések kizárólag tulajdonosi döntés után.

## Átadási nyilvántartás (Claude / Codex / Work / óránkénti futás)
Formátum átadott feladathoz: azonosító · felelős · releváns fájlok · utolsó igazolt commit · hiba · elvárt teszt · állapot. Ténylegesen átadott feladatot más nem végez párhuzamosan.

| Azonosító | Felelős | Fájlok | Utolsó igazolt commit | Hiba / cél | Elvárt teszt | Állapot |
|---|---|---|---|---|---|---|
| TM-ACT-2 | Tulajdonos | `deployment/test-mailbox/install.sql`, `rollback.sql` | `7d14aa0` | hosztolt migráció a TEST-projekten | ellenőrzőlista 2.1–2.3 | tulajdonosi döntésre vár |
| TM-ACT-3/4 | Tulajdonos | Netlify-változó, `sc_test_mailbox_config`, `[netlify-test-release]` | `7d14aa0` | kapcsolók + TEST-telepítés | ellenőrzőlista 3–4 | tulajdonosi döntésre vár |
| TM-ACT-5 | Tulajdonos + Claude (visszaolvasás) | napi kezelő | `7d14aa0` | élő Writer/Approver próba, iPhone | ellenőrzőlista 5.1–5.12 | 2–4 után |

Codexnek átadott feladat jelenleg nincs; Work/Codex commit 2026-10-31 óta nem érkezett a tesztágra (ellenőrizve 2026-11-01 07:59Z). Nyitott GitHub-jegyek között nincs Gmail-lánc hiba (#8 napi kezelő: a felület és az ügy-életciklus a tesztlevél-ügyekre bekötve; „Lezárt ügyek” szándékosan üres, mert a D2 döntés szerint az elutasítás nem zár le).

## Bizonyítékolvasási tudnivalók
- A „Sarberki daily UI synthetic mobile proof” push eseményre **mindig skipped**; bizonyíték csak a `workflow_dispatch` futás (`confirm_synthetic_only:true`). Utolsó: run 41281756319 (#39, `52eb26e`) PASS. Push-futás „skipped” állapota nem hiba és nem NEM IGAZOLT.
- Az `AGENTS.md`-t csak-ellenőrző futásban is be kell olvasni (blob-azonosítóval jelentve).

## Óránkénti automatizálás (403-ügy) – állapot
- Korábbi 403 oka: a régi (csevegő típusú) feladathoz nem volt repository csatolva. A régi feladat kikapcsolva.
- Új Code-típusú feladat (repository csatolva): írási hozzáférés **PASS** – saját push `b4a32ad` (2026-11-01 05:53Z); olvasási hozzáférés **PASS** – 06:18Z és 07:18Z futás hiba nélkül olvasta a HEAD-et és a CI-t, és az 1 órás szabály szerint nem fejlesztett.
- Teljes önálló fejlesztési futás: **NEM IGAZOLT** (eddig nem volt rá szabad ablak/feladat).
- A feladat utasításszövege ügynökből nem módosítható (tulajdonosi létrehozás); a javasolt új szöveget a tulajdonos másolja be. Új ütemezés nem jött létre.
