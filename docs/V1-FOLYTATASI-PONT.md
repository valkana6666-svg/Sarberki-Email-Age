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
- Hosztolt WP3-migráció: **PASS**, Supabase `20261101082048`; kikapcsolva. Részletes bizonyíték a dokumentum végén.
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
| TM-ACT-2 | Work | `deployment/test-mailbox/install.sql`, `rollback.sql` | `2d0b2264011e2a462b64ea3c5862bd6a72ef1af0` | TEST-migráció végrehajtva, enabled=false | ellenőrzőlista 2.1–2.3, migráció 20261101082048 | PASS |
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


## WP3 feltételes TEST-migráció – végrehajtási bizonyíték (2026-11-01)

Ez a legújabb állapot felülírja a korábbi TM-ACT-2 „tulajdonosi döntésre vár / BLOKKOLT” megjelölést. A tulajdonos e munkamenetben feltételesen engedélyezte kizárólag a WP3 TEST-migrációt, sikeres előellenőrzések után.

- **Eredmény: PASS; a funkció továbbra is kikapcsolva.** Migráció: `20261101082048_wp3_test_mailbox_owner_approved_20261101`. Indítás: `2026-11-01T08:20:39.305Z` (09:20:39 CET).
- Induló HEAD: `cabc7580e49d81185bc0cc8431eb90dbe48354da`; migráció előtti HEAD: `2d0b2264011e2a462b64ea3c5862bd6a72ef1af0`.
- Teljes aktuális AGENTS.md beolvasva `2026-11-01T08:13:59Z` (09:13:59 CET); blob `be27bd2dfb4795496bd9f3d64ad60ada1123de5b`.
- Célprojekt az API metaadatából: `sarberki-test / mojnqizbcaczstguikpv / ACTIVE_HEALTHY`; más projekt nem kapott SQL-módosítást.
- Jóváhagyott telepítő blobja: `e2429f6a7972d1384f093a5543cd284b97b167ff`; rollback blobja: `b0ae30785f7479b9bad5ece0f4135501d1fdf7a6`. Az eredeti SQL-fájlok nem változtak.

### Mentés és frissesség
- A korábbi [41284787609](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/41284787609) proof-artifactját ténylegesen letöltöttük és ZIP-digestjét ellenőriztük (`ed9c8681a1511d3d3506ad3995a03de35fede890ec2a629232044446dba36864`). A telepítéshez alkalmas titkosított helyreállítási csomag SHA-256-ja: `2b0906b984359a4d446f57a539a767411ea9920375b9a63813806ac9d321753a`; nem az artifact külső ZIP-digestje.
- A korábbi snapshot óta eltelt teljes időszak változatlansága nem volt bizonyítható a publikus proofból. Ezért a tulajdonosi feltétel alapján a meglévő eljárással **egyszeri kézi WP3-frissítő mentés** indult, nem új automatizálás. A napi automatizálás nem módosult.
- Friss mentési kérés commitja: `2d0b2264011e2a462b64ea3c5862bd6a72ef1af0`; [run 41288264009](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/41288264009) SUCCESS.
- Stage artifact: `13075424077`; proof artifact: `13075573868`. A letöltött proof ZIP SHA-256-ja egyezik az API digesttel: `a4a7f6992f04e8626a21990705e2bc03343f7f0fe9fb5b21a46717267b2bf995`.
- **A migrációban ténylegesen használt mentésazonosító:** `b12553febf662bee8b170d16a4980e2d567fbc1cb63d3a7aabc45fecf520f072` (titkosított helyreállítási csomag).
- Proof: source_project=mojnqizbcaczstguikpv; input_mode=exact_id_github_download; full_restore=PASS; case_manifest=PASS; all_table_copy_payloads_equal=true; tables_compared=50; verification_completed=true. A visszaállítás külön PostgreSQL 17 célba történt; a forrásadatbázis nem restore-cél.
- Frissesség a friss mentési körben: 51 tábla INSERT/UPDATE/DELETE statisztikai számlálói és a stats_reset időpont azonos; oszlop-, kényszer-, public-függvény-, reláció/ACL/RLS- és policy-ellenőrző azonosítók azonosak a mentés előtt/után. Ez metaadat-/statisztika-alapú változásellenőrzés; a régi snapshot teljes bájtszintű összevetését nem állítjuk. A migráció előtti referencia e friss mentés.
- A Drive-ág kimaradt; teljes platform/Auth API/Netlify-helyreállítást ez sem igazol.

