# Sárberki foglaltságkezelési kötelező ellenőrzési pont

## CHATGPT ↔ WORK ↔ CLAUDE GITHUB-ÜZENETVÁLTÁS – tulajdonosi szabály, 2026-11-03

- **Work név szerinti részvétele (tulajdonosi pontosítás, 2026-11-03):** e kommunikációs rend a ChatGPT projektvezető chatre, Claude Code-ra és a ChatGPT Work munkameneteire egyaránt érvényes, egymás közötti minden irányban. Minden üzenetben szerepeljen a feladó (ChatGPT / Work / Claude), a címzett, a dátum és a konkrét kérés vagy válasz, szükség esetén az előzmény kommentlinkje.
- **Worknek: „Olvasd el Claude / a Chat üzenetét”** → a #9-ben olvasd be a megnevezett feladó legfrissebb, Worknek szóló, még nem feldolgozott üzenetét; a megengedett feladatot végezd el, és a választ/eredményt ugyanoda új kommentben írd vissza az eredeti feladónak, külön küldési felszólítás nélkül. **„Küldd el Claude-nak / a Chatnek”** → a #9-be írj új kommentet a megnevezett címzettnek. **ChatGPT-nek és Claude-nak: „Olvasd el Work üzenetét” / „Küldd el Worknek”** → ugyanígy járjanak el, Work címzettel, illetve Work üzenetére válaszolva.
- **Végrehajtási korlát Work esetén is:** a komment rögzítése nem indít másik munkamenetet, és nem igazolja az átvételt vagy a végrehajtást. Új Work-munkamenetben az aktuális AGENTS.md tényleges beolvasása szükséges; ez a módosítás nem állít be globális Work-utasítást. Nincs ismétlődő üres nyugtázás vagy végtelen válaszlánc. Claude marad az egyetlen elsődleges fejlesztő; Work konkrét speciális ellenőrzést végez a meglévő jogosultságai szerint.

