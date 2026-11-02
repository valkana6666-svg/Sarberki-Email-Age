# Previo tesztfelület – folytatott, részleges felmérés
Címzett: Sárberki projektvezető chat.
Vizsgálat: 2026-11-02, 06:16 CET-től. Az egyes UI-műveletek másodperces időpontját nem naplóztuk.
Állapot: **részleges PASS; teljes funkcionális felmérés NEM IGAZOLT**.

## Kiindulás és döntés
- Aktuális teljes AGENTS.md tényleges GitHub-beolvasása a munkamenet kezdetén (06:16–06:17 CET), kizárólagos ág: gmail-test-subject-allowlist. Blob: be27bd2dfb4795496bd9f3d64ad60ada1123de5b. Ez fájlazonosító, nem commit.
- Induló HEAD: cb91f25c77122cd23a0be22544625c0cc2be9613. Branch- és HEAD-szűrt CI: [41392358623](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/41392358623), completed/success. Új tesztfuttatás nem történt.
- Friss V1-FOLYTATASI-PONT és gitfa visszaolvasva. A Claude ISSUE-8-ACCEPTANCE / LIVE-READONLY-SMOKE kódfájlköreit nem érinti a vizsgálat. Mentés előtti HEAD már fb1874027706f871926d60667d106700de5def55; a Claude dokumentációs diffjét külön visszaolvastuk, az ISSUE-8 státusz frissítése megőrzendő.
- A korábbi beszélgetés a belépést, két aktív kapcsolatot és félbemaradt menüvizsgálatot igazoló beszámolót tartalmaz; ebből nem következik kész funkcionális felmérés. Az eredeti képek ebben a körben nem kerültek újraolvasásra; korábbi állításból nem készül új PASS.
- Meglévő használható előkészítés: docs/PREVIO-API-HANDOFF-2026-10-21.md; docs/PREVIO-CAPACITY-READONLY-GATE.md; shared-core/server-previo-contract-adapter.mjs; PREVIO_SUPPORT_QUESTIONS.md. Ezeket ténylegesen visszaolvastuk.
- Választás: meglévő bejelentkezett PMS és hivatalos dokumentáció olvasása. Az API-adapter aktiválása nem indokolt: hitelesített sandbox API-hozzáférés és a szükséges szerződések nincsenek igazolva. Új V2-motor vagy böngészős foglalásautomatizálás nem készült.

## Tényleges UI-megfigyelések
Minden megnyitott PMS-nézet fejlécében 73521 / Sárberki Horgásztó - API TESZT szerepelt. Éles szálláshelyre nem váltottunk.

