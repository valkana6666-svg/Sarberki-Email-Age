# Sárberki – kiegészítő fejlesztési zárójelentés

Dátum: 2026. október 8.
Repository: valkana6666-svg/Sarberki-Email-Age
Ág: gmail-test-subject-allowlist
Tesztoldal: https://leafy-chimera-2403e5.netlify.app/

## Eredmény és döntés

**A meglévő központi rendszer továbbfejlesztése megtörtént. A végső automatikus eredmény 696/696 PASS, 0 FAIL, 0 kihagyott teszt.** A 670 tesztes korábbi verzióhoz képest 26 új regressziós teszt került be. Az utolsó böngészőben ellenőrzött kódverzió: ac9044e.

A jelenlegi rendszer a további tesztági fejlesztés alapjaként használható, az igazolt kapacitás kötelező feltételével. Ez nem jelenti a teljes, többkezelős foglalási ügykezelés elkészültét, és nem bizonyít minden dátumra vagy fizikai apartmanra hibátlan működést. A bejelentkezett Gmailből végigfutó valódi többüzenetes folyamat és a központi szerveroldali ügytárolás továbbra is külön ellenőrzést/megvalósítást igényel.

Kizárólag a tesztág változott. A main és a production rendszert nem módosítottam. Vendéglevelet nem küldtem; Previo-foglalást nem hoztam létre, nem módosítottam és nem véglegesítettem. Az élő próbák az anonim nyilvános kapacitáslekérdezési útvonalakat használták.

Ez a jelentés a reports/central-booking-2026-10-08/REPORT.md folytatása. A korábbi jelentés és bizonyítékok megmaradtak.

## 1. A fejlesztési szakaszok állapota

| Szakasz | Tényleges eredmény | Igazolás / fennmaradó határ |
|---|---|---|
| 1. Meglévő rendszer ellenőrzése | A 670 tesztes központi szűrő, választervező, ügytároló és tesztek továbbvizsgálata; visszaállítási pont d8382a7 | Meglévő projekt folytatása, újrakezdés nélkül |
| 2. Központi szűrés | Biztos/hiányzó/ellentmondásos/pontosítandó mezők; szigorú dátum- és darabszám-ellenőrzés; egységes pozitív kiválasztás | Automatikus regresszió; élő típusszintű ellenőrzés |
| 3. Osztott apartmanok | Több azonos típusú C és A/B egység; többtagú kombinációk; változó egységszám; közelségi feltétel külön kezelése | Pozitív többegységes esetek mock teszteken; élő C és A/B készlet külön ellenőrizve |
| 4. Egységes választervező | Az aktív központi böngészős útvonal a szerver döntését használja; nem számolja újra a split készletet | Teszt tiltja a böngészős újraszámítást; telepített Deluxe/C próbák |
| 5. Ügyösszekapcsolás | Korábbi thread/RFC/emberi ügyazonosító-kezelés megmaradt; kifejezetten külön foglalás ugyanabban a szálban is elkülönül | Automatikus teszt; élő Gmail többüzenetes E2E nem történt |
| 6. Többlépcsős adatgyűjtés | Újabb adatok megőrzése régebbi levél beolvasásakor; gyermeklétszám-változáskor régi életkorlista törlése; telefonos folytatás és újratöltés | Automatikus időrendteszt; telepített kézi ügykapcsolási próba |
| 7. Optimalizálás és teljes tesztelés | Felesleges split újraszámítás megszüntetése az aktív központi útvonalon; hibás kombinációhoz nulla külső kérés; teljes regresszió | 696/696 teljes teszt, 68/68 célzott teszt; élő és böngészős eredmény külön dokumentálva |

Az 5–6. szakasz működő, helyi böngészős ügykezelést ad. Több eszközön megosztott, központi adatbázisos ügykezelés nem készült el.

## 2. Feltárt és kijavított hibák

