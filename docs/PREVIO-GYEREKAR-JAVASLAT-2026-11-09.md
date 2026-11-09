# Previo gyerekár – javaslat (Claude, 2026-11-09) – tulajdonosi döntésre vár

**Szabály (tulajdonos, 11-09):** az alaplétszámba mindenki beleszámít; felette felnőtt +10 000 Ft/éj, gyerek 3–8 év +5 000 Ft/éj, 0–2 év ingyenes; 9 év felett felnőttár; IFA csak 18 év felett (a V1 árkalkulátor így számol).

## Mit számol most a Previo (73521, suggester, csak olvasás, 11-09; Deluxe 2027-06-15→17)
| Eset | Previo | Árlista | Eredmény |
|---|---|---|---|
| 2 felnőtt + gyerek 4 és 1 (alaplétszámon belül) | 128 200 | 128 200 | egyezik |
| 4 felnőtt + gyerek 12 („Gyerek” kategóriában) | 150 400 | 150 400 | egyezik (felnőttár, IFA-mentes) |
| 4 felnőtt + gyerek 5 | 150 400 | 140 400 | **+10 000 – a Previo felnőttárat számol** |
| 4 felnőtt + gyerek 1 | 150 400 | 130 400 | **+20 000 – a Previo felnőttárat számol** |

Következmény a kódban (már javítva): minden 0–17 éves gyereket a „Gyerek” kategóriában küldünk (a 9+ korúakat is). Felnőttként küldve IFA-t számolna rájuk.

## Javaslat: két új vendégkategória a 73521-en (Work; Previo-beállítás, ezért előtte tulajdonosi engedély kell)
1. A meglévő „Gyerek” (472223) korhatárát **9–17 évre** szűkítjük. Kedvezmény nincs, IFA-mentes marad.
2. Új **„Gyerek 3–8”**: típus „gyermek”, IFA-mentes, kedvezmény **5 000 Ft/éj** (abszolút összeg).
3. Új **„Baba 0–2”**: típus „gyermek”, IFA-mentes, kedvezmény **100%** (vagy 10 000 Ft/éj).
4. A kedvezmény számítási módját (fogaskerék a táblázat fölött; 3 lehetőség) úgy választjuk, hogy a kedvezmény **csak az alaplétszám feletti** díjat csökkentse. **Kockázat:** ha a Previo az alaplétszámon belüli gyerekre is levonja, az ár alacsonyabb lesz az árlistánál. Ezt az alábbi ellenőrzés kiszűri.

## Ellenőrzés a beállítás után (Claude, csak olvasás, Work nélkül)
`node scripts/previo-price-compare.mjs --children` – Previo-végösszeg és árlista minden esetre. Elvárt értékek: 128 200 (alaplétszámon belül) / 140 400 (gyerek 5) / 130 400 (gyerek 1) / 150 400 (gyerek 12) / 140 400 (gyerek 5 és 1). Ha bármelyik eltér, a beállítást Work visszaállítja. A visszaállítás: az új kategóriák törlése, a „Gyerek” korhatára vissza 0–17-re.

Az új kategóriák azonosítóját Claude a nyilvános foglalóoldalról olvassa ki, és beírja a `PREVIO_TEST_73521.guestCategories` értékbe.