| Terület | Megfigyelés, ellenőrzött oldal | Következtetés és korlát |
|---|---|---|
| Belépett környezet | https://pms.previo.app/73521/reservation/grid ténylegesen megnyílt, új hitelesítés nélkül | PASS erre a munkamenetre; későbbi újrabelépésre nem garancia |
| Szállástípus | https://pms.previo.app/73521/settings/objects : 1 típus, azonosító 1012357, Apartmanok; 5 szoba; online ajánlat bekapcsolva | PASS a teszt konfigurációjára; nem az éles 23 egység megfeleltetése |
| Kapacitás | Szállástípus adatlapja: 4 ágy, 0 pótágy; naptár is [4+0] jelölésű | PASS; nincs alap a VIP/családi/A-B-C/Deluxe/15 éles készlet átírására |
| Fizikai tesztegységek | Apartman 1, 2, 3, 4, 5; sorrendjük 1–5 | Egyedi objId a vizsgált szobaszerkesztőben nem látszott: NEM IGAZOLT. A név/sorrend nem azonosító |
| Erőforrástípusok | Szobabeállításban wellness, sport, konferencia, gasztronómia, egyéb nap/óra fülek mind 0 | Nem bizonyítja, hogy a Previo általában nem kezel ilyen erőforrást; itt nincs beállítva |
| Foglalási lista | Az érkezés 2026.11.02-től szűrt listában nincs adat | Nem a teljes adatbázis ürességének bizonyítéka |
| Naptár | https://pms.previo.app/73521/reservation/canvas : öt tesztegység, látható foglalási blokk nélkül | Kijelzett időablak pillanatképe; nem API-kapacitásigazolás, nem vendégajánlat |
| Vezérlőpult | Új online foglalások, Opció, Várólista, Kiosztatlan szobák, Érkezések, Távozások panelek | Funkciók létezése látható, éles beérkezési folyamat nem tesztelt |
| Új foglalás adatlapja | Érkezés/távozás időponttal; voucher automatikus számozás; állapot; opció lejárata; szoba; beosztott foglalás; cég; forrás; kapcsolattartó; email; telefon; szegmens/piaci szegmens; vendéglista | Csak üres, nem mentett adatlap vizsgálata. Alapértelmezett forrás Telefon, státusz opció, érkezés 14:00/távozás 10:00 – ezek tesztalapértékek |
| Állapotok | opció; megerősítve; bejelentkezve; Kijelentkezett; más; várólista; lemondás; no-show | UI-választék PASS; állapotváltás és mentés nem próbált |
| Kötelező adat | Kommunikáció fülre váltáskor validáció: Piaci szegmens – Kötelezően kitöltendő mező | PASS erre a konkrét validációra; a teljes mentési kötelezőmező-lista NEM IGAZOLT |
| Vendégek | Vendégek száma mező, négy üres sor Felnőtt / reggeli alapértékkel | Gyermekkor, korhatár és többegységes mentés nem tesztelt; a reggeli nem Sárberki szolgáltatási szabály |
| Kommunikáció és történet | Számla, Feladatok, Csatolmányok, Kommunikáció fülek; Foglalási történet új, nem mentett foglalásnál tiltva | Küldés, sablon, előzmény, voucher-előállítás NEM IGAZOLT; a tiltott történelemfül nem bizonyít hiányzó naplófunkciót |
| Szolgáltatások | https://pms.previo.app/73521/settings/services#services : alapnézet, üres szűrők, Nincs találat | Ebben a nézetben nincs dézsa/szolgáltatás; nem globális szolgáltatási képességhiány |
| IFA | https://pms.previo.app/73521/tax_settings#taxSettings : 2026.02.13-tól adómentes, 14 kivétel | PASS a tesztbeállításra. Az éles IFA/ár/foglalószabályt nem helyettesíti |
| Árlista menü | Árlista, étkezések, pénznem/árfolyam, IFA, kedvezmények/felárak, szolgáltatások, leltár, csomagajánlatok láthatók | Részletes szobaárak, kedvezmények és foglaló még NEM IGAZOLT |
| Online foglalás menü | Reservation+, Fizetések, ÁSZF, Személyes adatok felhasználása, Összekötéseim, Piactér | Menülét PASS; Reservation+ részletek megnyitása hitelesítési origin-korláton megállt |

Két üres foglalási adatlap nyílt meg a felület válaszideje miatti ismételt megnyitás során. Mindkettőn kifejezetten **Nincs mentés** választással zártunk; utána a naptár visszatért, foglalási blokk nélkül. Mentés, küldés, fizetés vagy állapotmentés nem történt. Ez nem szolgáltatói adatbázis-audit és nem általános bizonyíték a háttérzárolások hiányára.

## API és felület összevetése
Hivatalos források tényleges webes lekéréssel:
- https://help.previo.app/en/doc/api-access/
- https://xml.apidocs.previo.app/
- https://rest.apidocs.previo.app/

| Funkció | Dokumentált lehetőség | Tényleges Sárberki API-próba |
|---|---|---|
| Tesztjelleg / szálláshely | XML Hotel.get válaszban hotId és isTest | NEM IGAZOLT; UI-fejléc nem API-válasz |
| Típus és egységlista | XML Hotel.getObjectKinds: obkId, objId, ágy/pótágy | NEM IGAZOLT; 1012357 csak UI-ban olvasott típusazonosító |
| Kapacitás | REST GET calendar/availability, Booking.getFreeCapacity jogosultság; típusszintű készlet | Nem hívtuk. Típuspoolból konkrét A+B páros nem bizonyítható |
| Több szoba | REST: egy reservationId alatt több roomReservationId | Csak dokumentált modell; nem kipróbált csoportos rögzítés |
| Állapot | REST státuszkódtábla megfelel a látott UI-állapotoknak | Kódmegfeleltetés nincs aktiválva |
| Létrehozás/módosítás | Általános API-leírás XML-ben támogatást jelez | Konkrét szerződés, jogosultság, idempotencia és hibakezelés NEM IGAZOLT |
| Teljes ár, gyermekkor, dézsa, IFA, foglaló | Együttes Sárberki-szerződés nem igazolt | Nincs élő próba |
| Voucher / kommunikáció / felhasználói audit | UI-szinten csak részlegesen látható | Megfelelő konkrét API-művelet e vizsgálatban NEM IGAZOLT |

