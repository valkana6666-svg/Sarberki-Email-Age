# Sárberki – fejlesztési zárójelentés és aktuális állapot

Dátum: 2026. október 8. Repository: `valkana6666-svg/Sarberki-Email-Age`. Munkavégzés kizárólag a `gmail-test-subject-allowlist` tesztágon. A main és a production rendszer nem módosult. Nem küldtünk valódi vendéglevelet és nem hoztunk létre vagy módosítottunk valódi foglalást.

## Vezetői megállapítás

A központi kapacitásszűrésre ellenőrzött tesztkörnyezetben alapozható a további fejlesztés. A teljes, több levélen és több kezelőn át működő rendszer éles használatra kész voltát még nem igazoltuk. A foglalhatóság csak a lekérdezés időpontjára és feltételeire vonatkozik; nem jelent foglalási garanciát vagy konkrét apartman hozzárendelését.

## Szakaszok és megvalósított működés

| Szakasz | Állapot | Igazolt eredmény |
|---|---|---|
| 1. Meglévő rendszer ellenőrzése | Elvégezve a tesztágon | Kapacitás, központi válaszoló, külön válaszmag és Gmail-feldolgozás felülvizsgálata |
| 2. Központi szűrés | Megvalósítva, tesztelve | Elérhető / nem elérhető / nem igazolt státusz; a konkrét típus kérése sem kerüli meg az ellenőrzést |
| 3. Osztott apartmanok | Megvalósítva, automatikusan tesztelve | Készletszintű A/B/C kombinációk, közelségi feltétel külön kezelve |
| 4. Központi választervező | Megvalósítva a vizsgált útvonalakon | Ellenőrzött szűrési eredményből készül a tervezet; a külön válaszmag megőrizve, továbbfejlesztése felfüggesztve |
| 5. Ügyösszekapcsolás | Részben kész | Böngészős ügyállapot, Gmail thread és RFC-hivatkozások; közös szerveroldali ügytár még nincs |
| 6. Többlépcsős adatgyűjtés | Részben kész | Ismert adatok megtartása, életkorok pótlása, változások miatti érvénytelenítés; minden lehetséges nyelvi módosítás nincs lefedve |
| 7. Optimalizálás és tesztelés | Jelenlegi változtatásokra elvégezve | 710/710 automatikus teszt; élő kapacitás és telepített böngészős kritikus esetek külön ellenőrizve |

### Kapacitásszűrés és árak

A bizonyítottan nem foglalható lehetőség nem megy tovább az ajánlati árlekérésbe. A sikertelen, hiányos vagy ellentmondásos válasz nem igazolt státuszt kap; nem válik automatikusan nulla készletté. A szükséges dátumokat és létszámot a kapacitáskliens a cache és a hálózati lekérés előtt ellenőrzi. Érvénytelen vagy hiányzó alapadatokkal nem kér kapacitást.

A jóváhagyás előtt új kapacitásellenőrzés szükséges. A kézi felülbírálás ezt nem kerüli meg. A módosítási érdeklődésre is érvényes a kapu. Korábbi pozitív ajánlat és ár érvényét veszti a kapcsolódó feltételek változásakor, illetve negatív új ellenőrzés után. A jóváhagyás belső jelölés, e-mailt nem küld.

### Osztott egységek

Közelségi igény nélkül két igazolt szabad A/B készletegység típusszinten megfelelő. Az azonos házon belüli páros előnyben részesíthető, de nem kötelező. Ismeretlen fizikai elhelyezkedésből nem állítjuk, hogy az apartmanok szomszédosak. Kifejezetten közös ház vagy szomszédság kérésekor konkrét egységbizonyíték kell; ennek hiányában emberi ellenőrzés szükséges.

Egy igazolt C egység elegendő egy négyszemélyes típusszintű ajánlathoz. A+C/B+C kombinációknál a készletek külön ellenőrzendők. A pozitív A/B és vegyes kombinációs tesztek szimulált adatokkal készültek; a most ellenőrzött élő időszakban A/B készlet nem volt.

### Ügyek és újabb vendéglevelek

A rendszer megőrzi a kapcsolódó üzeneteket, biztos adatokat, hiányokat, korábbi tervezeteket és ellenőrzéseket. A Gmail thread és a Message-ID/In-Reply-To/References bizonyítékok összekapcsolhatják a leveleket a feladó ellenőrzésével. Azonos e-mail-cím önmagában nem elegendő az összevonáshoz. Bizonytalan kapcsolat kezelői döntést igényel.

