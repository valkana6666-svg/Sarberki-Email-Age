# Sárberki – központi foglalási szűrés és ügykezelés

2026. október 8. · Repository: valkana6666-svg/Sarberki-Email-Age · Ág: gmail-test-subject-allowlist.

A meglévő projekt továbbfejlesztése megtörtént és a tesztoldalon telepítve van. A main és a production rendszer nem változott. Valódi e-mail-küldés, foglalás létrehozása vagy Previo-adatmódosítás nem történt.

**Eredmény: 670/670 automatikus teszt sikeres.** Az új központi működés tesztági fejlesztési alapként használható. Ez nem teljes körű bizonyíték minden dátumra vagy konkrét fizikai apartmanra, és nem engedély automatikus vendéglevél-küldésre. A további fejlesztésekhez kötelező kapu a hiteles kapacitás és a friss, felül nem bírálható jóváhagyás előtti ellenőrzés.

## A fejlesztési szakaszok eredménye

| Szakasz | Elkészült működés | Igazolás és határ |
|---|---|---|
| 1. Meglévő rendszer vizsgálata | Kapacitás-, válasz-, Gmail- és árútvonal áttekintése; visszaállítási alap rögzítése | A korábbi 638 tesztes verzió és auditjelentés megmaradt |
| 2. Központi szűrés | Elérhető / nem elérhető / nem igazolt státusz; vendégadatokhoz kötött eredmény; kapacitással össze nem férő típusok korai kizárása; választott típus elsőként | Automatikus negatív és útvonaltesztek; élő Deluxe-kérés |
| 3. Osztott apartmanok | A/B közös készlet; közelségi kikötés nélkül típusszintű ajánlat; C névleges 4 fő; A+C/B+C készletellenőrzés | Mock pozitív és negatív tesztek; élő A/B nulla, C kettő |
| 4. Egyetlen választervező | Meglévő központi tervező használata; publikus mag betöltésének felfüggesztése; kötelező friss kapacitás a belső jóváhagyás előtt | Böngészőben ellenőrzött tiltás; publikus kód és tesztek megőrizve |
| 5. Ügyösszekapcsolás | Thread ID, RFC Message-ID, In-Reply-To, References és kezelő által igazolt ügyazonosító; azonos feladó önmagában nem kapcsol össze | Automatikus levélkapcsolati tesztek; böngészős kézi ügyazonosító-próba |
| 6. Többlépcsős adatgyűjtés | Biztos adatok megőrzése; részleges gyermekéletkor-pótlás; csak a fennmaradó életkorra visszakérdezés; korábbi tervezetek és üzenetek tárolása | Második/harmadik levél és újratöltés tényleges böngészős próbája |
| 7. Optimalizálás és regresszió | Közös kliens, azonos kérések összevonása, 120 másodperces releváns cache; árkérés kapacitáskapu mögött a böngészőben és a Netlify-függvényben | 670/670 teszt; célzott mérési példák alább |

Az ügykezelés jelenlegi tárolója **a kezelő böngészőjének helyi tárolója**. Oldal-újratöltésen át megőrzi az ügyeket; nem központi, több eszközön megosztott adatbázis. Ez a szakasz működő első megvalósítása, nem többkezelős, szerveroldali CRM.

## Kapacitásellenőrzés működése

A booking-filter.mjs a biztos dátumot, vendéglétszámot, felnőttszámot, háztípust, egységszámot és elhelyezési feltételeket kapacitáskérésre alakítja. A facts állapot ismert, hiányzó, ellentmondásos és pontosítandó értékeket különböztet meg. Ellentmondásos létszám nem válhat igazolt pozitív eredménnyé.

A kapacitásvégpont először a kért egész háztípust ellenőrzi. Ha az igazoltan megfelelő, nem kér le fölösleges alternatív típusokat. Ha nem megfelelő vagy nem igazolt, a megengedett alternatívák külön ellenőrizhetők. Árhoz a fallback kikapcsolt: csak a ténylegesen árazandó típus megfelelő készlete számít.

A forrásválasznak konzisztens státuszt és nemnegatív egész szabad darabszámot kell tartalmaznia; az esetleg visszaküldött dátum és típus nem térhet el a kéréstől. Nulla megfelelő készlet igazolt nem elérhető állapot. Sikertelen, hibás vagy ellentmondásos kérés nem igazolt állapot, nullának álcázás nélkül. A kizárások oka és az ellenőrzési bizonyíték megmarad.