Az API külön API-kulcsot igényel. A PMS-belépés és két korábban jelzett aktív szolgáltatói kapcsolat nem az Agent saját API-jogosultsága. A meglévő adapter szintetikus-only, authenticationStatus=NOT_CONNECTED és minden írás tiltott; ez helyes határ, nem most javítandó programhiba.

## Bizonyított akadály
A Reservation+ megnyitása https://id.previo.app eredetre vezetett. Az automatikus böngészős biztonsági ellenőrzés elutasította e külön hitelesítési cél hozzáférését; nem a tulajdonos utasította el. Indok: a külön identity originre nem volt az ellenőrzés által elfogadott konkrét engedély. Egy ezt követő állapotolvasás is ugyanazon origin-korláton állt meg. További próbálkozás, alternatív út vagy megkerülés nincs.
Ez nem bizonyít hibás jelszót, Previo-leállást vagy API-jogosultságvesztést. A folytatáshoz az id.previo.app meglévő fiókos belépési céljának konkrét tulajdonosi engedélyezése szükséges; nincs szükség új jogosultság vagy jelszócserére.

## Hasznosítás most
1. **A tesztadat nem éles konfiguráció:** az 5 × 4+0 apartman, adómentes IFA és üres szolgáltatáslista nem kerülhet az Agent központi szabálymotorjába. A 23 éles egység jóváhagyott megfeleltetése továbbra külön feladat.
2. **Munkatársi adatlap előkészítéséhez használható mezősorrend:** ügyazonosító/revízió; érkezés/távozás; kért típus és egységszám; felnőttek; gyermekek és életkorok; pótágy; kapcsolattartó/engedélyezett elérhetőség; foglalás forrása; kezelő által ellenőrzendő piaci szegmens; kívánt állapot/opcióhatáridő; ellenőrzött kapacitás és ár forrása/időpontja; dézsa; IFA; foglaló/fizetési határidő; emberi jóváhagyás. Ismeretlen mezőnél ellenőrzés szükséges, nincs kitalált alapérték.
3. Ez dokumentált kézi előkészítés, nem új V2-implementáció. A központi AI, jogosultságok, ügytár és üzleti szabályok változatlanok.

## Hátralévő és következő konkrét lépés
- A Reservation+ hozzáférési korlátjának engedélyezett feloldása után: beérkező online foglalás/ajánlatkérés beállításai; sablonok és küldési lehetőségek küldés nélkül; felhasználói szerepkörök és naplónézetek.
- Gyermekkor-kezelés, többegységes adatlap, részletes ár/kedvezmény/foglaló, mentési kötelező mezők: NEM IGAZOLT. Mentett szintetikus próba csak igazolt tesztkörnyezetben, egyértelmű felhatalmazással és mellékhatásvizsgálattal.
- A sarberki.hu honlap beküldése létrehoz-e Previo-bejegyzést: **NEM IGAZOLT**. A teszt online panelje nem bizonyítja az éles honlap integrációját.
- API-kulcs és szolgáltatói olvasási/sandbox/mellékhatásmentességi szerződés ellenőrzése továbbra külön kapu. Kulcsot chatbe/GitHubra nem kérünk.
- Kódjavítást indokoló reprodukált programhiba nincs; csak dokumentáció készült. Nincs telepítés, migráció, jogosultságváltozás, vendégküldés, valódi foglalás, pénzügyi vagy Previo-adatmódosítás.

## Folytatás – 2026-11-02 08:37–08:42 CET (07:37–07:42 UTC)
Címzett: Sárberki projektvezető chat. Ez a szakasz a korábbi hozzáférési akadály aktuális állapotát felülírja; a felmérés továbbra részleges.

