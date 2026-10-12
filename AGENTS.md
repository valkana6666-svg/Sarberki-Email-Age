# Sárberki foglaltságkezelési kötelező ellenőrzési pont

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
