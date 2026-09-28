# Sárberki nyilvános árforrás – technikai állapot (2026-09-28)

## Igazolt folyamat

1. A `https://sarberkito.hu/foglalas/` oldal a `https://booking.previo.cz/?hotId=753011&lang=hu&currency=HUF...` iframe-et tölti be. A Previo `PHPSESSID` munkamenetet állít be. A keresést a foglaló első lépése `POST` űrlappal indítja: `step=1`, `arrival=YYYY-MM-DD`, `departure=YYYY-MM-DD`.
2. A második lépés HTML-jében a `PageParams` adatmodell tartalmazza a `RESERVATION_DETAILS.from/to`, `OBJECT_KINDS` és `GUEST_CATEGORIES` mezőket. Példa: Deluxe `obkId=766439`; felnőtt `guaId=254357`; gyermek 8–17 `255813`, 3–7 `254359`, 0–2 `255815`. Ezeket minden munkamenetben a válaszból kell kiolvasni.
3. `POST https://booking.previo.cz/index/get-object-kind-occupancy/` ugyanazzal a munkamenettel, `hotId`, `currency`, `lang`, `obkId`, `newDesign=1` adatokkal JSON-t ad: `success`, `html`. A HTML űrlap `data-numOfFreeRooms` attribútuma a keresett típus szabad egységeinek száma. A második lépés `OBJECT_KINDS.numOfFreeRooms` értéke ebben a próbában 0 volt, miközben az élő foglaló és az occupancy végpont 4-et jelzett.
4. `POST https://booking.previo.cz/index/get-occupancy-price/` ugyanazzal a munkamenettel `formData` JSON-t kap. Ebben `obkId`, egy `rooms` elem és a `guestCategories` `{guaId,count}` értékei szerepelnek; az ágyat igénylők száma `numOfGuestsWithBed`. Válasz példa: `{"success":true,"totalPrice":122200,"totalTaxes":2200,"totalRequiredServices":0,"unknownPrice":false}`. A `totalPrice` a Previo számítása.

## Élő ellenőrzés

- 2026-10-16–18., Deluxe, 2 felnőtt, 0 gyermek: az adapter válasza **122 200 Ft teljes ár**, ebből 2 200 Ft IFA; **4 szabad egység**. Ugyanebben a keresésben a hivatalos Sárberki foglaló két felnőttre mentett összesítője **122 200 Ft**. Foglalást nem véglegesítettünk.
- Ugyanerre az időszakra Családi, 2 felnőtt: a Previo JSON **106 200 Ft** teljes árat és 3 szabad egységet adott. Deluxe, 2 felnőtt és két gyermek (7 és 11 éves): a kategóriaazonosítókkal kért Previo JSON **122 200 Ft** teljes árat adott. E két eredmény hivatalos felületi összesítővel való egyezése még nincs igazolva, ezért a gyermekes automatikus vendégár zárolt.
- A listanézet 120 000 Ft minimum szállásárat mutatott, de az nem teljes végösszeg. A létszámválasztó kezdetben 4 felnőttet tett a Deluxe házba, ezért a 2 felnőttes összeget csak a létszám módosítása és mentése után lehetett összevetni.

## Integráció és korlátok

- A `price-source/sarberki-public-booking.mjs` külön, csak olvasási adapter. A Netlify `price-quote` funkció ezt hívja. A kezelő az eredményt elkülönítve jeleníti meg, és a vendéglevélbe csak külön emberi árjóváhagyás után kerülhet összeg. Hibás válasz, ismeretlen ár vagy hálózati hiba esetén `HITELES ÁRLEKÉRÉS SZÜKSÉGES` marad.
- A Previo végpontok a foglaló belső, dokumentálatlan végpontjai. Munkamenet kell hozzájuk, az árvégpont önmagában nem igazolja a kapacitást. A böngészőből a Previo saját iframe-originjén hívhatók; a Sárberki oldal JavaScriptje közvetlenül nem olvashatja a másik origin válaszát. A szerveroldali hívás helyben reprodukálható volt; a Netlify tesztkörnyezetének hálózati elérését, időkorlátját és stabilitását külön ellenőrizni kell.
- Gyermekeknél a korosztály-kategóriák átadhatók az adapternek, de az automatikus vendégár kiadása a kezelőben továbbra is zárolt, amíg az élő gyermekár és a hivatalos UI egyezése nincs igazolva. A több házas és osztott egységes esetek szintén nincsenek engedélyezve.
- A jelenlegi végpont nem szerződéses vagy garantált API; a Previo változtathatja. A Previo hivatalos, olvasási API-ja hosszabb távon előnyösebb csereadapter.