### Kiindulás és ütközésvédelem
- Teljes aktuális AGENTS ismét ténylegesen beolvasva a fenti időablak elején; ág: gmail-test-subject-allowlist; blob: be27bd2dfb4795496bd9f3d64ad60ada1123de5b. A hívás másodperces időpontját nem rögzítettük.
- Induló HEAD: e531a04d2dc76afb86ca4580327b677a537d9908. Ehhez a branch-szűrt CI: [41404399976](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/41404399976) success; capacity regression 41404399941 success; a mobil push workflow 41404399947 skipped, nem élő mobilbizonyíték.
- A meglévő felmérés és központi feladatnyilvántartás visszaolvasva. Mentés előtti HEAD: c96df0563aadc882560e7b74fad26e4f4c9b0f25; Claude friss, ikon TEST-kiadásról szóló dokumentációs változása visszaolvasva. Alkalmazáskódja és feladatköre érintetlen.
- A kezdeti üres böngészőlap nem jelentett kijelentkezést: a PMS a meglévő munkamenettel, új jelszó vagy jogosultságkérés nélkül megnyílt. Minden vizsgált oldalon 73521 és a Sárberki Horgásztó - API TESZT fejléc szerepelt.
- Választás: a meglévő PMS2 beállítások olvasása. A korábbi identity-origin akadály a most megnyitott Reservation+ részoldalakat már nem blokkolta. Ez nem bizonyít új belépési folyamatot vagy API-hitelesítést.

### Új, ténylegesen visszaolvasott UI-bizonyítékok
Az állapotokat a betöltött oldal akadálymentességi/DOM-pillanatképéből olvastuk, nem pusztán a menüpont létezéséből. A kapcsolókat nem változtattuk meg.

| Oldal | Ténylegesen látott állapot | Következtetés és korlát |
|---|---|---|
| https://pms2.previo.app/73521/settings/applications/online-reservations/booking/general | A „foglalási naptáram a tényleges foglaltságot tükrözi…” és az időszakosan szabad szoba foglalását engedő checkbox egyaránt jelöletlen; online foglalás legkésőbb 00:00; Mentés tiltva | PASS a tesztbeállításra. Az első jelölő az online visszaigazolhatóságról szól; nem egyszerű naptárláthatósági kapcsoló. Beküldés és állapotképzés nem próbált. |
| https://pms2.previo.app/73521/settings/notifications/reservation | Új foglalás és Lemondott foglalás táblákban Partner / Manuális / Web kapcsolók mind kikapcsolva; „Értesítések engedélyezése” gomb látható | PASS a kapcsolók megfigyelésére. Az értesítés hiánya nem bizonyítja, hogy bejegyzés sem készül. Böngészős értesítési engedélyt sem kértünk. |
| https://pms2.previo.app/73521/settings/hotel/email | SPF-hitelesítés: Nincs beállítva; a felület spamkockázati figyelmeztetést ír. Feladó név/cím mező üres; saját SMTP kapcsoló kikapcsolva; Mentés tiltva | PASS a teszt konfigurációjára. Vendégküldési/voucher-próba nincs; az éles Outlook vagy Agent küldési képessége ebből nem állapítható meg. |
| https://pms2.previo.app/73521/settings/prices/currencies | Alapértelmezett pénznem HUF; egyéb pénznem EUR, forrás MNB, kijelzett árfolyam 1 EUR = 367,1100 HUF | PASS a kijelzett tesztértékre; nem rögzített üzleti árfolyam vagy szobaár. Nem építjük be a központi motorba. |
| https://pms2.previo.app/73521/settings/applications/online-reservations/booking/form-configuration | „Még nincs új R+ konfiguráció”; hozzáadás és saját foglalási űrlap megjelenítése gomb | PASS a konfigurátor állapotára. Nem bizonyítja régi űrlap vagy éles honlapos integráció hiányát. Új konfigurációt és vendégoldali foglalási folyamatot nem indítottunk. |
| https://pms2.previo.app/73521/settings/applications/online-reservations/booking/conversion | Google AdWords, Google Analytics 4, Google Tag Manager és Sklik kapcsolók kikapcsolva; Mentés tiltva | PASS a teszt mérési kapcsolóira; nem foglalási beérkezés bizonyítéka. |
| https://pms2.previo.app/73521/settings/applications/channel-manager/my-connections | RESERVATION+ és Offers Aktív / Alap / 0% | A korábban ismert kapcsolatok aktuálisan olvashatók; nem az Agent saját API-kulcsának vagy scope-jának bizonyítéka. |

