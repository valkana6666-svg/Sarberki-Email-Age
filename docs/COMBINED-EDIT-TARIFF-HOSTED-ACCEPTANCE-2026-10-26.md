# Összevont hosted átvétel – 2026-10-26

## Kiadás és bizonyítékhatár

Forrás: 76323e8abce159c4ee5a5b884fee9527d27658ca. Tartalmazza a 7d0c0bcb00d85b580c7c4a776aa2523ee0e35351 szerkesztési fejlesztést; GitHub compare merge-base ezt a commitot adta. A 40351799685 alkalmazás- és 40351799959 kapacitás-CI completed/success. A 2214 PASS a Codex jelentett száma; Work nem futtatta újra a teszteket.

Egyetlen szükséges kiadás: 179cd76247d8affe61db59c539f741cf7bfd8c09, változatlan forrásfával, [netlify-test-release] markerrel, expected_sha és force=false használatával. Work böngésző BUILD 179cd76, HTTP build-info.mjs teljes SHA pontosan egyezett. A restore buildkapu maradt always-skip; main/production nem változott. Nem történt második kiadás.

Későbbi HEAD 999d8127e0b39be31f0b84c113691f3d6ee621e3 kizárólag docs/OWNER-DECISION-2027-CHILD-PRICING-2026-10-26.md: gyermekár-döntés, nem implementáció. Nem indokol új deployt. Ez az átvételi jelentés külön dokumentációs commit lesz.

## Új böngészős árpróbák

Mindegyik referenciaár, nem kapacitás vagy végleges vendégár. Nincs kézi kapacitásigazolás vagy árjóváhagyás.

| Próba | Szállásösszeg | Minősítés |
|---|---:|---|
| Deluxe, 2027-05-10–12, 4 felnőtt | 126000 Ft | PASS böngésző |
| VIP, ugyanaz, 4 felnőtt | 126000 Ft | PASS böngésző |
| Családi, ugyanaz, 4 felnőtt | 110000 Ft | PASS böngésző |
| 15-ös, ugyanaz, 2 felnőtt | 63000 Ft | PASS böngésző |
| Deluxe, ugyanaz, 5 felnőtt | 146000 Ft | PASS böngésző: +10000/fő/éj |
| Deluxe, 2027-08-21–23, 4 felnőtt | 138600 Ft | PASS böngésző: mindkét éjszaka +10% |
| Deluxe, 2027-08-23–25, 4 felnőtt | 126000 Ft | PASS böngésző: normál időszak |
| Deluxe, 2026-12-31–2027-01-02, 4 felnőtt | 123000 Ft | PASS böngésző: 60000+63000 |
| Deluxe, 2028-05-10–12, 4 felnőtt | nincs | PASS böngésző: elutasítás, üres eredmény, approve disabled |

A 2028-as próba előző félbemaradt nézetének eredménye nem maradt meg, ezért csak ezt zártuk le friss lapon; a sikeres árpróbákat nem ismételtük.

Külön hosted POST /api/price-reference bizonyíték, NEM böngészős vendégfolyamat: splitA 2 felnőtt 2 éj 48000; splitC 4 felnőtt 2 éj 92000; Deluxe 2 felnőtt 2 éj is 126000 (négyfős alapár); 5 fő146000; aug21–23 138600; aug23–25 126000; évváltás123000; 2026nov10–12 120000; 2028 HTTP422 unverified végösszeg nélkül. Minden pozitív API-válasz referenceOnly=true, availability=not_checked, bookingCompleted=false.

A kézi árűrlap nem kínál külön splitA/splitB/splitC választót, csak általános Osztott kézi ellenőrzést. Ezek teljes UI-árfolyamata NEM IGAZOLT. A/B közös árszintből splitA végpontpróba és mindkét típus forrásértéke ellenőrzött; külön splitB hívás nem történt.

2026 BUSINESS és fishing-rules fájl a01e958a..76323e8a összehasonlításban változatlan: PASS forrásbizonyíték. A 2026-08-20 szezonhatár forrás/CI-bizonyíték; múltbeli vendégfoglalás böngészős kalkulációját nem állítjuk sikeresnek.

## Horgász/kemping forrásátvétel

A tulajdonosi PDF mindkét oldalát Libraryból közvetlenül olvastuk (libfile_7624b4fb6938819198b83917b0994695). A 2. oldal 24 normál/Rekord felnőtt/gyermek jegyösszege, 2 bérleti díja, 8 halára és 8 kemping/töltési összege egyezik a price-source/yearly-fishing-camping.mjs adataival: PASS forrásadat-ellenőrzés. Kiemelten a Rekord gyermek 24órás 5650 és heti24500 az eredeti PDF száma, nem százalékos becslés. A modul HTTP200-ként kint van (4360 bájt, SHA256 cf49adbf28b4de3bbe6ac27435a39a7473034dd49ba675a82c3db83d9d078674).

