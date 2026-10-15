# Sárberki V1 – ellenőrzött állapot, 2026-10-15


## Lezárt felhős szakasz – 2026-10-15

**Tesztelt és telepített kódcommit: `322bcdd00e86c66550cc72f6b21f589aa043651a`.** Az ezt követő jelentésfrissítés csak dokumentáció, nem új kód- vagy CI-eredmény.

- [CI 38687214869](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38687214869) SUCCESS: **1501 PASS / 0 FAIL / 0 SKIP**. Az élő Previo smoke külön SKIPPED. A szintetikus Gmail mobilworkflow és a kapacitásregresszió is SUCCESS. Helyben csak a 22 érintett célzott ellenőrzés futott.
- A normál Writer-mentés, az azonos levél második feldolgozásának változatlan v1 eredménye és a Readerként bekért külön belépésből történő írás FORBIDDEN eredménye igazolt. Újratöltés után listázás és v1 szerveres előnézet sikeres.
- Az új auditpatch tényleges PostgREST `data::text` útvonala sikeres. Olvasói munkamenetből visszaolvasható: létrehozás / v1; actor `d6c910cd-d0bf-4470-a1f2-2def40a1ab1c`; adat-SHA256 `b04dc79ee54c1de22db89e3936b8ee631ef4f3347ba160a14a8eac6878e92b3c`. Az alkalmazás normál RLS-es olvasással egyeztette a tárolt adatot és audit-hash-t. Ez a létrehozás aktuális írási auditja, nem jóváhagyás vagy teljes auditlánc-bizonyítás.
- Állapot pending; ismeretlen kapacitás/ár mellett jóváhagyás tiltott. Korábbi négy nyelvi jóváhagyási tesztet nem ismételtünk. E-mail/Pushover-küldés, Previo-hívás vagy -írás nem történt ebben a szakaszban; production/main változatlan. Ügyírás nem történt admin SQL-lel vagy service role-lal.
- [Mentés 38687214672](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38687214672) SUCCESS; teljes izolált SQL-restore PASS, **47/47 tábla** adattartalma egyezik. Snapshot: 8 ügy, 8 üzenetkulcs, 20 audit; a privát exact-receipt DB-tábla is része. RLS/CAS/audit rollbackpróba PASS; Auth API login továbbra NOT_RUN ebben a visszaállításban.
- Tartósan külön megőrzött csomag: `Sarberki_Verified_PostReceipt_Backup_2026-10-15.zip`, 105753 byte; SHA256 `8810a80bd3e00532f3a0cab9c8cacf1828d84793ed1df3287c74749e7a1237f8`. ZIP CRC, GitHub artifact digest és három ciphertext-hash egyezik. A GitHub-példány lejárata **2026-10-22 05:32:55 UTC / 07:32:55 Budapest**, restore-artifact egy másodperccel korábban. Minden régi mentés megmaradt. Netlify/Google külső beállítások nem részei a DB-mentésnek.

**Bizonyítékhatár:** a tényleges Gmail-azonosítójú kitalált levél korábbi, felhasználói eszközön készült exportjának teljes felhős mentési/visszaolvasási/duplikációs és írási auditfolyamata sikeres. Új, közvetlen Work–Google OAuth/Gmail-beolvasás ebben a szakaszban nem történt, így ezt nem állítjuk.

**V1: 92% mérnöki becslés**, nem tesztlefedettségi mutató. Fennmarad a friss, közvetlen Gmail-read kapcsolat bizonyítása; a bejövő idegen nyelvű levél magyar fordításának biztonságos bekötése; a canonical/local gyermek-visszakérdezési eltérés rendezése a védett komponensek külön engedélyezett javításával; a biztonságos Previo-read/hold-mentesség igazolása és az élesítési security-advisor tételek áttekintése. A szerveres tárolt tervezetben a 8 felnőtt és a dátumok helyesek. Következő konkrét feladat: friss gmail.readonly beolvasás az elkülönített szintetikus postaládából, a most már igazolt felhős szakasz újrafuttatása nélkül, kivéve ha új adatváltozás indokolja.

## További felhős ellenőrzés – 2026-10-15 07:19 után

