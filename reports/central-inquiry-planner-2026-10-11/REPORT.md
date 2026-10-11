# Közös e-mail/chat döntési réteg – 2026-10-11

## Igazolt eredmény

Kiinduló tesztági HEAD: `e1a407de95d2ca01618dbdb4c0edc4b043a3ddf4`. Meglévő CI: [38163959097](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38163959097), sikeres, 1036 teszt. A korábbi parser, osztottkapacitás-kezelés és négy nyelvű chatbot változásai megmaradtak.

A közös döntési réteg újrahasználja a meglévő adatértelmezőt, ellenőrzést, kapacitásszűrést és árösszesítést. Külön e-mail- és chatadapter adja vissza ugyanazt az üzleti döntést. A helyi chatbot több üzenetben megőrzi az adatokat; külön beszélgetések nem osztják meg őket. A gyermekéletkorok részleges kiegészítése, korrekciója és létszámváltozáskor törlése a meglévő ügyadat-egyesítőből származik.

Javult a magyar teljes ISO dátumpárok felismerése. A dátum után álló létszámot az „és” kötőszó önmagában nem alakíthatja távozási dátummá.

## Tesztek

- Végső célzott futás: **24 PASS, 0 FAIL**; ebből 4 meglévő previewteszt, 20 új teszt.
- Végső teljes `npm test`: **1056 PASS, 0 FAIL**, nincs kihagyott teszt.
- A célzott futás a teljes csomag részhalmaza; a két darabszám nem adandó össze.
- Négy nyelvű adatértelmezés és adapteregyezés; osztott kapacitás, közelség, rossz tenant/időszak/létszám, lejárt bizonyíték, elégtelen készlet, árkomponens-kötés, providerhiba és várakozás közbeni lejárat ellenőrizve.
- Kizárólag szintetikus tesztadatok. Nem futott élő Previo-ellenőrzés, üzenetküldés vagy foglalás.

Bizonyíték: `targeted-tests.txt`, `regression-summary.txt`. A GitHub CI eredményét külön, az új commithoz tartozó futás alapján kell ellenőrizni.

## Készültség és korlátok

| Projekt | Bizonyított | Még nem igazolt |
|---|---|---|
| AI-agent V1 | Közös döntésből készült, jóváhagyásra váró e-mail-adapter; meglévő regresszió változatlanul sikeres | A korábbi Gmail/kezelői útvonal teljes átállítása az új adapterre és hitelesített felhős E2E |
| Chatbot Project | Négy nyelvű közös döntés, helyi preview/UI-bekötés, izolált többüzenetes memória és törlés | Tartós HTTPS cél, valódi mobilböngészős próba és külső szolgáltatói kapacitásforrás |

A tesztek jóváhagyott szintetikus árkomponenseket használnak; élő tarifa-, kedvezmény- és teljes Previo-időszak-ellenőrzést nem igazolnak. A chat a kapacitást alapból UNKNOWN állapotban tartja. Nincs automatikus jóváhagyás, küldés vagy foglalás.

A korábbi Persistent_Preflight ZIP korábbi forrásállapotot tartalmaz; ez a fejlesztés nem készített új teljes rendszermentést, és nem igazolja újra a teljes rendszer helyreállíthatóságát.

## Következő konkrét feladat

A közös tervezőt az elkülönített, hitelesített szerveres tesztügy-folyamatba kell bekötni, a tárolt aktuális tervezet, kapacitásbizonyíték, jóváhagyási jogosultság és audit ellenőrzésének megtartásával. A szolgáltatói hívás csak igazoltan elkülönített tesztcél és dokumentált készletzárolás-mentesség után engedélyezhető. Részletes szerződés: `docs/CENTRAL-INQUIRY-PLANNER.md`.