### API / automatizálás / kézi visszaesési út
| Terület | Konkrét API bizonyítéka ebben a folytatásban | Használható V1-megoldás | Hiány |
|---|---|---|---|
| Online visszaigazolhatóság és honlapos igény | Saját API-hívás nem történt; e konfiguráció olvasási/írási végpontja nincs igazolva | Kezelő ellenőrzi a forrást, Previo-azonosítót és aktuális státuszt; meglévő ügyhöz kapcsolja, új foglalást csak meglévő bejegyzés kizárása után készít | Szintetikus, mellékhatás-ellenőrzött beküldés és PMS-azonosító összerendelése; éles honlap működése külön NEM IGAZOLT |
| Értesítések | Beállítás API-n keresztüli kezelése nem igazolt | Kezelői beérkezési ellenőrzés; értesítésre nem alapozunk duplikációvédelmet | Csatornák tényleges kézbesítési viselkedése |
| E-mail / voucher | A feladóoldal nem voucher-sablon vagy küldési API; új bizonyíték nincs ilyen végpontra | Meglévő emberileg jóváhagyott tervezet és kézi Previo-ellenőrzés | Sablonok, címzettlista, voucher és előzmény, saját API-szerződés |
| Pénznem / ár | A UI pénzneme nem teljes díjkalkuláció és nem API-árigazolás | Kezelő által ellenőrzött, forrással/időponttal jelölt ár az adatlaphoz | Díjtételek, kedvezmények, IFA, dézsa, foglaló együttes szerződése |

### Változtatás, korlát és következő lépés
- Bizonyított alkalmazáskódhiba nincs. A biztonságos hasznosítás a meglévő kézi adatlap/ellenőrzési sorrend pontosítása: előbb meglévő Previo-bejegyzés/forrás/státusz ellenőrzése, utána kezelői döntés; értesítés vagy üres konfigurátor nem jogosít új foglalásra. A motor és az üzleti szabályok változatlanok.
- A felső PMS-menü kattintásra és billentyűzetes lenyitásra nem adott olvasható kibontott menüt e böngészővezérlésben. A PMS2 oldalsó fában csak a fenti részoldalak voltak elérhetők. Ez kezelőfelületi automatizálási korlát; nem bizonyított jogosultsági vagy szolgáltatói hiba. Rejtett alkalmazásállapot, sessionből kinyert API vagy találgatott végpont használata nincs.
- **NEM IGAZOLT marad:** szerepkörök és műveletnapló részletei; voucher/sablon/küldési előzmény; gyermekkor és többegységes mentés; részletes ár/kedvezmény/foglaló; a sarberki.hu beküldés tényleges Previo-hatása; saját API-hozzáférés.
- Következő konkrét feladat: a régi PMS beállítási menüjének hozzáférhető megnyitásából a kommunikációs sablonok és felhasználói naplók olvasási felmérése, majd a hiányzó ár/gyermek/többegységes mezők. Nem új hitelesítési engedély a jelenleg bizonyított akadály.
- Kizárólag dokumentáció változott. Új automatizált teszt nem indokolt és nem futott; fent a meglévő CI állapotát olvastuk. Nincs Previo-mentés, küldés, foglalás, konfiguráció-/jogosultság-/AI-/üzletiszabály-módosítás, migráció vagy telepítés.

## Sablonok, szerepkörök és napló – 2026-11-02 08:52–08:57 CET
Címzett: Sárberki projektvezető chat.
- Teljes aktuális AGENTS beolvasva 08:52:43 CET; blob be27bd2dfb4795496bd9f3d64ad60ada1123de5b. Ág gmail-test-subject-allowlist, induló és mentés előtt visszaolvasott HEAD fee85a79689a29bf726f052e2d3de7ffe50d8b3d. Saját korábbi dokumentációs CI 41408190873 completed/success. Központi feladatnyilvántartás frissen visszaolvasva.
- **Menüakadály feloldva:** a Beállítások gomb alsó részére végzett natív koordinátás kattintás megnyitotta a menüt. A középre célzott kattintás nem nyitotta ki. A tényleges belső eseménykezelési gyökérok nem igazolt. Nincs szükség jogosultság- vagy beállításváltozásra; a korábbi menüblokkoló aktuálisan lezárva.
- Minden megnyitott nézet címe 73521 / Sárberki Horgásztó - API TESZT. Meglévő session; hitelesítési módosítás nincs.

