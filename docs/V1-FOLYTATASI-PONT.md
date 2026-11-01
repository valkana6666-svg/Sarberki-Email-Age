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
- **Eredmény:** TEST-build PASS – run 41293340101 `DEPLOY SYNC PASS`, deployedCommit `7e9a4fa133530a043ecddc8de0dbc38c0065e356`; CI 41293054158 PASS. Netlify-változó pontos értéke és hatása: NEM IGAZOLT (nincs olvasási út; a health nem jelzi). DB-kapcsoló nem változott. Teljes aktiválás: NEM IGAZOLT.
- **Következő lépés:** hitelesített Writer-kezelővel a napi kezelőben egy jelölt tesztlevél „Ügyként mentés”: a várt válasz most „Ehhez a mentéshez nincs jogosultság, vagy a funkció nincs bekapcsolva” (DB-kapcsoló false). Ez a tiltás működését igazolja, de a Netlify-érték helyességét még nem. Utána tulajdonosi döntéssel `sc_test_mailbox_config.enabled=true`, majd ugyanaz a próba → sikeres mentés igazolja mindkét kapcsolót.

## Élő próba – állapot (2026-11-01, Claude Code)
- AGENTS.md beolvasva 10:11Z (blob `be27bd2…`), HEAD `f870250`, nincs új párhuzamos commit.
- Tulajdonosi közlés (nem Claude-visszaolvasás): Netlify-változó Production-értéke iPhone-on ellenőrizve; `sc_test_mailbox_config.enabled=true` beállítva és visszaellenőrizve. Telepített commit: `7e9a4fa` (run 41293340101).
- Claude ebből a környezetből nem éri el a tesztoldalt, a Gmailt és a Supabase-t (proxy 403), és a GitHub Actionsben sincs kezelői belépés vagy Gmail-token → az élő 5.1–5.12 lépések **NEM IGAZOLT**, mock/CI nem helyettesíti.
- Átvehető forgatókönyv: `docs/V1-TEST-MAILBOX-LIVE-RUN-SCRIPT.md` (L1–L16, elvárt szövegek a telepített kódból). Végrehajtó: tulajdonos iPhone-on (W és A fiók), L15 Work csak-olvasó SQL. Eredmények beírása után Claude kiértékeli és csak bizonyított hiba esetén javít.

## OAuth-hiba az „Ügyként mentés”-nél (iPhone, 2026-11-01)
- Tünet (tulajdonosi élő próba): 38 levél beolvasva, AI-javaslat megjelent; „Ügyként mentés” → nem látszott Google-ablak, üzenet: „A Google-engedély nem érkezett meg; a levél nem lett mentve.”
- Gyökérok (kódból azonosítva, teszttel reprodukálva): iPhone Safariban a Google-tokenkérés külön lapot nyit, ezért a napi oldal rejtett lesz; meglévő engedélynél a lap azonnal bezárul, így ablak alig látszik. A token a rejtett oldalra érkezik; a mentés visszahívása ilyenkor elvetette (`active()` hamis a rejtett oldal miatt). A beolvasás ugyanerre a helyzetre már sorba állította a választ (queuedConsent) – a mentésből ez hiányzott.
- Minimális javítás (`napi-kezelo/napi-email.mjs`): rejtett oldalon érkező mentési tokent csak memóriában tartja, és a napi nézet szerveres munkamenet-ellenőrzése utáni visszatéréskor (reveal) használja fel; kijelentkezés/clear eldobja. A hibaüzenet megkülönbözteti a hiányzó tokent (Google hibakóddal) és a közben megváltozott kiválasztást. OAuth-rendszer, AI-mag, szerver és üzleti szabály változatlan.
- Bizonyíték: új teszt reprodukálta a pontos üzenetet a javítás előtt, utána PASS (rejtett → visszatérés → mentés; kijelentkezés → nincs mentés; hibakód). `npm test` 2491/2491; Chromium napi próba 22/22. Élő iPhone: NEM IGAZOLT.


## Gmail → közös AI → ügy → független jóváhagyás – élő bizonyíték visszaolvasása (2026-11-01 11:55Z körül)

Ez a kiegészítés felülírja a fenti általános „élő lánc NEM IGAZOLT” állapotot az alább pontosított, sikeresen lefutott körre. Nem jelenti az összes negatív/életciklus-próba teljesítését.

