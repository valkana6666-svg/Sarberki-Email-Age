# Szombati bemutató – V1 + V2 teljes lánc a TEST-rendszeren (2026-11-14)
Feladat: #9 6796044652 (ChatGPT, tulajdonosi cél). Csak TEST: oldal `leafy-chimera-2403e5`, Previo 73521, Gmail-tesztpár. Éles 753011: nincs.
Állapotforrás: `docs/V1-ALLAPOT.md`. Itt csak a bemutató-forgatókönyv és a hiánylista van.

## 1. Hiánylista (2026-11-11 délután)
| Bemutatandó út | Állapot | Bizonyíték / hiány |
|---|---|---|
| Chatbot HU/DE/EN/SI, többfordulós foglalási beszélgetés | **JAVÍTVA, kiadásra vár** | élő próba 11-11: dátum + létszám esetén eddig „nem tudom megválaszolni” volt; javítás `1070d37` (4 nyelv, regressziós teszt) |
| Chatbot: szabad hely a Previóból | **PASS élőben** (bejelentkezett kezelőnél; nyilvánosan nem) | teli → „nincs elegendő”, szabad → „van szabad helyünk” (HU/DE); ár a chatben NINCS (jóváhagyott ajánlat kell); foglalás a kezelőn át (V2) |
| Chatbot: háziállat-kérdés | **JAVÍTVA** (`3aaa1f9`, 4 nyelv), kiadásra vár | |
| V1: levél → Previo szabad hely → tervezet → ár → jóváhagyás → küldés | **PASS** (iPhone 11-09, 11-11) | |
| V2 egy egység: véglegesítés → Previo-opció → levél SC-számmal → küldés → lemondás | **PASS** (11-11) | #9 6795428713 |
| V2 foglaló beérkezett → Previo megerősítve (zöld) | **PASS** (11-11, felületről) | |
| V2 több egység (2 ház) a kezelőfelületről | **PASS** (11-11 22:53Z, L2, V2-118123799, lemondva) | levélben „2 × Családi” – javítás kiadva |
| V2 vendégadatok (e-mail, telefon) a Previóban | **PASS** (API, 11-11) | |
| V2 foglalás módosítása (dátum/egység) | Previo-oldal **PASS** (11-11, élő); DB-telepítés **PASS** (run 43112863172); felület **PASS** (11-11 22:40Z, V2-118123675, lemondva) | |
| Gyerekárak | **PASS** 12/13 (Deluxe 5 + Családi, VIP, C, főszezon, 1 éj, alaplétszámon belül) | **15-ös ház pótágy: a Previo-tesztben nincs 3 fős ár → a bemutatón NE mutassuk** |
| Szezon, 1 éj +20 %, IFA, C 5. fő | **PASS** (8/8, 11-09) | |
| Dupla foglalás / dupla küldés védelem | **PASS** (DB-zár, idempotens voucher, küldési napló; tesztek) | |
| Hiba/megszakítás (Previo lassú, mentési hiba) | **PASS** (szintetikus); élőben 1 lassú létrehozás helyesen kezelve (11-11) | |

## 2. Szükséges döntések / engedélyek (tulajdonos)
1. **TEST-kiadás** (összevonva: chatbot-javítás, állapotszöveg, módosítás-kód) – a Netlify-keret miatt egyben.
2. ~~DB-telepítés `booking-modify.sql`~~ – KÉSZ (11-11, GitHub `test-db-install`, tulajdonosi jóváhagyással).
3. **Previo TEST-írás a próbákhoz:** egy határidős engedély (11-14 23:59-ig) a bemutató főpróbáira, minden próba lemondással zárul.
4. **Tesztlevelek** a sarberkito@gmail.com-ról (a felület csak onnan ment) – lásd 3. pont, péntek estig.

