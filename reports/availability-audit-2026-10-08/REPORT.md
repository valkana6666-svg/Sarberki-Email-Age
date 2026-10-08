# Sárberki foglaltságellenőrzési jelentés – 2026. október 8.

## Döntés

**A vizsgált, javítás előtti teljes rendszerre még nem lehet megbízható vendégajánlat-készítést alapozni.** A nyilvános Previo típusszintű kapacitáslekérdezése ugyanakkor ezen az időszakon működött, és egyezett a böngészőben megfigyelt eredménnyel. A javított tesztági kód alkalmas a típusszintű, ember által ellenőrzött folyamat továbbfejlesztésének alapjául. Ez nem jelent teljes körű PMS-hitelesítést, egyedi egységazonosítást vagy garantált A+B párosítást.

Az új, elkülönített publikus válaszmagban a hiteles kapacitás átadása még nincs bekötve. A teljes új válaszoló végponttól végpontig történő kapacitáshitelesítése ezért **még nincs kész**. Az új mag jelenleg biztonságosan csak további ellenőrzést ígér, ellenőrizetlen szállást nem igazol vissza.

## Vizsgálati keret és források

- Repó: `valkana6666-svg/Sarberki-Email-Age`, kizárólag `gmail-test-subject-allowlist`.
- Kiinduló commit: `aed74c07069422cec27702a9cb35e18e6bef9193`.
- Időszak: 2026.10.23–25., 2 éjszaka, 4 felnőtt, 0 gyermek.
- Élő forrás: Sárberki nyilvános Previo-felület, szálláshelyazonosító 753011.
- Összehasonlított tesztoldal: `https://leafy-chimera-2403e5.netlify.app/`, `/api/availability-options`.
- A tesztoldal lekérdezése 2026.10.08. 19:45:42–44 bécsi idő szerint; az első közvetlen lekérdezések 19:45:49–19:47:51 között; megismételt közvetlen lekérdezések 20:07:18–20:07:54 között.
- Böngészőben is kiválasztottam október 23-i érkezést és 25-i távozást. A 2. keresési lépésen megfigyeltem a típusokat és az emeleti apartman négyszemélyes árlehetőségét. Foglalás gombot nem nyomtam meg.
- Nem küldtem vendéglevelet, nem adtam meg valódi vendégadatot, nem véglegesítettem foglalást. A kód engedélylistája csak anonim dátumkeresést és kapacitás/ár lekérdezési útvonalakat enged. Az esetleges belső, átmeneti Previo-zárolást kívülről nem tudjuk teljes bizonyossággal kizárni; ügyfél- és foglalásbeküldést nem használtam.

## Tényleges kapacitás és egyezés

| Kérés | Previo típusszintű szabad egység | Tesztoldal kapacitásadata | Következtetés |
|---|---:|---:|---|
| VIP, 4 felnőtt | 0 | 0 | Nem ajánlható foglalhatóként |
| Családi, 4 felnőtt | 0 | 0 | Nem ajánlható foglalhatóként |
| Deluxe, 4 felnőtt | 0 | 0 | Nem ajánlható foglalhatóként |
| Osztott C, emeleti, 4 felnőtt | 2 | 2 | Típusszinten szabad; konkrét házszám nem igazolt |
| Osztott A+B, összesen 4 felnőtt | A/B közös pool: 0 | A/B közös pool: 0 | A+B kombináció nem biztosítható a nyilvános adatok szerint |

**A nyers darabszámokban nem találtam eltérést.** A hibák az ellenőrzés indításában és az ajánlat kiválasztásában vannak. A javítás előtti tesztoldal `available_options` listája üres volt, miközben saját `splitC` pool-ellenőrzése 2 szabad egységet tartalmazott.

A Previo böngészős eredményében a Családi, DELUXE, VIP és a 2 fős apartman mellett „A kiválasztott dátumon nem elérhető / Lefoglalva” látszott. Az emeleti „4 fős apartman” mellett „2 tetőtéri szoba maradt” szerepelt; a négy vendéges árlehetőség 88 000 Ft / 2 éj volt. Ez itt a foglalhatóság ellenőrzésének kiegészítő bizonyítéka, nem teljes, jóváhagyott vendégárajánlat.

