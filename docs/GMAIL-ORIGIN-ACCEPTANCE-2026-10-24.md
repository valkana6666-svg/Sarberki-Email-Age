# Gmail-eredet és iPhone-elfogadás – 2026-10-24

## Tulajdonosi megfigyelés

A felhasználó a BUILD 5a02c38 alatt iPhone Safariban látta a Gmail-listát, korábban olvasott szintetikus levél ügyadatait, hiányait, szerkeszthető tervezetét és jóváhagyási korlátját. Az ügy november 13–15-re szólt. Ezeket az UI-részpróbákat elfogadjuk, nem ismételtetjük meg.

A „Kézi beillesztés és szabályalapú feldolgozás” két eseményéből nem következik két kézi import, és nem következik sikeres Gmail API-olvasás sem. A közös elemző ezt a fix címkét írta Gmail esetén is. Az események forrását utólag a címke alapján nem lehet helyreállítani; a régi eseményeket nem írjuk át. Két megnyitás két helyi feldolgozási eseményt adhat; a régi készülékpróba esetén dupla meghívást vagy külön felhasználói megnyitásokat nem tudunk elkülöníteni.

## Javítás és bizonyítékhatár

A readonly beolvasó csak a sikeres fiókellenőrzés és teljes levélválasz után jegyez meg egy munkameneti WeakMap-megfigyelést. A kijelölt üzenet tényleges objektumából létrehozott rekord egyszer fogyasztható megfigyelést kap. A közvetlenül hívható fixture-transform, másolt vagy JSON-ból visszatöltött rekord nem hoz létre ilyen megfigyelést. Token, jelszó, levélszöveg nem része ennek az új bizonyítékobjektumnak.

A felület megkülönbözteti:

- Gmail readonly API-olvasás: böngészőben megfigyelt, szerveroldalon nem igazolt, olvasási időponttal.
- Gmail-rekord importja: API-eredet nem igazolt. Ez a kézi JSON és a helyi fixture-transzform alapállapota is; a source.provider=gmail nem elég.
- Kézi szövegbeillesztés: operátori bemenet, nem Gmail API-olvasás.

A kijelölőből való újranyitás az eredeti olvasási időpontot őrzi, és külön „újbóli megnyitás” eseményt kap. Ez nem új hálózati olvasás. Egy sikeres feldolgozási lánc egy forráshelyes feldolgozási eseményt ír. Feldolgozási hiba nem ad sikeres eredeteseményt és nem jelöli olvasottnak a levelet. Átmeneti forráskontextus hiba után sem öröklődhet kézi feldolgozásba.

A megfigyelés nem kriptográfiai vagy szerveres bizonylat: ugyanazon böngészőkörnyezet kódjába vetett bizalomra épül. Nem ad küldési, Writer-, jóváhagyási vagy Previo-jogot. Nem változtatjuk a meglévő szerveres sourceReceipt formátumát, RLS-t, auditot vagy a már jóváhagyott v3 ügyet.

## Ellenőrzés

Célzott teljes érintett csomag: **116 PASS / 0 FAIL / 0 SKIP** (case UI, friss Gmail-fixture, policy, scoped readonly, timeout/lapozás, analyzer és meglévő válasz-integráció). Az utolsó változtatás csak az olvasási időpont naplózása; ennek UI-csomagja **35 PASS / 0 FAIL / 0 SKIP**. A csomagok átfednek, nem adhatók össze.

Új negatív próbák: importált JSON hamis eredetjelzője, megfigyelés egyszeri felhasználása, JSON-klón, közvetlen fixture-transform, sikertelen feldolgozás, kézi elemzésre visszatérés, egy forrásesemény feldolgozásonként, ismételt megnyitás címkéje. A 15 másodperces fejléc/JSON timeout és no-retry tesztek továbbra sikeresek. Mindez helyi Node/VM-bizonyíték, nem friss iPhone- vagy Google API-hívás.

## Ami még nem igazolt

A korábbi 5a02c38 iPhone-levél konkrét Gmail API-eredete továbbra NEM IGAZOLT. A kliens közvetlen Google-olvasása nem ad utólag visszakereshető szerveroldali olvasási bizonylatot; a meglévő tárolt ügy/Writer-audit önmagában nem bizonyítja ezt a konkrét böngészős GET-et. Nem indítunk ismételt felhős mentést vagy jóváhagyást ennek pótlására.

A következő fizikai eredetigazolás csak az új, pontosan ellenőrzött deploy után kérhető, a már létező szintetikus levélre. Az eddig sikeres UI-, háttér- és v3-jóváhagyási részpróbákat nem kell újrafuttatni. Új e-mailt nem készítünk vagy küldünk. A felhasználótól legfeljebb egyetlen, előkészített readonly megnyitás kérhető; az adott levél és a művelet előfeltételeit előtte azonosítani kell.


## Készülékes lezárás – 2026-10-25

**PASS, kizárólag a böngészőben megfigyelt Gmail-eredetjelzés elfogadási körében.** A tulajdonos iPhone-képernyőképei (IMG_9247, IMG_9254; 15:16 készülékidő) a kijelölt, már meglévő szintetikus levél sikeres readonly megnyitását igazolják. Az elvárt szintetikus tartalom: 2026-10-30–2026-11-01, 2 éjszaka, 8 felnőtt, angol levél. A forráskártyán és az eseménynaplóban is a „Gmail readonly API-olvasás · böngészőben megfigyelt, szerveroldalon nem igazolt” jelölés látható.

Olvasás: **2026-10-25T14:15:24.298Z**, azaz 15:15:24 Europe/Vienna. Feldolgozási esemény: **2026-10-25T14:15:24.368Z**. A forráskártyán látható üzenetazonosság megfelel az előzetesen kijelölt levélnek. A magánlevél-azonosítót, feladói címet és teljes képernyőképeket nem másoljuk a dokumentumba.

Ez lezárja az új eredetjelzés készülékes elfogadásának korábbi nyitott feladatát. Nem igazolja utólag a korábbi 5a02c38 próba konkrét GET-jét; nem szerveroldali vagy kriptográfiai Gmail-bizonylat, és nem teljes Gmail–adatbázis végrehajtási lánc. A kép nem bizonyít önmagában külső küldés hiányát, kapacitást, árat vagy új jóváhagyást. Az elfogadáshoz nem végeztünk új deployt, exportot, tesztlevélküldést vagy Safari-újratesztet.

### Külön nyitott paritási kérdés

IMG_9253: a helyi összesítő 8 felnőtt mellett „gyermek: ?” értéket mutat; az ármező gyermekadata is üres. Forrásellenőrzés: sarberki-core.mjs/partyCountsFromText szándékosan csak a kifejezetten megadott gyermeklétszámot vetíti ki; index.html/extract is üresen hagyja a nem megadott gyermeklétszámot. A központi intake/decision út ezzel szemben egyértelmű, gyermekemlítés nélküli felnőttcsoportnál nullát használ. tests/gmail-party-parity.test.mjs ezt a különbséget jelenleg kifejezetten rögzíti.

Ezért ez nem új parserregressziónak nyilvánított hiba, hanem egységesítendő szerződés/UX-kérdés. A Gmail-eredetpróbát nem akadályozza. A következő fejlesztésnek meg kell különböztetnie a kifejezett 0 gyermeket, a felnőttlétszámból levezetett 0-t és a bizonytalan gyermekemlítést. Üzleti szabályt nem változtattunk; kapacitást érintő majdani változtatáshoz teljes npm test és negatív esetek szükségesek.
