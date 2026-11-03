# V1 – valódi postafiók (info@sarberkito.hu) csak olvasó bekötésének terve

Feladat: LIVE-MAILBOX-PLAN (Claude, 2026-11-02). Terv, kódváltozás nélkül. Megvalósítás csak tulajdonosi döntés és engedély után.

## Kiindulás (kódból igazolva)
- A működő lánc: szerveres Gmail-olvasás (`shared-core/server-gmail-source.mjs`) → közös AI (`server-message-extraction`, `buildEmailInquiryDraft`) → `sc_tm_create` → napi kezelő → független jóváhagyás.
- Szándékos tesztkapuk: csak a `sarberkiprojecttest@gmail.com` címzett, csak „Sárberki élő teszt” tárgy, csak `sarberki-test` tenant, `test-mailbox-source-v1` attesztáció. Valódi vendégadat a TEST-be nem kerülhet (AGENTS).

## A közös rész (bármelyik út esetén)
A forrás-olvasó utáni lépések (AI, ügytár, napi kezelő, jóváhagyás) változatlanul újrahasznosíthatók. Új elem csak:
1. **Éles tenant és postafiók-konfiguráció** a meglévő ügytárban (külön tenant, nem a `sarberki-test`), RLS-sel és szerepekkel; valódi PostgreSQL-teszt.
2. **Forráskapu cseréje:** a tárgyszűrő helyett az engedélyezett postafiók + a meglévő duplikáció-, Re:/továbbítás- és dátumkapu; külön attesztációs scope.
3. **Csak olvasás:** nincs küldés, nincs postafiók-módosítás (olvasottnak jelölés sem); a válasz kézzel megy ki.
4. **Kapcsoló és visszaút:** alapból tiltott éles kapcsoló, egy kattintásos kikapcsolás; mentés-visszaállítás az új táblákra.

## Szolgáltató: Google Workspace (Work, 2026-11-02 23:24 CET, nyilvános DNS)
Cím: **info@sarberkito.hu**. MX: `smtp.google.com` (a Google Workspace új, egyrekordos MX-formája). SPF: `include:_spf.google.com include:_spf.previo.cz ip4:212.108.192.37 ~all` (a Previo is küldhet a domain nevében; ez nem bizonyít működő Previo-integrációt). A korábbi `sarberki.hu`-lekérdezés rossz domainre vonatkozott. Az info@ postafiók vagy alias volta NEM IGAZOLT. Az Outlook csak levelezőprogram.
**Választott út: a meglévő, élőben igazolt Gmail-lánc** (első sor alább).

## Út a szolgáltató szerint
| MX-eredmény | Út |
|---|---|
| Google (`aspmx.l.google.com`) | **Meglévő, élőben igazolt Gmail-lánc** `gmail.readonly` joggal, Workspace-fiókra paraméterezve; Internal OAuth (nincs 7 napos lejárat) |
| Microsoft 365 (`*.mail.protection.outlook.com`) | Új `server-outlook-source` adapter, Microsoft Graph `Mail.Read` delegált joggal; Azure-alkalmazásregisztráció |
| Tárhelyszolgáltató | IMAP csak olvasó (tartós jelszó a szerveren, nagyobb kockázat), vagy továbbítás külön Gmailbe (adatmásolat) – külön tulajdonosi döntés |

Mindegyik úton a forrás-olvasó utáni lánc (AI, ügytár, napi kezelő, jóváhagyás) változatlan.

## Tulajdonosi döntések (a megvalósítás előtt)
0. **Előfeltétel (2026-11-02):** a vállalkozás és az info@sarberkito.hu a projekttulajdonos édesapjáé (adatkezelő). Bekötés csak az ő kifejezett, lehetőleg írásos hozzájárulásával; a Workspace-adminisztrátori lépéseket ő vagy az ő engedélyével más végzi. Éles indulás előtt az adatkezelési tájékoztatóban szerepeljen az AI-alapú feldolgozás.
1. Az info@ önálló Workspace-postafiók vagy alias/csoport? Ki a Workspace-adminisztrátor (admin.google.com)?
2. Mehet-e Internal OAuth-kliens a sarberkito.hu Workspace Google Cloud-projektjében, kizárólag `gmail.readonly` joggal?
3. ~~Éles ügytár~~ – **eldöntve (11-03): külön Supabase-projekt.**

## Megállapítások az élesítés előtt (Claude, 2026-11-03)
- **Pushover:** a mostani (csak TEST) értesítés a feladó nevét, e-mail-címét és a levél tárgyát elküldi a Pushovernek (`netlify/functions/pushover-gmail.mjs`). Élesben ez vendégadat egy újabb szolgáltatónál. **Tulajdonosi döntés (11-03): az éles értesítés feladó és tárgy nélküli** – megvalósítva (`notificationText`, éles profil).
- **Automatikus levelek:** a Previo a domain nevében küld (SPF). A közös szűrő (`shared-core/automated-mail-filter.mjs`, `400f6e6`) ezeket, továbbá az auto-reply, bulk és noreply leveleket kiszűri; éles profilban a saját feladót is.
- **Napi mentés:** a napi `[backup-v2-cloud-bridge-run]` kérés (a tulajdonos fiókjáról, 11-03 07:36Z, PASS) a GitHub-úton fut. A Drive-útra (`[backup-v2-run]`) állítás a Drive-token tartóssá tétele után, a napi kérés üzenetének cseréjével lehetséges.