## 3. Bemutató-forgatókönyv (kb. 20 perc, iPhone)
Előkészítés péntek este (tulajdonos, 5 perc): három tesztlevél a sarberkito@gmail.com-ról a sarberkiprojecttest@gmail.com-ra, tárgy: „Érdeklődés a szállásról”.
- **L1** (egy ház): „Jó napot! Deluxe faházat szeretnénk 2027. június 24-től 26-ig, 2 felnőtt, gyerek nincs. Telefon: +36 30 000 0000. Üdv: Kovács Anna”
- **L2** (két ház): „Jó napot! 2027. július 20-tól 22-ig jönnénk 8 felnőtt, gyerek nincs, 2 Családi faházba. Telefon: +36 30 000 0000. Üdv: Nagy Péter”
- **L3** (német, gyerekkel): „Guten Tag, Familienhaus vom 10. bis 13. August 2027, 2 Erwachsene und 2 Kinder (4 und 10 Jahre). Telefon +43 660 0000000. Grüße, Anna Müller”

| # | Lépés | Várható eredmény | Ha nem megy |
|---|---|---|---|
| 1 | Chatbot (`/sarberki-chatbot-project/`, előtte a lap alján kezelőként belépni): „Szia! 2027. július 5-től 8-ig jönnénk 2 felnőtt és 2 gyerek (5 és 9 évesek).”, majd „A Családi faház érdekelne.” | dátum, létszám felismerve, háztípus-ajánlat, hiányzó adat kérése; DE/EN/SI ugyanígy | „Új tesztbeszélgetés” |
| 2 | Napi kezelő → E-mailek beolvasása → L1 → Mentés | tervezetben: „van szabad helyünk” (Previo) | Foglalások frissítése |
| 3 | Ár (Deluxe előre kiválasztva) → beillesztés | 126 000 + IFA; kezelői sor: „Previo-ár … egyezik” | |
| 4 | Véglegesítés, egység + „V2 teszt” | „Previo-tesztben opcióként rögzítve”; a Previo-naptárban sárga foglalás | Previo-naptár frissítése |
| 5 | Visszaigazoló levél: jóváhagyás → Válasz küldése | sarberkito-ban levél „Foglalási szám: SC-…” sorral | |
| 6 | Foglaló beérkezett | Previóban zöld | |
| 7 | L2 → mentés → ár (2 egység) → véglegesítés 2 házzal + V2 | Previóban 1 foglalás 2 házzal | |
| 8 | Módosítás: L1 új dátum/egység | Previóban módosul, új levél „módosítottuk” (ugyanaz az SC-szám) | kihagyható |
| 9 | Lemondás (L1, L2) | Previóban lemondva | |
| 10 | L3 (német, gyerek) → tervezet németül, ár gyerekkel | német levél, gyerekár | |
Lezárás: minden tesztfoglalás lemondva; semmi nem megy valódi címre.

## 4. Szombat reggeli gyorsellenőrzés (Claude, csak olvasás, ~1 perc)
`NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scripts/demo-preflight.mjs` (verzió, Previo-azonosság, szabad helyek, ár, chatbot) + `CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/live-test-readonly-smoke.mjs` (böngészős írásmentes próba). Első futás 11-11: **PASS**.

