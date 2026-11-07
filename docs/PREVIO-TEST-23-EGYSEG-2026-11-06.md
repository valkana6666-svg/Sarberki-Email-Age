# Previo TEST (73521) – Sárberki 23 egység: törzsadat, eltérés, levéltervezet (Claude, 2026-11-06)

Nem engedély Previo-módosításra. Minden TEST-beállításhoz előzetes, a `V1-ALLAPOT.md` „Engedélyek” részébe rögzített tulajdonosi engedély kell (AGENTS.md).

## 1. Cél-szerkezet (forrás: `business-config.mjs`, már a repóban)
| Háztípus (Sárberki) | Fizikai ház | Egység | Kapacitás (alap / max) | Éles Previo típus (nyilvános foglalómotor) | Bizonyosság |
|---|---|---|---|---|---|
| VIP apartman | 1 | 1 | 4 / 7 | 766437 | típus: kódban rögzített; egység-ID nincs |
| Családi faház | 2–6 | 5 | 4 / 8 | 766435 | uaz. |
| Osztott A | 7–10 | 4 | 2 / 2 | **766441 „2 fős apartman”, közös pool = 8 (A+B)** | típus IGAZOLT; egyedi egység és A–B páros NEM IGAZOLT |
| Osztott B | 7–10 | 4 | 2 / 2 | ugyanaz (766441) | uaz. |
| Osztott C | 7–10 | 4 | 4 / 5 (5. fő pótágy) | 766443 „4 fős apartman”, pool = 4 | típus IGAZOLT; egyedi egység NEM IGAZOLT |
| Deluxe faház | 11–14 | 4 | 4 / 6 | 766439 | típus: kódban; egység-ID nincs |
| Különálló 2 fős | 15 | 1 | 2 / 3 (gyermek-pótágy) | 766433 | uaz. |
| **Összesen** | **15 ház** | **23 egység** | | **6 Previo-típus** (A és B egy típus) | |

Megjegyzés: az élő Previóban az A és a B **egy típus** (8-as pool). A „melyik fizikai ház A/B-je” kérdés csak egység-szinten (`/rest/rooms`: roomId + név) dönthető el – ezt a leképezésnél külön kell ellenőrizni.

## 1b. Élő Previo ágy+pótágy jelölés (Work 11-07, `docs/previo-source-recovery-2026-11-07/`, szept. 24-i kép) – összevetés
| Egység (Previo-sor) | Previo-jelölés | `business-config` (alap / max) | Egyezik? | Bizonyosság |
|---|---|---|---|---|
| 1 | 7+0 | VIP 4 / 7 | igen (max 7) | képen igazolt |
| 2, 3, 4, 5, 6 | 8+0 | Családi 4 / 8 | igen (max 8) | képen igazolt |
| 7/A, 8/A, 9/A, 10/A | 2+0 | Osztott A 2 / 2 | igen | képen igazolt |
| 7/B, 8/B, 9/B, 10/B | 2+0 | Osztott B 2 / 2 | igen | képen igazolt |
| 7/C, 8/C, 9/C | 4+1 | Osztott C 4 / 5 (5. fő pótágy) | igen | képen igazolt |
| 10/C | 4+1 | Osztott C 4 / 5 | igen | képen igazolt (tulajdonosi fotó 11-07) |
| 11, 12, 13, 14 | **6+0** (a régi 5+1 adat téves) | Deluxe 4 / 6 | igen (max 6) | képen igazolt (tulajdonosi fotó 11-07) |
| 15 | 2+1 | Különálló 2 / 3 | igen | képen igazolt (tulajdonosi fotó 11-07) |

Eltérés a kódtól nincs; az egységek a Previóban **egyenként, házszám/betű névvel** szerepelnek (pl. „7/A”) → a 73521-ben is így kell felvenni, hogy az A/B/C egyedileg leképezhető legyen.
**Mind a 23 egység képen igazolt, eltérés a kódtól nincs.** Hiányzik még: a naptár **színeinek** és az „R”/„B” jeleknek a jelentése (tulajdonos/apu).

## 1c. Felépítési lista a 73521-hez (Work, előzetes tulajdonosi engedély után)
Típusok (név → kapacitás): VIP apartman 7+0 · Családi faház 8+0 · Deluxe faház 6+0 · Különálló 2 fős faház 2+1 · 2 fős apartman 2+0 · 4 fős apartman 4+1.
Egységek (név → típus): 1 → VIP · 2–6 → Családi · 7/A, 7/B, 8/A, 8/B, 9/A, 9/B, 10/A, 10/B → 2 fős apartman · 7/C, 8/C, 9/C, 10/C → 4 fős apartman · 11–14 → Deluxe · 15 → Különálló. Összesen 23.
Nem változik: foglalás, ár, árcsomag, csatorna, integráció; az 5 mintapartman marad (nem kötjük semmihez).

## 2. 73521 jelenlegi állapota (első olvasás, 2026-11-06, `3d13190`)
1 árcsomag „Alap” (385033) · 1 típus „Apartmanok” (1012357, 4 fő) · 5 egység „Apartman 1–5”.
**Eltérés:** a 6 típus és a 23 egység teljesen hiányzik → leképezés és szabadhely-próba most nem lehetséges.

## 3. Módszer
- **Választott (11-07): A – mi építjük fel**: Kántor Gergő 11-04-i levele szerint a tesztet nekünk kell az élőhöz hasonlóvá beállítani. Végrehajtó: Work a 73521 webes felületén, az 1c lista szerint, előzetes, rögzített tulajdonosi engedéllyel.
- B (Previo-másolás) csak kiegészítő kérdés lehet; nem várunk rá.
- API-s létrehozás: nem (írási jog nincs, és nem is kérünk).
- **Work most nem kell:** a szerkezet a repóban dokumentált; a régi videóanyag nem szükséges ehhez a lépéshez. Work csak akkor, ha a másolás után a Previo webes felületén kell valamit ellenőrizni, amit az olvasó API nem mutat.

## 4. Levéltervezet a Previónak (a tulajdonos küldi, #63899)
> Tisztelt Kántor Gergő!
>
> Köszönjük az API-kulcsot, a 73521-es API TESZT szálláshelyen az olvasó hívások működnek.
>
> Kérésünk: a teszteléshez kérjük, másolják át az éles szálláshelyünkről (753011) a 73521-es TESZT szálláshelyre **kizárólag a szállástípusok és a szobák (egységek) szerkezetét** – típusnevek, kapacitás, pótágy, a 23 egység a nevével együtt (6 típus: VIP apartman, Családi faház, Deluxe faház, Különálló 2 fős faház, 2 fős apartman, 4 fős apartman).
>
> Kérjük, hogy **ne** kerüljenek át foglalások, vendégek, személyes adatok, fizetések, levelezés, csatornakapcsolatok, árak/árcsomagok és egyéb integrációs beállítások, és az éles 753011-es szálláshelyen semmi ne változzon.
>
> Kérjük, a másolás előtt erősítsék meg, pontosan mi kerül át, és utána jelezzék, hogy elkészült.
>
> Köszönettel:
> Kovács László, Sárberki Horgásztó

## 5. Utána (Claude)
1. A már jóváhagyott 3 olvasó lekérdezés megismétlése a 73521-en (új tulajdonosi jóváhagyással) → 6 típus / 23 egység ellenőrzése a fenti táblázattal.
2. Leképezés (`PREVIO_ROOM_KIND_MAP`) javaslat, tulajdonosi jóváhagyásra.
3. Naptár (szabad hely) olvasása csak külön döntéssel; `PREVIO_READ_API_ENABLED` addig KI.