A felhasználó kifejezetten engedélyezte a pontos tesztpayload privát Netlify/DB-kötését és a hibásan titkosként jelölt nyilvános aktiváló kapcsoló újralétrehozását. A kapcsoló nem titkos, a PRIVATE_JSON változó továbbra is titkos; a teljes secrets scanning és Require approval védelem megmaradt. A javított Netlify-teszttelepítés `6ad062c02d18ba10a74a8372` / `1624ad2` published.

- Normál Writer UI-mentés sikeres: az engedélyezett ügy `13c8ecb7-f836-4e2c-9833-d58ee96f2dda`, v1. Ugyanazon export második feldolgozása meglévő ügyet és változatlan v1-et adott.
- Külön, Readerként bekért védett belépés után a Writer-mentési próba FORBIDDEN; teljes oldal-újratöltés után az ügy v1-ként listázható, és a tárolt tervezet szerverről visszaolvasható. A szerveres előnézetben kapacitás/ár NEM IGAZOLT, állapot pending; nincs jóváhagyás.
- Ez a korábban user-eszközön valódi Gmailből beolvasott export felhős visszajátszása. Nem új Work–Google OAuth/Gmail-read bizonyíték.
- A szerveres tárolt tervezet összlétszáma 8, felnőttek 8, dátum 2026-10-30–11-01, 2 éj; a korábbi canonical/local gyermek-visszakérdezési eltérés nyitott.
- Az audit előnézeti hiányára a Codex elkészítette a meglévő GET-preview útvonal normál RLS-es, privát exact-receipt-egyezésre kötött kiegészítését. 22 célzott PASS/0FAIL/0SKIP; részletes jelentés: `../exact-receipt-audit-2026-10-15/REPORT.md`. Nincs új RPC, migráció, jogosultság vagy jóváhagyási út. Az új auditpatch felhős eredménye és új mentési futása ezen commit készítésekor még függőben van.

## Végrehajtás utáni frissítés – az alábbi korábbi pillanatképet felülírja

- Új kódcommit és ellenőrzött teszttelepítés: `7654c5d617e06788f3d59a9f7e5540561d9eaed4`. Kizárólag a tesztág és a leafy-chimera tesztoldal változott.
- [CI 38682628961](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38682628961): SUCCESS; **1496 PASS / 0 FAIL / 0 SKIP**. A kapacitásregresszió és a szintetikus Gmail mobilpróba is SUCCESS. A chatbot mobilworkflow szándékosan SKIPPED. Ez az egyszeri automatikus CI az új storage/API-határ változása miatt indokolt; nem indult újabb teljes helyi tesztfutás.
- A tesztoldal health-válasza pontosan ezt a kódcommitot jelzi; `autoSend=false`, `autoBookingModification=false`.
- [Friss mentés 38682628995](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38682628995): SUCCESS. Forrásprojekt `mojnqizbcaczstguikpv`, read-only export; teljes izolált SQL-restore PASS, 46/46 tábla adattartalma egyezik; RLS/CAS/audit rollback-próba PASS. Auth API login ebben a restore-ban NOT_RUN, szerepjelszavak nincsenek a mentésben.
- A letöltött ZIP-ek SHA256-ja egyezik a GitHub artifact digesttel; mindhárom ciphertext hash-e egyezik a restore-bizonyítékkal. A külön megőrzött `Sarberki_Verified_PreReceipt_Backup_2026-10-15.zip` SHA256: `bf4697c0907ce30c86d26469fbfcdeb12f99e43f428354996d8edb6415d15050`. A titkosított GitHub artifact lejárata **2026-10-22 04:41:41 UTC / 06:41:41 Budapest**; restore-artifact egy másodperccel korábban. A korábbi mentések megmaradtak.
- A friss mentés és projektazonosság ellenőrzése UTÁN alkalmazva a `synthetic_exact_gmail_receipt_guard` séma-migráció. A meglévő Writer funkció csak pontosan privát konfigurációhoz kötött tesztügyet fogadhat; auth, Writer-jog, CAS, append-only, audit és ismeretlen ár/kapacitás tiltás változatlan. A konfigurációs tábla RLS-védett, jelenleg **0 sor**, anon/authenticated/service_role közvetlen hozzáférése tiltott. Nem történt alkalmazási ügyírás admin SQL-lel vagy service role-lal.
- A hivatalos Netlify Google-belépés sikeres; a privát konfiguráció MENTÉSE viszont az automatikus jóváhagyási ellenőrzésen megállt. Indok: a valódi Gmail-azonosítók, operátori feladócím és kitalált tesztlevélszöveg Netlify-célhelyre továbbításához külön adat–célhely engedély szükséges. A blokkolást nem kerültük meg; a privát env nem mentődött és a DB-kötés sem aktiválódott.
- Ezért a tényleges Gmail-levél Writer-mentése, Reader-visszaolvasása és ismételt feldolgozásának FELHŐS eredménye továbbra is **NEM IGAZOLT**. Az offline adapter/RLS/UI-próba sikeres. Ismeretlen kapacitás és ár mellett foglalási ajánlat jóváhagyása tiltott.
- Supabase security advisor: a privát táblák policy nélküli RLS-e szándékos teljes kliensoldali tiltás; a három sc_* definer RPC meglévő hitelesített belépési pont. Nyitott élesítési ellenőrzés a korábbi `rls_auto_enable` triggerfüggvény EXECUTE-grantja és a kikapcsolt leaked-password protection. Ezekhez most nem változtattunk jogosultságot vagy Auth-beállítást.
- Következő konkrét lépés: kifejezett engedély a pontos tesztpayload kizárólag a leafy-chimera tesztoldal titkos env-jébe és a sarberki-test privát kötésébe történő mentésére; utána normál Writer-belépés, egy mentés, azonos levél deduplikációja, Reader előnézet és jóváhagyási tiltás. A védett renderer/üzleti szabályok eltérései továbbra is nyitottak; nem módosultak.
- V1: **90–92% mérnöki becslés**, élesítésre még nem kész.

