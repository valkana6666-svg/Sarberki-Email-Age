# Sárberki – kötelező kapacitás- és alternatíva-regressziós mátrix
Dátum: 2026-10-12
Ág: gmail-test-subject-allowlist
Állapot: TESZTSPECIFIKÁCIÓ – nem implementációs vagy sikeres tesztjelentés.
Előzmény: GitHub issue #2.

## Általános invariánsok
- Dátum + egyértelmű felnőttlétszám + (ha gyermek van: minden gyermek életkora) elegendő a típusonkénti kapacitásszűréshez; név, telefon, e-mail nem blokkol.
- Felnőttek életkorát nem kérjük. Egyértelmű kizárólag felnőtt társaságnál gyermekekre nem kérdezünk.
- Konkrétan kért háztípus: először csak a kért típus; ha igazolt AVAILABLE, kizárólag az ajánlható, más típus lekérdezése tilos.
- Ha a kért típus igazolt UNAVAILABLE: előbb fizikailag kizárni a nem megfelelőket, majd minden megfelelő alternatív típust ellenőrizni, és minden igazolt AVAILABLE típusból egy-egy lehetőséget ajánlani.
- Ha nincs kért típus: minden fizikailag megfelelő típus ellenőrzése, minden igazolt AVAILABLE típus felajánlása.
- UNKNOWN/timeout/hiba ≠ UNAVAILABLE; nem lehet hamis ajánlat, hamis foglaltsági állítás vagy automatikus foglalás.
- Egy egységre szóló kérést nem lehet bizonyíték nélkül több egységre bontani. A/B pool nem igazol konkrét házszámpárosítást.
- Belső házszám vendégnek nem jelenhet meg; opcionális árat csak ellenőrzött és jóváhagyott összetevőkből lehet adni.
- A chatbot és az e-mail-agent üzleti döntése és ellenőrzési sorrendje azonos; a szövegezés eltérhet.

## Konkrét szintetikus esetek (mindkét csatornán, HU/DE/EN/SL mintákkal)
| ID | Vendégüzenet / adatok | Previo fixture | Elvárt döntés |
| --- | --- | --- | --- |
| T01 | November 26–28, 2 felnőtt, VIP | VIP AVAILABLE | Csak VIP query, csak VIP ajánlat; gyermekre nem kérdez |
| T02 | Ugyanez | VIP UNAVAILABLE; 15-ös AVAILABLE; A/B AVAILABLE; C AVAILABLE; Deluxe AVAILABLE; Családi UNAVAILABLE | Előbb VIP; utána minden fizikailag alkalmas alternatíva ellenőrzése, mindegyik igazolt szabad típusból egy ajánlat |
| T03 | Ugyanez | VIP UNKNOWN | Nem mondja foglaltnak, nem indít foglaltságra épülő alternatívát |
| T04 | 4 felnőtt, háztípus nélkül | C AVAILABLE, Deluxe AVAILABLE, VIP AVAILABLE, Családi AVAILABLE; A/B és 15-ös AVAILABLE | C, Deluxe, VIP, Családi ajánlható; egyetlen A/B és 15-ös nem |
| T05 | 6 felnőtt, Deluxe | Deluxe AVAILABLE | Csak Deluxe; kapacitás/pótágy-szabály tényleges igazolásával |
| T06 | 6 felnőtt, Deluxe | Deluxe UNAVAILABLE; C AVAILABLE; Családi AVAILABLE; VIP AVAILABLE | Egyetlen C nem ajánlható; Családi és az igazoltan 6 főre alkalmas VIP ajánlható |
| T07 | 6 felnőtt, háztípus nélkül | C AVAILABLE, Családi AVAILABLE, Deluxe UNKNOWN, VIP AVAILABLE | C kizárva, Családi és igazoltan alkalmas VIP ajánlható; Deluxe nem |
| T08 | 8 felnőtt, háztípus nélkül | Családi AVAILABLE; minden más AVAILABLE | Csak egyetlen egységként igazoltan 8 főre alkalmas típus; kisebb egységek kizárva |
| T09 | 2 felnőtt + 2 gyermek, 7 és 11 éves; nincs típus | C AVAILABLE, Deluxe AVAILABLE, Családi AVAILABLE | Teljes 4 fős létszámra ellenőrzés; minden alkalmas, igazolt szabad típus |
| T10 | 2 felnőtt + 2 gyermek; életkor nincs | bármely | Életkorok bekérése; gyermekéletkor-függő ajánlatot nem igazol |
| T11 | 4 felnőtt, emeleti C | C AVAILABLE | Csak C; nem általános osztott A/B |
| T12 | 4 felnőtt, emeleti C | C UNAVAILABLE; Deluxe AVAILABLE; Családi AVAILABLE | Mindkét megfelelő és igazolt alternatíva |
| T13 | 2 felnőtt, különálló kétszemélyes | 15-ös AVAILABLE | Csak különálló kétszemélyes; vendégnek nincs belső házszám |
| T14 | 2 felnőtt, osztott A vagy B | A/B pool AVAILABLE | Csak megfelelő 2 fős osztott opció; konkrét házszám nem ígérhető |
| T15 | 4 felnőtt, 2 db kétszemélyes egymás mellett | A/B pool 2 AVAILABLE, konkrét ház nem igazolt | Nem állítja, hogy ugyanabban a házban vannak; emberi ellenőrzés |
| T16 | 2 felnőtt, VIP, név és telefon hiányzik | VIP AVAILABLE | Kapacitás ellenőrizhető, válaszban név/telefon bekérése; e-mail csak ha csatornából sem ismert |
| T17 | 4 felnőtt, VIP, hibás dátum | bármely | Dátum pontosítás, nem állít igazolt kapacitást |
| T18 | 4 felnőtt, Családi | Családi UNAVAILABLE; minden alternatíva UNKNOWN | Családi foglalt; nem ajánl ismeretlen státuszú házat |
| T19 | 2 felnőtt, VIP | VIP AVAILABLE, egyéb típusokhoz lekérdezésfigyelő | Pontosan 1 VIP-típuslekérdezés, más típus nulla |
| T20 | 4 felnőtt, háztípus nélkül | egy típus UNAVAILABLE, kettő AVAILABLE, egy UNKNOWN | Csak a két igazolt AVAILABLE ajánlható; mindkét csatornán azonos |

## Elfogadási feltételek
1. A meglévő működő commit visszaállítási pontként megmarad; a main/production nem módosul.
2. A közös üzleti motorra valódi futtatható tesztek készülnek, nem csupán tesztadat-leírás.
3. Az összes esetet mindkét csatornán futtatni kell; ellenőrizni a tényleges lekérdezési sorrendet és az ajánlatok teljes körét.
4. A meglévő regressziós csomag zöld, az új tesztek zöldek; az új commit CI-eredménye dokumentált.
5. Telepített tesztoldali végpontok és felületek E2E ellenőrzése megtörtént; csak utána jelenthető KÉSZ.