A böngészős válasz kizárólag a központi állapotba kerülő ellenőrzött eredményből épül. Az árlekérés előtt kliensoldali kapu, a Netlify árfüggvényben pedig önálló szerveroldali kapu is működik. Nem elérhető vagy nem igazolt típushoz az árforrás/számítás nem indul el. Az osztott egységek publikus referenciaára továbbra sem élő személyre szabott Previo-ár.

Belső jóváhagyás előtt a rendszer cache nélkül új kapacitásellenőrzést indít. Negatív eredmény vagy hiba érvényteleníti a korábbi pozitív ajánlatot és árat; ezt a kézi felülbírálás sem kerülheti meg. A frissített pozitív tervezet újbóli megtekintést/jóváhagyást kíván. A jóváhagyás nem küld levelet és nem foglal.

## Osztott házak

A 7–10-es házak A és B egységei a közös kétszemélyes készletből, C egységei külön négyszemélyes készletből ellenőrizhetők.

- Két A/B apartmanhoz két szabad egység elegendő, ha nincs közelségi kikötés. Különböző fizikai házakból is választhatók. Ugyanazon ház A+B párosa előnyben részesített, de a nyilvános adatok nem bizonyítják, hogy a páros rendelkezésre áll.
- Kifejezett egymás melletti, közös házas vagy konkrét egységigénynél a készlet önmagában kevés: az eredmény nem igazolt, emberi egyedi ellenőrzés szükséges. A rendszer nem ígér szomszédságot.
- Egy C egységhez egy szabad C elegendő, konkrét házszám megnevezése nélkül.
- A+C/B+C kombinációhoz mindkét készlet szükséges darabszáma külön igazolandó. Közelségi kikötés hiányában külön házak megengedettek.
- A belső jelölt egységlisták tervezési minták; nem valóban szabad konkrét apartmanok listái. Egyedi szabad egység-ID és tényleges párosítás továbbra sem áll rendelkezésre.

## Újabb levelek és újraszámítás

A booking-cases.mjs tárolja az ügyazonosítót, feladót, kapcsolódó üzeneteket, ismert/hiányzó adatokat, aktuális ellenőrzéseket, időpontokat és korábbi tervezeteket. Bizonyítható thread- vagy levélhivatkozás esetén ugyanahhoz az ügyhöz kapcsol. Ütköző hivatkozások vagy csak azonos feladó esetén nem olvaszt össze: külön ügyet és ellenőrzendő jelölteket hoz létre. A kezelő a felületen megadott, igazolt korábbi ügyazonosítóval kapcsolhat.

Részleges válasz kiegészíti a korábbi biztos adatokat. A gyermekek 7, majd 11 éves korának megadása két külön levélben kitölti a két hiányzó életkort; az első pótlás után csak a második gyermek életkorára kérdez vissza. Egy teljes életkorlista felülírja a korábbi listát. Összetett, szöveges életkor-korrekciók esetén kezelői ellenőrzés továbbra is szükséges.

| Változás | Érvénytelenítés |
|---|---|
| Telefonszám | Megmarad a releváns ár és kapacitás; a telefonszámkérdés eltűnik |
| Gyermekéletkor | Az ár újraellenőrzendő; változatlan vendégszám mellett a releváns kapacitás megmaradhat |
| Érkezés/távozás | Korábbi kapacitás és ár érvénytelen |
| Létszám | Kapacitás és ár érvénytelen; összetételi ellentmondás külön kezelendő |
| Háztípus/egységszám/elhelyezési feltétel | Érintett kapacitás és ár érvénytelen |
| Végső belső jóváhagyás | Mindig friss külső kapacitásvizsgálat |

A dézsaigény és ismert kiegészítő információk megmaradnak. Az ismeretlen dézsadíj és ajánlatba foglalás önmagában nem akadályozza a faháztervezetet. Dézsát a rendszer ellenőrzés nélkül nem nevez elérhetőnek; külön díjas szolgáltatásként kezeli.

## Automatikus tesztek

Parancs: npm test. Végső eredmény: **670 teszt, 670 PASS, 0 FAIL, 0 kihagyott**. A korábbi alap 638 teszt volt; nettó 32 új teszt került be. A korábbi osztott szabályt rögzítő elvárások az új, felhasználó által meghatározott rugalmas szabályhoz igazodnak. Nem gyengült a konkrét vagy szomszédos elhelyezés bizonyítási feltétele.

