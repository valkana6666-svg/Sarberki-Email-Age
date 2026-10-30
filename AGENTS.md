# Sárberki foglaltságkezelési kötelező ellenőrzési pont

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
- Tilos valódi e-mail küldése, valódi foglalás létrehozása és Previo-adatok módosítása.
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

## Work tartós projektutasítása – kötelező döntési kapu

- Ez a fájl a Sárberki-projekten dolgozó Work számára is kötelező projektutasítás, nem csupán a Codexnek szól. Minden új Work-munkamenet kezdetén olvasd be a tesztág aktuális `AGENTS.md` fájlját, és a fenti **KÖTELEZŐ FEJLESZTÉSI DÖNTÉSI PROTOKOLL** szabályait alkalmazd az összes tervezésre, eszközválasztásra, kóddelegálásra és ellenőrzésre.
- Mielőtt új rendszert, összetett integrációt vagy többnapos fejlesztést javasolnál: igazold a meglévő lehetőségeket, hasonlítsd össze a valóban létező egyszerűbb alternatívákat, válaszd a legkisebb biztonságosan megfelelő beavatkozást. A felhasználóra ne hárítsd a technológiai alternatívák feltárását.
- Minden Codexnek delegált feladatban hivatkozz erre az `AGENTS.md`-re, és követeld a konkrét gyökérokot, minimális módosítást, tesztet és tényszerű beszámolót.
- A jelenlegi P0 feladat: a meglévő Gmail OAuth → csak olvasás → közös AI → napi kezelő folyamat befejezése. Nem indokolt párhuzamos motor, új e-mail-infrastruktúra vagy másodlagos ügytár építése a hiba bizonyítása nélkül.
- A Work saját, általános beállítását ez a GitHub-fájl nem változtatja meg automatikusan: akkor biztos projektutasítás, ha az adott Work-munkamenet ténylegesen beolvassa. Nem szabad ellenőrizetlenül azt állítani, hogy a Work valamennyi új beszélgetésére globálisan érvényes.

## Work–Codex végrehajtás és igazolás

- Work koordinál; programozáshoz és automatizált teszthez lehetőség szerint közvetlen Codex-feladatot indít. Csak tényleges átadást jelents átadásnak. Az eredményt a koordinátor külön ellenőrzi.
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
