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


## Work központi bizonyíték-audit – 2026-11-01 09:09 CET

### Kiindulás és döntés
- Első tartalmi művelet: teljes tesztági AGENTS.md beolvasása 2026-11-01T08:06:52Z (09:06:52 CET), blob: `be27bd2dfb4795496bd9f3d64ad60ada1123de5b`. A HEAD teljes gitfája ugyanazt a blobot tartalmazza.
- Ellenőrzött kiinduló HEAD: `bd78591d1817b18604cd9287601be7caa637be7d`.
- Meglévő használható megoldások: közös AI-mag, szerveres Gmail-forrástanúsítás, tesztlevél-RPC-k és napi felület, Backup V2, jelen dokumentum átadási táblája és a meglévő aktiválási ellenőrzőlista.
- Választás: ezek bizonyítékainak visszaolvasása és az aktuális TEST-metaadatok lekérése. Új rendszer vagy a sikeres regresszió ismétlése nem oldaná fel a hiányzó aktiválási kapukat, viszont futási költséget és ütközési kockázatot adna.
- Kód, üzleti szabály, migráció, kapcsoló, workflow és telepítés változatlan. Új futtatás, e-mail, Previo-művelet és más fejlesztőnek átadás nem történt. Csak ez a dokumentum bővült.

### Ellenőrzött feladatnyilvántartás
A felelős szerepkör kijelölés; nem bizonyít elindított munkamenetet. A commit a megnevezett bizonyíték forrásverziója, nem automatikusan a hosztolt rendszer verziója.

| Azonosító | Felelős | Állapot | Utolsó igazolt commit | Bizonyíték és korlát | Következő konkrét lépés |
|---|---|---|---|---|---|
| COORD-AGENTS | Work | PASS | bd78591d1817b18604cd9287601be7caa637be7d | teljes szabályzat + HEAD/gitfa visszaolvasva; nem globális Work-beállítás bizonyítéka | új munkamenetben ismét aktuális beolvasás |
| TM-SYN-CI | Claude fejlesztés / Work audit | PASS | bd78591d1817b18604cd9287601be7caa637be7d | [CI 41286987060](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/41286987060): naplóból npm test 2489 PASS / 0 FAIL / 0 SKIP; külön célzott csomag 26 PASS, nem összeadandó | változatlan kódra ne indíts új teljes csomagot |
| TM-SYN-MOBILE | Claude / Work audit | PASS | 52eb26eea983369113a903691c6bf5faa8744599 | [dispatch 41281756319](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/41281756319): 44/44 PASS Chromium+WebKit; actualIPhoneVerified=false, külső kérés 0 | fizikai iPhone az aktiválás után |
| TM-ACT-1 | Work bizonyítékellenőrzés | PASS | 30cece8581d5883d1b4595dbbf991a4d74f50ef8 | [Backup V2 41284787609](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/41284787609): export + külön PostgreSQL restore + exact-ID GitHub-visszaolvasás utáni új restore; full_restore és case_manifest PASS, 50 tábla | migráció előtt a snapshot frissességét és a proofban megnevezett csomaghash-t ismét ellenőrizni |
| TM-ACT-0-DB | Work | PASS | bd78591d1817b18604cd9287601be7caa637be7d | 08:08–08:09Z readonly SQL: ACTIVE_HEALTHY TEST; projektkötés helyes; kulcs létezik (értékét nem olvastuk); test tenant igen, váratlan tenant 0; Writer 2, Approver 1, külön személypár létezik; a 7 meglévő ellenőrzött táblán RLS aktív | tényleges bejelentkezési/jogosultsági próba az élő körben; a kulcs Netlify-oldali egyezése még nem igazolt |
| TM-ACT-2 | Tulajdonosi döntés; utána kijelölt egyetlen végrehajtó | BLOKKOLT | bd78591d1817b18604cd9287601be7caa637be7d | readonly katalógus: sc_test_mailbox_config és sc_test_mailbox_cases hiányzik; sc_tm_* függvénylista üres; install.sql és rollback.sql beolvasva | pontos TEST-célra külön engedély; install előfeltételei és mentéshash, majd ellenőrzőlista 2.1–2.3 |
| TM-ACT-3/4 | Tulajdonosi döntés; Work koordináció | BLOKKOLT | bd78591d1817b18604cd9287601be7caa637be7d | GET /api/health: deployedCommit=1cfde646f43036b83e1bb122ea74ce96bd3afa8c; readonly Gmail, autoSend=false, autoBookingModification=false. Ez nem az új kiadás. Netlify titkos kapcsolók közvetlenül nem olvashatók ebből a munkamenetből | migráció után külön kapcsoló- és kiadási engedély; pontos release SHA rögzítése, majd célzott verify_deployed |
| TM-ACT-5 | Work + tulajdonos; Claude célzott javítás szükség esetén | BLOKKOLT | 52eb26eea983369113a903691c6bf5faa8744599 | élő Gmail → ügy → Writer → független Approver és fizikai iPhone NEM IGAZOLT; szintetikus próba nem helyettesíti | aktiválási ellenőrzőlista 5.1–5.12 a 2–4 kapuk után |
| AUTO-CODE-ACCESS | Claude Code / Work audit | PASS | b4a32adce7f04c8bb527362eacf1d23dc19a631a | commit és módosított proof-fájl közvetlenül visszaolvasva; GitHub-hozzáférési próba, nem teljes fejlesztési vagy E2E-próba | ütemező élő konfigurációjának/naplójának külön ellenőrzése, ha hozzáférhető |
| AUTO-FAILOVER | Work koordináció | NEM IGAZOLT | bd78591d1817b18604cd9287601be7caa637be7d | nincs elérhető Claude-ütemező vagy hitelesített automatikus Claude→Codex→Claude próba; keretkimerülés felismerése sem igazolt | első valódi szükségnél egy feladat, egy felelős és fájlkör; a dokumentált 60 perces szabály csak ütközéscsökkentés, nem atomi zárolás |
| DR-FULL-PLATFORM | Work koordináció | NEM IGAZOLT | 30cece8581d5883d1b4595dbbf991a4d74f50ef8 | a mai futás Drive-lépései SKIP; SQL/GitHub-restore nem teljes Supabase/Netlify/Auth/Edge/platform-helyreállítás | meglévő #5/#6 nyilvántartás szerint a hiányzó külön bizonyítékok, kész SQL-próba ismétlése nélkül |