## Korábbi, a végrehajtás előtti pillanatkép


Kizárólagos ág: `gmail-test-subject-allowlist`. Kiinduló GitHub HEAD és frissen ellenőrzött Netlify teszttelepítés: `77cf97cfad2d594ae33a967946f889b4df301fe2`. Ez a jelentés és az új negatív teszt nem aktivál új adatfogadási útvonalat.

## GitHub és CI

A branch-szűrt Actions-lista legfrissebb futása: [38546025723](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38546025723), `4ea4b936117b60ad461a7a616faf2cfb8a12b218`, 2026-10-14 09:57:26 UTC, SUCCESS. A tesztjob (`115792172500`) naplója: **1472 PASS / 0 FAIL / 0 SKIP**. Az élő Previo smoke lépés külön SKIPPED, nem élő kapacitásbizonyíték.

A jelenlegi `77cf97cf…` commit `[skip actions]` jelöléssel készült: nincs hozzá teljes Actions-futás. Korábbi célzott bizonyítéka **19 PASS / 0 FAIL / 0 SKIP**, nem új teljes CI-siker. A PR-futásokat szűrő wrapper üres válaszából nem következtettünk a push-futások hiányára; a branch-szűrt REST-listát külön ellenőriztük.

A legutóbbi failure-listázott futás [38414863596](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38414863596), az október 13-i export/restore munka része. A későbbi, eredethez kötött `38457118999` mentés teljes izolált visszaállítási bizonyítéka PASS; a régi failure újrafuttatása most nem szükséges.

## Működés és bizonyítékszintek

- A korábbi HU/DE/SI/EN zárt minták Writer → PostgreSQL → Reader → külön jóváhagyó → audit útja igazolt. A négy emberi jóváhagyást nem ismételtük.
- A korábbi eredeti mintán a v3 → v4 jóváhagyás igazolt. A négy új nyelvi ügy v3 / `internally_approved` állapotban lett visszaolvasva október 14-én.
- Október 15-én csak reprezentatív, írás nélküli friss olvasás történt: az EN ügy (`926cc81d-16a1-435f-bfd3-41e874c1b1bc`) továbbra is v3 / `internally_approved`, egy audit, az eredeti actor és időpont, változatlan hash-ek. Nem új jóváhagyás.
- A Reader olvasási, a Writer írási és a külön jóváhagyó approve-joga elkülönül. A korábbi automatizált tiltási bizonyítékok megmaradnak; ma nem ismételtük a teljes szerepkörtesztet.
- A valódi Gmail-olvasás és helyi feldolgozás a felhasználó iPhone-os képeivel és az átadott canonical JSON-nal igazolt. Ez külön eszközről származó bizonyíték, nem a Work sikeres Google OAuth-munkamenete. A Work böngészőjében utoljára 502 / Connection refused akadály volt; ma nem indult ismételt Google-belépés.
- A tényleges Gmail-üzenet Supabase-mentése, Reader-megjelenítése és felhős duplikációpróbája **NEM IGAZOLT**. A zárt fixture-eredményt nem tulajdonítjuk ennek a levélnek.