### Kiindulás és döntés
- A munkamenet első érdemi művelete az aktuális tesztági AGENTS.md teljes lekérése volt (2026-11-01 11:51–11:52Z közötti intervallum; külön másodperc pontosságú olvasási időbélyeg nem került rögzítésre), blob: `be27bd2dfb4795496bd9f3d64ad60ada1123de5b`.
- Kiinduló és írás előtt ellenőrzött HEAD: `acd78cb00b79643365f1a373c391a05e40ed6175`, kizárólag `gmail-test-subject-allowlist`.
- Tulajdonosi bizonyíték: fizikai iPhone Tesztügy 7 Writer → mentés → független Approver → jóváhagyás → visszaolvasás sikeres, 2026-11-01 11:47:01 UTC.
- Meglévő használható út: saját alkalmazási Gmail-olvasás, közös inquiry-channel-adapters / server-test-mailbox-case, WP3 RPC, napi kezelő, külön Writer/Approver. A szerverkód a Gmail-forrást maga olvassa és a meglévő közös maggal készít tervezetet.
- Választás: a már lefutott kör Gmail-forrásának, adatbázis-rekordjának és auditjának közvetlen csak-olvasó összevetése. Új ügy vagy azonos próba ismétlése szükségtelen; új motor, OAuth-rendszer vagy kódjavítás nem indokolt bizonyított hiba nélkül.

### Közvetlenül visszaolvasott eredmények
| Ellenőrzés | Eredmény / bizonyíték |
|---|---|
| Gmail tesztpostafiók csatlakoztatott olvasása | PASS: profil sarberkiprojecttest@gmail.com; a jelölt levél kereshető és teljes MIME-tartalma olvasható. Ez a connector olvasását bizonyítja; az alkalmazás saját OAuth-láncának bizonyítéka a következő forráskötött ügy. |
| Valódi Gmail-forrás → tárolt ügy | PASS: a „Sárberki élő teszt – AI előnézet” levél message-id `1a1917b5a80512ca`, ügy `tm-1a1917b5a80512ca`; a Gmail-törzs, thread/RFC Message-ID és tárolt sourceReceipt/messages megegyezik; mailbox_id=sarberki_gmail_test. A forrás kitalált tesztlevél. |
| Közös mag válaszjavaslata és mentése | PASS az ellenőrzött láncra: tárolt eredeti tervezet, tények (2026-11-13 → 2026-11-15, 4 felnőtt, 0 gyermek), manual_review_required; a szerver meglévő buildEmailInquiryDraft útja visszaolvasva. Kapacitás/ár nincs igazoltnak feltüntetve. |
| Független jóváhagyás | PASS: tm_create 10:57:01.292932Z → tm_redraft 11:01:06.302813Z → tm_return 11:05:53.560881Z → tm_redraft 11:38:38.821224Z → tm_approve 11:47:01.218595Z; revízió 1–5. A létrehozó nem rendelkezik can_approve joggal; a döntő személy különböző, és rendelkezik vele. Személyazonosítókat nem publikálunk. |
| Hash és revízió | PASS: az utolsó tervezet szövegének SHA-256-ja egyezik az internalApproval.draftHash értékkel; reviewedRevision=4, ügy revision=5. A teljes tárolt JSON SHA-256-ja egyezik az audit data_hash értékével. A két hash eltérő dolgot jelöl; közvetlen összehasonlításuk nem érvényes hibateszt. |
| Belső jóváhagyási korlát | PASS: scope=test-mailbox-v1, sendAllowed=false, bookingAllowed=false, priceVerified=false, capacityVerified=false. Belső jóváhagyás, nem foglalás/vendégküldés. |
| TEST kapcsoló | PASS: közvetlen SQL 11:52:47Z és 11:53:53Z enabled=true. Netlify env pontos értéke itt nem olvasva; az adott ügy sikeres létrehozása/döntése az akkori kapu működésének bizonyítéka. |
| Telepített verzió | PASS: közvetlen böngészős /api/health deployedCommit=`acd78cb00b79643365f1a373c391a05e40ed6175`; autoSend=false, autoBookingModification=false. A napi kezelő látható verziója is egyezik. |
| Mai elküldött levél | PASS az ellenőrzött tesztpostafiókra: Gmail `in:sent after:2026/11/01` keresés 0 találat. A tegnapi tesztlevél és Re: a korábbi teszt része; nem mai küldés. |
| CI | PASS: [41297590496](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/41297590496), naplóból 2491 PASS / 0 FAIL / 0 SKIP. Külön célzott csomag 26 PASS, nem összeadandó. |
| Meglévő célzott/mobil futás | PASS: [41297892491](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/41297892491) targeted és [41297894500](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/41297894500) dispatch mobil success, ugyanazon SHA. Új futást nem indítottunk. |

