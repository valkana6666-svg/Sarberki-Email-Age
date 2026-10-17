# Sárberki V1 – többnyelvű foglalás tesztmátrix

Állapot: tesztterv, nem futtatott tesztek. 2026-10-17.

## Nyelvi és csatorna tesztek
| ID | Bemenet | Elvárt eredmény |
|---|---|---|
| L01 | HU/DE/EN/SI azonos foglalási kérés | Azonos kapacitás és szabály szerinti végösszeg |
| L02 | Német honlapról foglalási űrlap | Német űrlap, validáció, tájékoztatás és visszajelzés |
| L03 | HU/DE honlap azonos háztípus | Azonos férőhely, felszereltség és dézsa-információ |
| L04 | Német kérés e-mailen | Német választervezet, belső audit, nincs automatikus küldés |
| L05 | Ismeretlen/hibás nyelv | Biztonságos nyelvi fallback, ár és kapacitás változatlan |

## Foglalási és szabályhatárok
| ID | Bemenet | Elvárt eredmény |
|---|---|---|
| B01 | A/B 2 fő | Kétfős alapár és igazolt szabad egység |
| B02 | Osztott C 4/5/6 fő | 4 alap, 5 csak pótággyal, 6 önmagában tiltott |
| B03 | 15-ös ház 3 felnőtt | Nem ajánlható |
| B04 | 15-ös ház 2 felnőtt + gyermek | Csak életkor és férőhely-szabály ellenőrzésével |
| B05 | Két egymás melletti A/B | Csak azonos ház igazolt elérhetőségével |
| B06 | 15 és 16 vendég | Előleg szabály határértékének ellenőrzése; 16 főre 80% |
| B07 | Érkezés 15/14/3/1 nap múlva | Előleg beérkezési határidő helyes kiszámítása |
| B08 | Törzsvendég 729/730/731 nap | 20% kedvezmény jogosultság helyes határa |
| B09 | 0/2/3/7/8/17/18 éves gyermek | Határértékek tulajdonosi tisztázásig nem automatizálhatók |
| B10 | Dézsa 7–10-es ház vendégének | Más házhoz rögzített dézsa csak külön, igazolt elérhetőséggel |
| B11 | Previo nem elérhető | NEM IGAZOLT; nincs biztos ajánlat, nincs véglegesítés |
| B12 | Azonos foglalás ismételt beküldése | Idempotencia, nincs duplikált ügy vagy foglalás |
| B13 | Lemondás rövid határidőn belül | Jóváhagyott foglaló- és lemondási szabály, audit |
| B14 | 2027-es ár még nincs jóváhagyva | Nincs kitalált összeg vagy publikálás |

## Kimenet és biztonság
Minden teszt bizonyítékot kapjon: dátum, tesztkörnyezet, commit, bemenet, tényleges kimenet, PASS/FAIL/NEM FUTTATOTT. Csak szintetikus adatok. Main/production tiltott; e-mail-küldés és Previo-írás tiltott. A jelen dokumentum sem tesztfuttatás, sem működő integráció igazolása.
