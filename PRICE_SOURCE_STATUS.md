# Sárberki nyilvános árforrás – technikai állapot (2026-09-28)

## Jelenlegi kapu és bizonyítási határ

- **Nincs hivatalos Previo API-hozzáférésünk.** A vizsgált végpontok a nyilvános Reservation+ foglaló dokumentálatlan belső kérései, nem az előfizetéses Previo XML/REST API. A tesztági kód `SARBERKI_PREVIO_NO_HOLD_CONFIRMED=true` nélkül **a Previo meghívása előtt** összeg nélkül áll meg. A Netlify környezeti változóinak és az új deploy futásának közvetlen ellenőrzése még nincs meg; a kapcsolót nem szabad bekapcsolni.
- A felhasználó a korábbi próbák után manuálisan ellenőrizte a PMS-t: **nem volt látható új foglalás**. Az átmeneti, esetleg lejárt kapacitászárolás hiánya **nem bizonyított**. További élő Previo-kérés nem indult a biztonsági audit során.
- A kód- és Git-történetben az adaptert a `dcce2c34` commit vezette be, a `de4b6c5e`/`c8a19405` javította a Netlify-függvény hívását, az `ad87cd4a`–`2ec3cff4` sorozat zárta le alapértelmezetten a kaput és tiltotta le a régi böngészős kattintást. A későbbi validáció személyes és ismeretlen mezőket, útvonalakat és átirányításokat tilt. A repóban nincs foglalást véglegesítő endpoint hívás.

| Kérés/lépés | Kódból és korábbi megfigyelésből igazolt cél | Foglalási mellékhatás státusza |
|---|---|---|
| `GET /?hotId=753011...` | Anonim `PHPSESSID` és első dátuműrlap | Nincs bizonyított foglalás; szerveroldali session-nyom lehet |
| `POST /` törzs `step=1`, `arrival`, `departure` | Dátumkeresés; 302/303 után `GET /index/step-2/`, válaszban `PageParams` | **Átmeneti hold/lock hiánya nem igazolt** |
| `POST /index/get-object-kind-occupancy/` | Kiválasztott `obkId` szabad egységei, JSON-válaszba ágyazott HTML | **Átmeneti mellékhatás hiánya nem igazolt** |
| `POST /index/get-occupancy-price/` | Vendégkategóriákra számított `totalPrice`, `totalTaxes`, `unknownPrice` JSON | **Átmeneti mellékhatás hiánya nem igazolt** |
| UI „Foglalás” választó, későbbi lépések | A korábbi böngészős útvonal ilyen feliratú választót nyitott; most letiltott. Az adapter nem küld ilyen műveletet, vendégadatot, lépés 3–5 kérést vagy megerősítést. | A tényleges mentő endpoint neve és az esetleges előzetes zárolás kezdete nyilvános dokumentációból nem azonosítható |

A Previo nyilvános leírása különíti el a dátum/szoba választását a későbbi lépésektől, és a teljes foglalási folyamat befejezése után említi a visszaigazolást és a naptárba mentést. A leírás **nem ad endpointonkénti mellékhatás-garanciát**. Források: https://help.previo.app/en/doc/booking-of-services/ és https://help.previo.app/en/doc/basic-settings-new-r/ . A hivatalos API hozzáférése külön szolgáltatás: https://help.previo.app/en/doc/api-access/ . A célzott kérdések a `PREVIO_SUPPORT_QUESTIONS.md` fájlban vannak.

## Foglalásmentességi biztonsági audit – 2026-09-28

**NOT YET VERIFIED (Previo/PMS oldali hatás):** A nyilvános belső végpontokhoz nincs olyan Previo-dokumentáció vagy PMS naplóhozzáférés, amely kizárná az első dátumos `POST /?step=1&arrival=...&departure=...` művelethez kapcsolódó átmeneti foglalási vagy kapacitászároló rekordot. A válasz a második, keresési lépés HTML-je, benne dátummal, háztípusokkal és vendégkategóriákkal; az eddig megfigyelt válaszban nem volt foglalási azonosító vagy véglegesítési visszaigazolás. Ez a kliensoldali megfigyelés **nem bizonyítja** a szerveroldali mellékhatások hiányát.