A második vagy harmadik levél kiegészíti a meglévő ügyet. Részleges gyermekéletkor-pótlás után csak a még hiányzó életkort kéri be. A korábbi biztos dátum és létszám megmarad, ha nem változott. A puszta telefonszám-változás nem indokol teljes elhelyezési újraszámítást; a végső jóváhagyás friss kapacitásvizsgálata ettől függetlenül kötelező.

A jelenlegi ügytár böngészőben tárolódik. Nem tekinthető közös, több eszköz és több kezelő között megbízhatóan működő szerveroldali ügykezelésnek.

## A most befejezett javítások

1. A Gmailből érkező rekord és a kézzel betöltött Gmail-JSON ugyanazon központi feldolgozót használja. Az importált ellenőrizetlen választervezet nem lesz automatikusan vendégválasz.
2. Új importnál törlődik a korábbi kézi ügyösszekapcsolási mező, így nem kapcsolódik véletlenül egy régi ügyhöz.
3. A Gmail eredeti, másodpercet és törtrészt is tartalmazó időbélyege megmarad. A később betöltött régebbi üzenet nem írhatja felül a frissebb ügyadatot pusztán a percazonosság miatt.
4. Érvénytelen rekord vagy sikertelen feldolgozás nem jelölhető sikeres helyi beolvasásnak.
5. Új `booking-followup.mjs` modul kezeli a szűken, egyértelműen felismerhető dátumkorrekciót. Példa: „2026.10.23 helyett 2026.10.30; távozás: 2026.11.01.” A régi dátumnak egyeznie kell a korábbi igazolt érkezéssel.
6. Többértelmű új dátumnál a jelenlegi munkadátumok és a rájuk épülő ár/kapacitás érvénytelenné válnak. A korábbi dátumok ellenőrzési előzményként megmaradnak; nem használhatók aktuális ajánlat alapjaként.
7. Módosítási kérésnél is blokkol a jóváhagyás, ha nincs pontos, érvényes új időszak és létszám.
8. Részlegesen ismert gyermekéletkorból magyarul, németül, angolul és szlovénül sem állítja valamennyi gyermek életkorát. A Gmail összefoglaló a jelenlegi ügy háztípusát mutatja.

Érintett fájlok ebben a folytatásban: `booking-followup.mjs` (új), `booking-cases.mjs`, `booking-filter.mjs`, `gmail-readonly.js`, `index.html`, `sarberki-core.mjs`, `tests/booking-continuation.test.mjs`, `tests/case-ui.test.mjs`. A bizonyítékok ebben a jelentéskönyvtárban találhatók. A korábbi szakaszok fájllistáit a `reports/central-booking-2026-10-08/` és `reports/booking-hardening-2026-10-08/` jelentések tartalmazzák.

## Automatikus tesztek

Korábbi audit: 638/638. Központi átalakítás után: 670/670. További megerősítések után: 696/696. Jelenlegi teljes futás: **710/710 PASS, 0 FAIL, 0 SKIP** (`automatic-tests.log`). Ebben a folytatásban 14 új teszt került a készletbe. A célzott naplóban 28 sikeres teszteset szerepel (`targeted-tests.log`).

Az új tesztek lefedik a központi Gmail-importot, a külön threadben érkező RFC-választ, az azonos percen belüli időrendet, a hibás rekordot, a külön ügyet azonos feladóval, a dátumkorrekciót és a bizonytalan módosítás jóváhagyási tiltását. A részleges gyermekéletkor vendégszövegét mind a négy támogatott nyelven ellenőrzik.

A fölösleges árlekérés elmaradása és a hibás dátumú kapacitáslekérés nulla hálózati hívása teszttel igazolt. Összesített üzemi gyorsulási százalékot vagy megtakarított AI-költséget nem mértünk, ezért ilyet nem állítunk.

## Élő Previo-ellenőrzés – külön a szimulált tesztektől

2026. október 23–25., két éjszaka, négy felnőtt. Új ellenőrzések: 2026-10-08 19:46:46.989–19:47:13.955 UTC, magyar helyi idő szerint 21:46–21:47. Forrás: a hivatalos foglalási felület nyilvános típusszintű készletlekérdezése; a részletek és válaszlenyomatok a `live-evidence.json` fájlban.

| Szállástípus | Igazolt szabad darabszám | Ellenőrzési szint |
|---|---:|---|
| VIP | 0 | Típusszint |
| Családi | 0 | Típusszint |
| Deluxe | 0 | Típusszint |
| Osztott C | 2 | Típusszint |
| Osztott A/B közös készlet | 0 | Közös típuskészlet |

