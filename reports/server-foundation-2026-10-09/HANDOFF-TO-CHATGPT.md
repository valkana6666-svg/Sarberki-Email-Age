SÁRBERKI – ÁTADÁSI CSOMAG CHATGPT-NEK
Dátum: 2026. október 9.

FELADAT ÉS SZABÁLYOK
Folytasd a meglévő központi szerveralapot; ne építs külön e-mail/chatbot/telefon foglalási motort. Repository: valkana6666-svg/Sarberki-Email-Age. Csak gmail-test-subject-allowlist módosítható. Main/production tiltott; valódi vendéglevélküldés, Previo-írás, automatikus ügyadat-migráció tilos. PREVIO_READ_SAFETY_VERIFIED maradjon kikapcsolva. Valódi vendégadatot ne vigyél új felhőbe tulajdonosi/adatvédelmi ellenőrzés előtt. Titok ne kerüljön repóba vagy chatbe; fizetős szolgáltatást ne rendelj.

COMMITOK ÉS TELJES KÓD
Kiinduló: 3768f54fe80913b72ad66a3a137a1a0cc449b42c
https://github.com/valkana6666-svg/Sarberki-Email-Age/commit/3768f54fe80913b72ad66a3a137a1a0cc449b42c
Végső implementáció: 4c66c83ce850ec0fdafa1ebce12182d65a04ae54
https://github.com/valkana6666-svg/Sarberki-Email-Age/commit/4c66c83ce850ec0fdafa1ebce12182d65a04ae54
Teljes aktuális forrás és lezáró dokumentáció:
https://github.com/valkana6666-svg/Sarberki-Email-Age/tree/gmail-test-subject-allowlist
A lezáró dokumentációs commitot a projektgazda Work-záróüzenete és a REPORT.md commit-története adja meg; ellenőrizd a legfrissebb távoli HEAD-et, ne írj felül közben érkező munkát.

TÉNYLEGES ÁLLAPOT
ELKÉSZÜLT ÉS TESZTELT: helyi PostgreSQL/PGlite SQL/RLS, atomi CAS, mailbox/message egyediség, minimális audit, remote Auth-ellenőrzést hívó repository, meglévő ügykezelő motor szerveres illesztése, verziózott belső tervezet, export-előnézet, automatizált tesztek.
ELKÉSZÜLT, DE NEM AKTÍV: Netlify ügy-API és aszinkron opt-in kliens, üres szerverkonfigurációs példa.
RÉSZBEN KÉSZ: operátori migráció csak helyi export/preview; nincs import/DB rollback. A UI továbbra is localStorage-t használ.
NEM KÉSZ: működő cloud DB/Auth, telepített és igazolt Supabase/Netlify E2E, login UI, valódi Gmail-hiteles import, szerveres igazolt ár/kapacitás és végleges jóváhagyás.
TULAJDONOSI LÉPÉSRE VÁR: Supabase login; Free/EU sarberki-ai-test projekt, DB-jelszó, tesztoperátorok, adatvédelmi/költségellenőrzés, teszthely env és felhős restore.
SUPABASE-PROJEKT NEM JÖTT LÉTRE. Böngészőben sign-in oldal volt. Nincs project ref/régió/DB, nincs felhős backup, nincs aktivált API.

ARCHITEKTÚRA
A shared-core/server-case-service.mjs repository.get/list/insert/compareAndSwap szerződését használjuk. Supabase publishable apikey + a kezelő bearer tokenje; /auth/v1/user ellenőrzés, majd sc_memberships alapján read/write/approve. Nem fogadunk el kliens role/userId/tenantId állítást jogosultságként. Service role nem használható. A definer SQL auth.uid és memberships alapján külön ellenőriz, mert megkerüli RLS-t.
DB: sc_tenants, sc_memberships, sc_cases, sc_message_keys, sc_audit. Tenant/case kulcs, tenant/mailbox/message egyediség; ügy JSON a meglévő séma. Üzenet/draft history append-only, audit SHA-256+aktor+revision egy tranzakcióban. Privilegizált admin ellen nem tamper-proof audit.
Runtime: createBookingCaseStore meglévő motor kérésenként betöltött snapshoton, majd egy atomi mentés. Message és thread ID mailbox szerint namespace-elt. Azonos feladó nem linkel automatikusan; régi levél történeti, nem fact overwrite; dátum/létszám a meglévő motor szerint invalidál.
API: /.netlify/functions/booking-cases; alapból 503. Csak CASE_STORE_ENABLED=synthetic-only, pontos teszthost és sarberki-test,demo-test allowlist mellett aktiválható. POST import vagy action=draft, GET list/get. Nincs raw case/evidence/approval/küldő végpont. Tervezet csak sarberki-test saját, trusted konfigurációval; demo-test nem kap Sárberki üzleti szabályokat. .invalid feladó kötelező, de a szabad szöveg szintetikusságát ember ellenőrizze.