## Éles ügytár (külön Supabase-projekt) – tervezési döntés (Claude, 2026-11-03)
Kiindulás (kódból): a séma tesztkerítése `sc_tenants.test_only ... check (test_only)` és a `'sarberki-test'` literál kb. 30 helyen, 9 SQL-fájlban (`supabase/migrations/*`, `deployment/{cloud-approval,exact-receipt,test-mailbox}/install.sql`), továbbá a JS-ben (`server-gmail-source` canonical, `booking-cases`, Pushover-ledger).
| Út | Értékelés |
|---|---|
| A) Éles másolat-fájlok `sarberki-live` névvel | Gyors, de párhuzamos biztonsági SQL → eltérés-kockázat (AGENTS: nincs párhuzamos motor). Elvetve. |
| **B) Egy telepítéskori, változtathatatlan projektprofil** (`environment` = test/live, `tenant_id`), a literálok helyett egy függvény olvassa; `test_only` = (environment='test') | **Választott.** Ugyanaz az SQL mindkét projektben; a TEST-projekt viselkedése változatlan marad. |
Végrehajtás: (1) SQL + JS átírása, pglite valódi PostgreSQL-tesztek mindkét profillal, negatív tesztek (profil nem módosítható, test projekt nem fogad live tenantot és fordítva); (2) a TEST-adatbázis frissítése csak tulajdonosi engedéllyel, utána élő TEST-ellenőrzés; (3) új éles projekt telepítése + visszaállítási próba (PLATFORM-RESTORE-TEST) engedéllyel. Független ellenőrzés: jogosultsági/RLS-változás → kritikus pont.
Becslés: (1) 1–2 munkamenet; (2)–(3) tulajdonosi lépésekkel kb. 1 óra (feltételezés).
**Korrekció (2026-11-03, leltár alapján):** a TEST-kötés nem csak a tenantnév. A Supabase-projektazonosító (`mojnqizbcaczstguikpv`: kötési tábla, JWT-kibocsátó) 14 fájlban, a `'sarberki-test'` kb. 40 fájlban (SQL + JS), a `test_only` 5 SQL-fájlban, a tesztpostafiók 6 fájlban szerepel. Az 1. szelet (projektprofil, `758d071`) kész. A 2. szelet ezért **csak a minimális éles útvonalat** paraméterezi, a tisztán teszt-fixture-ök (szintetikus, dézsa, Previo-preflight, küldési próba, clarification-only) TEST-only maradnak, és az éles projektbe nem települnek:
- SQL: `case_store`, `cloud-approval/install` + `separate-approver-permission` (projekt-kötés és kibocsátó a profilból), `test-mailbox/install` (tenant, `test_only`, attesztációs scope, postafiók), Pushover-ledger (tenant, postafiók).
- JS: `operator-cookie-session`, `booking-cases`, `server-booking-runtime`, `case-store-client`, `server-gmail-source`/`server-test-mailbox-case`, `isolated-approval-review`, Pushover (`pushover-gmail`, `_shared/pushover-*`).
**Új becslés (feltételezés):** 3–4 munkamenet a 2. szeletre, mindegyik a meglévő TEST-tesztek változatlan zöldjével és PGlite élő/teszt profil-negatívokkal; a TEST-adatbázis frissítése és élő TEST-újraellenőrzés engedéllyel. A korábbi „1–2 munkamenet” alulbecslés volt.
**2a kész (2026-11-03, NEM alkalmazva):** a profil kötelezően rögzíti a projekt-azonosítót (`sarberki.deployment_project_ref`; TEST = `mojnqizbcaczstguikpv`, LIVE ≠ az), helperek: `sc_deployment_project_ref()`, `sc_deployment_issuer()` (kliens és `service_role` számára tiltva). A `cloud-approval/install` (generátor: `scripts/build-cloud-synthetic-approval-sql.mjs`) és a `separate-approver-permission` a profilból köt; profil nélkül megáll. A szintetikus `sc_approve_case` törzse változatlan, TEST-only: élesben `isolated approval only` hibával zár. **Alkalmazási sorrend (engedéllyel):** case_store → profil (`test`, TEST ref) → meglévő telepítők. Hátra: 2b `test-mailbox/install` (tenant, `test_only`, attesztációs scope, postafiók, kibocsátó), 2c Pushover-ledger, 2d JS-réteg.
**2b kész (2026-11-03, NEM alkalmazva):** `deployment/test-mailbox/install.sql` egy definer-only `sc_tm_profile()` függvényből veszi a tenantot, a postafiókot (TEST: tesztfiók; LIVE: `info@sarberkito.hu`), a forrás-scope-ot (`test-/live-mailbox-source-v1`), a belső jóváhagyási scope-ot (`test-/live-mailbox-v1`), a `test_only` elvárást és a kibocsátót – a `server-mailbox-profiles.mjs` tükre. Élesben a saját postafiókról érkező levél SQL-szinten is tiltott. A `rollback.sql` a profil projekt-azonosítóját várja. Tábla- és függvénynevek (`sc_test_mailbox_*`, `sc_tm_*`) történeti okból maradnak. Bizonyíték: `tests/live-mailbox-sql-pglite.test.mjs` 7/7 (TEST-scope/-postafiók/-tenant/-kibocsátó és saját feladó elutasítva), TEST-tesztek változatlanul zöldek. 2d-ben a JS (`server-gmail-source`, `booking-cases`, napi kezelő felirata) a live scope-ot is kezelje.

## Becslés (feltételezés, nem igazolt)
Google esetén a meglévő Gmail-adapter paraméterezése és az éles kapuk: kb. 1–2 munkamenet; Microsoft esetén új adapter: néhány munkamenet, majd TEST-szerű próba egy kifejezetten erre a célra küldött, kitalált levéllel, élesítés csak engedéllyel. A pontos idő a döntésektől és a hozzáférések elérhetőségétől függ.