### Aktiválás – végrehajtható sorrend
A részletes, gombokat és negatív próbákat tartalmazó egyetlen lista: [V1-TEST-MAILBOX-ACTIVATION-CHECKLIST.md](V1-TEST-MAILBOX-ACTIVATION-CHECKLIST.md).
1. **Mentés:** a fenti sikeres snapshot használhatósága csak változatlan TEST-adatbázis mellett áll; a pontos helyreállítási csomag hash-t a proofból kell választani. A staging ZIP digest nem nevezhető automatikusan telepítési backup-hashnek.
2. **Migráció, csak külön engedéllyel:** ellenőrzött mojnqizbcaczstguikpv cél, friss mentés; ugyanabban a munkamenetben projekt- és backup-hash deklaráció; kizárólag deployment/test-mailbox/install.sql. Visszaolvasáskor kapcsoló false, négy RPC és elvárt RLS/grant; előtte/utána meglévő jogosultságok összevetése.
3. **Kapcsolók, külön engedéllyel:** meglévő cloud-approval Netlify/DB kötés és kulcsegyezés privát ellenőrzése; pontos TEST-only env érték és DB enabled. Nincs titoknaplózás vagy védelemgyengítés.
4. **Kiadás, külön engedéllyel:** friss HEAD + releváns CI, egy kijelölt végrehajtó; [netlify-test-release] kiadási commit csak a meglévő TEST-oldalra. Előző deployedCommit rögzítve fent; végleges kiadási SHA még nincs kijelölve. A célzott gmail-readonly-targeted-20261024.yml verify_deployed=true a kiadási commitra ellenőrizze /api/health deployedCommit értékét. Rutinszerű dokumentációs push nem release.
5. **Valódi tesztpostafiókos kör:** csak kitalált tartalmú, jelölt levél a sarberkiprojecttest@gmail.com fiókban; OAuth, olvasás, szerveres forrástanúsítás, közös AI, mentés és visszaolvasás; duplikátum és Re: tiltás; Writer nem dönt; más személy visszaküld/elutasít/jóváhagy; revízió/hash/audit. Küldés és foglalás végig tiltott. Tesztlevél létrehozása/küldése e körben sem történt.
6. **Fizikai iPhone:** az új folyamat célzott köre alkalmazásváltással, visszaolvasással; a korábban lezárt teljes Safari-próbát nem kezdjük újra.
7. **Hiba/rollback:** FAIL-nél megállás, jóváhagyott visszaállítási lépés: DB enabled=false, TEST-env törlés és szükség esetén korábbi kiadás, majd SHA-visszaolvasás; schema rollback külön döntéssel, audit/ügyek megőrzésével. A hosztolt rollback tényleges végrehajtása NEM IGAZOLT, most nem futott.
8. **Lezárás:** minden sor PASS/FAIL/NEM IGAZOLT + teljes SHA/időpont/bizonyíték; V1 100% csak a kötelező élő elfogadási kapuk után. Új készültségi százalékot/időbecslést ez az audit nem állapít meg.

