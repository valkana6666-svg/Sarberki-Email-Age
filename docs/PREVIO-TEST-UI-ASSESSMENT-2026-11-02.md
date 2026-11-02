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