### Hátralévő, pontosan körülhatárolt elfogadási hiány
- Duplikált mentés elutasításának élő bizonyítéka NEM IGAZOLT. A forráshoz pontosan 1 ügy van, de ez önmagában nem bizonyít ismételt mentési kísérletet.
- „Re:” gombtiltás élő bizonyítéka NEM IGAZOLT. Re: tesztlevél létezik, a letiltást ebben a munkamenetben nem próbáltuk.
- Elutasítás → új tervezet → újranyitás élő bizonyítéka NEM IGAZOLT: ezen az ügyön tm_reject esemény 0. Visszaküldés és jóváhagyás igazolt.
- Fizikai iPhone fő kör PASS tulajdonosi közlés alapján; az adatbázis az eszközt nem bizonyítja. Alkalmazásváltás utáni munkamenet-visszatérés külön NEM IGAZOLT.
- A jelen felhőböngésző napi kezelője kijelentkezett (beolvasás/mentés tiltva). Az iPhone munkamenete nem ugyanaz. Nem kértünk új belépést a már lezárt kör ismétléséhez.
- Previo-változatlanság közvetlen élő összevetése NEM IGAZOLT; Previo-kérést nem indítottunk. A kikapcsolt bookingAllowed/autoBookingModification nem helyettesíti ezt.

### Változtatás és következő konkrét lépés
- Kizárólag ez a meglévő folytatási dokumentum frissült. Nincs kódmódosítás, telepítés, migráció, kapcsolóváltás, e-mail-küldés, ügyírás vagy új automatizálás.
- A fő Gmail → AI → mentés → független jóváhagyás kör újrafuttatása nem szükséges.
- Következő feladat: meglévő forgatókönyv L4/L5/L11–L12/L14 hiányzó élő bizonyítékainak összegyűjtése (korábbi képernyőkép/napló elfogadható, ha ténylegesen igazol), majd csak a valóban hiányzó célzott próbák. Az approved ügyet indokolatlanul ne módosítsuk; az elutasítási körhöz külön jogosult tesztügy szükséges. A teljes V1 100% továbbra sem állítható ezen hiányok lezárása nélkül.


## Élő Gmail-audit folytatás és létszám-megjelenítési javítás – 2026-11-01

### Kiindulás és döntési napló
- Teljes aktuális AGENTS.md lekérve 2026-11-01T12:05:42.766Z (13:05:42 CET), blob `be27bd2dfb4795496bd9f3d64ad60ada1123de5b`; kiinduló/írás előtt ellenőrzött HEAD `a4eb189bae5f4b087d68c4436d7fbb10fde5a75a`.
- Meglévő működő elemek: a korábbi fő Gmail → közös AI → ügymentés → Writer → visszaküldés → javított tervezet → független Approver jóváhagyás kör. A fizikai iPhone eredményeket a tulajdonos képernyőképekkel igazoltnak adta át; ezeket elfogadjuk, nem nyitjuk újra.
- Döntés: csak az új létszám-eltérés reprodukálása és javítása, valamint a szerveres kötés/audit visszaolvasása. A központi adatértelmezés átírása indokolatlan, mert a 4 felnőtt már helyesen ki van nyerve és tárolva. A kijelzési fallback a legkisebb beavatkozás; nem változtat tényeken, kapacitáson, áron vagy jogosultságon.