A kért 22 forgatókönyvet a central-booking.test.mjs és case-ui.test.mjs célzott tesztjei fedik: VIP/Deluxe nulla; általános 4 fő + C; két A/B szabad egység közelség nélkül és azzal; ismeretlen/külön házas helyzet; egy C; A+C/B+C; forráshiba/ellentmondás; dátum/létszám változtatás; második/harmadik életkorválasz; thread és RFC-hivatkozás; új külön levél azonos feladótól; több ügy; bizonytalan kapcsolat; pozitívból negatív kapacitás; régi ár törlése; ismert adatok megtartása; kizárt típus árlekérésének kihagyása.

További tesztek: duplikált üzenet idempotens kezelése, tárolásból visszatöltés, párhuzamos kérések összevonása, négy nyelvű célzott életkorkérdés, konkrét típushoz tartozó fölösleges alternatívakérések elmaradása, közvetlen szerveroldali árútvonal kapacitáskapuja, telefonszámos második levél ármegőrzése, jóváhagyási tiltás az aktuális UI-eseménykezelőn keresztül.

A pozitív A/B, közelségi és A+C/B+C esetek kontrollált mock adatokon futottak. Nem igazolják, hogy az élő rendszerben a vizsgált időpontban vannak ilyen szabad egységek.

## Élő Previo-ellenőrzés

2026. október 23–25., 2 éjszaka, 4 felnőtt. Új olvasási próba 18:54–18:55 UTC között:

| Típus | Szabad egység | Bizonyítás szintje |
|---|---:|---|
| VIP | 0 | Típusszint |
| Családi | 0 | Típusszint |
| Deluxe | 0 | Típusszint |
| Osztott C | 2 | Külön C készlet, típusszint |
| Osztott A/B | 0 | Közös A/B készlet, típusszint |

A nyilvános Previo foglalási csatorna dátumhoz kötött kapacitásválaszai és az új szűrő eredménye egyeztek. A live-evidence.json tartalmazza a forráskérések útvonalát, HTTP-eredményét, dátumát és tartalmi SHA-256 lenyomatát. Foglalás nem történt. Ez egyetlen időszak pillanatfelvétele, nem általános, minden értékesítési helyzetre érvényes igazolás.

## Telepített böngészős ellenőrzés

Tesztoldal: https://leafy-chimera-2403e5.netlify.app/. A végső ellenőrzött build: **5e8c986**.

1. Deluxe-kérés: a ténylegesen foglalt Deluxe nem jelent meg szabadként; csak az igazolt osztott C került alternatívába.
2. Általános négyfős keresés: ellenőrzés után csak osztott C jelent meg szabadként.
3. Szomszédos A+B kérés: a nulla közös készlet miatt nem ajánlotta foglalhatóként.
4. Hiányzó gyermekéletkorral induló ügy: két felnőtt, két gyermek, dátum és Deluxe megmaradt a második/harmadik levélben; 7, majd 11 éves kor rögzült. Az első pótlás után csak egy életkort kért.
5. Oldal-újratöltés és telefonszámos további levél: ugyanazon ügyből visszatöltötte a dátumot, létszámot és 7/11 éves kort. Nem kérdezett vissza ezekre.
6. Belső jóváhagyás foglalt Deluxe esetén: a kezelői felülbírálás ellenére friss ellenőrzés után **Jóváhagyás tiltva**, a korábbi ajánlat érvénytelen. Levél nem lett elküldve.

Bizonyíték: browser-proof.json és approval-blocked.jpg. A böngészős többleveles próba kézi beillesztéssel, kezelő által igazolt ügyazonosítóval futott. Bejelentkezett Gmail-fiókból valódi többüzenetes levelezés beolvasása ebben a fejlesztésben nem történt; a Gmail-hivatkozási útvonalat automatikus tesztek igazolják.

## Mérhető optimalizálás

- Kontrollált próba: két egyidejű azonos ellenőrzés és egy friss, csak telefonszámban eltérő harmadik kérés összesen **egy** külső kapacitáskérést indított. Kettő a háromból elmaradt; egy összevonás és egy cache-találat mérhető.
- Konkrét, szabad Deluxe mock esetben a korábbi 6 típus/pool lekérése helyett csak 1 típus lekérése történt. Öt forráskérés elmaradt ebben az esetben.
- VIP/Deluxe nulla vagy nem igazolt kapacitásnál az árforrás hívásszáma 0, a böngészős és közvetlen Netlify-útvonal tesztjében is.
- Ezek célzott mérési eredmények. Teljes üzemi forgalomra, költségre vagy átlagos gyorsulásra nincs még mérés.

