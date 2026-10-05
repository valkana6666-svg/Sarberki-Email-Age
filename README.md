# Sárberki érdeklődéskezelő – tesztág

Kizárólag `gmail-test-subject-allowlist`; tesztoldal:
https://leafy-chimera-2403e5.netlify.app/
A `main` és a külön éles Netlify projekt nem része a munkának.

## Gmail, csak olvasás

Böngészős Google Identity Services token-popup, kizárólag `gmail.readonly`.
A nyilvános OAuth client ID az `index.html` meta mezőjében van; ehhez az
útvonalhoz nem kell Netlify client secret vagy szerveroldali callback.
Az engedélyezett JavaScript origin a tesztoldal HTTPS originje.
A Google Console origin- és tesztfelhasználó-listája külön adminisztratív
ellenőrzést igényel; a popup megnyílása önmagában nem igazolja az engedélyt.
Az access token csak memóriában marad, nem kerül GitHubba vagy localStorage-ba.

A `gmail-policy.mjs` profil-ellenőrzése minden levéllistázás előtt megköveteli
a `sarberkiprojecttest@gmail.com` fiókot. Másik fiókból levél nem olvasható.
Keresés: `in:inbox after:2026/09/25`.
Nincs feladó- vagy tárgy-allowlist: a tesztfiók bármely új Inbox-levele feldolgozható.
A helyi kapu az INBOX címkét és a dátumhatárt ellenőrzi, valamint minden olvasás előtt
kötelezően ellenőrzi, hogy a megnyitott fiók pontosan a `sarberkiprojecttest@gmail.com`.
A feldolgozás közös `sarberki-core.mjs` segédfüggvényeken és ugyanazon
kezelői `extract` útvonalon fut a kézi és Gmail-forrásból is.

Élő OAuth → levél → kezelői rekord ellenőrzés még szükséges. 2026.10.03-án
az elérhető Google-fiókválasztó csak a feladói fiókot mutatta; a tesztfiók
belépésénél a kezelő közreműködése szükséges. Nem kértünk vagy fogadtunk el
új engedélyt automatikusan. A Gmail connector saját kapcsolata nem helyettesíti
a tesztoldal OAuth-ját.

## Pushover értesítés

A tesztoldal böngészős Gmail-figyelése a bejelentkezés után kb. 60 másodpercenként
ellenőrzi a tesztfiók Inboxát, és az új üzenet azonosítóját a
`/api/pushover-gmail` tesztoldali Netlify-funkciónak adja át. A funkció újra
ellenőrzi a Gmail-fiókot és az INBOX címkét, a feladót/tárgyat pedig kizárólag
a Gmailből olvassa ki; tetszőleges kliensoldali értesítésszöveg nem küldhető be.
A Pushover API-token és user key csak Netlify környezeti változó marad.

Fontos korlát: ez a böngészős figyelés csak addig működik, amíg a tesztoldal
nyitva van és az ideiglenes Gmail OAuth access token érvényes. Ez még NEM
háttérben futó, oldalfüggetlen értesítés.

Az oldal bezárása melletti azonnali értesítéshez jelenleg a legegyszerűbb
tesztmegoldás a Gmail automatikus továbbítása a Pushover saját `@pomail.net`
gateway-címére. A gateway közvetlen tesztje sikeres volt. A Gmail-fiókszintű
továbbítás bekapcsolása azonban Google-fiók beállítás és ellenőrzés, ezért azt
nem a repó kódja végzi. Hosszabb távú szerveroldali megoldásként Gmail push /
Google Cloud Pub/Sub + Sárberki backend + Pushover API használható külön OAuth-
és infrastruktúra-beállítással.

## Ár és kapacitás

A tesztoldal `/api/price-quote` Netlify-funkciója a külön teszthosthoz kötött.
A `price-source/sarberki-public-booking.mjs` kizárólag anonim dátumkeresést,
occupancy és price kéréseket enged. A 3–4. foglalási lépés, ügyféladatok,
foglalási hash és nem engedélyezett redirect tiltott. A szolgáltató belső,
dokumentálatlan végpontjainak változása esetén hibával megáll.

Minden eredmény kezelői ellenőrzésre vár (`review_required`). A gyermekes
érdeklődés minden életkorát meg kell adni; végleges automatikus ajánlat nincs.
Több azonos típusú háznál az egységárak összege egyeztetett a teljes árral.
Vegyes háztípusok egy kérésen belüli árazása nem támogatott. Osztott A/B/C
esetén csak nyilvános referencia/kezelői ellenőrzés van, élő mapping nincs.
HUF mellett a hivatalos MNB-forrás sikeres válasza adja az EUR átváltást;
forráshiba esetén nincs kitalált árfolyam. A dézsa és kisállat külön díját
nem szabad ellenőrzött kiegészítő ár nélkül a Previo szállásárhoz adni.

2026.10.03-i élő referencia: 2026.10.16–18., Deluxe, 2 felnőtt:
4 szabad egység; szállás 120 000 Ft + IFA 2 200 Ft = 122 200 Ft.
MNB 2026.10.02.: 367,87 Ft/EUR; teljes ár 332,18 EUR.
Két Deluxe ház / 4 felnőtt: 244 400 Ft / 664,37 EUR.
Az élő ellenőrzés nem hoz létre foglalást és nem küld vendéglevelet.

## Ellenőrzés

`npm test`: helyi, hálózat nélküli mock/fixture tesztek (a HTTP források mockoltak).
`EXPECTED_COMMIT=<40 karakteres SHA> node tests/deployment-sync.mjs`:
pontos tesztági Netlify kiadás ellenőrzése.
`node tests/live-price-smoke.mjs`: külön, csak olvasási élő próba egy házra,
két házra egységár-egyeztetéssel és 7/11 éves gyermekekre kezelői státusszal.
Ez a parancs csak az auditált adapter és a kijelölt tesztoldal ellenőrzése
után futtatható. A CI élő próbája külön repository variable kapuhoz kötött.

Automatikus e-mail-küldés, foglalás és PMS-módosítás nincs.

## Projekt-dokumentáció

A fejlesztési döntések és külső kutatások külön dokumentumokban vannak, hogy a futó üzleti szabályok ne keveredjenek az architekturális mintákkal:

- [DAKTELA_TANULSAGOK.md](DAKTELA_TANULSAGOK.md) – mit tanultunk a Daktela nyilvános működéséből, és mit nem bizonyítottunk.
- [ARCHITEKTURA_DONTESEK.md](ARCHITEKTURA_DONTESEK.md) – a rendszer biztonsági és szerkezeti döntései, valamint azok indokai.
- [FORRASOK.md](FORRASOK.md) – Daktela, Previo és belső projektforrások bizonyítási szintekkel.
- [szabalyok.txt](szabalyok.txt) – a jelenlegi Sárberki üzleti és válaszadási szabályok.
- [PRICE_SOURCE_STATUS.md](PRICE_SOURCE_STATUS.md) – Previo árforrás, élő ellenőrzések és mellékhatás-biztonsági státusz.