A 0 azt bizonyítja, hogy a nyilvános csatornán az adott teljes időszakra nincs ajánlható kapacitás. Ebből nem állapítható meg biztosan, hogy minden fizikai ház lakott-e, vagy belső letiltás, értékesítési szabály is okozza a korlátozást.

## Ellenőrzési szint

A lekérdezés a teljes tartózkodási időszakra visszakapott `data-numOfFreeRooms` értéket használja, ellenőrzi a szálláshelyet, a pénznemet, a dátumokat és a típust. A megismételt lekérdezés bizonyítékai: `live-evidence.json`; a tesztoldal eredeti válasza: `deployed-before.json`.

| Previo típus | Azonosító | Azonosítás szintje |
|---|---:|---|
| VIP apartman | 766437 | Típus/pool; egyedi házazonosító nincs a válaszban |
| Családi faház | 766435 | Típus/pool |
| DELUXE faház | 766439 | Típus/pool |
| 4 fős apartman / osztott C | 766443 | Típus/pool; 7C/8C/9C/10C közül a konkrét szabad egység nem azonosított |
| 2 fős apartman / osztott A/B | 766441 | Közös pool; A/B különválasztás és fizikai házpárosítás nem igazolt |

Két szabad A/B poolegységből általában nem következik az azonos házas A+B páros elérhetősége. A mostani 0-s eredmény kizárja a kombinációt, de pozitív darabszám esetén is külön egyedi ellenőrzés szükséges. Az új regressziós teszt 2 szabad poolegységnél sem enged automatikus párosításigazolást.

## Talált hibák és javítások

1. **Konkrét háztípus átugrotta a kapacitásellenőrzést.** Az `enrich()` korai visszatérése VIP/Családi/Deluxe esetén nem indította el a lekérdezést. A telepített régi felületen Deluxe levéllel reprodukáltam: dátum, 4 felnőtt és 0 gyermek helyesen megjelent, de nem kapott tényleges „nem elérhető” eredményt. A javítás minden konkrét kérésnél is indít ellenőrzést; foglalt típusnál egyértelműen jelzi a hiányzó kapacitást, és csak ellenőrzött alternatívát sorol fel.
2. **A szabad C apartman kimaradt az általános négyfős ajánlatból.** A kézi osztott kombinációtervező az A+B változatot választotta, a C pool pozitív eredménye nem jutott a szabad listába. A javítás legfeljebb 4 főnél a hiteles C pool alapján önálló emeleti lehetőséget ad hozzá; nem állít konkrét egységazonosítást.
3. **Négy fő, háztípus nélkül szükségtelenül megállt.** A javítás általános szálláskeresésnél ellenőrzi a kapacitást. A bizonytalan „négyfős apartman” továbbra is pontosítást igényel, mert önmagában nem jelöli az osztott C-t.
4. **A „C” és „A+B” megnevezés nem volt teljesen feldolgozva.** Most az „Osztott faház C” egy emeleti egységet, az „Osztott A+B” két kétszemélyes egységet jelent; ugyanazon ház előnyben részesítése megmarad.
5. **A feloldott, de hibás forrásválaszt ellenőrzöttnek jelölhette a köztes réteg.** A javítás elutasítja az ismeretlen státuszt, tört/negatív vagy ellentmondó darabszámot, eltérő dátumot és típust. Ezek `unverified` állapotba kerülnek.
6. **Régi pozitív árajánlat felülírhatta az új negatív eredményt.** A javítás friss „nem elérhető” vagy sikertelen ellenőrzés után érvényteleníti a korábbi ajánlatot. Az összlétszám változása is érvényteleníti a hozzá kötött ellenőrzést.
7. **Összetett osztott elhelyezés nem lehet pusztán pooladatból igazolt.** Az A+B és a konkrét egységkérelmeknél a típusszám pozitív eredménye nem vált egyedi rendelkezésreállás-igazolássá. A bizonytalan elhelyezés kritikus kezelői figyelmeztetés marad.

