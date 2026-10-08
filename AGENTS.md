# Sárberki foglaltságkezelési kötelező ellenőrzési pont

- Kizárólag a `gmail-test-subject-allowlist` tesztág módosítható. Main és production nem módosítható.
- Tilos valódi e-mail küldése, valódi foglalás létrehozása és Previo-adatok módosítása.
- A vendégnek foglalhatóként csak a kért teljes időszakra és szükséges egységszámra ténylegesen ellenőrzött elhelyezés ajánlható. Ismeretlen, hibás vagy más dátumhoz tartozó adat nem szabad kapacitás.
- Alternatív háztípus ugyanarra az időszakra külön kapacitásellenőrzést igényel. A háztípus megadása nem kerülheti meg az ellenőrzést.
- A/B közös típusszintű poolja nem bizonyít A+B párost ugyanabban a fizikai faházban. Egyedi egységet vagy párost kizárólag egyedi ellenőrzéssel lehet igazoltnak jelölni. Közelségi kikötés nélkül a megfelelő igazolt típusszintű készletből különböző fizikai házak is ajánlhatók; egymás melletti elhelyezést kizárólag egyedi ellenőrzéssel lehet ígérni.
- A szabad egységszám pillanatfelvétel, nem foglalás vagy garancia; végleges vendégajánlat előtt a kezelő ismét ellenőrizze a rendelkezésre állást.
- Kapacitást érintő fejlesztésnél teljes `npm test`, hibás/hiányzó forrásra vonatkozó negatív teszt és a foglalható/foglalt határ ellenőrzése kötelező. Az automatikus teszt nem helyettesíti az élő Previo-val történő összevetést.
- Referencia: `reports/availability-audit-2026-10-08/REPORT.md`; anonim opt-in élő ellenőrzés: `node tests/live-availability-audit.mjs --live-read-only`.