## Új befejezett szakasz

A Codex 2 új célzott ellenőrzést készített: `tests/actual-receipt-storage-boundary.test.mjs`. **2 PASS / 0 FAIL / 0 SKIP**. A koordinátor ellenőrizte a teszt orákulumait és a jelentést.

A valódi feladó változatlan megőrzését két meglévő védelem akadályozza: a runtime és a `sc_write_case` SQL egyaránt `.invalid` feladót követel. Valódi PostgreSQL-motoron, authenticated Writer-tagság mellett SQLSTATE `22023` a válasz; az ügy-, üzenetkulcs- és auditszám nulla marad. Azonos jog és payload mellett a kitalált `.invalid` pozitív kontroll sikeres. A kontroll nem javasolt feladóhamisítás.

Részletes bizonyíték és offline jelölt: [exact receipt storage boundary](../actual-gmail-receipt-2026-10-15/REPORT.md). A diagnosztika után a Codex elkészítette az egyetlen privát tesztreceiptre kötött, alapból zárt szerveradaptert, a meglévő API/runtime bekötését, az explicit Writer-gombot és az install/rollback SQL-jelöltet. A frissen érintett backend/UI célzott végső futása **16 PASS / 0 FAIL / 0 SKIP**; a controller módosítása miatt indokolt korábbi futásban a 6 új UI-ellenőrzés mellett a 13 meglévő controller-ellenőrzés is sikeres volt. Ezek átfedő futások, nem összeadandó tesztösszegek. A koordinátor a forrást a pontos távoli 77cf HEAD-del vetette össze. Nincs alkalmazott felhős sémaátírás, bekapcsolt privát receipt vagy jogosultságbővítés. Kódba személyes feladó, tényleges RFC-fejléc vagy privát receipt nem kerül.

## Nyitott V1-hiányok

1. Egyetlen, privát konfigurációval pontosan rögzített Gmail-tesztlevél eredethű szerveres fogadása. Az általános feladóvédelem oldása vagy szintetikus alias nem elfogadható megoldás.
2. A valódi levélre épülő Writer → Reader → ismételt feldolgozás bizonyítéka.
3. A teljes magyar fordítás nincs bekötve a képeken látható valódi Gmail-útvonalon. A zárt minták magyar ellenőrző szövege nem általános fordítómotor-bizonyíték.
4. Az EN levél 8 felnőttet ad meg, de a canonical rekordban a total `guests` null, gyermekre rákérdezés és hiányjelzés jelenik meg. Ez a jóváhagyott szabállyal összevetendő eltérés; a védett üzleti szabályokat és renderert most nem módosítottuk.
5. A levél Oct30–Nov1 időszakára nincs igazolt kapacitás vagy ár. Korábbi fixture-kapacitás/ár nem használható hozzá; foglalási ajánlat jóváhagyása továbbra is tiltott.
6. Élő Previo-művelet addig nem indítható, amíg az átmeneti készletzárolás hiánya nincs dokumentáltan igazolva. Élesítés nem engedélyezett.

A V1 készültsége **90–92% mérnöki becslés**, nem automatizált lefedettségi mutató. A fenti integrációs és fordítási hiányok miatt nem tekinthető éles bevezetésre késznek.

## Mentések – tényleges megőrzés és integritás

A mentési workflow-kban `retention-days: 7` szerepel. A GitHub artifact API október 15-i válasza szerint:

| Artifact | Lejárat UTC | Europe/Budapest | Állapot |
|---|---|---|---|
| sarberki-fresh-full-recovery-38417777616 | 2026-10-20 14:57:52 | október 20. 16:57:52 | nem járt le |
| sarberki-test-encrypted-38457118999 | 2026-10-20 19:45:35 | október 20. 21:45:35 | nem járt le |
| sarberki-fresh-isolated-restore-38457118999 | 2026-10-20 19:45:34 | október 20. 21:45:34 | nem járt le |

