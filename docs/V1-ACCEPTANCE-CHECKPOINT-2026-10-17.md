# Sárberki V1 – összevont elfogadási állapot, 2026-10-17

Ez az aktuális folytatási leltár. A dátumozott régi jelentések történeti
pillanatképek; az ott nyitottnak jelölt kapuk közül több később sikeresen lezárult.
A sikeres bizonyítékokat új hiba/változás nélkül nem kell újrafuttatni.
Ez dokumentációs összesítés, nem új élő Gmail-, szolgáltatói vagy DB-teszt.

## Bizonyítékmátrix

| Terület | Igazolt eredmény és forrás | Határ / még szükséges |
| --- | --- | --- |
| Friss Google OAuth és Gmail-olvasás | Október 15-én tényleges tesztfiókos readonly olvasás, HU szintetikus levél és helyi duplicate: [jelentés](../reports/gmail-oauth-live-2026-10-15/REPORT.md) | Ez kész részteszt; nem új hitelesítési feladat önmagában |
| Egyetlen privátan kötött Gmail-tesztreceipt felhős mentése | Normál Writer, v1 dedup, külön Reader írástiltás, visszaolvasott audit és teljes sorhash: [lezárt felhős szakasz](../reports/v1-status-2026-10-15/REPORT.md), [audit](../reports/exact-receipt-audit-2026-10-15/REPORT.md) | Korábbi, felhasználói eszközön beolvasott export; nem ugyanazon friss Work-OAuth olvasás közvetlen folytatása |
| Négy nyelvű közös ügy-/tervezettár | Korábbi zárt HU/DE/SI/EN felhős ügyek, Writer/Reader/approver és belső jóváhagyás: [állapotjelentés](../reports/v1-status-2026-10-15/REPORT.md) | Az ott ismertetett kitalált mintákra vonatkozik; nincs küldési vagy foglalási engedély |
| Bejövő magyar fordítás | EN/DE/SI valós szolgáltatói fordítás 3/3, védett számok megmaradtak; terminológiai javítás után ismét három zárt minta: [szolgáltatói próba](../reports/translation-netlify-2026-10-16/REPORT.md), [faház-terminológia](../reports/translation-terminology-2026-10-16/REPORT.md) | Csak a három pontos kitalált bemenet. Nem általános vendéglevél-fordítás; válasz-/visszafordítás külön hatókör |
| Létszám/gyermek canonical eltérés | Gmail közös partyCounts-projekció és négynyelvű transformer-paritás: [OAuth-jelentés javítási fejezete](../reports/gmail-oauth-live-2026-10-15/REPORT.md) | A korábbi 8 adults / guests=null hibát ne kezeljük újra nyitottnak |
| Bizonytalan szolgáltatásügy emberi összerendelése | Felhős review v1→v2, változatlan cél v4, egy egyező döntés és audit: [későbbi igazolt összerendelés](../reports/service-preview-scope-2026-10-16/REPORT.md) | A [korábbi jelentés](../reports/closed-cloud-service-link-2026-10-16/REPORT.md) még belépésnél állt meg; ez történeti, később feloldott kapu |
| Dézsa időszak/ház/forrás és külön jóváhagyás | Közös checker, valódi izolált PostgreSQL, tiltások, CAS/audit és felhőben alkalmazott schema: [dézsajóváhagyás](../reports/tub-service-approval-2026-10-16/REPORT.md) | A valós szolgáltatói dézsanaptár és annak hiteles kötése még nem igazolt. Nem jelent kész élő dézsavisszaigazolást |
| Lemondási szándék és több szolgáltatás | Tagadás/feltétel/hivatkozáskonfliktus, saját szolgáltatásidőpont, szálláslemondási emberi kapu: [legutóbbi javítás](../reports/tub-action-scope-2026-10-17/REPORT.md) | Szintetikus minták, nem általános nyelvi garancia |
| Aktuális kódregresszió | `6341d207600c67d78fe714b4b6d523a5a7ebdc50`: [CI 39005722410](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39005722410), 1661 PASS / 0 FAIL / 0 SKIP. A következő docs-HEAD `2e573b1bbb08bf417e6d7852c6be962bfe540c79` ugyanez: [CI 39005796614](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39005796614), exact deploy PASS | Nem futtatjuk újra pusztán az összesítés miatt |
| Mobil UI | Korábbi Chromium/WebKit szintetikus mobilpróbák sikeresek: [CI 39004012065](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39004012065) | Nem tényleges iPhone/Safari vagy főképernyős PWA-bizonyíték |
| Mentés és izolált helyreállítás | Október 15-i 47 táblás igazolt restore és hash-ellenőrzött titkosított csomag: [mentési állapot](../reports/v1-status-2026-10-15/REPORT.md) | A későbbi szolgáltatásdöntés-séma miatt ez nem automatikusan a végső jelölt teljes snapshotja. Az ott leírt GitHub-példány okt. 22-én jár le; a korábbi példányok már okt. 20-án is lejárhatnak. Ezek történeti, nem most újralekért retention-adatok |
| HU/DE nyilvános honlap és foglalási paritás | Párhuzamos munkamenet dokumentált követelményei/auditja: [átadás](requirements/multilingual-v1-implementation-handoff-2026-10-17.md) | A tesztagent nem azonos a WordPress-honlappal. A követelménydokumentum nem implementáció vagy egységesített üzleti adatforrás |

