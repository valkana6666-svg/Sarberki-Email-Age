# Saját dézsa hiánya és szolgáltatáselérhetőség szétválasztása

2026-10-16. Kizárólag gmail-test-subject-allowlist. Távoli kiindulás 74b9f7d078e207dc088755e9040309408488e60f: CI 1642 PASS / 0 FAIL / 0 SKIP, pontos azonos tesztbuild. Fő CI: 38952704653, job117147794836.

## Hiba és minimális javítás

A tubServiceProjection az adott szállásház fizikai dézsahiányát a teljes szolgáltatás verificationStatus=not_available állapotává tette. A jóváhagyott üzleti szabály szerint a 7–10-es házak vendége másik házhoz rögzített dézsát is bérelhet, ezért ez nem teljes szolgáltatási foglaltsági bizonyíték.

A fizikai assessTubEligibility és a házlista változatlan: 7–10 saját dézsája nincs, az 1–6/11–15 elhelyezés önmagában nem bizonyít szabad erőforrást. A szolgáltatásprojekció most elérhetőségre kizárólag unverified állapotot ad, amíg a külön hiteles naptár ellenőrzése nem történik meg. A visszavonás és actionConflict kezelése változatlan. Nincs automatikus másik dézsa kijelölés vagy AVAILABLE, ár-/jóváhagyási ígéret.

A négy fizikai szállásház másik házbeli bérlési kérelme megőrzi a szolgáltatás dátumát, célügyét és a szállásadatokat. A teszt a fizikai not_available állapot megmaradása mellett a szolgáltatás unverified státuszát, a Reader figyelmeztetését és az emberi jóváhagyás szükségességét külön ellenőrzi. Negatív kontroll: tárolt eligibility vagy kliens availability=available sem adhat naptári bizonyítékot.

## Ellenőrzés

- Öt célzott suite (linked service, classifier, central preview, PostgreSQL és külön service approval): 26 PASS / 0 FAIL / 0 SKIP.
- A Previo-hozzáféréstől független teljes helyi npm test a jelenlegi fájlokkal, a már publikált előnézeti javítást is tartalmazva: 1644 PASS / 0 FAIL / 0 SKIP, 25.2 másodperc.
- git diff --check: PASS.
- A runtime/UI-scope javítás két célzott suite-ja a helyi környezet helyreállása után 24 PASS; ezek átfedő eredmények, nem összeadandók. Az előző jelentés helyi transporthibája megszűnt.
- A módosított commit CI-jét és teszttelepítését külön ellenőrizni kell. A teljes helyi siker nem azonos élő naptárigazolással.

A fizikai erőforráson végzett ütközésvizsgálat és a hiteles naptárhoz kötött jóváhagyó változatlan. A hiányos Previo-megjegyzéslista továbbra sem bizonyít elérhetőséget. A korábbi felhős review v2 döntést nem ismételtük és nem írtuk át.

Production/main, sarberkito.hu, adatbázisséma/jogok és korábbi mentések változatlanok. Nincs vendégadat, küldés, AI-providerhívás, Previo-lekérdezés vagy foglalás. V2/V3-érték: a szállás fizikai felszereltsége és a külön bérelhető erőforrás naptárbizonyítéka nem keveredik. A Previo sandbox-hozzáférés a tulajdonos hétfői ügyintézésére vár.