Az élő válasz és a központi szűrés ebben a vizsgált esetben egyezett. Konkrét 7A–10C fizikai egység szabad voltát vagy szomszédos párosát nem igazoltuk. Az eredmény nem bizonyít minden dátumra vagy speciális értékesítési feltételre hibamentes működést.

## Telepített böngészős ellenőrzések

Tesztoldal: https://leafy-chimera-2403e5.netlify.app/ . Szintetikus Gmail-JSON rekordokat használtunk, valódi e-mail küldése nélkül.

A `3aa619a` telepítésen ellenőrizve: új ügy létrehozása; régi kézi ügykapcsolat törlése; RFC-hivatkozással másik threadből életkor pótlása ugyanahhoz az ügyhöz; életkorok és korábbi adatok megtartása; egyértelmű dátummódosítás; többértelmű módosítás esetén aktuális dátumok törlése és jóváhagyás blokkolása. A tiltás szövege: „Jóváhagyás tiltva: Pontos, érvényes időszak és létszám szükséges a kapacitásellenőrzéshez.” Bizonyíték: `sarberki-gmail-followup-20261008.json` és az azonos nevű `.jpg`.

A végleges `057196a` build külön ellenőrzésén a két gyermekből egy ismert 7 éves életkor mellett a levél nem állította mindkettő életkorát, csak a fennmaradó egy gyermekét kérte, és az ellenőrzött C típust jelenítette meg. Bizonyíték: `sarberki-final-age-20261008.json`.

Hitelesített Gmail-fiókból, OAuth-on keresztül történő teljes végponttól végpontig beolvasást ebben a folytatásban nem teszteltünk. A szintetikus rekordvizsgálat ezt nem helyettesíti. A módosítási levél jelenlegi vendégszövege általános visszajelzés; az új időszakra készített teljes, személyre szabott módosítási ajánlat működését nem igazoltuk.

## Commitok és visszaállítás

Mostani kódváltoztatások:

- `3aa619ab53239d1da5ec98df54c8b4ce23110892`: egységes Gmail-import, időrend, dátumkorrekció és bizonytalan módosítás érvénytelenítése.
- `057196a456a8b80c40f6100edd1bced23e83a59d`: részleges gyermekéletkor vendégszövegének javítása és aktuális Gmail-háztípus.

Korábbi központi fejlesztés: `f8a3100c6b6cdf60aba1ae8f4a80fa64507024ec`, `5e8c986defb020bd64378cb64d0cf57825baba89`. Korábbi megerősítés: `eb0c7d9ce5fb215abf3f55b65319ffb20bb86a9d`, `4a4a5ec7e9abce43f80211163147cb52c35f8612`, `ac9044e3ba9658477d3363803d1541e39ab725e8`. A folytatás előtti jelentési állapot: `b82db1ac5a1dc814ff0eec148ab8b580888c724b`.

Visszaállítási pont: `sarberki-before-gmail-continuation-20261008` helyi tag, a `b82db1a` commiton. Megosztott ágon a két új kódcommit fordított sorrendű revertje őrzi meg a történetet; ne erőltetett main/production-visszaállítás történjen. Újratelepítés kizárólag a tesztoldalra történhet. A böngészős ügyadatok külön állapotok: a kód visszaállítása önmagában nem menti vagy migrálja őket.

## Hátralévő kötelező munkák

- Közös szerveroldali ügytár, jogosultságok, ütközéskezelés és több kezelő/eszöz közötti működés igazolása.
- Hitelesített, csak olvasási Gmail-folyamat több valódi tesztüzenettel, megmaradó emberi jóváhagyással.
- További dátumok és értékesítési helyzetek élő kapacitásvizsgálata; pozitív A/B eset külön ellenőrzése.
- Konkrét egység- és szomszédságbizonyíték hiányában továbbra is emberi ellenőrzés. Nem ígérhető igazolatlan fizikai elhelyezés.
- A többértelmű és összetett dátum-/létszámmódosítások, valamint a teljes módosítási ajánlat további lefedése.
- Az élő lekérdezési és árfolyamat minden lépésén az átmeneti Previo hold/zárolás hiányának külön igazolása az élesítés előtt; nem véglegesítettünk foglalást, de ez nem általános bizonyíték minden mellékhatás hiányára.

**Döntés:** igen, a tesztekkel és a vizsgált élő adattal igazolt központi kapacitásszűrés továbbfejlesztési alapként használható. Nem állítjuk, hogy a teljes automatikus foglalási ügykezelés már éles használatra kész. Ellenőrizetlen szállás továbbra sem ajánlható foglalhatóként.