## Módosított fájlok

Új központi modulok: booking-filter.mjs, booking-runtime.mjs, booking-cases.mjs.

Meglévő működés: netlify/functions/availability-options.mjs, netlify/functions/price-quote.mjs, split-units.mjs, case-state.mjs, sarberki-core.mjs, availability-recommend.mjs, price-check.js, gmail-readonly.js, index.html, AGENTS.md.

Archiválási leírás: guest-reply/ARCHIVED.md. A külön publikus mag kódja megmaradt, a tesztoldal nem tölti be.

Tesztek: tests/central-booking.test.mjs, tests/case-ui.test.mjs, tests/availability-reply.test.mjs, tests/split-units.test.mjs, tests/split-physical-units.test.mjs, tests/fresh-gmail-e2e.test.mjs, tests/guest-reply-boundary.test.mjs, tests/price-quote-function.test.mjs, price-quote.test.mjs, intake-normalize.test.mjs, tests/live-availability-audit.mjs. Az élő próbának külön jelentési könyvtára lett, a korábbi auditbizonyítékot nem írja felül.

## Fennmaradó korlátozások és következő kötelező ellenőrzések

- Nincs automatikusan olvasható konkrét Previo-egységazonosító; szomszédos párosítás és pontos házigény csak egyedi emberi ellenőrzéssel igazolható.
- A helyi ügytároló nem többkezelős szerveroldali adatbázis. Más böngésző/eszköz nem látja automatikusan a korábbi ügyeket. Szerveroldali tárolás, hozzáférési szabály és megőrzési idő külön következő fejlesztés.
- Ugyanazon feladó új, külön szálú levele nem olvad össze dátumegyezés alapján sem. Az emberi összekapcsolás ügyazonosítóval működik; a jelöltlistához még készíthető kényelmesebb választófelület.
- Részleges életkorok sorrendben töltik a hiányokat. Bonyolult gyermekazonosítás vagy részleges korrekció külön pontosítást igényel.
- A+C/B+C típusszintű elhelyezés már ajánlható megfelelő készlettel. Vegyes egységek végleges személyenkénti kiosztása és összevont élő árajánlata nincs teljesen automatizálva; a vendégek egységenkénti megosztásának igazolása szükséges.
- Az új Gmail-ügykezelést még ellenőrizni kell a tesztengedélyezett, bejelentkezett fiók valódi második/harmadik levelein. A main/production útvonal ezen célból sem módosítható.
- A meglévő parser nem minden szöveges dátumkorrekciót tud egyértelműen értelmezni; az ellentmondó vagy hiányos korrekció kezelői pontosítást kíván.
- A nyilvános csatornán látható szabad készlet időben változik. A jóváhagyás előtti friss vizsgálat sem foglalja le az egységet, és nem garantálja a későbbi Previo-foglalás sikerét.

## Commitok és visszaállítás

Kiinduló javítás: 25b9fc268f83c36fdb90ee9ff212f9b0a8e450c1. Korábbi audit és visszaállítási alap: 25cb92257c087c6fdc9425eb05d5f4a734541906.

Új megvalósítás: **f8a3100c6b6cdf60aba1ae8f4a80fa64507024ec** – központi kapacitásszűrés, osztott logika, ügytároló, árkapu, válasz és tesztek.

Böngészős próbában talált régi előkészítő javítása: **5e8c986defb020bd64378cb64d0cf57825baba89** – ügyadat/ár megőrzés, elhelyezési feltételhez kötött jóváhagyási ellenőrzés.

Helyi visszaállítási tag: sarberki-before-central-filter-20261008, a 25cb922 commiton. Távoli visszaállításnál a két új kódcommit visszavonása új revert commitokkal, fordított sorrendben, kizárólag a tesztágon javasolt. Ne használj force push-t és ne módosítsd a main ágat. Az új ügytároló adatait rollback előtt exportáld, mert a régi verzió nem olvassa ezt a tárolót.

**Döntés:** a hiteles típusszintű szűrés és a tesztelt központi ügykezelés alkalmas a tesztági további fejlesztések alapjának. Teljes üzemi megbízhatóságot, egyedi apartmanpárosítást vagy általános automatikus ajánlatküldési alkalmasságot a jelen bizonyíték nem állít. A nem igazolt elhelyezés továbbra sem kerülhet foglalhatóságot állító ajánlatba.
