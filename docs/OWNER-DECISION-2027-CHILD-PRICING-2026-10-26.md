# Sárberki 2027 – tulajdonosi döntés: gyermekárak
**Döntés napja:** 2026-10-26. **Hatály:** kizárólag a 2027. évi díjszabás.

## Jóváhagyott szabályok

1. **0–3 éves korig** a gyermek díjmentes.
2. **4–8 éves korig** az alkalmazható gyermekdíj **5 000 Ft/fő/éjszaka**.
3. **9 éves kortól** a vendégre a felnőttdíj szabályai érvényesek.
4. A **4–8 évesek 5 000 Ft-os gyermekdíja kizárólag a ház/egység alapárában foglalt létszám felett fizetendő**; alaplétszámon belül külön gyermekdíj nem számolható fel.
5. Az alaplétszám házonként/egységenként változatlan: VIP, Családi, Deluxe, Osztott C = 4 fő; Osztott A/B és 15-ös = 2 fő.
6. A gyermekek a fizikai kapacitás és egységkiosztás szempontjából vendégnek számítanak, életkortól függetlenül, a már meglévő kapacitásvédelmek megtartásával.
7. **2026-os árak és 2026-os gyermekárak változatlanok.** Nincs visszamenőleges hatály.

## Implementációs korlátok és pontosítandó peremesetek

- Ez a dokumentum a tulajdonos kifejezett üzleti jóváhagyása, **nem** az árazómotor elkészült implementációjának vagy böngészős átvételének igazolása.
- A 0–3 éves gyermek díjmentes akkor is, ha az egység alapáras létszáma már betelt, **amennyiben a fizikai férőhely- és gyermekelhelyezési szabály megengedi**; az ingyenesség nem jelent automatikus plusz férőhelyet. A meglévő kód jelenleg az alaplétszám feletti gyermeket tiltja, ezért ezt külön és védetten kell fejleszteni.
- 9 éves kortól a *felnőttdíj* vonatkozik rá; a négy-/kétszemélyes házalapárban foglalt helyet ez önmagában nem duplázza meg. A felnőtt tarifa szerinti **pótfő-díj csak a ház alapárában foglalt létszám felett** merülhet fel és csak engedélyezett kapacitásig.
- A több különböző korú gyermek helyekhez rendelésének determinisztikus díjazási sorrendjét (például 4 felnőtt + ingyenes 2 éves + 5 éves) külön ellenőrizni és dokumentálni kell, hogy a kalkuláció ne függjön a gyermekek beviteli sorrendjétől.
- A 15-ös kis ház harmadik vendégének jogosultsága továbbra is külön tulajdonosi kérdés, és nem oldódik fel ettől a döntéstől.
- Egységek között a base helyeket nem lehet szabadon átvinni; minden egység díjazását és fizikai férőhelyét külön kell ellenőrizni.
- A 2027.07.01–08.22 közötti főszezon és a 2026-os év külön hatályos, változatlan keretrendszer.
- A fejlesztést a Work összevont böngészős átvételével össze kell hangolni; a felhős jóváhagyási fájlokhoz, Previohoz, éles környezethez nem nyúlunk. `[skip netlify]` commit és nincs deploy.