A két külön megőrzött csomag a tartós fájltárban megtalálható; helyi példányaik ZIP CRC-je hibátlan:

- `Sarberki_Separate_Approver_Verified_Backup_2026-10-13.zip`, 88309 byte, SHA-256 `b8f970df4997dfc8646758ec45bf40bc9af6e5c616fa02676e076d17321803ec`.
- `Sarberki_PreApproval_Verified_Backup_2026-10-13.zip`, 81666 byte, SHA-256 `d25ce75bb81d9b5919c796a51f2107e52c17e5623a786254b4c7d5e74e545544`.

A külön encrypted ZIP hash-e `0f51d6d8c2bf33d37248129286b9838bdcb72a643e4aaa2358b6a02339875fe5`, egyezik az artifact API digestjével. A benne lévő három ciphertext SHA256SUMS értéke most is egyezik. A `38457118999` eredethez kötött restore-jelentés 46 tábla payload-egyezését, teljes izolált PostgreSQL restore-t, role/sequence/manifest/RLS ellenőrzést és hordozható visszafejtést igazol. Ennek a külön restore-nak `auth_api_login=NOT_RUN`; nem tulajdonítunk neki új Auth API-belépési próbát.

Az exportkor írt STATUS.txt még nem ismerte a később elkészült restore/tartós másolat eredményét; a külön provenance-kötött restore JSON és a csomaghash a későbbi bizonyíték. Ma nem fejtettük vissza ismét az adatbázist, és nem állítottunk helyre forrásprojektbe. A tartós példányok meglétét és a helyi bytes integritását ellenőriztük; a tartós tárolóból ma új letöltéses byte-összevetés nem történt.

### Lejárat előtti pótlás konkrét rendje

Legkésőbb október 18-ig, illetve bármely szükséges DB-migráció ELŐTT készüljön új, test-project-refhez és commit/runhoz kötött, titkosított, read-only snapshot a meglévő export + izolált restore eljárással. Csak mindkét ellenőrzés sikere után tekinthető új helyreállítási pontnak. A ciphertextet, checksumot és külön restore/provenance jelentést egy új dátumozott tartós csomagban kell megőrizni és visszaolvasással ellenőrizni. A régi csomagokat megtartjuk. Régi artifact újrafeltöltése nem friss adatbázismentés.

A kezdeti audit nem indított új exportot vagy teljes CI-t. A később elkészült írási/API-határ jelöltjének tesztági commitja a meglévő backup-triggerrel friss exportot és a repó szokásos CI-ellenőrzését kérheti; ezt a DB-telepítés előfeltétele indokolja. E jelentés írásakor a friss run eredménye még nem igazolt. Ismétlődő automatizmus vagy retention-beállítás-módosítás nem készült. A lejáró artifactok nem az egyetlen megőrzött másolatok.

## Következő konkrét döntési pont

A pontos Gmail-receipt fogadásához az adatbázis meglévő szintetikus határának szűk, egyetlen levélre kötött kiterjesztése szükséges. Az előkészített javaslat megőrzi a Writer-jogot, tenant/RLS-t, CAS-t, üzenetkulcsot és auditot, és nem enged jóváhagyást ismeretlen kapacitással/árral. Nem kér általános Gmail-feladóengedélyt vagy admin/service-role alkalmazásjogot. Telepítés előtt a konkrét módosítás, célzott negatív tesztek, friss mentés és az érintett sarberki-test projektazonosítás kötelező. E szakasz önmagában nem jelent DB-kapu aktiválási jóváhagyást.

Takarékosság: helyben csak az új diagnosztikai/backend/UI tesztek és a közvetlenül módosított controller 13 régi ellenőrzése futott. A teljes 1472-es csomag helyben nem ismétlődött; a négy nyelv emberi jóváhagyása sem ismétlődött. A szokásos tesztági CI egyszeri futását az új tárolási/API-határ módosítása indokolja, nem pusztán az állapotfelmérés. Production/main, e-mail-küldés, Pushover-küldés és Previo-írás nem történt.
