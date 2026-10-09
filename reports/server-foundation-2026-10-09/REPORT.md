# SÁRBERKI – KÖZPONTI ÜGYTÁR FEJLESZTÉSI ZÁRÓJELENTÉS
Dátum: 2026. október 9.

**A biztonságos szerveralap elkészült és a GitHub tesztágra elmentve; működő felhős ügytár nem lett aktiválva.** A Supabase böngésző a bejelentkezési oldalig jutott. Nem jött létre projekt, nincs projektazonosító, kiosztott régió vagy telepített adatbázis. A munkát nem kezdtem újra: a meglévő motorhoz készültek adapterek.

## Commitok és visszaállítás

- [Kiinduló commit](https://github.com/valkana6666-svg/Sarberki-Email-Age/commit/3768f54fe80913b72ad66a3a137a1a0cc449b42c): `3768f54fe80913b72ad66a3a137a1a0cc449b42c`.
- [Végső implementációs commit](https://github.com/valkana6666-svg/Sarberki-Email-Age/commit/4c66c83ce850ec0fdafa1ebce12182d65a04ae54): `4c66c83ce850ec0fdafa1ebce12182d65a04ae54`.
- [Engedélyezett tesztág és teljes forrás](https://github.com/valkana6666-svg/Sarberki-Email-Age/tree/gmail-test-subject-allowlist).
- A lezáró dokumentációs commit SHA-ja a beszélgetésben és [e jelentés commit-történetében](https://github.com/valkana6666-svg/Sarberki-Email-Age/commits/gmail-test-subject-allowlist/reports/server-foundation-2026-10-09/REPORT.md) található. Saját commitazonosítót a commit tartalmába nem lehet önhivatkozóan beírni.
- Working tree kiinduláskor tiszta; push előtt a távoli tesztág továbbra is a kiinduló commiton állt. Nincs force push vagy párhuzamos módosítás felülírása.
- Helyi baseline Git-bundle ellenőrizve, külön checkoutból ugyanaz a SHA visszaállítva. A bundle átmeneti; tartós visszaállítási pont maga a GitHubon már meglévő kiinduló commit. Nem készült felhős adatbázismentés.

## Tényleges státusz

| Kategória | Eredmény |
|---|---|
| ELKÉSZÜLT ÉS TESZTELT | SQL/RLS/CAS helyi PostgreSQL-motoron; repository és Auth-feloldó szintetikus HTTP-val; meglévő motor szerveres illesztése; konkurencia, tenant-elszigetelés, mailbox-szintű egyediség, belső tervezet és export-előnézet. |
| ELKÉSZÜLT, DE NEM AKTÍV | Netlify ügy-API, Supabase konfigurációs minta és aszinkron böngészőkliens. |
| RÉSZBEN KÉSZ | LocalStorage-migráció: export/validáció/előnézet kész; végrehajtott import, migrációs audit és DB rollback még nincs. Központi tervezet kész a sarberki-test tenantnak, teljes UI-átvezetés nincs. |
| NEM KÉSZ | Publikált működő Supabase adatbázis; tényleges felhős Auth/RLS/E2E; kezelői login UI; automatikus, hiteles Gmail-forrásból dolgozó import; szerveres ellenőrzött ár/kapacitás-feltöltés és végleges jóváhagyási művelet. |
| TULAJDONOSI LÉPÉSRE VÁR | Supabase-bejelentkezés, tulajdonosi Free/EU projekt, esetleges új fiók/2FA/CAPTCHA; adatvédelmi és költségellenőrzés, tesztoperátorok; Netlify teszthely konfiguráció. |

## Adatmodell és biztonság

`sc_tenants`, `sc_memberships`, `sc_cases`, `sc_message_keys`, `sc_audit`: öt tábla. Az ismert/hiányzó tények, ügyüzenetek, dátumellenőrzések és tervezetverziók a meglévő ügy JSON-sémájában maradnak; az üzenetkulcs-tábla csak minimális azonosítókat tárol. Nincs második foglalási motor és nincs személyes adatot tartalmazó teljes auditmásolat.

Tenant+case összetett elsődleges kulcs, tenant+mailbox+message egyediség, atomi insert/CAS. Az audit írás ugyanabban a tranzakcióban történik. Üzenet- és tervezettörténet a normál íráskor csak hozzáfűzhető, sorrendjét is ellenőrzi az SQL. SHA-256 ellenőrzőösszeg, aktor és verzió kerül az auditba. Ez nem függetlenül aláírt, privilegizált tulajdonos ellen is védett archívum.

Auth: minden művelet előtt a Supabase `/auth/v1/user` ellenőrzi a bearer tokent, majd DB-tagság alapján születik jogosultság. A kliens szerepköre/azonosítóállítása nem authority. `read`, `write`, `approve` külön képesség; kézi ügyösszekapcsolás approve jogot igényel. A végleges vendégajánlat jóváhagyási útvonala még tiltott. Nincs service role használat. A security-definer SQL külön `auth.uid()`/tagság ellenőrzést végez, mert nem támaszkodhat RLS-re.

Az API csak az ismert teszthost, pontos tenant-allowlist és `synthetic-only` kapcsoló együttesével aktiválható. Csak `.invalid` feladó és szigorúan megadott mezők fogadhatók. Ez technikai védőkorlát, nem a szabad szöveg személyesadat-mentességének bizonyítása; a kezelő kizárólag kitalált szöveget adhat meg. Nyers ár/kapacitás-bizonyíték és állított jóváhagyás nem írható ezen az SQL-útvonalon. Olvasó nem írhat, anonymous nem férhet hozzá, idegen tenant tiltott.

Gmail-azonosítókat jelenleg szintetikus minták adják. Valódi Gmail-import előtt az üzenet- és mailbox-azonosságot a hiteles Gmail-integrációból kell szerveroldalon származtatni. Azonos feladó nem okoz automatikus összekapcsolást. Két, egyidejű új érdeklődés több ügyet eredményezhet; bizonytalan összekapcsolást operátor ellenőriz. CAS-konfliktus után újraolvasás és előnézett újrapróbálás kell, vak újraírás nem.

## Teszteredmények és igazolás

- Kiinduló teljes `npm test`: **755/755 PASS**, 0 hiba, 0 kihagyás.
- Célzott 3 tesztfájl: **35/35 PASS** (10 korábbi szolgáltatás + 21 új motor/API + 4 új PostgreSQL teszt).
- Végső teljes `npm test`: **780/780 PASS**, 0 hiba, 0 kihagyás.
- **25 új teszt**. Valódi helyi PostgreSQL SQL/policy végrehajtás PGlite alatt, két tenant és külön operátoridentitások; kétszeri migrációfuttatás; jogosultsági tiltások; SQL tranzakciós rollback; mentés és visszatöltés.
- Netlify handler → authority → motor → repository → PostgreSQL teszt kész; a HTTP és az Auth identitásválasz szimulált. Ez nem telepített Netlify/Supabase end-to-end teszt.
- A kétkezelős versenyhelyzet alkalmazási repository-szimuláción igazolt; SQL-CAS helyi PostgreSQL-en. Két valódi felhős munkamenet konkurenciája még nincs kipróbálva.
- Teljes felhős E2E próbák: **0**. Élő Previo-lekérdezések: **0**. Valódi vendéglevélküldés: **0**.

## Fájlok és szerepük

| Fájl | Szerep |
|---|---|
| [.gitignore](https://github.com/valkana6666-svg/Sarberki-Email-Age/blob/gmail-test-subject-allowlist/.gitignore) | Környezeti titkok és adatbázismentések kizárása; az üres példa engedélyezése. |
| [.env.case-store.example](https://github.com/valkana6666-svg/Sarberki-Email-Age/blob/gmail-test-subject-allowlist/.env.case-store.example) | Titkos érték nélküli, kikapcsolt konfiguráció. |
| [AGENTS.md](https://github.com/valkana6666-svg/Sarberki-Email-Age/blob/gmail-test-subject-allowlist/AGENTS.md) | Tartós biztonsági fejlesztési szabályok. |
| [docs/PLATFORM-STRATEGY.md](https://github.com/valkana6666-svg/Sarberki-Email-Age/blob/gmail-test-subject-allowlist/docs/PLATFORM-STRATEGY.md) | Megvalósítási tapasztalatok és modulhatárok. |
| [docs/SERVER-CASE-STORE-NEXT-STEPS.md](https://github.com/valkana6666-svg/Sarberki-Email-Age/blob/gmail-test-subject-allowlist/docs/SERVER-CASE-STORE-NEXT-STEPS.md) | Aktuális szerveres állapot és következő lépések. |
| [package.json](https://github.com/valkana6666-svg/Sarberki-Email-Age/blob/gmail-test-subject-allowlist/package.json) | Pontosan rögzített PGlite fejlesztői tesztfüggőség. |
| [package-lock.json](https://github.com/valkana6666-svg/Sarberki-Email-Age/blob/gmail-test-subject-allowlist/package-lock.json) | Reprodukálható npm-függőségek. |
| [shared-core/server-case-service.mjs](https://github.com/valkana6666-svg/Sarberki-Email-Age/blob/gmail-test-subject-allowlist/shared-core/server-case-service.mjs) | Hibás adapterválaszok szigorúbb kezelése; külön approve ellenőrzés. |
| [shared-core/supabase-case-repository.mjs](https://github.com/valkana6666-svg/Sarberki-Email-Age/blob/gmail-test-subject-allowlist/shared-core/supabase-case-repository.mjs) | Supabase Auth ellenőrzés, tagságfeloldás, olvasás és atomikus SQL RPC. |
| [shared-core/server-booking-runtime.mjs](https://github.com/valkana6666-svg/Sarberki-Email-Age/blob/gmail-test-subject-allowlist/shared-core/server-booking-runtime.mjs) | Meglévő ügykezelő motor aszinkron perzisztenciája, szintetikus import és belső tervezet. |
| [shared-core/case-store-client.mjs](https://github.com/valkana6666-svg/Sarberki-Email-Age/blob/gmail-test-subject-allowlist/shared-core/case-store-client.mjs) | Opt-in aszinkron kliens; a jelenlegi UI nem használja automatikusan. |
| [shared-core/case-migration-preview.mjs](https://github.com/valkana6666-svg/Sarberki-Email-Age/blob/gmail-test-subject-allowlist/shared-core/case-migration-preview.mjs) | Helyi export és validált előnézet, duplikációjelzés; feltöltés nélkül. |
| [netlify/functions/booking-cases.mjs](https://github.com/valkana6666-svg/Sarberki-Email-Age/blob/gmail-test-subject-allowlist/netlify/functions/booking-cases.mjs) | Alapértelmezetten tiltott API; Auth és szintetikus tenant gate. |
| [supabase/migrations/202610090001_case_store.sql](https://github.com/valkana6666-svg/Sarberki-Email-Age/blob/gmail-test-subject-allowlist/supabase/migrations/202610090001_case_store.sql) | Tranzakciós, újrafuttatható séma, RLS, CAS, üzenetkulcsok és audit. |
| [tests/server-foundation.test.mjs](https://github.com/valkana6666-svg/Sarberki-Email-Age/blob/gmail-test-subject-allowlist/tests/server-foundation.test.mjs) | 21 szintetikus adapter-, motor-, API- és migrációs teszt. |
| [tests/supabase-policy.test.mjs](https://github.com/valkana6666-svg/Sarberki-Email-Age/blob/gmail-test-subject-allowlist/tests/supabase-policy.test.mjs) | 4 helyi PostgreSQL/PGlite teszt, beleértve a restore-t és részleges integrációt. |

További öt új dokumentum: `REPORT.md`, `HANDOFF-TO-CHATGPT.md`, `DEPLOYMENT-GUIDE.md`, `SECURITY-CHECKLIST.md`, `TEST-RESULTS.md` ebben a jelentésmappában. Összesen 21 új/módosított fájl.

## Üzemeltetési korlát és következő feladat

Main nem módosult: ellenőrzött SHA `b99a48383773b760e8e959a0e3c3353dc3586547`. Production infrastruktúrához nem nyúltam. A tesztági GitHub-push kiválthat szokásos teszt-Netlify buildet, de ez nem igazolja az új funkció telepítését vagy aktiválását. Nem történt vendégadat-migráció, valódi e-mailküldés, Previo-írás vagy új élő Previo-lekérdezés; a `PREVIO_READ_SAFETY_VERIFIED` beállítás érintetlen.

Következő feladat: tulajdonosi Supabase-bejelentkezés után Free szervezetben külön EU tesztprojekt, migráció és legalább két tesztoperátor; felhős RLS és visszaállítás ellenőrzése, majd teszthelyre korlátozott szintetikus API-próba. Csak ezt követően készüljön login UI és az operátori migráció/rollback; valódi adatokhoz külön adatvédelmi ellenőrzés szükséges. Lásd a telepítési útmutatót.