### Telepítés és visszaolvasás
- Telepítő előfeltételek PASS: helyes projektkötés, jelen lévő tanúsítási kulcs (értékét nem olvastuk ki), teszt-tenant, 0 váratlan tenant, auth.uid, sha256, jogosultságfüggvény és MAC-függvény elérhető; WP3-objektumok előtte hiányoztak.
- Supabase apply_migration ugyanabban az SQL-tranzakcióban kapta a `sarberki.tm_install_project_ref` és `sarberki.tm_backup_sha256` értékeket, közvetlenül az eredeti install.sql BEGIN-je után. Munkameneti lock_timeout=5s, statement_timeout=60s. Ezen deklarációkon túl a telepítő tartalma változatlan. Válasz: success=true.
- `sc_test_mailbox_config` és `sc_test_mailbox_cases` létrejött, mindkettő RLS-védett. A config pontosan egy sora: enabled=false, backup_sha256 a fenti friss hash. Registry sorok száma: 0.
- `sc_tm_actor`, `sc_tm_create`, `sc_tm_redraft`, `sc_tm_decide` létrejött; mind a négy prosrc törzse pontosan egyezik a telepítővel, SECURITY DEFINER és üres search_path.
- PUBLIC/anon/service_role EXECUTE egyik új függvényre sincs. authenticated csak create/redraft/decide EXECUTE-jogot kapott; actor közvetlenül nem hívható.
- Az új táblákon anon/authenticated/service_role szerepeknek nincs SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN jogosultsága (teljes privilégium-mátrix visszaolvasva).
- Meglévő 5 ellenőrzött függvény definíciója/ACL-je, 10 meglévő tábla ACL/RLS-beállítása és 77 meglévő kényszer változatlan a telepítés előtti kiinduláshoz képest.
- A DML-számlálókban csak a várt új config INSERT=1 és a Supabase migrációs nyilvántartás INSERT+1 változás jelent meg; a registry üres, a meglévő táblák számlálói változatlanok.
- Negatív, visszagörgetett próba authenticated szereppel: a `sc_tm_create` kikapcsolt állapotban `42501 / forbidden or expired` hibát adott. Váratlan elfogadásra a próba hibát dobott volna; az ellenőrzés PASS. Ez nem érvényes élő Gmail/Auth E2E-próba.
- Advisors előtte/utána összevetve: az új két belső, policy nélküli, RLS+REVOKE táblára INFO; a három szándékos authenticated definer RPC-re WARN jelent meg. A meglévő anon `rls_auto_enable` és Auth leaked-password figyelmeztetés nem változott. A `rls_auto_enable` forrása visszaolvasva: event_trigger visszatérésű automatikus RLS-bekapcsoló. Nem módosítottuk; az általános figyelmeztetések nem egyenlők az új RPC-k jogosulatlan használatának bizonyítékával.
- Rollback SQL ellenőrizve: exact projektdeklaráció kell; kapcsoló false + négy új függvény eltávolítása; ügy/audit/message-key/registry megmarad. **Hosztolt rollback nem futott**, mert a migráció és a visszaolvasás sikeres; rollbackre nincs jelzett szükség.

### Aktuális feladatok
| Azonosító | Felelős | Állapot | Bizonyítékverzió | Következő lépés |
|---|---|---|---|---|
| TM-ACT-1-REFRESH | Work | PASS | 2d0b2264011e2a462b64ea3c5862bd6a72ef1af0; run 41288264009 | új adatbázis-változtatás előtt snapshot-frissesség újraértékelése |
| TM-ACT-2 | Work | PASS | Supabase 20261101082048; install blob e2429f6a7972d1384f093a5543cd284b97b167ff | nincs újratelepítés |
| TM-ACT-3/4 | Tulajdonosi döntés; egyetlen kijelölt végrehajtó | BLOKKOLT | kapcsoló false visszaolvasva | külön kapcsoló- és TEST-kiadási engedély, privát Netlify-kötésellenőrzéssel |
| TM-ACT-5 | Work + tulajdonos | BLOKKOLT | szintetikus bizonyíték meglévő; élő kör NEM IGAZOLT | csak 3–4 után Gmail → Writer → független Approver, majd fizikai iPhone |

