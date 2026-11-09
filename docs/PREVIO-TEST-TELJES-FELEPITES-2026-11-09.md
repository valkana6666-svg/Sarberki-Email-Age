# Previo TEST (73521) – teljes felépítés terve (Claude, 2026-11-09)

Cél: a 73521-es TESZT-szálláshely a Sárberki valós működését tükrözze (típusok, egységek, árak, foglaltság), hogy az 1. szint (szabadhely + ár olvasása → ajánlat → jóváhagyás) **végponttól végpontig** kipróbálható legyen, mielőtt az éles olvasókulcs megjön. Kész: 6 típus, 23 egység (`523239d`, API-val ellenőrizve `6e6909f`).
Végrehajtó: **Work** a 73521 webes felületén; minden lépés előtt **előzetes, rögzített tulajdonosi engedély** (AGENTS: TEST Previo-írás is engedélyköteles). Éles 753011: semmi.
Forrás: a videókból/képkockákból a szerkezet (egységek, színek, adatlap-mezők) – `previo-source-recovery-2026-11-07/`, `PREVIO-TEST-23-EGYSEG-2026-11-06.md` 7. pont. **Árak: kizárólag a jóváhagyott 2027-es árlista** (`business/sarberki/tariffs.mjs`, „Rezidencia 96 Kft., 2027. évi árak, aláírva 2026-09-30”) – a videó árai nem forrásai az áraknak.

## 1. lépés – árak az „Alap” árcsomagban (385033), 2027
| Típus (73521) | Éjszakai ár (Ft) | Benne foglalt fő |
|---|---|---|
| VIP apartman | 63 000 | 4 |
| Családi faház | 55 000 | 4 |
| Deluxe faház | 63 000 | 4 |
| Különálló 2 fős faház | 31 500 | 2 |
| 2 fős apartman (A/B) | 24 000 | 2 |
| 4 fős apartman (C) | 46 000 | 4 |

Kiegészítők (ha a felület engedi): pótfelnőtt 10 000 Ft/éj; gyermek 3–8 év 5 000 Ft/éj; főszezon 07-01–08-22: +10%; 1 éjszakás tartózkodás: +20%; IFA 550 Ft/felnőtt/éj.
Ha a Previo egy szabályt másképp kezel (pl. nincs %-os felár), **Work megáll és jelzi**; nem talál ki értéket.

## 2. lépés – szintetikus tesztfoglalások (kitalált vendégek, „Teszt Vendég 1–8”, valós adat nélkül)
| # | Egység | Érkezés → távozás | Állapot (szín) | Mit teszt |
|---|---|---|---|---|
| T1 | 7/A | 2027-06-10 → 06-13 | opció (sárga) | 7/A foglalt, 7/B szabad marad |
| T2 | 11 | 2027-06-10 → 06-13 | megerősített (zöld) | Deluxe telítés |
| T3 | 12 | 2027-06-10 → 06-13 | megerősített | Deluxe telítés |
| T4 | 13 | 2027-06-10 → 06-13 | opció | Deluxe telítés (opció is foglal) |
| T5 | 14 | 2027-06-11 → 06-12 | megerősített | Deluxe 06-11 éjszakára 0 szabad |
| T6 | 11 | 2027-06-13 → 06-15 | megerősített | érkezés a távozás napján (T2 után) |
| T7 | 7/C | 2027-07-01 → 07-08 | megerősített | főszezon |
| T8 | 2 | 2027-06-13 → 06-16 | opció | családi ház, egy foglalt |

**Elvárt olvasási eredmények (3. lépés ellenőrzéséhez):** Deluxe 06-10→06-13: **0 szabad**; 2 fős apartman 06-10→06-13: **7 szabad** (8-ból T1); 4 fős apartman 07-01→07-08: **3 szabad**; Családi 06-13→06-16: **4 szabad**; Deluxe 06-13→06-15: **3 szabad** (T6), 06-15→06-17: **4 szabad**.

## 3. lépés – Claude: naptár-olvasás a 73521-en (külön tulajdonosi jóváhagyással)
`GET /rest/calendar/availability` a meglévő olvasóval; az eredmény összevetése a fenti elvárt számokkal. Utána a TEST-oldalon a `PREVIO_READ_API_ENABLED=sandbox-73521-only` bekapcsolása (kiadás) → az ármező mellett „Previo: X szabad” – ez az 1. szint TEST-bizonyítéka.

## Később (nem most)
Szolgáltatások (dézsa, háziállat), levélsablonok, színek egyedi beállítása – a videók alapján, ha szükséges. Az éles 753011-ből olvasás az élő kulcs után (Previo-levél elküldve 2026-11-09).