### Munkamegosztás, automatizálás és skillek
- Claude Code elsődleges fejlesztő; Codex célzott hibajavító/ellenőrző, tényleges átvétel csak kijelölt feladatra; Work prioritás, bizonyíték és aktiválási koordináció. Új kódfeladat most nincs átadva.
- A GitHub az egyetlen fejlesztési nyilvántartás. A „SÁRBERKI – PROJEKTVEZETŐ” külön beszélgetésbe közvetlen írási integráció ebben a munkamenetben nem érhető el; a jelen beszélgetés zárójelentése és ez a dokumentum adja az emberi átadást.
- ChatGPT automatizálások ténylegesen lekérdezve: napi mentés, Supabase-csomagfigyelő és a halasztott mérési emlékeztető aktív. Claude Code feladatot ez a szolgáltatás nem kezel. A Claude-konfigurációról a GitHubban dokumentált állapotot olvastuk, nem élő ütemezőbeállítást.
- Skill-felmérés: az aktuális Work/Codex katalógus, a skill-creator útmutató és a teljes tesztági gitfa áttekintve. A gitfában nincs SKILL.md/.claude/skills/.codex/skills készlet; a helyi personal-skills checkoutban sem volt közvetlen */SKILL.md találat. Ez nem a távoli Claude telepített skilljeinek leltára, azok NEM IGAZOLT állapotúak.
- Az indítást, célzott javítást, tesztet és átadást az AGENTS.md és e dokumentum már lefedi; új projekt-skill előnye nem bizonyított. Új skill, állandó AI-figyelő vagy ütemezés nem készült.
- Kreditmegtakarítás: nincs új teljes teszt/mentés; meglévő naplók egyszeri visszaolvasása, független lekérdezések csoportosítása; nincs automatikus feladatcsere bizonyíték nélkül. Blokkolt óránkénti futás ne készítsen öncélú commitot. Workflow/ütemezés-módosítást nem végeztünk.
- Projektutasítások összevetése: a fő korlátok egyeznek. Az AGENTS.md részletesebb kapacitás-, titok-, Pushover-, RLS- és E2E-korlátokat, továbbá történeti október 18-i ütemtervet tartalmaz; a régi dátum nem nyit újra kész feladatot. Tartós/globális Work-beállítás mentése és új munkamenetbeli automatikus betöltése NEM IGAZOLT.

**Következő konkrét feladat:** a TM-ACT-2 pontos TEST-migrációjának tulajdonosi döntése az ellenőrzőlista szerint; utána külön kapcsoló- és kiadási döntések. Addig csak új bizonyítékot vagy valódi változást ellenőrzünk.