FÁJLOK
- .gitignore: Környezeti titkok és adatbázismentések kizárása; az üres példa engedélyezése.
- .env.case-store.example: Titkos érték nélküli, kikapcsolt konfiguráció.
- AGENTS.md: Tartós biztonsági fejlesztési szabályok.
- docs/PLATFORM-STRATEGY.md: Megvalósítási tapasztalatok és modulhatárok.
- docs/SERVER-CASE-STORE-NEXT-STEPS.md: Aktuális szerveres állapot és következő lépések.
- package.json: Pontosan rögzített PGlite fejlesztői tesztfüggőség.
- package-lock.json: Reprodukálható npm-függőségek.
- shared-core/server-case-service.mjs: Hibás adapterválaszok szigorúbb kezelése; külön approve ellenőrzés.
- shared-core/supabase-case-repository.mjs: Supabase Auth ellenőrzés, tagságfeloldás, olvasás és atomikus SQL RPC.
- shared-core/server-booking-runtime.mjs: Meglévő ügykezelő motor aszinkron perzisztenciája, szintetikus import és belső tervezet.
- shared-core/case-store-client.mjs: Opt-in aszinkron kliens; a jelenlegi UI nem használja automatikusan.
- shared-core/case-migration-preview.mjs: Helyi export és validált előnézet, duplikációjelzés; feltöltés nélkül.
- netlify/functions/booking-cases.mjs: Alapértelmezetten tiltott API; Auth és szintetikus tenant gate.
- supabase/migrations/202610090001_case_store.sql: Tranzakciós, újrafuttatható séma, RLS, CAS, üzenetkulcsok és audit.
- tests/server-foundation.test.mjs: 21 szintetikus adapter-, motor-, API- és migrációs teszt.
- tests/supabase-policy.test.mjs: 4 helyi PostgreSQL/PGlite teszt, beleértve a restore-t és részleges integrációt.
- reports/server-foundation-2026-10-09/REPORT.md: teljes zárójelentés.
- reports/server-foundation-2026-10-09/HANDOFF-TO-CHATGPT.md: ez az önálló átadás.
- reports/server-foundation-2026-10-09/DEPLOYMENT-GUIDE.md: aktiválás, szolgáltatói források, backup/restore.
- reports/server-foundation-2026-10-09/SECURITY-CHECKLIST.md: igazolt és nyitott pontok.
- reports/server-foundation-2026-10-09/TEST-RESULTS.md: tesztek és környezethatárok.
Minden fájl: https://github.com/valkana6666-svg/Sarberki-Email-Age/tree/gmail-test-subject-allowlist

TESZTEK ÉS VISSZAÁLLÍTÁS
Kiinduló npm test 755/755 PASS. Célzott 35/35 PASS. Végső npm test 780/780 PASS. 25 új teszt, 0 hiba/skip. Négy új teszt helyi valódi PostgreSQL/PGlite SQL/policy végrehajtással; az Auth/HTTP fixture szimulált. A helyi fizikai DB-snapshot restore és RLS ellenőrzött. Kétkezelős konkurencia repository mockon; SQL CAS külön PostgreSQL-en. Valódi felhős E2E: 0. Élő Previo és vendéglevélküldés: 0.
Futtatás: npm ci; node --test tests/server-case-service.test.mjs tests/server-foundation.test.mjs tests/supabase-policy.test.mjs; npm test.
Baseline bundle verify és külön checkoutban SHA-egyezés megtörtént. Tartós restore a kiinduló GitHub commitból lehetséges; a helyi bundle átmeneti. Nincs felhős adatbázismentés.

KÖVETKEZŐ KONKRÉT MUNKA
1. Ellenőrizd távoli tesztági HEAD és working tree; olvasd AGENTS.md, PLATFORM-STRATEGY.md és a fenti öt jelentést.
2. Tulajdonosi Supabase-bejelentkezés után Free szervezetben sarberki-ai-test, konkrét Frankfurt eu-central-1 vagy más ellenőrzött EU régió. A credentialt kizárólag secure auth vagy tulajdonosi felületen kezeld.
3. SQL-migráció; tulajdonosi memberships bootstrap két tenant/tesztoperátorok. Ne nyisd meg a tagság szerkesztését kliensnek.
4. Valódi Auth/RLS/CAS, két session, backup és restore igazolása; utána teszt-Netlify szintetikus opt-in.
5. Csak sikeres felhős E2E után login UI és auditált migráció/rollback. Ne mozgasd át a régi ügyeket automatikusan.
6. Következő fejlesztés: hiteles Gmail mailbox/message származtatás és DB lookup/snapshot RPC; az aktuális szintetikus input még nem bizonyít Gmail-azonosságot. Kapacitás/ár csak verified forrásból, végleges jóváhagyás külön permission és audit. Rate limit/retention/security monitoring is nyitott.

BIZTONSÁG ÉS ÁTADÁS
Main ellenőrzött SHA: b99a48383773b760e8e959a0e3c3353dc3586547, nem módosítva. Productionhoz nem nyúltunk. Új élő Previo-kérés, vendégemail, Previo-írás és valósadat-migráció nem történt. A tesztági pushból esetleg induló Netlify build nem E2E-bizonyíték. A csomagot a projektgazda tudja átmásolni másik ChatGPT-beszélgetésbe; oda közvetlenül nem lett elküldve.