Netlify-telepítés, kapcsolóbekapcsolás, vendéglevél, foglalás és Previo-módosítás **nem történt**. A készültségi százalékot nem módosítjuk. Következő konkrét kapu: TM-ACT-3/4 külön tulajdonosi döntése.

## Engedélyezett TEST-aktiválás – hozzáférési akadály (2026-11-01)

- Tulajdonosi engedély e munkamenetben: meglévő leafy-chimera-2403e5 TEST-telepítés és két tesztlevél-kapcsoló bekapcsolása, kizárólag sikeres közvetlen biztonsági ellenőrzés után. Ez az engedély a folytatásra is érvényes, nem kell újra kérni; nem engedélyez vendégküldést, foglalást, Previo-írást vagy production-módosítást.
- AGENTS.md teljes beolvasása: 2026-11-01T08:26:33Z (09:26:33 CET), blob be27bd2dfb4795496bd9f3d64ad60ada1123de5b.
- Induló és újraellenőrzött HEAD: 51174326dc1a9f6b3e6d6ab2ecb527cd21f5af48.
- PASS: a legutóbbi teljes alkalmazás-CI [41286987060](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/41286987060) sikeres; bd78591d1817b18604cd9287601be7caa637be7d óta e HEAD-ig kizárólag három dokumentum változott. Nem futtattuk újra a sikeres alkalmazásteszteket.
- PASS: a [friss mentés/restore 41288264009](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/41288264009) sikeres; a két artifact elérhető, nem lejárt. A korábban letöltéssel igazolt proof és hash változatlan.
- PASS readonly SQL: WP3 két RLS-védett tábla és négy függvény jelen van, üres search_path és várt ACL; projektkötés és teszt-tenant helyes, tanúsítási kulcs létezik, váratlan tenant 0, külön Writer/Approver személypár létezik. Config enabled=false, registry=0. WP3 nem futott újra.
- PASS: GET /api/health 200; deployedCommit=1cfde646f43036b83e1bb122ea74ce96bd3afa8c; autoSend=false, autoBookingModification=false. Ez továbbra is az előző telepítés.
- Korlát: operator-session névtelen GET 401 AUTH_REQUIRED; booking-cases névtelen GET 400 INVALID_INPUT. Ebből nem állítunk hitelesített ügykezelési vagy teljes jóváhagyási PASS-t.
- Netlify hozzáférés feltárva: nincs elérhető Netlify-csatlakozó; plugin-keresés nem adott találatot; a helyi Netlify CLI és a vizsgált Netlify-hitelesítési környezeti változók nem konfiguráltak (értékeket nem olvastunk/naplóztunk).
- Böngészős ellenőrzés: app.netlify.com bejelentkezést kér. A felhasználó a biztonságos belépési folyamatban Google-t és a valkana6666@gmail.com fiókot választotta. A Google a biztonságos jelszóbeküldés után „Helytelen jelszó” hibát mutatott. Ez hitelesítési akadály, nem igazolt bot-/Netlify-üzemzavar. Hitelesítő érték nem került a modellhez vagy dokumentációba.
- **TM-ACT-3/4: BLOKKOLT a Netlify-belépésnél.** Netlify környezeti kapcsolók és privát kulcskötés NEM IGAZOLT. Kiadási commit nem készült, Netlify-telepítés és kapcsolómódosítás nem történt. Az adatbázis-kapcsoló a hiba után újra visszaolvasva false; nincs részleges aktiválás vagy szükséges rollback.
- Következő konkrét lépés: a jelen felhőböngészőben sikeres kézi Netlify-hitelesítés, majd csak a TEST-oldal környezeti beállításainak titokmentes ellenőrzése. Utána friss HEAD, szabályozott [netlify-test-release] commit/TEST-build, pontos deployedCommit; Netlify kapcsoló és végül DB-kapcsoló, a védelmek ellenőrzésével. Az élő Gmail-ügy és fizikai iPhone külön következő szakasz.