- **Közös kommunikációs csatorna:** a repository GitHub [#9 issue](https://github.com/valkana6666-svg/Sarberki-Email-Age/issues/9). A projekt tényállapotának egyetlen forrása továbbra is a tesztági `docs/V1-ALLAPOT.md`; az issue csak üzenetváltás, nem második állapotnapló.
- **Claude-nak: „Olvasd el a Chat üzenetét”** → olvasd el a #9 issue legfrissebb, ChatGPT-től származó, még nem feldolgozott kommentjét; azonosítsd a feladathoz tartozó dátumot és hivatkozást. **„Küldd el a Chatnek”** → a megosztható választ tedd a #9 issue új kommentjébe, linkkel/bizonyítékkal; jelezd a felhasználónak, hogy rögzítetted.
- **ChatGPT-nek: „Olvasd el Claude üzenetét”** → olvasd el a #9 issue legfrissebb tényleges Claude-válaszát, és foglald össze a felhasználónak, szükség esetén a `docs/V1-ALLAPOT.md` friss visszaolvasásával. **„Küldd el Claude-nak”** → tegyél új kommentet a #9 issue-ba Claude címzettel.
- Csak az adott üzenetküldési vagy -olvasási kérésre kell a #9 issue-t megnyitni; rutin fejlesztési munkamenetnél nem szükséges az egész beszélgetést olvasni. Egyértelműen különítsd el az üzenet rögzítését a címzett általi átvételtől és végrehajtástól.
- **Kétirányú válasz külön felszólítás nélkül (tulajdonosi pontosítás, 2026-11-03):** ha a tulajdonos Claude-nak azt mondja: „Olvasd el a Chat üzenetét”, Claude a #9-ben beolvassa a legfrissebb, neki szóló, még nem feldolgozott üzenetet, és ha az kérdést vagy engedélyezett feladatot tartalmaz, a választ/eredményt **ugyanoda, új kommentben automatikusan visszaírja ChatGPT-nek** a futó munkamenetében; nem szükséges külön „Küldd el a Chatnek” felszólítás. Ugyanígy, ha a tulajdonos ChatGPT-nek azt mondja: „Olvasd el Claude üzenetét”, ChatGPT beolvassa a neki szóló új üzenetet, a megengedett és elvégezhető feladatot feldolgozza, és a választ/eredményt **ugyanoda, új kommentben visszaírja Claude-nak**, külön „Küldd el Claude-nak” felszólítás nélkül. Ha akadály vagy engedélykérés szükséges, azt jelzik, nem lépik át a jogosultsági korlátokat. A kommentekből a címzett és az aktuális kérés azonosítandó; ne legyen végtelen automatikus válaszlánc vagy változatlan üzenetek ismételgetése.
- **Nem automatikus üzenetkézbesítés:** issue-komment nem indít Claude-munkamenetet, és a Claude-alkalmazás puszta megnyitása nem bizonyít GitHub-beolvasást. Új Claude-munkamenetben e szabály érvényesülését külön kell igazolni; ha nincs GitHub-hozzáférés, jelöld NEM IGAZOLT-nak.
- Titkot, személyes vendégadatot, tokent nem szabad issue-ba írni. Nincs új main/production, levélküldési, foglalási vagy Previo-írási engedély. A meglévő biztonsági szabályok érvényben maradnak.

## TESZT-LEVÉLKÜLDÉSI ENGEDÉLY – tulajdonosi döntés, 2026-11-03 (szűk kivétel)

- **Engedélyezett kör, kizárólag:** a `sarberkiprojecttest@gmail.com` (rendszer-tesztpostafiók) és a `sarberkito@gmail.com` (ideiglenes, közös tesztfeladó) **egymás közötti** levelezése, **csak kitalált** tartalommal (nincs valódi vendég-, foglalási vagy személyes adat). Bármely más címzett, másolat (Cc/Bcc) vagy továbbítás tilos.
- **Ki küldhet:** (1) Claude a tulajdonos által bekötött Gmail-csatlakozón keresztül; (2) a V1 TEST-rendszer – emberi jóváhagyás után és később automatikusan is –, de csak külön megvalósított és tesztelt küldési képességgel: rögzített címzettlista (csak a fenti pár), idempotens küldési napló, alapból kikapcsolt kapcsoló és egylépéses kikapcsolás. Ennek elkészültéig a rendszer nem küld.
- **Sorrend (tulajdonos, 11-03):** előbb Claude-küldés + emberi jóváhagyás néhány levéllel; utána a rendszer automatikus küldése erre a párra.
- Az `info@sarberkito.hu`, valódi vendég, production és Previo-írás továbbra is tilos; az alábbi „Tilos valódi e-mail küldése” szabály minden más esetre érvényes.

## FÓKUSZ ÉS HATÉKONYSÁG – tulajdonosi döntés, 2026-11-02 (minden ágensre: Claude, Work, Codex, óránkénti futás)

A cél a működő V1 és annak valódi használata, nem a folyamat további auditálása. Ez a szakasz a munkasorrendet és a munkamódot szabályozza; az alábbi biztonsági, jogosultsági és tiltó szabályok egyikét sem gyengíti.

**Fejlesztési sorrend:**
1. **V1 lezárása:** Drive-mentés (tulajdonosi secret), rövid állapotfájl, kiadásra jelölési ellenőrzés.
2. **Kontrollált éles bevezetés:** a valódi postafiók csak olvasó bekötése; a kezelő a választ kézzel küldi. Production-aktiválás csak külön tulajdonosi engedéllyel.
3. **Csak olvasó Previo-kapacitás és ár** a tervezetbe, a meglévő Previo-kapu és mellékhatás-igazolás szerint.
4. Csak ezután: V2-előkészítés (Previo-írás, automatikus küldés, telefon). Ami nem az aktuális lépést viszi előre, az halasztandó.

**Szerepek (tulajdonosi döntés, 2026-11-02; felülírja az alábbi régebbi „Work koordinál” szabályokat):**
- **Claude Code – egyetlen elsődleges fejlesztő:** kódolás, tesztelés, javítás, engedélyezett TEST-kiadás és élő TEST-ellenőrzés.
- **Work – speciális ellenőrző, csak konkrét, indokolt feladatra:** Previo, Gmail-fiók, Drive, Supabase és más, Claude-nál hiányzó hozzáférés. Claude munkáját rutinszerűen nem ellenőrzi újra és nem dokumentálja újra.
- **Tulajdonos/projektvezetés:** prioritás, üzleti döntés, biztonság, eredményértékelés.
- Független kontroll csak kritikus pontokon: jogosultság/RLS-változás, adatkezelés, production- vagy éles bevezetés, kiadásra jelölés. Egymás munkájáról rutinjelentés nem készül.
- Az óránkénti Claude-futás csak kiosztott, SZABAD feladaton dolgozik.

**Munkamód:**
- Elsődleges állapotforrás a `docs/V1-ALLAPOT.md` (legfeljebb 40 sor). Munkamenet elején az AGENTS.md és ez a fájl elég; a hosszú `docs/V1-FOLYTATASI-PONT.md` archívum, csak célzott kereséssel olvasandó, és nem bővítendő tovább.
- Igazolt, PASS eredményt ne ellenőrizz újra, és ne dokumentálj újra. Változatlan HEAD és AGENTS-blob esetén ne olvasd be újra a teljes dokumentációt.
- Egy feladat = egy commit (eredmény + állapotfájl-frissítés együtt). Nincs külön „record” és „link” commit, nincs no-op commit.
- Jelentés: egy tömör táblázat (ellenőrzés / bizonyíték / eredmény) és legfeljebb 5 sor korlát és következő lépés. A változatlan tiltásokat ne sorold fel; elég: „tiltások: AGENTS.md szerint”.
- Ha nincs elvégezhető feladat: egy mondatos jelentés, commit nélkül.
- **Eszközjavaslat (tulajdonosi kérés, 2026-11-05):** ha munka közben egy kész program vagy szolgáltatás egyszerűbben, gyorsabban vagy olcsóbban megoldana egy feladatot, mint az ágens (akkor is, ha az ágenst váltaná ki), jelezd röviden: mire jó, várható költség, adatvédelmi/biztonsági kockázat, és miért jobb. Csak javaslat: telepítés, előfizetés vagy fiók létrehozása kizárólag tulajdonosi döntéssel; titok és valódi vendégadat nem kerülhet külső eszközbe engedély nélkül.

**Previo-írás (TEST is) – tulajdonosi döntés, 2026-11-02:** foglalás létrehozása, módosítása, lemondása, voucher, sablon vagy beállítás csak **előzetes, konkrét tulajdonosi engedéllyel**, műveletenként. Az engedélyt a végrehajtás előtt a `docs/V1-ALLAPOT.md` „Engedélyek” részébe kell rögzíteni: ki, mikor, pontosan melyik művelet, milyen tesztadat, hogyan zárul. Általános feladatleírás („szükséges szintetikus próba megengedett”) nem engedély. **Utólagos tudomásulvétel nem engedély**, és nem helyettesíti az előzetes engedélyt; külön, „UTÓLAGOS TUDOMÁSULVÉTEL” jelöléssel rögzítendő. Olvasó felmérés engedély nélkül folytatható. Ez a szabály a fenti és alábbi Previo-tiltásokat nem lazítja.

## KÖTELEZŐ FEJLESZTÉSI DÖNTÉSI PROTOKOLL – 2026-10-30

Ez a szabály a Sárberki V1/V2 valamennyi új feladatára, hibajavítására, refaktorálására és Codex-munkamenetére érvényes. A meglévő biztonsági, jogosultsági, adatvédelmi és jóváhagyási korlátokat nem gyengítheti.

1. **Előbb bizonyítsd a kiindulási állapotot.** Vizsgáld meg a felhasználói célt, a már meglévő kódot, teszteket, konfigurációt, szolgáltatásokat és működő funkciókat. Ne indíts új architektúrát feltételezésekből.
2. **Alternatívák, majd döntés.** Mérlegeld a meglévő beállítás javítását, a célzott kódjavítást és szükség esetén a kész, bevált megoldást vagy új fejlesztést. Legalább két érdemi út esetén röviden hasonlítsd össze a megvalósíthatóságot, időt, költséget, kockázatot és karbantartást; ne készíts mesterségesen három alternatívát, ha nincs három.
3. **A legkisebb igazoltan megfelelő beavatkozást válaszd.** Nem feltétlenül a legkevesebb kódsor vagy legrövidebb becsült idő a legjobb: a biztonság, működőképesség, stabilitás és szükséges bővíthetőség kötelező feltétel. Ne építs újra működő rendszert, ne hozz létre párhuzamos motort.
4. **Csak a valódi hibát javítsd.** Előbb reprodukáld és azonosítsd a kiváltó okot. Különítsd el az OAuth-/jogosultsági/konfigurációs hibát a programhibától és a kezelőfelületi hibától. Őrizd meg a jóváhagyott üzleti szabályokat, a központi AI-motort és a részletes tesztkezelőt.
5. **Tény, feltételezés, becslés elkülönítése.** Ne állíts bizonyítatlan működést, elkészültséget vagy gyökérokot. Időbecslést csak azonos készültségi célra, tételes feltételekkel adj; felhasználói nyomásra bizonyíték nélkül ne változtasd meg.
6. **Élő működési igazolás.** A unit/mock/CI teszt nem egyenlő a valódi Gmail → AI → kezelő → jóváhagyás folyamattal. A szükséges E2E, iPhone és jogosultsági ellenőrzést külön jelöld: PASS / FAIL / NOT_VERIFIED. Ha külső engedély hiányzik, ne kerüld meg.
7. **Eszköz és munkamód a feladathoz igazodjon.** Work a jogosult környezeti és felhasználói folyamat-ellenőrzéshez, Codex a célzott kódfeladathoz, de ne köss feladatot automatikusan egyikhez sem. Minimalizáld a fölösleges hívásokat, módosításokat, újrafuttatásokat.
8. **Végrehajtás előtti rövid döntési napló:** meglévő eszközök / bizonyítékok; érdemi alternatívák; választás indoka; mihez NEM nyúlunk; ellenőrzési terv. Végrehajtás után a módosított fájlokat, tesztbizonyítékokat és megmaradt korlátokat sorold fel.

**Aktuális elsőbbség:** A Gmail-tesztfiók saját alkalmazási OAuth és olvasási láncának bizonyítása, AI-válaszjavaslat és napi kezelői megjelenítés. Ne építsd újra a Gmail-részt, amíg a tényleges hibapont nem igazolt. Az éles levelezés, automatikus küldés, Previo-írás és production változatlanul tiltott külön felhatalmazás nélkül.


- Kizárólag a `gmail-test-subject-allowlist` tesztág módosítható. Main és production nem módosítható.
- Tilos valódi e-mail küldése (kivétel: a fenti TESZT-LEVÉLKÜLDÉSI ENGEDÉLY szűk köre), valódi foglalás létrehozása és Previo-adatok módosítása.
- A vendégnek foglalhatóként csak a kért teljes időszakra és szükséges egységszámra ténylegesen ellenőrzött elhelyezés ajánlható. Ismeretlen, hibás vagy más dátumhoz tartozó adat nem szabad kapacitás.
- Alternatív háztípus ugyanarra az időszakra külön kapacitásellenőrzést igényel. A háztípus megadása nem kerülheti meg az ellenőrzést.
- A/B közös típusszintű poolja nem bizonyít A+B párost ugyanabban a fizikai faházban. Egyedi egységet vagy párost kizárólag egyedi ellenőrzéssel lehet igazoltnak jelölni. Közelségi kikötés nélkül a megfelelő igazolt típusszintű készletből különböző fizikai házak is ajánlhatók; egymás melletti elhelyezést kizárólag egyedi ellenőrzéssel lehet ígérni.
- A szabad egységszám pillanatfelvétel, nem foglalás vagy garancia; végleges vendégajánlat előtt a kezelő ismét ellenőrizze a rendelkezésre állást.
- Kapacitást érintő fejlesztésnél teljes `npm test`, hibás/hiányzó forrásra vonatkozó negatív teszt és a foglalható/foglalt határ ellenőrzése kötelező. Az automatikus teszt nem helyettesíti az élő Previo-val történő összevetést.
- Referencia: `reports/availability-audit-2026-10-08/REPORT.md`; anonim opt-in élő ellenőrzés: `node tests/live-availability-audit.mjs --live-read-only`.

- Tartós stratégia: a Sárberki a későbbi AI-vállalkozás első alkalmazása. Új fejlesztésnél moduláris, vállalkozásonként elkülönített és tesztelhető határokat alakíts ki a jelenlegi stabilitás megőrzésével. Részletek: `docs/PLATFORM-STRATEGY.md`.
- Élő Previo-lekérdezést ne ismételj, amíg az alkalmazott műveletek készletzárolási mellékhatásának hiánya nincs dokumentáltan igazolva. A teszthost önmagában nem engedély: a szerveroldali biztonsági kapcsoló alapértelmezetten tilt.

- Központi ügytár: `supabase/migrations/202610090001_case_store.sql` és `shared-core/server-booking-runtime.mjs`. A Netlify ügy-API alapértelmezetten tiltott, és jelenleg kizárólag szintetikus tesztadatokhoz készül.
- Service role nem használható ezen a tárolási útvonalon. A definer SQL-függvény külön ellenőrzi az `auth.uid()` és a DB-tagság szerinti jogosultságot. RLS-t valódi PostgreSQL-motoron is tesztelj, ne csak mockkal.
- Nincs automatikus localStorage-migráció. Tulajdonosi bejelentkezés, felhős RLS/E2E ellenőrzés és mentés-helyreállítás nélkül ne aktiváld és ne fogadj valódi vendégadatot.

## Projektcél és közös architektúra

- V1: érdeklődés értelmezése → ellenőrzött választervezet → emberi jóváhagyás. A chatbot és az e-mail-agent külön felület, teszt és bevezetési folyamat; egyetlen közös üzleti döntési magot használ: `shared-core/central-inquiry-decision.mjs` és a meglévő adatértelmezési, kapacitás-, ár- és csatornaadapter-modulok.
- Ne készíts második válaszmotort, ügykezelőt vagy jogosultsági rendszert. Auth, RLS, tenant-elkülönítés, CAS és tranzakciós audit megőrzendő.

## Kötelező értelmezési és lekérdezési sorrend

1. Értelmezd a vendég kérését és az ismert ügyadatokat; különítsd el az egy- és többegységes elhelyezést.
2. Ellenőrizd a belső foglalási szabályokat, a háztípust, az egységszámot és a fizikai alkalmasságot. Alkalmatlan jelöltre ne indíts külső lekérdezést.
3. Először a kifejezetten kért, alkalmas háztípust ellenőrizd. Igazolt elérhetőségnél nincs szükségtelen alternatív keresés; alternatívát csak igazolt foglalhatatlanság után vizsgálj. Ismeretlen/sikertelen válasz nem indokol automatikus lekérdezési láncot.
4. Csak a szükséges kapacitásforrásokat kérdezd le, és csak megfelelő, igazolt elhelyezésre számolj árat. A minimális hívásszám nem írhatja felül a kifejezetten kért típust.
5. Csak ellenőrzött tervezet készülhet, emberi jóváhagyással és szükség esetén új kapacitásellenőrzéssel. Az ügy, kapacitás és ár saját forrása, időpontja és verziókötése külön ellenőrizendő.

- Egyetlen egység iránti kéréshez ne ajánlj automatikusan több házas/apartmanos kombinációt. Többegységes lehetőséget csak kifejezett kérés vagy elfogadás esetén vizsgálj; ennek bizonyítékát őrizd meg az ügyadatokban.
- Osztott A/B alapkapacitása 2 fő; C alapkapacitása 4 fő, pótággyal legfeljebb 5. Öt főnél a pótágy és elhelyezés feltételét jelezd; a felár külön bizonyíték nélkül nem igazolt. Hat főnek egyetlen C nem ajánlható. A meglévő közelségi/azonos házi ellenőrzési szabályok változatlanok.
- Vendégszövegbe belső házszám nem kerülhet. Ár-, kedvezmény-, előleg-, lemondási, gyermek- és dézsaszabályt kizárólag jóváhagyott üzleti módosítás alapján változtass.

## Work-keret utáni kötelező GitHub-beolvasási ellenőrzés – 2026-10-30

- **Állapot: NEM IGAZOLT.** A Work-keret elfogyása előtt a ChatGPT-projektutasítások felismerését kipróbáltuk, de a Work új munkamenetben történő tényleges GitHub-`AGENTS.md`-beolvasását és az utasítások tartós Work-mentését nem igazoltuk. Ezeket tilos késznek vagy automatikusnak jelenteni.
- **A következő elérhető Work-munkamenet első feladata:** nyissa meg a `valkana6666-svg/Sarberki-Email-Age` repository `gmail-test-subject-allowlist` ágának aktuális `AGENTS.md` fájlját, és olvassa be teljesen. Közölje a pontos ágat, az ellenőrzött teljes commit SHA-t, az olvasás időpontját és a forráshivatkozást; külön jelezze, ha bármely adat nem ellenőrizhető.
- Hasonlítsa össze a ténylegesen beolvasott szabályokat a Sárberki AI Agent ChatGPT-projektutasításaival, sorolja fel az eltéréseket. Mutassa be saját szavaival a meglévő megoldások ellenőrzésének, a legegyszerűbb biztonságos javítás kiválasztásának, a tesztbizonyítékoknak és a production-tilalomnak a szabályait.
- Ellenőrizze, hogy saját tartós Work-utasítás ténylegesen el van-e mentve és új Work-munkamenetben betöltődik-e. Ha nincs hozzáférése a beállításhoz vagy a megismételt ellenőrzéshez, eredmény: **NEM IGAZOLT**, nem PASS. A GitHub-fájl létezése önmagában nem igazolja az automatikus Work-beolvasást.
- A két ellenőrzésről adjon **PASS / FAIL / NEM IGAZOLT** státuszt, konkrét bizonyítékot és szükséges további lépést. A fenti ellenőrzéshez ne módosítson kódot, Gmail-fiókot vagy éles rendszert.
- Az ellenőrzés után a meglévő Gmail OAuth → olvasás → központi AI → napi kezelő → jóváhagyás lánc, valamint a mentés és **valóban kipróbált visszaállítás** marad a P0 feladat. Csak célzott, a bizonyított hiba okához illő minimális javítás engedett.

## Work tartós projektutasítása – kötelező döntési kapu

- Ez a fájl a Sárberki-projekten dolgozó Work számára is kötelező projektutasítás, nem csupán a Codexnek szól. Minden új Work-munkamenet kezdetén olvasd be a tesztág aktuális `AGENTS.md` fájlját, és a fenti **KÖTELEZŐ FEJLESZTÉSI DÖNTÉSI PROTOKOLL** szabályait alkalmazd az összes tervezésre, eszközválasztásra, kóddelegálásra és ellenőrzésre.
- Mielőtt új rendszert, összetett integrációt vagy többnapos fejlesztést javasolnál: igazold a meglévő lehetőségeket, hasonlítsd össze a valóban létező egyszerűbb alternatívákat, válaszd a legkisebb biztonságosan megfelelő beavatkozást. A felhasználóra ne hárítsd a technológiai alternatívák feltárását.
- Minden Codexnek delegált feladatban hivatkozz erre az `AGENTS.md`-re, és követeld a konkrét gyökérokot, minimális módosítást, tesztet és tényszerű beszámolót.
- A jelenlegi P0 feladat: a meglévő Gmail OAuth → csak olvasás → közös AI → napi kezelő folyamat befejezése. Nem indokolt párhuzamos motor, új e-mail-infrastruktúra vagy másodlagos ügytár építése a hiba bizonyítása nélkül.
- A Work saját, általános beállítását ez a GitHub-fájl nem változtatja meg automatikusan: akkor biztos projektutasítás, ha az adott Work-munkamenet ténylegesen beolvassa. Nem szabad ellenőrizetlenül azt állítani, hogy a Work valamennyi új beszélgetésére globálisan érvényes.

## Work–Codex végrehajtás és igazolás

- (2026-11-02 óta a fenti Szerepek érvényesek; ez a pont csak a Work konkrét célfeladataira vonatkozik.) Work koordinál; programozáshoz és automatizált teszthez lehetőség szerint közvetlen Codex-feladatot indít. Csak tényleges átadást jelents átadásnak. Az eredményt a koordinátor külön ellenőrzi.
- Feladat előtt olvasd ezt az útmutatót, ellenőrizd a tesztág HEAD-jét, a releváns korábbi commitokat, CI-t és nyitott hibákat. Ne ismételj kész fejlesztést vagy indokolatlanul sikeres tesztet. Csoportosítsd a független ellenőrzéseket.
- Párhuzamos munkát ne írj felül. A szükséges legkisebb módosítást, külön fájltulajdonlást és commit előtt friss HEAD-ellenőrzést használj; force push tilos.
- Szintetikus adatokkal futtasd az érintett célzott és negatív teszteket. Kapacitást érintő változtatásnál a fenti teljes `npm test` követelmény érvényes. Fixture/mock, valódi PostgreSQL, böngésző-emuláció és élő forrás bizonyítékát külön jelöld.
- Commit után ellenőrizd a teljes SHA-t és az adott commit releváns CI-jét. Actions-futásokat branch-szűrővel kérj le, ne csak PR-futásokból következtess. Telepítésnél a teszthost pontos build SHA-ját is ellenőrizd.
- Jelentés: elvégzett feladat, módosított fájlok, teljes commit SHA, tesztek PASS/FAIL/SKIP száma, CI-állapot és bizonyítéklink, fennmaradó akadály, következő konkrét feladat. Nem ellenőrzött eredmény: NEM IGAZOLT.
- Valódi vendégadat és titok nem kerülhet tesztbe, naplóba vagy GitHubra; automatikus vendégküldés, Pushover-küldés és valódi foglalás tiltott. Élesítés külön ellenőrzést és jóváhagyást igényel.

## Elsődleges cél és ütemterv

- Határidő: 2026-10-18, V1 kiadásra jelölt chatbot + AI-agent, dokumentált feltételekkel a fokozatos élesítéshez. Ez nem automatikus production-aktiválási engedély.
- 10-12: szabályok, hívásminimalizálás, aktuális commit/CI és hibák; 10-13: kapacitás/ár és bizonytalan források; 10-14: csatornaparitás, jogosultság/jóváhagyás; 10-15: HU/DE/EN/SI és foglalási feltételek; 10-16: HTTPS, tényleges iPhone és vendég-/e-mail-folyamat; 10-17: regresszió, integráció, biztonság, audit, mentés/restore; 10-18: kiadásra jelölési ellenőrzés.
- A már igazolt feladatokat eredményük alapján lezártnak kezeld; a dátum nem indokol újrafuttatást. Eltérésnél a függőséget és akadályt dokumentáld, majd térj vissza az elsődleges célhoz.
- GitHub #3 AI-hatékonyság-/hibaaránymérés halasztott; a dokumentált későbbi feladat nem blokkolhatja a V1-et, és most nem fejlesztendő.

## V2/V3-kompatibilitás – 2026-10-12

- A V1 meglévő közös magját fejleszd tovább: determinisztikus üzleti döntés, külön AI-/kommunikációs adapter, hitelesített tenant és külön olvasási/írási/jóváhagyási jog. Csatornaadat vagy AI-kimenet soha nem ad műveleti jogosultságot.
- Először a V1 blokkolóit javítsd. Csak bizonyított későbbi újraírást elkerülő modulhatárt készíts elő; új válaszmotor, előre megépített SaaS/voice funkció vagy általános keretrendszer tilos indokolt feladat nélkül.
- A későbbi külső végrehajtás külön képesség legyen: tenant- és műveletjog, aktuális üzleti feltételek, feature flag, idempotenciakulcs, tartós műveleti audit, korlátozott retry/timeout és emberi visszaesési út szükséges. Tervezet vagy belső jóváhagyás önmagában nem küldési/foglalási engedély.
- Most nem implementálunk vagy aktiválunk automatikus vendégküldést, Previo-írást/foglalást vagy telefonos V3-at. A Previo írási API megvalósíthatóságát és mellékhatásait külön kell igazolni.
- A szerveres hitelesítési segéd, sessionkulcs és szolgáltatói token nem publikálható statikus kliensmodulként. Tartós belépés mellett minden védett olvasásnál megmarad a tényleges Auth- és jogosultságellenőrzés.
- Minden jelentés jelölje a V2/V3 értéket és a bizonyíték korlátját. Technikai leltár: `docs/V2-V3-ARCHITECTURE-GAPS-2026-10-12.md`.
