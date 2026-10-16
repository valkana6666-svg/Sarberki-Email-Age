# Dézsaelérhetőség ellenőrzési modul – 2026-10-16

Kiindulás: `d31acd5a6dc085744fb86cda9141da3e97e480df`, 1580 PASS / 0 FAIL / 0 SKIP és azonos teszthost-build. Csak a `gmail-test-subject-allowlist` ág módosul.

## Elkészült kód

`shared-core/server-tub-availability.mjs`: alapértelmezett adatforrás nélküli, szerveroldalon konfigurálható ellenőrző. A meglévő AVAILABILITY/TTL és hiteles üzleti konfiguráció szerint az 1–6 és 11–15 házak lehetnek jogosultak; a fizikai alkalmasság nem elérhetőségi bizonyíték.

A kérés tenant/ügy/verzió/ház/erőforrás és explicit időzónaeltolásos teljes kezdés-vég intervallumhoz kötött. A szolgáltató azonosítója, eredete, metódusa és erőforrása szerveroldali bekötés; kliens vagy vendéglevél nem választhat hiteles forrást. Teljes időszaki lefedettség, teljes releváns foglaláslista, bizonyítékhivatkozás és verzió, checkedAt/validUntil és szigorú lejárat szükséges. A közösen bérelhető dézsa másik háznál fennálló ütközése is blokkol; érintkező fél-nyílt intervallumok nem fedik egymást.

Hibás, hiányzó, idegen vagy lejárt forrás UNKNOWN. A pillanatkép másolt, a kimenet és kérés változtathatatlan. A bizonyíték nem foglalás, jóváhagyás vagy visszaigazolási jog.

## Igazolás és korlát

- `node --test tests/tub-availability.test.mjs`: **11 PASS / 0 FAIL / 0 SKIP**, kizárólag szintetikus provider fixture. Jogosult/tiltott házak, többnapos és házak közötti erőforrásütközés, időhatárok, hibás dátum/offset, tenant/ügy/verzió-kötés, hiányzó provenance, lejárat/hibás óra, hiányos naptár, adapterhiba és mutációk ellenőrzése.
- Két JS syntaxcheck és `git diff --check`: PASS. A kapacitást érintő kötelező teljes npm tesztet a commit utáni CI futtatja; helyben nem ismételtük.
- Igazolt commit: **`0f49049e08a12c17a21601961e83c695f1682637`**. [Teljes CI](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38895524044), job `116954949564`: **1591 PASS / 0 FAIL / 0 SKIP**. Pontos teszthost-build ugyanez (`DEPLOY SYNC PASS`); offline Windows mentésmásolási ellenőrzés SUCCESS. Ez a modul telepítését igazolja, valódi elérhetőséget nem.
- Nincs éles vagy teszt-Previo-lekérdezés, AI-providerhívás, küldés, adatbázisírás vagy foglalás.
- Valódi adatforrás **nincs bekötve**; tényleges dézsaelérhetőség **NEM IGAZOLT**. A provider-szerződés és fixture nem bizonyítja egy későbbi valódi adapter hitelességét vagy mellékhatásmentességét.

Következő lépés: zöld CI után külön, auditált emberi szolgáltatásjóváhagyás, a fenti forrás- és időszakbizonyítékhoz kötve. V2/V3-érték: erőforrás- és vállalkozási határok a meglévő közös magban; új válaszmotor és végrehajtási képesség nélkül.
