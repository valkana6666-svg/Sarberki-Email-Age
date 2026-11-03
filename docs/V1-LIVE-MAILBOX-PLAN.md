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
Állapot (11-03): 1. szelet = profil + tenant-őr; 2. szelet = `sc_tm_*` (a valódi postafiók útja) tenant- és `test_only`-literáljai a profilból. A szintetikus, `.invalid`-feladós és TEST-projekthez kötött SQL (dézsa, szolgáltatás-kapcsolás, izolált jóváhagyás, pontos nyugta, küldési napló-jelölt) szándékosan `sarberki-test` marad: élesben nem futhat, a literál ott további kerítés; az alkalmazott migrációk szövege így nem tér el az adatbázistól. 3. szelet (11-03): a profil a projektazonosítót, a postafiókot és az attesztációs scope-ot is rögzíti (a JS `server-mailbox-profiles.mjs` értékeivel egyezően); `sc_tm_*` ezeket olvassa. 4. szelet (11-03): `deployment/mailbox-attestation/install.sql` adja élesben a kulcstáblát és a HMAC-ot (a `cloud-approval` blokkjával betűre egyező, teszt kényszeríti); `sc_tm_*` nem függ a TEST-only binding-táblától. 5. szelet (11-03): `deployment/approver-role/install.sql` – csak jóváhagyó szerep élesben is (TEST-migrációval azonos végállapot, teszt igazolja). Éles telepítési sorrend: case store → profil (live + projektazonosító) → approver-role → mailbox-attestation → kulcs (szerveroldali titok) → test-mailbox. 6. szelet (11-03): a szerveroldali JS-aláírás scope-ja és tenantja a postafiók-profilból jön; az éles profil aláírását a PGlite-próba az SQL-lel keresztellenőrzi. 7. szelet (11-03): a szerveroldali olvasás és ügymentés is a profilból dolgozik; olvasni csak engedélyezett profillal lehet (az éles kikapcsolt), a böngésző olvasója változatlanul a TEST-fiókhoz kötött. A Pushover-ledger tenantja a postafiók-címmel együtt változik.
Becslés: (1) 1–2 munkamenet; (2)–(3) tulajdonosi lépésekkel kb. 1 óra (feltételezés).

## Becslés (feltételezés, nem igazolt)
Google esetén a meglévő Gmail-adapter paraméterezése és az éles kapuk: kb. 1–2 munkamenet; Microsoft esetén új adapter: néhány munkamenet, majd TEST-szerű próba egy kifejezetten erre a célra küldött, kitalált levéllel, élesítés csak engedéllyel. A pontos idő a döntésektől és a hozzáférések elérhetőségétől függ.
