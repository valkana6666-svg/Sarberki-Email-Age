# V1 – valódi postafiók (info@sarberki.hu) csak olvasó bekötésének terve

Feladat: LIVE-MAILBOX-PLAN (Claude, 2026-11-02). Terv, kódváltozás nélkül. Megvalósítás csak tulajdonosi döntés és engedély után.

## Kiindulás (kódból igazolva)
- A működő lánc: szerveres Gmail-olvasás (`shared-core/server-gmail-source.mjs`) → közös AI (`server-message-extraction`, `buildEmailInquiryDraft`) → `sc_tm_create` → napi kezelő → független jóváhagyás.
- Szándékos tesztkapuk: csak a `sarberkiprojecttest@gmail.com` címzett, csak „Sárberki élő teszt” tárgy, csak `sarberki-test` tenant, `test-mailbox-source-v1` attesztáció. Valódi vendégadat a TEST-be nem kerülhet (AGENTS).
- Az info@sarberki.hu szolgáltatója innen NEM IGAZOLT (a környezet DNS-t sem enged); a dokumentáció „Outlook”-ot említ.

## A közös rész (bármelyik út esetén)
A forrás-olvasó utáni lépések (AI, ügytár, napi kezelő, jóváhagyás) változatlanul újrahasznosíthatók. Új elem csak:
1. **Éles tenant és postafiók-konfiguráció** a meglévő ügytárban (külön tenant, nem a `sarberki-test`), RLS-sel és szerepekkel; valódi PostgreSQL-teszt.
2. **Forráskapu cseréje:** a tárgyszűrő helyett az engedélyezett postafiók + a meglévő duplikáció-, Re:/továbbítás- és dátumkapu; külön attesztációs scope.
3. **Csak olvasás:** nincs küldés, nincs postafiók-módosítás (olvasottnak jelölés sem); a válasz kézzel megy ki.
4. **Kapcsoló és visszaút:** alapból tiltott éles kapcsoló, egy kattintásos kikapcsolás; mentés-visszaállítás az új táblákra.

## Forrás-olvasó: érdemi utak
| Út | Mikor | Előny | Hátrány / kockázat |
|---|---|---|---|
| **A) Microsoft Graph, `Mail.Read`** | ha az info@ Microsoft 365 vagy Outlook.com | Nincs adatmásolat; hivatalos, szűk olvasási jog; a mostani Gmail-olvasóval azonos minta (kezelői token, szerveres újraolvasás) | Új forrásadapter (`server-outlook-source`) és tesztjei; Azure-alkalmazásregisztráció (tulajdonos) |
| **B) Továbbítás egy külön éles Gmail-fiókba** | gyors átmenet, ha A nem lehetséges | Szinte teljes kódújrahasznosítás (fiók/tenant paraméterezése) | A vendéglevelek másolata egy második szolgáltatónál (adatvédelmi döntés); továbbítás miatti fejléc-eltérések; két hely, ahol levél van |
| C) IMAP | ha tárhelyszolgáltatói postafiók | Szolgáltatófüggetlen | Tartós jelszó a szerveren, nagyobb kockázat; új könyvtár; nem javasolt |

**Javaslat:** ha az info@ Microsoft-alapú, akkor az **A** út; ez a legkisebb tartós kockázat. A **B** csak akkor, ha a tulajdonos az adatmásolatot kifejezetten elfogadja.

## Tulajdonosi döntések (a megvalósítás előtt)
1. Hol fut az info@sarberki.hu? (Microsoft 365 / Outlook.com / tárhelyszolgáltató) – a webmail címe vagy a kliens beállítása elég.
2. Mehet-e Azure-alkalmazásregisztráció `Mail.Read` delegált joggal (A), vagy elfogadható-e a továbbítás egy Gmail-fiókba (B)?
3. Melyik Supabase/Netlify környezet lesz az éles ügytár (külön projekt vagy tenant)?

## Becslés (feltételezés, nem igazolt)
Az A út kódja a meglévő Gmail-adapter mintájára néhány fejlesztési munkamenet, majd TEST-szerű próba egy kifejezetten erre a célra küldött, kitalált levéllel, élesítés csak engedéllyel. A pontos idő a döntésektől és a hozzáférések elérhetőségétől függ.