## Hat tesztérdeklődés

A `live-evidence.json` tartalmazza a teljes öt háztípusos és a hatodik, általános szálláskereső tesztlevelet. Mind a hatnál a közös értelmező helyesen adta vissza 2026.10.23–25-öt, 4 felnőttet, 4 összvendéget és 0 gyermeket. A VIP/Családi/Deluxe típus helyes; a C kérés egy emeleti egység, az A+B kérés két egység és azonos ház elsődlegessége. Az általános kérés nem kap önkényesen háztípust.

A felületi kapacitásbeillesztést izolált DOM-környezetben is teszteltem: konkrét háztípus, negatív eredmény, C alternatíva, dátumváltozás, sikertelen forrás. Az összetett egységekre és az ügyállapot érvénytelenítésére külön regressziós tesztek futnak.

Kiinduló teljes tesztkészlet: **626/626 PASS**. Javítás utáni teljes tesztkészlet: **638/638 PASS**, 0 hiba, 0 kihagyás. A forráskódformázás ellenőrzése (`git diff --check`) is hibamentes. A szimulált tesztek a logikát igazolják; az élő 0/0/0/2/0 adatok külön, valódi Previo-lekérdezésből származnak.

## Hátralévő kötelező feltételek

- Az új publikus válaszmaghoz a kért dátumhoz, létszámhoz és típushoz kötött, hiteles kapacitásátadást kell bekötni és felületen is tesztelni. A jelenlegi panelek közül csak a régi tervezet használja az élő ajánló útvonalat.
- A+B vagy egyéb párosítás esetén emberi/PMS egységellenőrzés kell; az egységszintű automatizálás ezzel a nyilvános útvonallal nincs bizonyítva.
- Vendégnek történő végleges ajánlat előtt friss újraellenőrzés szükséges. Az automatikus lejárat és a jóváhagyási pillanatban történő kötelező friss lekérdezés még nincs teljes körűen megvalósítva.
- A vizsgálat egy konkrét időszakot igazol. További időszakok, kiemelt napok, csatornakorlátozások, párhuzamos foglalások és forrásfelület-változások kezelése új ellenőrzési körökben bizonyítandó.
- A Previo képernyőn a C típus 5 fős árlehetőséget is mutat, miközben a projekt névleges C kapacitása 4. Ezt a jelentés nem oldja fel: az új igazolt C alternatíva legfeljebb 4 főre engedett.

A kötelező fejlesztési ellenőrzési pontot az `AGENTS.md` rögzíti. Ellenőrizetlen szállás egyik további fejlesztésnél sem jelölhető foglalhatóként.

**Végső válasz:** a nyilvános lekérdezési részre korlátozott, típusszintű alapként építhetünk. A teljes rendszer általános megbízhatóságát és az egyedi osztott párosítást még nem igazoltuk; jelenleg csak emberi ellenőrzés mellett, a fenti korlátokkal használható. Az új publikus válaszoló teljes hiteles integrációjához további munka szükséges.

## Tesztági rögzítés és telepített ellenőrzés

A javítások tesztági commitja: `25b9fc268f83c36fdb90ee9ff212f9b0a8e450c1`. A friss JavaScript megjelent a külön tesztoldalon. A telepített backend 2026.10.08. 20:23:27 bécsi idő szerint végrehajtott új élő ellenőrzése a szabad listában kizárólag `Osztott C (emeleti apartman)` lehetőséget adott vissza, 2 szabad egységgel és `type_pool` ellenőrzési szinttel; az A/B pool 0 maradt. Bizonyíték: `deployed-after.json`. A main és a production nem módosult.

A telepítés utáni backend-ellenőrzés elkészült. Mind a hat levél teljes, telepített böngészős újratesztelését nem állítom megtörténtnek: a hat levél értelmezési és felületi beillesztési regresszióját automatizált környezetben vizsgáltam, a régi telepített Deluxe megkerülést böngészőben külön reprodukáltam.