1. A böngésző osztott kérésnél újraszámolta a szerver eredményét. Emiatt például három kért A/B apartman ismét két apartmanként jelenhetett meg. Az aktív központi útvonal most az ellenőrzött szerveropciót és annak darabszámát használja. A jóváhagyás is ugyanazt a kiválasztási szabályt követi.
2. Az általános kombinációkeresésből kimaradhatott több C vagy több A/B egység együttese. Most például 6 főhöz 2 C, 10 főhöz 3 C, 8 főhöz 4 A/B, illetve 12 főhöz 2 A/B + 2 C vizsgálható, ha a szükséges teljes időszaki készlet igazolt.
3. Egy később beolvasott régebbi levél felülírhatta az újabb dátumot és ajánlatot. A megbízható időbélyeg alapján régebbi üzenet bekerül az ügy történetébe, de nem írja felül az újabb ügyadatokat. Ez nem automatikus történeti adatösszefésülés: a régi levélből hiányzó adat pótlása jelenleg külön kezelői döntés lehet.
4. Deluxe-ra váltás után régi osztott elhelyezési szöveg maradhatott aktív. Egész háztípusra váltáskor az osztott követelmény kiesik; az ellenőrzött C-típus és egységszám felülírja a történeti A/B-típust.
5. Gyermeklétszám módosítása megtarthatta az előző teljes életkorlistát. Ha új életkorlista nélkül változik a gyermekek száma, a korábbi lista érvénytelen lesz.
6. Érvénytelen dátum, fordított időszak, negatív gyermekszám, nem számszerű létszám és a dátummal ellentmondó éjszakaszám korábban ismert adatnak látszhatott. Ezek most ellentmondásos státuszt kapnak. A kapacitáshoz szükséges ellentmondásos mezők blokkolják a lekérdezést; például hiányzó gyermekéletkor önmagában nem blokkolja a már lekérdezhető készletet.
7. A kevert apartmankombináció és a külön megadott egységszám eltérése átjuthatott. A szerver most a forráshívás előtt elutasítja az ellentmondást.
8. Üres telefon/autós mező adatként megadottnak látszhatott. Most üres mező hiányzóként jelenik meg.
9. Egy magyar telefonszámos folytatás megtarthatott a rövid új levélhez kötődő idegen nyelvi figyelmeztetést. A megőrzött, feloldott ügy nyelve alapján ez a téves figyelmeztetés megszűnik.
10. Több A/B és C együttese esetén a vendégszöveg a teljes egységszámot hibásan mindkét típusra vonatkoztathatta. Most a komponensek külön darabszámmal jelennek meg.

## 3. Previo-kapacitásszűrés

A központi kliens a biztos időszakot, létszámot, háztípust, egységszámot és elhelyezési igényt adja át. Konkrét VIP/Deluxe/Családi/osztott típus esetén is kötelező a kapacitásvizsgálat. A szerver elérhető, nem elérhető és nem igazolt listát tart fenn; sikertelen lekérdezésből nem lesz nulla készlet.

Csak igazoltan elérhető opció állítható szabadnak. Az árazás előtt a korábbi kliens- és szerveroldali kapu megmaradt. Igazoltan nem elérhető vagy nem igazolt típushoz nem indul árforráshívás. Az ellenőrzési adat, időpont és kizárási ok megőrződik.

A releváns eredmény legfeljebb 120 másodpercig használható újra a feldolgozásban. Belső jóváhagyás előtt friss kapacitásellenőrzés szükséges. A negatív vagy sikertelen friss ellenőrzés érvényteleníti a korábbi pozitív ajánlatot; a kézi felülbírálás ezt nem kerülheti meg. A belső jóváhagyás nem küld levelet és nem foglal.

## 4. Osztott házak kiosztása

Az A és B közös kétszemélyes készletből, a C külön négyszemélyes készletből ellenőrizhető. Közelségi feltétel nélkül elegendő az előírt darabszám típusszintű igazolása. Két A/B egységhez nem kötelező az azonos fizikai ház bizonyítása; egy C apartmanhoz nem szükséges a 7C/8C/9C/10C kiválasztása.

Azonos házas vagy szomszédos elhelyezés kifejezett kérése, illetve konkrét egységazonosító csak egyedi bizonyítékkal ígérhető. A nyilvános összesített darabszám ehhez nem elég. Az ilyen opció nem igazolt, emberi ellenőrzést igényel.

Az angol, német és szlovén két kétszemélyes apartman darabszám-értelmezéséhez további regressziós tesztek kerültek be. A „nem szükséges, hogy egymás mellett legyenek” megfogalmazás már nem aktivál kötelező párosítást. Ez nem teljes többnyelvű természetesnyelvi értelmezési bizonyítás minden megfogalmazásra.

## 5. Ügyek és további levelek

A thread ID, RFC Message-ID-hivatkozások és ember által igazolt korábbi ügyazonosító használata megmaradt. A feladó e-mail-címe önmagában nem kapcsol össze ügyeket. Ha a vendég ugyanazon szálban kifejezetten külön foglalásról beszél, az új kérés nem olvad automatikusan a korábbi ügybe; összekapcsolási felülvizsgálat kell.

Az új levél a bizonyított ügy biztos adatait egészíti ki. Részleges gyermekéletkor-válaszok több lépésben gyűjthetők; csak a fennmaradó hiányra kérdez vissza. Dátum/létszám/típus változtatás érvényteleníti az érintett kapacitást és árat. Telefonváltozás megőrzi a releváns előzményeket és árat; végső jóváhagyáshoz ettől függetlenül friss kapacitás kell.

