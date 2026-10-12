# Gmail szerverelőnézet: valódi iPhone ellenőrzés

A Chromium/WebKit 390×844-es helyi próba böngészőmotoros emuláció. Nem igazol valódi iPhone-t, felhős bejelentkezést, Gmail OAuth-ot, tartós mentést vagy audit-visszaolvasást.

Csak a `gmail-test-subject-allowlist` tesztfelületet és előre létrehozott, `.invalid` feladójú szintetikus ügyet használj. Eredeti Gmail-üzenetet vagy vendégadatot ne tölts fel. Üzenetküldés, foglalás és production hozzáférés nem része ennek a próbának.

1. Safari iPhone-on: nyisd meg a meglévő Gmail felület „Központi szerveres választervezet” szakaszát. Jegyezd fel az iOS/Safari verziót és a tesztági commitot.
2. Bejelentkezés nélkül az előnézet maradjon tiltott; a szöveg ne állítson sikeres adatlekérést.
3. Külön hitelesített tesztmunkamenettel kérd le az előre tárolt szintetikus ügy pontos verzióját. A vendégtervezet és magyar ellenőrző szöveg csak olvasható legyen.
4. Ellenőrizd a hiányokat, kapacitás- és árjelzést. Ismeretlen kapacitás/ár nem jelenhet meg igazoltként. Az előnézet nem jóváhagyás és nem vendégajánlat.
5. Nézd meg az ügy- és tényverziót: elavult vagy üzenetszámhoz nem kötött tervezet új ellenőrzést igényel. Az audit „NEM IGAZOLT”, amíg külön hitelesített szerveres visszaolvasás nem történt.
6. Módosítsd az ügyazonosítót/verziót, vagy zárd le a munkamenetet: minden korábbi előnézet törlődjön. Későn érkező régi kérés ne töltse vissza.
7. Ellenőrizd álló/fekvő nézetben, billentyűzettel és nagyított szöveggel: mezők ne lógjanak ki, gombok érinthetők legyenek, magyar szöveg olvasható legyen.
8. Hibás/lejárt munkamenet és verzióütközés után ne maradjon sikeres állapot. Ne készíts tokent vagy vendégadatot tartalmazó képernyőképet.

A jelenlegi panel kizárólag GET-előnézetet kér; nem ír ügyet, nem aktivál jóváhagyást, és nem ellenőriz auditot vagy újraindítás utáni tartósságot. A checklist elvégzése még nem igazolt.