### Szerveroldali tények (csak-olvasó SQL)
- Ügy: `tm-1a1917b5a80512ca`, revision=5; forrás és registry message_id azonos, az adott forráshoz 1 ügy létezik.
- facts.adults={value:"4",status:"known"}, facts.children={value:"0",status:"known"}; state.values.adults="4", children="0". A külön facts.guests mező hiányzó; ez nem azonos az adults adat elvesztésével.
- A tárolt első üzenet szövege egyezik a state.original szöveggel. Az első, manual_review_required tervezetben szerepel „4 fő (4 felnőtt)”. Gmail-forrás teljes MIME-egyezése az előző auditban már igazolt; nem olvastuk újra indokolatlanul.
- Audit teljes sora: tm_create (revision 1, 10:57:01Z), tm_redraft (2, 11:01:06Z), tm_return (3, 11:05:53Z), tm_redraft (4, 11:38:38Z), tm_approve (5, 11:47:01.218595Z). A létrehozó és tervezetíró nem approve-jogú; a döntő más személy, can_approve=true.
- Jóváhagyási szöveghash egyezik az utolsó tervezet SHA-256-jával; a teljes aktuális ügy JSON-hash-e egyezik a revision 5 audit-hashével. internalApproval scope=test-mailbox-v1, reviewedRevision=4; sendAllowed=false, bookingAllowed=false, priceVerified=false, capacityVerified=false.
- RLS közvetlenül visszaolvasva aktív: sc_cases, sc_test_mailbox_cases, sc_test_mailbox_config.
- Duplikációvédelem szerveroldalon PASS: élő katalógusból `UNIQUE (tenant_id, mailbox_id, message_id)`; egy meglévő forráshoz 1 ügy. A meglévő tests/test-mailbox-sql-pglite.test.mjs külön ellenőrzi a duplicate message → 23505, jogosulatlan létrehozás → 42501, saját jóváhagyás, hibás hash, stale revision, idegen tenant és ismételt döntés tiltását. Meglévő releváns CI: [41297590496](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/41297590496), 2491 PASS, nem futott újra.
- Korlát: a UNIQUE és a korábbi motoros teszt nem élő kezelői duplikált kattintás bizonyítéka; az továbbra is külön jelölendő.

### Bizonyított kijelzési hiba és minimális javítás
- FAIL a kiinduló felületi kódon: mindkét ügyadatlap a `values.guests || 'Nincs megadva'` mezőt használta, ezért az adults=4, children=0, guests hiányzó esetben a „Létszám: Nincs megadva” szöveget írta.
- Reprodukció: meglévő tests/napi-kezelo.test.mjs test-mailbox kezelőtesztjében a valós adatstruktúrával; a javítás előtt az elvárt „Létszám: 4 felnőtt, 0 gyermek” ellenőrzés FAIL.
- Javítás: napi-kezelo/napi.mjs kizárólag megjelenítési helper. Meglévő összesített létszám megtartva; annak hiányában csak érvényes, ismert nemnegatív egész adults/children mezők jelennek meg („4 felnőtt, 0 gyermek”). Egyik hiányából sem következtetünk másikra vagy teljes létszámra. Mindkét napi ügyadatlap ugyanazt használja.
- Bővített regresszió: a valós alak mellett meglévő guests-elsőbbség, csak felnőtt, csak gyermek, üres/ismeretlen, negatív, tört és boolean értékek megjelenítése; a meglévő teljes Writer/Approver felületi életciklus megmaradt.
- Célzott lokális csomag: `node --test tests/napi-kezelo.test.mjs` **11 PASS / 0 FAIL / 0 SKIP**. `node --check napi-kezelo/napi.mjs` PASS. Ez fake-DOM/integrációs bizonyíték, nem új fizikai iPhone-próba. A helyi függőségek letöltésének kezdeti hiányát pótoltuk; az nem termékhiba.
- Módosított fájlok: napi-kezelo/napi.mjs; tests/napi-kezelo.test.mjs; jelen dokumentum.
- Nincs központi AI-/üzletiszabály-/SQL-/jogosultságmódosítás, ügyírás, migráció, kapcsolóváltás, Netlify-telepítés, e-mail vagy Previo-művelet. A javítás commitja nem release commit.

### Átadás, állapot és következő lépés
| Azonosító | Felelős | Állapot | Következő lépés |
|---|---|---|---|
| LIVE-GMAIL-MAIN | Tulajdonos iPhone / Work szerveres audit | PASS az igazolt fő körre | Ne futtassuk újra |
| UI-GUEST-COUNT | Codex célzott javítás / Claude vagy Work ellenőrzés | Forrásjavítás és célzott teszt PASS; telepített javítás NEM IGAZOLT | Commit CI visszaolvasása; szükséges külön kiadási engedéllyel TEST-telepítés, majd egy adatlap ellenőrzése |
| LIVE-DUPLICATE | Tulajdonos/Work hitelesített Writer | DB UNIQUE és korábbi motoros teszt PASS; élő kattintás NEM IGAZOLT | Csak hiányzó célzott próba/korábbi bizonyíték |
| LIVE-RE-REJECT-SWITCH | Tulajdonos/Work | korábbi fő iPhone kör PASS; Re:-tiltás, elutasítás/újranyitás, alkalmazásváltás külön NEM IGAZOLT | Meglévő L5/L11–12/L14 bizonyítékok vagy célzott próba |