**Új kézi megfigyelés:** A felhasználó a teszt után ellenőrizte a Previót, és nem látott új foglalást. Ez a látható foglalási rekord hiányát erősíti meg, de a rövid ideig élő, már lejárt zárolás vagy belső keresési rekord hiányát önmagában nem bizonyítja. A kapu ezért változatlanul zárva marad.

- A Netlify és a helyi ár-végpont alapértelmezésben **503, összeg nélkül** válaszol, és egyáltalán nem hívja a Previót. Csak kifejezett, Previo/PMS oldali foglalásmentességi igazolás után beállított `SARBERKI_PREVIO_NO_HOLD_CONFIRMED=true` kapcsoló engedélyezi. A kapcsolót jelenleg ne állítsuk be.
- A megőrzött adapter kizárólag `GET /`, `GET /index/step-1/`, `GET /index/step-2/`, `POST /` (`step=1`, csak dátumok), `POST /index/get-object-kind-occupancy/` és `POST /index/get-occupancy-price/` útvonalakat enged. Csak a `booking.previo.cz` origin és `hotId=753011` engedélyezett. Az átirányításokat nem követi automatikusan; a dátumkeresés után kizárólag 302/303 → `GET /index/step-2/` megengedett. Más útvonal, 307/308 vagy megváltozott form action esetén megáll. Az adapter nem küld nevet, e-mailt, telefont vagy fizetési adatot.
- A korábbi helyi `fetchQuote` Playwright-útvonal a felületi „Foglalás” feliratú választóra kattintott; ezt letiltottuk. A helyi HTTP szerver is a fenti, alapértelmezetten letiltott adapterre mutat. A korábbi UI-validálás során a „Foglalás” opciót és a vendéglétszám „Mentés” gombját megnyomtuk a 2026-10-16–18. időszakhoz, de a 3–4. lépésre, vendégadatokra, megerősítésre vagy fizetésre nem léptünk tovább. A háttérben esetleg keletkező ideiglenes rekordot PMS hozzáférés nélkül nem lehet kizárni.
- Korábbi tesztidőpontok: 2026-10-16–18. Deluxe 2 felnőtt; Deluxe 2 felnőtt + 7 és 11 éves gyermek; Családi 2 felnőtt. A 2026-10-16–19. időszak a helyi automatizált tesztekben is szerepel; a rendelkezésre álló kód és tesztkimenet alapján ezek mock/validációs esetek, de teljes Previo szervernapló híján a korábbi munkameneteket önmagukban nem zárhatjuk ki. PMS-ben a foglalási naptár, a foglaláslista, a függő/option és a hozzá nem rendelt várólista nézetében a dátum, típus és 2026-09-28-i létrehozási idő alapján kell ellenőrizni a Reservation+ eredetű rekordokat. Törölni/sztornózni csak egy konkrét, azonosított tesztrekord esetén, kezelői döntéssel szabad; jelenleg nincs bizonyítottan létrejött rekord.
- A következő feloldási feltétel a Previo írásos technikai válasza vagy a szálláshely PMS auditnaplója: a `step=1`, occupancy és price kérések sem foglalást, sem option/hold vagy várólistás rekordot nem hoznak létre, és a fenti korábbi időpontokra sincs tesztből keletkezett rekord. Addig további élő Previo-teszt nem indul.

### Korábbi próbák pontos bemenete

**A Previónak egyetlen nevet sem adtunk meg.** A „Teszt Elek” név és a `+36 30 555 1234` telefonszám az e-mail agent szintetikus vendéglevél-tesztjében szerepelt, nem került az árlekérő JSON-jába vagy a Previo-foglaló vendégadat-mezőibe. E-mail-cím, fizetési adat, cím és megjegyzés sem ment át.

Az éles Netlify `POST /api/price-quote` próbák rögzített JSON törzsei:

