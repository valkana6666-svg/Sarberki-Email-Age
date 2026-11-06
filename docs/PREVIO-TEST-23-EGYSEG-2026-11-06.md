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

## 2. 73521 jelenlegi állapota (első olvasás, 2026-11-06, `3d13190`)
1 árcsomag „Alap” (385033) · 1 típus „Apartmanok” (1012357, 4 fő) · 5 egység „Apartman 1–5”.
**Eltérés:** a 6 típus és a 23 egység teljesen hiányzik → leképezés és szabadhely-próba most nem lehetséges.

## 3. Módszer
- **Választott: B – Previo-támogatás másolja át a szerkezetet** (ChatGPT egyetért, #9 6697760145). Pontos, kevés tulajdonosi munka.
- Tartalék: A – tulajdonos kézzel veszi fel a 6 típust és 23 egységet a 73521 webes felületén (a fenti táblázat alapján).
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
