# Sárberki V1 – aktuális állapot (legfeljebb 40 sor; minden feladat a saját commitjában frissíti)

Utolsó frissítés: 2026-11-03 CET. Szerepek: AGENTS.md „FÓKUSZ ÉS HATÉKONYSÁG”. Részletes előzmény (archív): `docs/V1-FOLYTATASI-PONT.md`, `docs/V1-AUTOMATION-STATUS-2026-11-01.md`.

## Kész, igazolt – ne ismételd
| Terület | Bizonyíték |
|---|---|
| Gmail → közös AI → mentés → független jóváhagyás (iPhone, élő) | `a4eb189` |
| Létszámkijelzés, duplikált mentés tiltása, Re: tiltás, alkalmazásváltás (iPhone) | `312b9ad`, `c0f8f4d`, `71c84c9`, `3b63e50` |
| Elutasítás → új tervezet → újranyitás (L11–L12), élő | `0f7cb51`; audit-SQL `d1bb91a` |
| Jogosultság, függetlenség, CSRF, tenant, kijelentkezés, 30 perces tétlenség (élő) | `47aed48`, `b081d45` |
| Írásmentes élő próbaszkript (`scripts/live-test-readonly-smoke.mjs`) | `a44f1c8`, 20/20 PASS |
| #8 napi kezelő, türkiz feliratos ikon, iPhone-on is | `e531a04`, kiadás `32052fc`, `31ce41c` |
| Napi mentés + elkülönített visszaállítás (GitHub-úton) | napi `[backup-v2-cloud-bridge-run]`, utolsó 41410412064 |
| Független Drive-másolat: export → izolált restore → Drive-feltöltés → pontos ID-s visszaolvasás → restore a Drive-letöltésből (52 tábla) | run 41531603671 (`b6e22f1`); app-mappa `19WOxZQK…` (owner-only, run 41531436566) |
| Previo TEST csak olvasó felmérés (V2-előkészítés) | `9553d9d`, `3d2cae9`, engedély `b6bcb39` |

TEST-oldal: `leafy-chimera-2403e5`, telepített `17c1ad2` (2026-11-02 16:18Z; élő próba 20/20, chatbot 26/26 + 3 kiadás utáni PASS). Teljes `npm test`: 2562/2562.