```json
{"arrival":"2026-10-16","departure":"2026-10-18","cabin":"deluxe","adults":2,"children":[]}
{"arrival":"2026-10-16","departure":"2026-10-18","cabin":"deluxe","adults":2,"children":[7,11]}
{"arrival":"2026-10-16","departure":"2026-10-18","cabin":"family","adults":2,"children":[]}
{"arrival":"2026-10-16","departure":"2026-10-18","cabin":"deluxe","adults":2,"children":[7]}
```

Hiányos kérés próbája: `{"departure":"2026-10-18","cabin":"deluxe","adults":2,"children":[]}`. Ezt a validátor Previo-hívás előtt elutasította. A 2026-10-16–19. dátumok a rendelkezésre álló automatizált tesztben mock/validációs adatok; nincs igazoltan elküldött élő Previo-payload ehhez az időszakhoz. A hivatalos foglalói UI-ban a 2026-10-16–18. dátumot, a fenti Deluxe/Családi típust, 2 felnőttet és a gyermekes esetben a 3–7 és 8–17 éves korcsoportban 1–1 gyermeket választottunk, majd az összesítőt néztük meg. A 3–4. lépésre nem léptünk.

Az adapter a JSON-t kizárólag `step=1&arrival=2026-10-16&departure=2026-10-18` dátumos űrlappá, majd a munkamenetből kiolvasott `obkId`, `guaId` és anonim vendégkategória-darabszámokat tartalmazó kapacitás-/árkéréssé alakította. A gyermekszám és életkorok a Previo kategóriákba kerültek, a gyermekek neve nem. A kérésvalidátor most elutasítja az idegen mezőket, köztük a név, e-mail, telefon, fizetés és foglalásazonosító mezőket; az adapter az ismeretlen query paraméterrel érkező redirectet is elutasítja.

## Igazolt folyamat

1. A `https://sarberkito.hu/foglalas/` oldal a `https://booking.previo.cz/?hotId=753011&lang=hu&currency=HUF...` iframe-et tölti be. A Previo `PHPSESSID` munkamenetet állít be. A keresést a foglaló első lépése `POST` űrlappal indítja: `step=1`, `arrival=YYYY-MM-DD`, `departure=YYYY-MM-DD`.
2. A második lépés HTML-jében a `PageParams` adatmodell tartalmazza a `RESERVATION_DETAILS.from/to`, `OBJECT_KINDS` és `GUEST_CATEGORIES` mezőket. Példa: Deluxe `obkId=766439`; felnőtt `guaId=254357`; gyermek 8–17 `255813`, 3–7 `254359`, 0–2 `255815`. Ezeket minden munkamenetben a válaszból kell kiolvasni.
3. `POST https://booking.previo.cz/index/get-object-kind-occupancy/` ugyanazzal a munkamenettel, `hotId`, `currency`, `lang`, `obkId`, `newDesign=1` adatokkal JSON-t ad: `success`, `html`. A HTML űrlap `data-numOfFreeRooms` attribútuma a keresett típus szabad egységeinek száma. A második lépés `OBJECT_KINDS.numOfFreeRooms` értéke ebben a próbában 0 volt, miközben az élő foglaló és az occupancy végpont 4-et jelzett.
4. `POST https://booking.previo.cz/index/get-occupancy-price/` ugyanazzal a munkamenettel `formData` JSON-t kap. Ebben `obkId`, egy `rooms` elem és a `guestCategories` `{guaId,count}` értékei szerepelnek; az ágyat igénylők száma `numOfGuestsWithBed`. Válasz példa: `{"success":true,"totalPrice":122200,"totalTaxes":2200,"totalRequiredServices":0,"unknownPrice":false}`. A `totalPrice` a Previo számítása.

## Élő ellenőrzés