| Vizsgálat | Visszaolvasott bizonyíték | Státusz / korlát |
|---|---|---|
| Beállítások / Leírások / Egyéb | https://pms.previo.app/73521/settings/web_page_translation#webPageTranslation : bejelentőlap, hitelkártyagarancia, kártyagarancia/fizetési kérelem, fizetési kérelem, foglalásból közvetlen e-mail és SMS szövegmezői | PASS a mezők elérésére. A közvetlen e-mail iframe törzse üres (látható szöveg nem érkezett); más nyelvváltozat és összes sablontartalom nem igazolt. Mentés/küldés nincs. |
| Beállítások / Felhasználók / Szerep | https://pms.previo.app/73521/settings/roles#roles : egy Manager szerepkör, egy hozzárendelt felhasználó | PASS a tesztlistára. Nem az Agent Writer/Approver szerepköre és nem API-scope. |
| Manager adatlap / Művelet / Foglalás | Általános, Modulok, Művelet, Engedélyezett IP fülek; foglalásszerkesztés/törlés jogmátrix Mind, Opció, Megerősítve, Bejelentkezve, Kijelentkezett, Más, Várólista, Lemondás, No-show oszlopokkal | PASS a mátrix létezésére. A grafikus jogosultságjelek pontos jelentése és tényleges tiltó/végrehajtó viselkedés nem tesztelt. Semmilyen kapcsolót nem módosítottunk; Visszavonás gombbal bezárva, a szerepkörlista visszatért. |
| Jelentések / Felhasználói tevékenység | https://pms.previo.app/73521/stats/log : dátum, kulcsszó, felhasználó és tevékenység szűrők; eredménytábla Dátum/Tevékenység/Részletek/Felhasználó/IP oszlopok | PASS az olvasási felületre. Foglalás, pénzügy, árlista, egység, szerepkör, kommunikáció és online foglalás is külön eseménycsoportként látszik. |
| Tényleges naplókeresés | Keresés megnyomva 2026.11.01.00:00–2026.11.02.23:59 kijelzett időablakkal, további szűrők változtatása nélkül. Betöltés befejezése után Nincs megfelelő találat / Nincs megjeleníthető adat | PASS a lekérdezés eredményére. Nem bizonyítja a teljes napló ürességét, a naplózás hiányát vagy az összes művelet mellékhatásmentességét. |

### Dokumentáció és biztonságos hasznosítás
A hivatalos dokumentáció friss keresési találatai: https://help.previo.app/en/doc/communication/ és https://help.previo.app/en/doc/reservation-history/ . Ezek általános képességet írnak le: a kommunikációs nézet elküldött e-mail/SMS eseményeket szűr, a foglalástörténet műveleteket és részleteket mutat. A kommunikáció leírása szerint a vendég válasza a levelezőbe érkezik; ez dokumentált általános állítás, nem a jelen teszt saját bejövőlevél-próbája vagy éles Sárberki-bizonyíték.
- V1-haszon: megmarad a Gmail/Outlook bejövő lánc szükségessége; nem helyettesítjük feltételezett Previo-kétirányú postafiókkal. Kézi átadáskor külön Previo-azonosító és kommunikációs előzmény ellenőrzendő. A PMS Manager jog nem helyettesíti a saját független jóváhagyást.
- E funkciók konkrét API-végpontja/saját API-hozzáférése továbbra NEM IGAZOLT; UI-hozzáférésből nem állítunk API-működést. Bizonyított alkalmazáskódhiba nincs, kódjavítás nem indokolt.
- Következő hiányzó felmérés: részletes ár/kedvezmény/foglaló, gyermekkor és többegységes adatlap, voucher előállítás és meglévő foglalás kommunikációs/történeti részlete. Az éles honlap beküldésének hatása külön NEM IGAZOLT.
- Csak a meglévő GitHub-dokumentáció módosul. Nincs Previo-mentés, küldés, foglalás, jogosultságváltozás, éles művelet, migráció vagy telepítés. Új automatizált teszt nem futott.