A jelenlegi felhőböngészőben korábban kijelentkezett kezelő látszott; a jelen körben nem próbáltunk hiányzó jogosultságot SQL-írással, service-role-lal vagy más felhasználó megszemélyesítésével pótolni. A lezárt jóváhagyott ügy változatlan. Nincs Claude-nak párhuzamosan átadott kódfeladat; a célzott javítást Codex elvégezte. V2/V3 érték: ugyanaz a megjelenítés mindkét meglévő ügyúton; új AI-motor vagy adatmodell nincs.


### A létszámjavítás commit és CI-visszaolvasása
- Javítás teljes SHA: `155b7346efe5d289e1b7e0db7e94d8d5247ec2c4`; a tesztági ref és a három módosított fájl közvetlenül visszaolvasva.
- [Sarberki test branch checks 41305139670](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/41305139670): success, a javítás SHA-jára; [Capacity regression 41305139686](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/41305139686): success.
- A push-eseményű mobil workflow szándékosan skipped; új fizikai/mobil élő bizonyítéknak nem számít.
- A javítás továbbra sincs külön TEST-kiadásként telepítve; a következő lépés az erre szóló engedéllyel kiadás, majd az ügyadatlap egyszeri célzott ellenőrzése.


## Engedélyezett TEST-kiadás – 2026-11-01 (15:16 CET után)
- Eredmény: **TELEPÍTÉS PASS**. A tulajdonos külön engedélyezte a jóváhagyott létszámjavítás kiadási jelölésű commitját, új SHA-val, a meglévő GitHub → Netlify útvonalon.
- Aktuális AGENTS.md teljes beolvasása 2026-11-01T14:16:11.868Z (15:16:11 CET); blob `be27bd2dfb4795496bd9f3d64ad60ada1123de5b`.
- Kiinduló HEAD `06d983c5b9e41b325b2fbccfd3998d1d1172d8e7`; engedélyezett javítás `155b7346efe5d289e1b7e0db7e94d8d5247ec2c4`.
- GitHub compare alapján a javítás és a HEAD között csak docs/V1-FOLYTATASI-PONT.md változott. Az alkalmazáskód változatlan; kiadási commit `b197a91293fbd544ead156321f0a81dd87f3a5cc`, ugyanaz a gitfa mint a kiadás előtti HEAD, csak commit-metaadat változott.
- Választás indoka: meglévő scripts/netlify-test-build-gate.cjs [netlify-test-release] kapu, kizárólag gmail-test-subject-allowlist és leafy-chimera-2403e5. A restore-oldal kapuja változatlanul tiltott. Netlify admin-belépésre nem volt szükség; biztonsági kaput nem kerültünk meg.
- Korábbi működő kiadás: `acd78cb00b79643365f1a373c391a05e40ed6175`; kiadás után közvetlen böngészős GET /api/health deployedCommit=`b197a91293fbd544ead156321f0a81dd87f3a5cc`, ok=true, channel=gmail-test-subject-allowlist, autoSend=false, autoBookingModification=false. A napi kezelő látható lábléce is b197a91293fb és „a telepített verzió egyezik”.
- CI forrásbizonyíték: [41305139670](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/41305139670), 2491 PASS/0 FAIL/0 SKIP a javításra; [41305139686](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/41305139686) success. A dokumentációs HEAD CI [41305322167](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/41305322167) success. Az üres release commitra a lekérdezéskor nem látszott új Actions-futás; ezt nem nevezzük új release-CI PASS-nak. A működő Netlify-verziót közvetlenül igazoltuk.
- Előtte/utána readonly SQL: ügy revision=5; teljes JSON SHA-256 mindkétszer `f4a9791e1a9b6bca18d6025e1360237f778c5a4fcf48660b6f4b5fc0dcd76005`; approved_at=2026-11-01T11:47:01.218595Z; 5 auditesemény; Writer approve-jog nélkül, döntő külön személy Approver-joggal. sendAllowed=false, bookingAllowed=false. **Meglévő jóváhagyás és vizsgált szerepkötés sértetlen: PASS.**
- Létszámjelzés: a telepített kód az előzőleg 11/11 célzott napi teszttel igazolt „4 felnőtt, 0 gyermek” javítás. Az ügyben adults="4", children="0" változatlan. **Automatizált kijelzési teszt PASS; a telepített, hitelesített ügyadatlap vizuális kijelzése NEM IGAZOLT**, mert a felhőböngésző napi kezelője bejelentkezést kér. Az előző iPhone-főfolyamat PASS megmarad, nem futott újra.
- A nyers napi .mjs fájl közvetlen böngészős megnyitását ERR_BLOCKED_BY_CLIENT megakadályozta; ezt nem nevezzük Netlify- vagy alkalmazáshibának. A működő health és a napi UI verziója igazolt.
- Változtatás: egy üres, engedélyezett kiadási commit és jelen jelentés. Nincs további kód-, adatbázis-, RLS-, kapcsoló-, main-, production- vagy Previo-módosítás; nincs levélküldés/foglalás. Rollback nem volt szükséges.
- Következő konkrét feladat: a meglévő bejelentkezett iPhone napi kezelő frissítése után Tesztügy 7 megnyitása és a „Létszám: 4 felnőtt, 0 gyermek” sor egyszeri vizuális igazolása. Új ügyet, tervezetet vagy jóváhagyást ehhez nem kell létrehozni.