Ez nem bizonyít vendégfelületi bekötést vagy horgász/kemping végösszeget: NEM IGAZOLT. A PDF szezonfejléc-ellentmondását a tulajdonosi aug22 döntés oldja fel. A későbbi gyermekár-döntés dokumentált, futó implementációja nincs igazolva. IFA2027 joghatály, hetedik ajándékéj, kis ház3.fő és egyes külön díjak továbbra külön kapuk; a referenciát nem szabad biztos végárként kiadni.

## Konkrét hosted munkamenet-akadály

A tesztoldali biztonságos browserAuth bejelentkezés submitted eredményt adott. A látható UI ezután hitelesített tesztkezelői olvasást jelzett. Az első normál Szintetikus tesztügyek betöltése művelet azonban AUTH_REQUIRED hibára futott. Egyetlen normál Korábbi tesztbelépés ellenőrzése helyreállítási próba után a nézet általános bejelentkezési/jogosultsági hibát mutatott. Friss cloud-approval oldal Bejelentkezés szükséges állapotú, minden ügyírási/jóváhagyási mező tiltott.

Ez FAIL a megpróbált hosted login→ügylista/restore láncra, nem bizonyított konkrét cookie/config/Supabase gyökérok. HTTP401-et nem következtetünk az UI-kódból. Nem történt credential-, cookie- vagy secretkiolvasás, jogosultságváltoztatás, service-role vagy újabb belépési kör. A következő munkamenetben a böngészőlapok már nem maradtak fenn; a korábbi hibát nem nevezzük újonnan reprodukáltnak.

Megfelelő pending booking-review fixture hiányát a korábbi Codex read-only SQL igazolta; friss ügylistához az aktuális hosted belépés nem adott hozzáférést. Az egyetlen említett pending service_link_review ügy alkalmatlan. Az új fixture létrehozása a bejelentkezéstől függő, letiltott normál Writer gombon keresztül nem hajtható végre. Nincs új felhős ügy vagy tervezetírás. Zárt ügyet nem állítottunk vissza, privát registryt nem bővítettünk.

Writer edit/save→reload→Reader→független Approver teljes hosted lánc: NEM IGAZOLT. Új hosted Reader/same-editor/stale/hash/CSRF/tenant negatívok: NEM IGAZOLT; automatizált bizonyíték külön marad. A megvalósítás csak pending aktív serverApproval nélküli ügyet szerkeszt; jóváhagyott ügyet nem nyit újra. A jóváhagyás utáni új szerkesztés ezért jelenleg funkcionális korlát, nem végrehajtott PASS.

## Nyelvek, mentés, készültség

HU korábbi tárolt szöveg/v4pending/v3history/reload/clearing PASS megőrzött, nem ismételt. DE/EN/SL korábbi nyelvhelyes előnézet és approval/audit állapot bizonyíték megőrzött; tényleges tárolt tartalom új böngészős átvétele a munkamenet miatt NEM IGAZOLT. Gmail/HU tiltások kód- és CI-bizonyítéka megmaradt; az új kiadáson hitelesített negatív próba nem történt.

Okt27 08:00 export és 10:00 Drive Europe/Vienna még nem lefutott bizonyíték: NEM IGAZOLT. Nem indítottunk kézi helyettesítőt, mentési módosítást vagy automatizálást. Korábbi sikeres mentés/49táblás restore nem újraismételt.

V1 becslés85% marad. Új eredmény: pontos SHA-val kiadott build és ár/év/szezon forrás- és hosted/böngészős bizonyítékok. A kulcsfontosságú szerkesztés–független jóváhagyás browser elfogadása továbbra nyitott.

## Azonnal végrehajtható Codex hibafeladat

Alap a fenti kiadott SHA. Programfájlt Work nem módosított. Vizsgáld az operator-login-ui.mjs, sarberki-chatbot-project/operator-session.mjs, shared-core/operator-cookie-session.mjs, shared-core/cookie-json-request.mjs, netlify/functions/operator-session.mjs és booking-cases.mjs normál login→lista→restore útját. Bizonyítsd a hibakategóriát érzékeny értékek nélkül: csak végpont/action, HTTP státusz, fix hibakód és a szükséges fejlécek/cookie jelenlétének booleanja; ne naplózz Set-Cookie-t, Cookie-t, CSRF/JWT/refresh tokeneket, hitelesítő adatot vagy teljes törzset. Ne tételezd fel az okot pusztán AUTH_REQUIRED alapján, és ne lazíts Auth/CSRF/Host/SameSite/RLS/tagság kaput. Javíts csak bizonyított producer/config/runtime eltérést. Célzott teszt igazolja a login után tényleges protected list/restore folyamatot és negatív session határokat.

A fixture külön feladat: a tulajdonos engedélyezte a meglévő biztonságos úton új elkülönített szintetikus ügy előkészítését, de nincs szabad jogosult pending registry ügy. Adj pontos szűk fixture-azonosságot és létező jogosult Writer létrehozási útvonalat, duplikációvédelemmel, valódi Gmail/HU/lezárt ügyek érintése nélkül. Általános allowlist, SQL-grant vagy service-role nem megoldás. Work csak a működő munkamenet és használható fixture után folytatja a hosted szerkesztési láncot. Nem kérünk ismételt ártarifa-fejlesztést vagy automatikus újabb deployt.