## Párhuzamos munka átvétele

A `c8351851534af96340cdfdda9bd18ca79abfdf71` dokumentációs HEAD után
`a94877c071814f59b3cfad1fa91fc5ff0cba1eda` 12 egyszerű HU/DE/EN/SI paritás-
regressziót adott hozzá. A [CI 39006049540](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39006049540)
és a kapacitásworkflow sikeres; nem indítottuk őket újra. Napló szerint
**1673 PASS / 0 FAIL / 0 SKIP**, exact deploy = ugyanaz az `a94877c` teljes SHA.
Ezek a nyelvi/PMS-szöveg alapellenőrzések nem jelentik a teljes határértékes
[paritásmátrix](requirements/multilingual-booking-v1-test-matrix-2026-10-17.md) lezárását.
A két párhuzamos munka eredményét felülírás nélkül vettük át.

## A ténylegesen nyitott Gmail-kapu

**Nem az OAuth megléte hiányzik.** Az a kombinált, azonos üzenetre vonatkozó
bizonyíték nincs egységesen dokumentálva, amely friss tesztfiókos OAuth-olvasásból
közvetlenül ugyanazon pontosan engedélyezett tesztreceipt Writer-mentéséhez,
deduplikációjához és Reader/audit-visszaolvasásához vezet.
A már sikeres külön láncszemeket nem szabad egyetlen új, végigfutott eseménynek nevezni.

A következő konkrét próba:
1. A teszthoston meglévő normál Writer-munkamenet ellenőrzése. Csak a védett
   alkalmazás-bejelentkezés használható; Reader/admin SQL/service role nem pótlás.
2. Kizárólag `sarberkiprojecttest@gmail.com`, `gmail.readonly`; a már privátan
   engedélyezett egyetlen kitalált receipt. Nem bővítünk allowlistet, nem használunk
   valós vendégadatot és nem alakítjuk át a feladót `.invalid` aliasszá.
3. Friss olvasás és az aktuálisan kiválasztott receipt forrásának ellenőrzése;
   eltérő levélnél nincs felhős mentés és nincs privát konfigurációmódosítás.
4. Normál explicit Writer-mentés/duplicate → azonos caseId/revision → Reader
   szerveres preview és audit. Ismeretlen ár/kapacitás mellett nincs jóváhagyás.
5. A próba nem tartalmazhat automatikus küldést, Previo-hívást vagy foglalást.

## Mai, nem író felületi megfigyelés

A teszthost megnyílt; a kezdeti buildjelzés `a0d29c5` volt. A kezelői panelen
„A bejelentkezés vagy jogosultság ellenőrzése nem sikerült.” jelent meg,
a Writer- és exact-receipt mentés tiltva maradt. Nem történt új login,
Gmail-beolvasás, felhős ügyírás, szerepmódosítás vagy jogosultságmegkerülés.
Ez **aktuális munkamenet-akadály**, nem a korábban igazolt OAuth/Writer kód hibájának bizonyítéka.

## V1 státusz és hátralévő munka

Becsült készültség továbbra is kb. **90%**, mérnöki becslés. A regressziók száma
nem készültségi százalék. Hátravan a fenti kombinált receipt-próba, tényleges
iPhone/PWA-ellenőrzés, a végső jelölt mentési/restore-ellenőrzése és a
szolgáltatói tesztkapcsolat. Previo-hozzáférés várhatóan okt. 19–20.; addig
minden független fejlesztés folytatható. Élesítés nincs engedélyezve.

V2/V3: a közös mag, tenant, külön read/write/approve, CAS és audit változatlan;
a bizonyítékok összevonása nem hoz létre új műveleti jogosultságot.