## 5. 15 leveles buktató-próba (Claude, 2026-11-11 éjjel; kitalált levelek, valódi beolvasási út, Previo 73521 csak olvasás)
| # | Buktató | Eredmény |
|---|---|---|
| 01 | 1 éjszaka Deluxe | PASS (szabad hely; ár a kezelői lépésben, +20 %) |
| 02 | 6 fő egy Osztott C-be (max 5) | **JAVÍTVA (11-12):** „A kért háztípusba 6 fő nem fér el. Ennyi főnek … Deluxe, Családi vagy VIP.” |
| 03 | C 5 fő | **JAVÍTVA (11-12):** szabad hely + „Öt fő esetén az ötödik fő pótágyon alszik.” (felár nélkül) |
| 04 | dátum nélkül | PASS (rövid adatkérő levél) |
| 05 | teli Deluxe | PASS („nincs elegendő szabad helyünk”) |
| 06 | fordított dátum | PASS (dátumot kér, nem találgat) |
| 07 | múltbeli dátum (2025) | RÉSZBEN: „pontosítás szükséges”, de a 2025-ös dátumot visszaírja – NYITOTT |
| 08 | DE VIP + „ein Baby (1 Jahr)” | **JAVÍTVA** (baba = gyerek, kor 1 → Previo: szabad) |
| 09 | EN Családi, 3 gyerek (2, 7, 12) | PASS |
| 10 | SI Deluxe | PASS |
| 11 | „gyerek nincs, a kutyánkat is hoznánk” | **JAVÍTVA** (eddig a „nincs” a kutyára is vonatkozott; most díjjal válaszol) |
| 12 | A+B egymás mellett | PASS („szomszédos elhelyezést külön ellenőrizzük”); a „kapacitás nem igazolt” mondat ld. 02 |
| 13 | háztípus nélkül | PASS (háztípust kér, Previo-hívás nincs) |
| 14 | „2027.08.01-08.04”, „4 fő, ebből 2 gyerek” | **JAVÍTVA** (eddig 08.01–08.08 és felnőttszámot kérdezett) |
| 15 | 18 fős csoport | PASS (több ház, horgászszabályok, adatkérés) |
Eredmény: 8 PASS, 4 javítva, 3 nyitott (Osztott C/pótágy, múltbeli dátum, belső „kapacitás” mondat) – a bemutatón ne ezekkel. Mellékesen talált: a „Foglaló beérkezett” mai dátummal 23–24 UTC között elutasít (DB `current_date` UTC vs. budapesti foglalási nap) – SQL-javítás, DB-telepítéssel, később.

## 6. Második 15 leveles buktató-próba (Claude, 2026-11-12 éjjel; ugyanaz az út)
| # | Buktató | Eredmény |
|---|---|---|
| 16 | ékezet nélkül („junius 3-tol 5-ig … deluxe”) | PASS |
| 17 | két lehetséges időpont („10–12. vagy 17–19.”) | PASS (nem választ, dátumot kér) |
| 18 | idézett régi levél más adatokkal | PASS (csak az új részt használja) |
| 19 | „4-5 felnőtt” | PASS (rákérdez) |
| 20 | EN „07/10/2027 - 07/12/2027” | **JAVÍTVA** (eddig okt. 7 – dec. 7.; kétértelmű perjeles dátumot most megkérdez) |
| 21 | DE hónapváltás (06.30 → 07.02) | PASS |
| 22 | „2027.12.30-tól 2028.01.02-ig” | **JAVÍTVA** (eddig nem ismerte fel) |
| 23 | csak árkérdés | PASS (adatokat kér) |
| 24 | lemondás SC-számmal | PASS (lemondási visszajelzés, kezelőnek) |
| 25 | 15 éves gyerek | PASS (szabad hely; árkategória a kezelői lépésben) |
| 26 | Különálló 2 fős 3 főnek | **JAVÍTVA (11-12):** „3 fő nem fér el” + megfelelő típusok |
| 27 | EN „a toddler aged 2” | **JAVÍTVA** (eddig 4 fő, most 5, kor 2) |
| 28 | hosszú, sok kérdés | PASS (horgászat, dézsa); a parkoló- és etetőanyag-kérdést nem válaszolja – kezelő |
| 29 | SI család gyerekekkel | PASS |
| 30 | kéretlen reklámlevél | NYITOTT: szállásérdeklődésként adatokat kér – a kezelő elutasítja |
Összesen (30 levél): 18 PASS, 10 javítva, 2 nyitott (07 múltbeli dátum, 30 reklámlevél) + parkoló-válasz; a 12-es (A+B) levélben a „kapacitás nem igazolt” mondat még megjelenik. `npm test` 2733/2733.