- **VERIFIED LOCAL / VERIFIED NETLIFY / VERIFIED UI MATCH** – 2026-10-16–18., Deluxe, 2 felnőtt: 4 szabad egység, 122 200 Ft teljes ár, ebből 2 200 Ft IFA. A Netlify `POST /api/price-quote` HTTP 200 válasza és a hivatalos Sárberki foglaló mentett, 2 fős összesítője egyaránt 122 200 Ft.
- **VERIFIED LOCAL / VERIFIED NETLIFY / VERIFIED UI MATCH** – ugyanaz az időszak, Deluxe, 2 felnőtt és 2 gyermek (7, 11 éves): 4 szabad egység, 122 200 Ft, ebből 2 200 Ft IFA. A Netlify JSON `children:[7,11]` mezőt adta vissza. A foglalóban 2 felnőtt, 1 gyermek a 3–7 és 1 gyermek a 8–17 korcsoportban, 1 ház szerepelt; a mentett összesítő 122 200 Ft. Az életkorok a Previo korcsoportazonosítóival mentek át, nem saját árkorrekcióval.
- **VERIFIED LOCAL / VERIFIED NETLIFY / VERIFIED UI MATCH** – ugyanaz az időszak, Családi, 2 felnőtt: 3 szabad egység, 106 200 Ft, ebből 2 200 Ft IFA. Új foglalói munkamenetben 1 ház, 2 fő mentett összesítője 106 200 Ft.
- A Netlify funkció első telepített próbája HTTP 503 `source is not a function` hibával állt le: a Netlify a második argumentumban futtatási kontextust ad át, amelyet a korábbi default export tesztadapterként kezelt. A default export most csak a Requestet továbbítja; a fenti három HTTP 200 végpontválasz ezt az útvonalat, a kimenő HTTPS kapcsolatot, a redirectet és a Previo munkamenet továbbadását a referenciaesetekben igazolja. A build és function loghoz közvetlen hozzáférés nem állt rendelkezésre.
- A listanézet 120 000 Ft minimum szállásárat mutatott, de az nem teljes végösszeg. A létszámválasztó kezdetben 4 felnőttet tett a Deluxe házba, ezért a 2 felnőttes összeget csak a létszám módosítása és mentése után lehetett összevetni.

## Integráció és korlátok

- A `price-source/sarberki-public-booking.mjs` külön, kapacitás- és árlekérő adapter. A Netlify `price-quote` funkció csak a fenti foglalásmentességi kapu feloldása után hívhatja. A kezelő az eredményt elkülönítve jelenítené meg, és a vendéglevélbe csak külön emberi árjóváhagyás után kerülhetne összeg. Hibás válasz, ismeretlen ár, hálózati hiba vagy zárt kapu esetén `HITELES ÁRLEKÉRÉS SZÜKSÉGES` marad.
- A Previo végpontok a foglaló belső, dokumentálatlan végpontjai. Munkamenet kell hozzájuk, az árvégpont önmagában nem igazolja a kapacitást. A böngészőből a Previo saját iframe-originjén hívhatók; a Sárberki oldal JavaScriptje közvetlenül nem olvashatja a másik origin válaszát. A szerveroldali hívás helyben és a Netlify tesztkörnyezetben reprodukálható volt. A három Netlify referenciahívás 11–17 másodperc alatt válaszolt; folyamatos rendelkezésre állás és a ritkább timeout nem igazolt.
- A tesztági kezelő pontos gyermeklétszámot és minden gyermekhez 0–17 közötti egész életkort kér; hiány vagy eltérés esetén nem kér le vagy nem fogad el árat. A gyermekes élő ár is csak függőben lévő ajánlat a kezelőben, külön emberi árjóváhagyás és végső levéljóváhagyás szükséges. A több házas és osztott egységes esetek **NOT YET VERIFIED**, ezért nem engedélyezettek.
- **NOT YET VERIFIED** – hosszú távú Netlify/Previo stabilitás, build/function log és szerződéses API-garancia; a dokumentálatlan belső API bármikor változhat. Timeout, hibás JSON, `unknownPrice`, 0 kapacitás és részleges válasz továbbra is összeg nélküli hibastátuszt eredményez.
- A jelenlegi végpont nem szerződéses vagy garantált API; a Previo változtathatja. A Previo hivatalos, olvasási API-ja hosszabb távon előnyösebb csereadapter.
