# Sárberki – kezelői árlekérés és jóváhagyás (2026-10-09)

Állapot: tulajdonosi elvárás rögzítve, **nem aktiválási engedély**. Kizárólag a `gmail-test-subject-allowlist` tesztágra vonatkozik; main/production változatlan.

## Elvárt működés

1. Az operátor egy korábban megnyitott e-mailben, a saját kézzel pontosított és elmentett érkezés/távozás, háztípus, felnőtt-, gyermekszám és gyermekéletkor adatokkal önállóan indíthasson új árlekérést. Az ügy újranyitása a mentett kézi adatokat őrizze meg, ne írja felül a régi e-mail értékeivel.
2. A felhasználó által indított lekérés és a vendéglevélbe történő beillesztés **két külön lépés**. Ha a kiválasztott egység a kért időszakban igazoltan szabad, és hiteles ár érkezett, az operátor elé kerüljön a teljes ár forintban, EUR-ban (ha hiteles, dátummal ellátott árfolyam elérhető), továbbá szállásdíj, IFA, időszak, vendégösszetétel, háztípus, forrás és lekérési idő. Több háznál az egységenkénti bontás is látszódjon.
3. Az ár **a megtekintéstől nem kerülhet automatikusan a vendégválaszba**. Az operátor ellenőrizhet, jóváhagyhat, vagy mellőzhet. A jóváhagyás frissítse a szerkeszthető választervezetet a HUF + ellenőrzött EUR összegekkel. Továbbra sincs automatikus küldés, foglalás vagy PMS-írás.
4. Nem szabad árfolyamot, valós idejű szabad kapacitást vagy árat kitalálni. Sikertelen árfolyamlekérésnél az ellenőrzött HUF ár maradhat látható, EUR csak „nem elérhető” státuszban. Nem igazolt kapacitásra nincs „szabad” állítás.
5. Az árlekérés felhasználói kezdeményezése **nem kapcsolhatja ki** a meglévő technikai foglalásmentességi és Previo-hozzáférési védelmet. A `PREVIO_READ_SAFETY_VERIFIED=false` állapot addig maradjon zárt, amíg a nyilvános Previo-kérések mellékhatás-mentessége hitelt érdemlően nincs igazolva.
6. A korábbi működés kapcsolóval visszaállítható legyen; a publikus válaszmag és az árlekérés egymástól elkülönítve maradjon. `CASE_STORE_ENABLED=disabled` maradjon.

## Jelenlegi implementáció megfigyelése (GitHub, 2026-10-09)

- `price-check.js`: a sikeres árlekérés már kijelzi HUF, EUR (MNB, ha elérhető), szállás/IFA és egységbontás adatait; `pendingQuote` csak külön `approve_price` gombnyomás után kerülhet a tervezetbe.
- `netlify/functions/price-quote.mjs`: a valós idejű lekérés host + `PREVIO_READ_SAFETY_VERIFIED` kapuhoz kötött; zárt kapun 503 és nem valós ár az eredmény.
- Így az operátori szándék nem egyenlő az aktuálisan működő, élő Previo árral. A feloldás feltétele a dokumentált biztonsági bizonyítás; ezt a specifikációt önmagában nem szabad engedélyként kezelni.

## Elfogadási tesztek

- Már kézzel beírt gyermekéletkorok levél újranyitásakor megmaradnak.
- Árkérés után az ellenőrzött HUF, EUR és bontás látható az operátor előtt, de a levélben nincs összeg.
- „Ár jóváhagyása és beépítése a levélbe” csak az aktuális bemenethez tartozó árat illeszti be, nem küld e-mailt.
- Megváltozott dátum/létszám/ház esetén az előző jóváhagyás érvényét veszti.
- Nem szabad / nem igazolt ház vagy zárt Previo-kapu esetén nincs kitalált ár és nincs véletlen jóváhagyás.
- Hiányzó MNB-válasz esetén az eurós összeget nem pótolja becsléssel.
- Main/production nem módosul.
