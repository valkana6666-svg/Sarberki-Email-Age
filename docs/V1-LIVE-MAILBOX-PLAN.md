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

## Szolgáltató: NEM IGAZOLT
A helyes cím **info@sarberkito.hu** (tulajdonos, 2026-11-02). A Work 11-02-i MX-lekérdezése a `sarberki.hu` domainre vonatkozott (Google Workspace), ezért **érvénytelen**; a `sarberkito.hu` MX-ét újra le kell kérdezni. Az Outlook csak levelezőprogram.

## Út a szolgáltató szerint
| MX-eredmény | Út |
|---|---|
| Google (`aspmx.l.google.com`) | **Meglévő, élőben igazolt Gmail-lánc** `gmail.readonly` joggal, Workspace-fiókra paraméterezve; Internal OAuth (nincs 7 napos lejárat) |
| Microsoft 365 (`*.mail.protection.outlook.com`) | Új `server-outlook-source` adapter, Microsoft Graph `Mail.Read` delegált joggal; Azure-alkalmazásregisztráció |
| Tárhelyszolgáltató | IMAP csak olvasó (tartós jelszó a szerveren, nagyobb kockázat), vagy továbbítás külön Gmailbe (adatmásolat) – külön tulajdonosi döntés |

Mindegyik úton a forrás-olvasó utáni lánc (AI, ügytár, napi kezelő, jóváhagyás) változatlan.

## Tulajdonosi döntések (a megvalósítás előtt)
1. A `sarberkito.hu` MX-eredménye (Work) és: önálló postafiók vagy alias? Ki a postafiók adminisztrátora?
2. A szolgáltató szerinti út jóváhagyása, kizárólag olvasási joggal.
3. Melyik Supabase/Netlify környezet lesz az éles ügytár (külön projekt vagy tenant)?

## Becslés (feltételezés, nem igazolt)
Google esetén a meglévő Gmail-adapter paraméterezése és az éles kapuk: kb. 1–2 munkamenet; Microsoft esetén új adapter: néhány munkamenet, majd TEST-szerű próba egy kifejezetten erre a célra küldött, kitalált levéllel, élesítés csak engedéllyel. A pontos idő a döntésektől és a hozzáférések elérhetőségétől függ.