A tárolás továbbra is localStorage: üzenetek, biztos adatok, ellenőrzések, tervezetek és állapot ugyanazon kezelő böngészőjében maradnak meg. A telepített próba igazolta az újratöltés utáni visszatöltést. Automatikus, több eszközös ügyfolytonosságot ez nem ad.

## 6. Automatikus tesztek

Teljes tesztkészlet: npm test – **696/696 PASS**, 0 FAIL, 0 kihagyott.
Célzott készlet: booking-continuation.test.mjs + availability-reply.test.mjs + case-ui.test.mjs – **68/68 PASS**.

A korábbi 22 kötelező forgatókönyv regressziós tesztjei továbbra is lefutottak: VIP/Deluxe nulla, általános 4 fő + C, két A/B közelséggel és anélkül, ismeretlen/külön házas elhelyezés, C, A+C/B+C, forráshiba/ellentmondás, dátum/létszám-váltás, életkorpótlás, thread/új külön levél/több ügy, bizonytalan kapcsolat, pozitívból negatív készlet, régi ár törlése, adatmegőrzés és árkérés kihagyása.

A pozitív A/B, több C és kevert kombinációs esetek kontrollált mock adatokon futottak. Nem élő készletállítások. A végső tesztnapló: automatic-tests.log; a célzott napló: targeted-tests.log.

## 7. Új élő Previo-próba

2026. október 23–25., 2 éjszaka, 4 felnőtt, gyermek nélkül.
Lekérdezési idő: 2026. október 8. 19:26–19:27 UTC, azaz 21:26–21:27 magyar/osztrák helyi idő.

| Szállástípus | Igazolt szabad egység | Ellenőrzés szintje |
|---|---:|---|
| VIP | 0 | Típusszint |
| Családi | 0 | Típusszint |
| Deluxe | 0 | Típusszint |
| Osztott C | 2 | Külön C készlet, típusszint |
| Osztott A/B | 0 | Közös A/B készlet, típusszint |

A forrásadat és a központi szűrő eredménye egyezett. Két szabad C egység nem azonos két négyfős egység automatikus szomszédsági igazolásával. Egyedi fizikai egységszintű élő bizonyíték egyik osztott egységnél sem keletkezett.

A live-evidence.json tartalmazza a dátumhoz kötött forráseredményeket, útvonalakat, HTTP-státuszokat és SHA-256 tartalomlenyomatokat. A régi élő audit fájljait az új próba nem írta felül. Ez egyetlen időszak pillanatfelvétele; minimum tartózkodás, speciális értékesítési feltételek és más dátumok általános hibátlanságát nem bizonyítja.

## 8. Telepített böngészős ellenőrzés

- eb0c7d9 build: általános 4 felnőtt – dátum és létszám helyesen felismert; ellenőrzés után csak osztott C jelent meg szabadként.
- eb0c7d9 build: konkrét Deluxe – a választott típus nem elérhető; csak igazolt C alternatíva szerepelt.
- eb0c7d9 build: kezelői felülbírálással indított belső jóváhagyás – friss ellenőrzés után tiltva; előző ajánlat érvénytelen.
- 4a4a5ec build: konkrét C – szabad C ajánlat, üres telefon/autó mező helyesen hiányzó.
- ac9044e build: újratöltés után ugyanazon C ügyhöz kezelő által igazolt telefonszámos levél – korábbi dátum, négy felnőtt, nulla gyermek és osztott elhelyezés megmaradt; telefonra nem kérdezett újra; téves idegen nyelvi figyelmeztetés megszűnt.

A többüzenetes böngészős teszt kézi beillesztéssel és kezelő által igazolt ügyazonosítóval futott. Nem helyettesíti a bejelentkezett Gmail-olvasás többüzenetes végponttól végpontig próbáját. Bizonyíték: browser-proof.json és approval-blocked.jpg.

## 9. Mérhető optimalizálás

A korábbi, most is sikeres regressziós mérésben két egyidejű azonos kapacitáskérés és egy csak telefonszámban eltérő következő feldolgozás egy külső kérést indít: egy összevonás és egy cache-találat. Igazolt szabad konkrét Deluxe esetén csak az adott típus kérdezése történik; foglalt/nem igazolt árkérésnél az árforrás hívásszáma nulla.

Új mérési eredmény: ellentmondásos kevert egységszámnál nulla Previo-forráshívás. Az aktív központi válaszútvonal böngészős split újraszámítását a teszt hibára futó helyettesítéssel tiltja, és a válasz ennek ellenére helyesen készül. Átlagos üzemi futási időt, AI-költséget vagy teljes forgalmi megtakarítást nem mértem.