## Claude Code átvétel – TEST-kiadás (2026-11-01)
- AGENTS.md teljes beolvasása 09:03Z, blob `be27bd2dfb4795496bd9f3d64ad60ada1123de5b`; kiinduló HEAD `bee95a981dc928b2050a0d1405622c717d486dfe` (a Work 4 dokumentum-commitja után).
- Work-eredmények átvéve, nem ismételve: WP3 migráció PASS (20261101082048), friss mentés/restore PASS (41288264009), DB-kapcsoló false visszaolvasva.
- Hozzáférés ebből a környezetből: Netlify API, tesztoldal és Supabase **nem érhető el** (kimenő proxy 403), Netlify-/Supabase-csatlakozó és hitelesítő nincs. Ezért a Netlify környezeti változók titokmentes ellenőrzése és mindkét kapcsoló állítása innen **NEM VÉGEZHETŐ** – nem kerültük meg.
- Kiadás indoklása: a tulajdonos engedélyezte a TEST-telepítést. A telepített `1cfde64` és a HEAD közötti kódeltérés kizárólag az alapból tiltott tesztlevél-kód (`booking-cases.mjs`, `cloud-case-request.mjs`, `server-gmail-source.mjs`, `server-test-mailbox-case.mjs`, napi kezelő 3 fájl). Két független kapu tiltja: Netlify-változó hiányában és DB `enabled=false` mellett a szerver 403-at ad; ezt a kikapcsolt állapotú tesztek igazolják (CI 41286987060, kód változatlan azóta). A kiadás így kapcsoló nélkül nem nyit új műveletet.
- Kiadás: a meglévő kapun át (`[netlify-test-release]` commit, csak `leafy-chimera-2403e5`); ellenőrzés `gmail-readonly-targeted-20261024.yml` `verify_deployed:true` futással (deployedCommit = kiadási commit).
- **Eredmény:** TEST-kiadás PASS – deployedCommit `6702d1c8c198906f47500518bedd9016b117fddb` (run 41291815208 `DEPLOY SYNC PASS`; CI 41291505796 PASS). Kapcsolók: nem állítottuk (hozzáférés hiánya); Netlify-változó állapota NEM IGAZOLT, DB utolsó ismert értéke false (Work-visszaolvasás).
- **Következő konkrét lépés (TM-ACT-3):** Netlify-hozzáféréssel rendelkező végrehajtó (tulajdonos/Work) a TEST-oldalon beállítja `CASE_TEST_MAILBOX_INGEST_ENABLED=sarberki-test-fictional-only`, majd új TEST-build (`[netlify-test-release]` commit, Claude is elkészítheti) és deployedCommit-ellenőrzés; utána Supabase-hozzáféréssel `sc_test_mailbox_config.enabled=true`. Ezután TM-ACT-5 élő próba.

## TM-ACT-3.1 – Netlify-változó utáni TEST-build (2026-11-01)
- Tulajdonosi közlés: a `leafy-chimera-2403e5` TEST-oldalon a `CASE_TEST_MAILBOX_INGEST_ENABLED` változó elmentve (Netlify-lista: 5 érték, 5 deploy context). A pontos érték ebből a környezetből nem olvasható: **NEM IGAZOLT**.
- AGENTS.md beolvasva 09:24Z, blob `be27bd2dfb4795496bd9f3d64ad60ada1123de5b`; kiinduló HEAD `9a799c405b414e216441b7472f304738278c48a2`.
- Új TEST-build a meglévő kapuval, hogy a függvények megkapják a változót. A DB-kapcsoló (`sc_test_mailbox_config.enabled`) szándékosan változatlan (utolsó ismert: false), így a tesztlevél-műveletek továbbra is 403-at adnak.
