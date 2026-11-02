# V1 – valódi postafiók (info@sarberki.hu) csak olvasó bekötésének terve

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

## Szolgáltató: Google Workspace (Work, 2026-11-02 22:21 UTC, nyilvános DNS)
MX: `ASPMX.L.GOOGLE.COM` (1), `ALT1/ALT2` (5), `ALT3/ALT4` (10); SPF `include:_spf.google.com`. Az Outlook csak levelezőprogram. Az info@ postafiók vagy alias volta DNS-ből NEM IGAZOLT.

## Döntés: a meglévő Gmail-olvasó újrahasznosítása
| Út | Értékelés |
|---|---|
| **Meglévő Gmail-lánc `gmail.readonly` joggal, Workspace-fiókra paraméterezve** | **Választott.** Élőben igazolt kód (kezelői OAuth → szerveres újraolvasás → közös AI → napi kezelő); új elem csak az éles kapuk (fiók, tenant, tárgyszűrő helyett postafiók-kapu). |
| Microsoft Graph / Microsoft tesztfiók | Elvetve: az MX nem Microsoft 365. |
| Továbbítás külön Gmailbe, IMAP | Elvetve: adatmásolat, tartós jelszó; nem szükséges. |

Előny: a Workspace saját Google Cloud-projektjében az OAuth-alkalmazás **Internal** lehet → nincs Google-ellenőrzés a `gmail.readonly` korlátozott jogra, és nincs 7 napos token-lejárat (ugyanez a Drive-mentés tartós tokenjére is megoldás lehet).

## Tulajdonosi döntések (a megvalósítás előtt)
1. Az info@ önálló Workspace-postafiók vagy alias/csoport? Ki a Workspace-adminisztrátor (admin.google.com belépés)?
2. Mehet-e Internal OAuth-kliens létrehozása a sarberki.hu Workspace Google Cloud-projektjében, kizárólag `gmail.readonly` joggal?
3. Melyik Supabase/Netlify környezet lesz az éles ügytár (külön projekt vagy tenant)?

## Becslés (feltételezés, nem igazolt)
A kód a meglévő Gmail-adapter paraméterezése és az éles kapuk: kb. 1–2 fejlesztési munkamenet, majd TEST-szerű próba egy kifejezetten erre a célra küldött, kitalált levéllel, élesítés csak engedéllyel. A pontos idő a döntésektől és a hozzáférések elérhetőségétől függ.
