# Átadó jegyzet – Claude, 2026-11-07 reggel (új munkamenethez)

Ág: kizárólag `gmail-test-subject-allowlist`. PR nincs és nem kell. Tiltások: AGENTS.md szerint. Állapotforrás: `docs/V1-ALLAPOT.md`.
Minden munka commitolva és feltöltve (HEAD a jegyzet commitja); nincs mentetlen módosítás.

## Kész és igazolt (ne ismételd)
- TEST-oldal `leafy-chimera-2403e5`: utolsó kiadás `7914bfc` (élő írásmentes próba 38/38).
- Élő lánc (tulajdonos, iPhone): tárgy nélküli levél → foglalás → vendégválasz hozzáfűzve → ár beillesztve → jóváhagyás → küldés a tesztpárnak: PASS.
- Foglaló: 15 főig 50%, 16 főtől 80% (`482d381`); határidő 7 nap / ≤14 napnál 24 óra.
- V1 véglegesítés: visszaigazoló levél + „Véglegesítve” (csak kezelői Previo-igazolással) + „Foglaló beérkezett” (külön lépés); kód `10efef0`, `b8a3cc3`, `1187e79`; DB `booking-status.sql` telepítve (Work 11-06, VERIFY PASS). Számlaszám/fizetési mód: tulajdonosi döntés szerint külön üzenetben, nem a levélben.
- Previo-kulcs (csak olvasó, 73521): iPhone Jelszavak + Netlify `PREVIO_API_KEY` + munkamenet-környezet titka (`api.previo.app`). Első olvasás (3 listázó GET) PASS; `PREVIO_READ_API_ENABLED` KI.
- Napi Drive-mentés: 11-07 PASS (run 42344225934); ütemezett feladat 06:47 Budapest, ebbe a munkamenetbe fut.

## Folyamatban
1. **Élő próba a véglegesítésre** (tulajdonos, iPhone): Kis Anna-foglalás → Previo-hivatkozás `TESZT-1` → Véglegesítés → levél jóváhagyás/küldés → Foglaló beérkezett. NEM IGAZOLT.
2. **Previo TEST (73521) felépítése:** a teszt általános minta (1 típus, 5 apartman). Kántor Gergő levele szerint nekünk kell felépíteni → javasolt: Work építi a webes felületen, előzetes, rögzített tulajdonosi engedéllyel (AGENTS: TEST-beállítás is engedélyköteles).
   - Cél-szerkezet: `docs/PREVIO-TEST-23-EGYSEG-2026-11-06.md` (6 Previo-típus, 23 egység; A+B élőben egy típus, pool 8).
   - Work forrás-visszakeresése (11-07): `docs/previo-source-recovery-2026-11-07/` (README, 23 soros CSV, vendégadatmentes kapacitáskép). **Még nem dolgoztam fel** – a CSV kapacitásai (pl. VIP 7+0, Családi 8+0) összevetendők a `business-config.mjs`-sel.
   - Tulajdonos fényképei/videói az iPhone-on (szept. 24., Previo élő képernyők, vendégnevekkel): csak beállítási/szerkezeti tartalom rögzíthető; vendégnév sehova. Apu hozzájárult az elemzéshez.
3. Ütemezett emlékeztető: #9-ben Work válaszának ellenőrzése (send_later, 30 percenként, legfeljebb ~6-szor). Új munkamenetben ez nem fut – kézzel ellenőrizd a #9-et.

## Következő lépések (sorrend)
1. Work 11-07-i anyagának feldolgozása → végleges felépítési lista a 73521-hez + színjelmagyarázat (szín → foglalási állapot) a tulajdonostól/Worktől.
2. Tulajdonosi engedély szövege (Engedélyek táblába rögzítve) → Work felépíti a 73521-et.
3. A 3 olvasó GET megismétlése (tulajdonosi jóváhagyással) → `PREVIO_ROOM_KIND_MAP` javaslat → naptár-olvasás külön döntéssel.
4. Nyitott kisebb javítások: név a megszólításban (aláírásból), sortörés a küldött levélben, háromszor megjelenő HU-tervezet, „ÜGY ÁTTEKINTÉSE” → „FOGLALÁS ÁTTEKINTÉSE”, olvasható időbélyeg, levéllista-címkék élő ellenőrzése.

## Futtatási megjegyzések
- Previo-szkript: `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scripts/previo-readonly-discovery.mjs --approved-73521` (csak jóváhagyás után).
- TEST-kiadás: üres commit `[netlify-test-release] …` csak kifejezett tulajdonosi engedéllyel; utána `/build-info.mjs` SHA + `scripts/live-test-readonly-smoke.mjs`.