## Nyitott feladatok
| ID | Felelős | Állapot | Teendő |
|---|---|---|---|
| DRIVE-TOKEN | Tulajdonos (Claude vezeti) | KÉSZ (PASS 41531603671); karbantartás | Testing módú refresh token kb. 7 nap (~11-09-ig) → OAuth-app „In production” (tartós token), új refresh token, majd egy `[backup-v2-run]`. Klienstitok-csere: tulajdonosi döntés (11-03) – nem cseréljük, ne vesd fel újra |
| SCHEDULE-ENV | Tulajdonos | SZÜNETELTETVE (2026-11-02 16:16Z) | Óránkénti futás kikapcsolva; újraindításkor környezet: Sarberki TEST E2E, utasításban `docs/V1-ALLAPOT.md` |
| V1-RC-CHECK | Claude | PASS – V1 kiadásra jelölhető (TEST) | [`V1-RC-CHECK-2026-11-02.md`](V1-RC-CHECK-2026-11-02.md); production csak külön engedéllyel |
| LIVE-MAILBOX-PLAN | Claude | TERV KÉSZ – tulajdonosi döntésre vár | **info@sarberkito.hu = Google Workspace** (MX `smtp.google.com`, Work 11-02 23:24) → meglévő Gmail-lánc, Internal OAuth `gmail.readonly`. Előfeltétel: a vállalkozás tulajdonosa (édesapa) hozzájárulása + adatkezelési tájékoztató. TEST-előkészítés 1/2 kész: közös automatikuslevél-szűrő (Previo, auto-reply, bulk, noreply, saját feladó) a szerveren és a napi kezelőben; postafiók-profil szerveroldalon, éles profil KIKAPCSOLVA. Tulajdonosi döntés (11-03): éles ügytár = **külön Supabase-projekt**; éles értesítés vendégadat nélkül (`notificationText`, kész). Éles ügytár: 1. szelet kész – változtathatatlan projektprofil + tenant-őr (`deployment/deployment-profile/install.sql`, PGlite 4/4); 2. szelet kész – a valódi postafiók láncának SQL-je (`deployment/test-mailbox/install.sql`: `sc_tm_*` tenant = `sc_deployment_tenant()`, `test_only` = nem éles; profil nélkül a telepítés leáll), PGlite + `npm test` 2563/2563; 3. szelet kész – a profil a projektazonosítót (TEST: `mojnqizbcaczstguikpv`, élesben más, telepítéskor megadandó), a postafiókot és az attesztációs scope-ot is rögzíti; `sc_tm_*` ezekből olvas (`iss`, címzett, scope), `npm test` 2564/2564; 4. szelet kész – `deployment/mailbox-attestation/install.sql` (csak kulcstábla + HMAC, a TEST-csomaggal betűre egyező, teszttel kikényszerítve); `sc_tm_*` a TEST-only binding helyett a profilt használja. PGlite: teljes ÉLES-profilos próba (profil → attesztáció → `sc_tm_create` → független döntés) + negatívak (TEST scope/postafiók/tenant/`iss`, hamis attesztáció), `npm test` 2571/2571; 5. szelet kész – `deployment/approver-role/install.sql`: élesben is csak jóváhagyó szerep (olvasás + jóváhagyás, írás nélkül), a TEST-migrációval azonos végállapot teszttel igazolva, TEST-en no-op; `npm test` 2572/2572; 6. szelet kész – JS-aláírás profilból (`attestMailboxSource`/`verifyMailboxAttestation`, csak ismert profil, címzett = profil postafiókja; TEST-exportok változatlanok); az éles profil JS-aláírása betűre egyezik az SQL-újraszámolással, és az SQL elfogadja; `npm test` 2573/2573; 7. szelet kész – szerveroldali olvasás és ügymentés profil szerint (`readVerifiedMailboxMessage`, `ingestTestMailboxMessage({profile})`: fiók, postafiók-azonosító, tárgyszűrő, tenant, scope a profilból; kikapcsolt/ismeretlen profil hálózati hívás előtt leáll; böngésző-alapértelmezés továbbra is a TEST-fiók), `npm test` 2574/2574; egyik sincs alkalmazva, nincs telepítés. Szándékosan TEST-literál marad: szintetikus (`.invalid`, projekthez kötött) dézsa/szolgáltatás/izolált jóváhagyás/nyugta SQL. Hátra: `booking-cases` útvonal profil szerint (TEST-oldal- és tenantkötés; éles Netlify-oldal = külön döntés) – éles profil KIKAPCSOLVA marad; Pushover-ledger (felhőben nincs telepítve) tenant+postafiók; DB-alkalmazás (előbb profil, utána test-mailbox) csak engedéllyel [`V1-LIVE-MAILBOX-PLAN.md`](V1-LIVE-MAILBOX-PLAN.md): 3 kérdés |
| GUEST-TEXT-FIXES | Claude | KÉSZ; TEST-kiadás PASS (`17c1ad2`) | Minőségi átvizsgálás (264 megkeresés): (1) magyar dátum `2026.11.13.` (`3228b13`); (2) „nem hozunk kutyát” után nincs kisállatdíj-mondat; (3) szlovén „s psom” felismerve; (4) kérdések/státusz az aláírás elé, felkínált típusok mellett nincs „VIP/Családi/Deluxe/Osztott?” ismétlés; (5) létszám: „6 főre”, „15 fős társaság”, „za 4 osebe” felismerve (azonos kapacitásdöntés); (6) dátum: „2027.06.12-én egy éjszakára”, „1 night on …”, „from 5th to 8th May” (bizonytalan hossz → visszakérdez); (7) kifejezett lemondás → meglévő „Megkaptuk a lemondási kérelmét” sablon, foglalási kérdések nélkül (feltételekre vonatkozó kérdés nem lemondás); (8) szlovén „3 osebe / 2 osebi / 1 oseba”, „starost otroka”; (9) EN „kids”, DE „1 Kind 7 Jahre” gyerekként, életkorral; (10) „jul 10-14”, „2027. július 3-án érkezve 4 éjszakára” (év nélkül → visszakérdez). `npm test` 2550/2550 |
| PLATFORM-RESTORE-TEST | Claude + tulajdonos | TERVEZETT – éles bevezetés előtt | A valódi postafiók TEST-beállítása után, valódi vendégadat előtt: teljes újraépítés külön ingyenes Supabase-projektbe + külön Netlify-oldalra a Drive-mentésből; cél: ≤ 4 óra helyreállítás (RTO), ≤ 24 óra adatvesztés (RPO). Becslés: Claude 1–2 munkamenet, tulajdonos kb. 1–1,5 óra |
| PREVIO-READ-PLAN | Work | V1 után | Csak olvasó kapacitás/ár bekötésének feltételei (API-kulcs, mellékhatás-kapu) |

## Akadályok
- Gmail OAuth élő újrapróbája és a fizikai iPhone-lépések emberi lépést igényelnek.
- Previo: saját API-hozzáférés és éles honlap → Previo kapcsolat nem igazolt; Previo-írás műveletenkénti tulajdonosi engedéllyel.

## Engedélyek (Previo-írás, TEST is – AGENTS.md; végrehajtás ELŐTT rögzítendő)
| Típus (ELŐZETES / UTÓLAGOS TUDOMÁSULVÉTEL) | Engedélyező | Időpont | Pontos művelet | Tesztadat | Lezárás módja |
|---|---|---|---|---|---|
| UTÓLAGOS TUDOMÁSULVÉTEL (nem előzetes engedély) | Tulajdonos | Végrehajtás: 2026-11-02 09:39–11:56 CET (Work); tudomásulvétel: 2026-11-02 ~13:00 CET | Previo 73521 API TESZT: foglalás létrehozása (voucher 20260001), voucher-PDF előállítása küldés nélkül, majd lemondás | „TESZT WORK VOUCHER 20261102”, 1 felnőtt, várólista, e-mail/telefon nélkül | Lemondott; auditcélból megmarad; pénzügyi rendezés nincs (`c09ecc5`, `3d2cae9`) |