## Fizikai iPhone – létszámjavítás elfogadva (2026-11-01 16:00–16:01 CET)
- A tulajdonos négy új iPhone-képernyőképet adott át (IMG_0490.jpeg–IMG_0493.jpeg), vizuálisan ellenőrizve. Titkos vagy személyes adatot és képfájlt nem töltöttünk fel GitHubra.
- **UI-GUEST-COUNT: PASS, fizikai iPhone-on is.** Az Ügyadatok részben egyértelműen olvasható: „Létszám: 4 felnőtt, 0 gyermek”; érkezés 2026-11-13, távozás 2026-11-15. A korábbi „telepített ügyadatlap kijelzése NEM IGAZOLT” állapotot ez lezárja.
- Kiadási verzió ugyanazon átadott képcsomagban: „Tesztverzió: b197a91293fb · a telepített verzió egyezik.” Teljes, korábban közvetlen health-ellenőrzéssel igazolt kiadás: `b197a91293fbd544ead156321f0a81dd87f3a5cc`; forrásjavítás: `155b7346efe5d289e1b7e0db7e94d8d5247ec2c4`.
- A képeken a Tesztügy 7 listabejegyzés, az eredeti, 4 felnőttet kérő Gmail-szöveg, a tárolt választervezet és a korábbi döntések láthatók. Státusz: „Belső jóváhagyás mentve (test-mailbox-v1). Nincs levélküldés vagy foglalás.” Visszaküldés 11:05:53.560881Z; jóváhagyás 11:47:01.218595Z. Ez a korábbi szerveres revision/hash-visszaolvasással együtt a javítás utáni megjelenítés bizonyítéka.
- A jóváhagyás/mentés körét nem ismételtük meg, adatbázist nem módosítottunk. Az inaktívnak látszó döntési gombok az elfogadott ügy képén önmagukban nem új jogosultsági negatív tesztek.
- „Háztípus: Nincs megadva”: az eredeti levél négyszemélyes házat kér, konkrét háztípust nem nevez meg; ez nem bizonyít háztípus-kivonatolási hibát.
- „Magyar ellenőrző összefoglaló még nincs” látható a módosított tervezetnél; ez külön megfigyelés, nem a most lezárt létszámhiba. Hiányzó összefoglaló viselkedését szükség esetén a meglévő redraft szerződéssel kell összevetni, automatikus újrafejlesztés nélkül.
- Friss szabályzat-ellenőrzés: teljes tesztági AGENTS.md lekérve 2026-11-01T15:01:44Z (16:01:44 CET), blob `be27bd2dfb4795496bd9f3d64ad60ada1123de5b`, változatlan; induló HEAD `2a9bf2548a0b7bc9f93fc3774979de6ccce58d1a`.
- Következő konkrét feladat: csak a még hiányzó élő negatív/lifecycle bizonyítékok (duplikált mentés elutasítása, Re: tiltás, külön tesztügyön elutasítás → újranyitás, alkalmazásváltás). A fő Gmail-lánc és a létszámjavítás lezárt; ezeket ne futtassuk újra. A teljes V1 100%-át ez az egy kijelzési elfogadás nem jelenti.