## 10. Módosított fájlok ebben a folytatásban

- booking-filter.mjs – biztos adatok és ellentmondások; aktuális típus/egységszám; közös kiválasztás.
- booking-runtime.mjs – közös kiválasztás a jóváhagyásnál; kapacitási ellentmondások blokkolása.
- split-units.mjs – ismétlődő egységek, többnyelvű darabszám, közelségi tagadás, komponensdarabszámok.
- netlify/functions/availability-options.mjs – elhelyezési és egységszám-konzisztencia ellenőrzése forráshívás előtt.
- availability-recommend.mjs – aktív központi útvonalon szerveropciók használata; komponensenkénti vendégszöveg; ügyből származó aktuális eredeti kérés.
- booking-cases.mjs – időrendvédelem, gyermeklétszám és típusváltozás kezelése, kifejezetten külön foglalás elkülönítése.
- case-state.mjs – ellentmondásos adatok figyelmeztetése; feloldott ügy nyelve szerinti figyelmeztetés.
- index.html – megőrzött ügyadatok állapotának helyes megjelenítése.
- tests/booking-continuation.test.mjs – új regressziós készlet.
- tests/availability-reply.test.mjs és tests/case-ui.test.mjs – aktív központi válasz és tényleges UI-eseménykezelők tesztjei.
- tests/live-availability-audit.mjs – külön kimeneti fájl választása, a korábbi audit megőrzéséhez.
- reports/booking-hardening-2026-10-08/ – jelentés, naplók, élő és böngészős bizonyítékok.

A külön publikus válaszmag ebben a folytatásban sem kapott új döntési funkciót; archivált kódja megmaradt. Az aktív központi útvonal kizárólag a központi szerver eredményéből dolgozik. A régi kompatibilitási válaszútvonal kódja megmaradt a runtime nélküli régi környezet/tesztek számára.

## 11. Commitok és visszaállítás

Korábbi központi megvalósítás: f8a3100c6b6cdf60aba1ae8f4a80fa64507024ec és 5e8c986defb020bd64378cb64d0cf57825baba89.
Folytatás előtti visszaállítási alap: d8382a7985e6296513328fb36e7852566ec357a4.

Új kódcommitok:
- eb0c7d9ce5fb215abf3f55b65319ffb20bb86a9d – központi döntés, több osztott egység, időrend és ellentmondások.
- 4a4a5ec7e9abce43f80211163147cb52c35f8612 – hiányzó mezők jelzése, elkülönített élő auditkimenet.
- ac9044e3ba9658477d3363803d1541e39ab725e8 – magyar telefonos folytatás nyelvi figyelmeztetése.

Visszaállításkor a három kódcommit fordított sorrendű git revert műveletével visszaállítható a folytatás előtti működés a tesztágon. Alternatívaként d8382a7-ből külön teszt-fejlesztőág indítható. A main nem érintett. A helyi visszaállítási címke: sarberki-before-continuation-20261008. A kód visszaállítása nem törli automatikusan a böngésző ügyadatait.

## 12. Fennmaradó korlátozások és következő ellenőrzési kapu

1. Konkrét 7A–10C elhelyezést a nyilvános készletszám nem bizonyít; szomszédságot nem szabad automatikusan ígérni.
2. Központi, többkezelős ügyadatbázis nincs; a jelenlegi tároló egy böngésző helyi tárolója.
3. Valódi, bejelentkezett Gmailből beolvasott második/harmadik levél teljes útvonalát ebben a folytatásban sem igazoltam. Az automatikus teszt és a kézi böngészős próba külön bizonyíték.
4. Régi levél történeti hiánypótlása, összetett szabad szövegű dátumkorrekció és minden nyelvi fordulat nem tekinthető teljesen megoldottnak.
5. A pozitív többegységes kiosztási esetek mockok; az élő vizsgált időszakban A/B készlet nulla volt.
6. Az osztott referenciaár nem élő személyre szabott Previo-ajánlat. A kapacitás igazolása önmagában nem teljes árajánlat, foglalás vagy készletlekötés.
7. Az emberi jóváhagyás kötelező marad, az aktuális kapacitás újraellenőrzése nélkül pozitív ajánlat nem hagyható jóvá.

**Válasz a fő kérdésre:** igen, a bizonyítékkal alátámasztott típusszintű kapacitásszűrés és a tesztelt központi kapuk alapjára lehet további tesztági fejlesztést építeni. A teljes automatikus foglalási ügykezelés megbízhatóságát még nem igazoltuk minden szükséges környezetben. A fenti korlátokat és ellenőrzési kapukat a következő fejlesztéseknek is meg kell tartaniuk.
