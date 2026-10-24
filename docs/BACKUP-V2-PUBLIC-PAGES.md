# OAuth tájékoztatóoldalak előkészítése – 2026-10-24

Állapot: tartalmi tervezet, NEM közzétett oldal, NEM jogi megfelelőségi igazolás. Nem helyettesít működő URL-t. A közzététel előtt a tulajdonosnak jóvá kell hagynia a tartalom valóságtartalmát, az adatkezelő adatait és a megőrzési rendet. A meglévő éles honlaphoz nem nyúltunk.

## Bemutatkozó oldal szövegtervezete

**Sarberki Drive Backup**

A Sarberki Drive Backup a Sárberki alkalmazás ellenőrzött biztonsági mentéseinek tárolására készülő, korlátozott használatú eszköz. Jelenleg a kijelölt tesztadatbázis szintetikus adatainak mentésére készül; a teljes automatikus mentési és helyreállítási folyamat még nincs elfogadva.

A tervezett folyamat az adatbázis exportját titkosítja, majd a felhasználó meglévő Google Drive-tárhelyének kijelölt privát mappájába tölti. A feltöltést a pontos fájl visszatöltése, hash-ellenőrzése és elkülönített SQL-helyreállítás követi. A tárhely-engedélyezés nem engedélyez vendéglevél-küldést vagy foglalás létrehozását.

Kapcsolat: valkana6666@gmail.com

A közzétett oldalon tényleges, ugyanazon domainen elérhető link kell az alábbi adatkezelési tájékoztatóhoz és használati feltételekhez. Ezek címe jelenleg nincs kijelölve.

## Adatkezelési tájékoztató tartalmi tervezete

**Cél:** a kijelölt Sárberki tesztrendszer titkosított mentéseinek megőrzése és visszaállíthatóságuk ellenőrzése.

**Google-hozzáférés:** az alkalmazás kizárólag a Google Drive `drive.file` jogosultságát kívánja használni. Ez az alkalmazás által létrehozott vagy a felhasználó által az alkalmazásnak kiválasztott fájlokra korlátozódik; nem kér teljes Drive- vagy Gmail-hozzáférést. A kijelölt mappa hozzáférését külön ellenőrizni kell.

**Kezelt adatok:** a hozzáférés fenntartásához szükséges OAuth-hitelesítők, a célmappa és a mentés fájlazonosítói, fájlméretek, időpontok, ellenőrzőösszegek és titkosított mentésállományok. A jelenlegi tesztfolyamat nem engedélyez valódi vendégadatot.

**Tárolás és szolgáltatók:** az OAuth-hitelesítők és a mentési jelszó GitHub Actions Secrets tárolóba valók; titkos értékek nem kerülhetnek nyilvános forráskódba vagy futási naplóba. A titkosított állományok a tulajdonos kijelölt privát Google Drive-mappájába kerülnek. A futtatás GitHub Actions környezetben történik, az elkülönített helyreállítás ideiglenes tesztadatbázisban. A helyreállítás a futtató környezetben szükségszerűen feloldja a titkosított adatokat; azok nem kerülhetnek publikus artifactba.

**Felhasználás:** a mentési alkalmazás adatait mentésre, integritásellenőrzésre és helyreállításra használjuk. Nem használjuk reklámcélra, értékesítésre vagy AI-modellek tanítására. A mentési útvonalhoz AI-szolgáltatás nem szükséges.

**Megőrzés és törlés:** a jelenlegi kód nem töröl és nem ír felül korábbi Drive-mentéseket. A pontos megőrzési idő és a tulajdonosi törlési eljárás közzététel előtt véglegesítendő. A GitHub Actions átmeneti artifact-megőrzése külön beállítás, nem a Drive-megőrzés helyettesítője.

**Hozzáférés visszavonása:** a felhasználó Google-fiókjában visszavonhatja az alkalmazás hozzáférését. Ettől a korábban létrehozott mentésfájlok nem törlődnek automatikusan. Törlési vagy hozzáférési kérés: valkana6666@gmail.com.

Közzététel előtt tisztázandó: az adatkezelő pontos személye/szervezete és kapcsolati adatai, a végleges megőrzés, a törlési ügyintézés és az alkalmazandó adatvédelmi tájékoztatási követelmények. Ismeretlen részhez nem állítunk kitalált adatot.

## Használati feltételek tartalmi tervezete

Az eszköz jelenleg a kijelölt Sárberki tesztrendszerhez készül. Használatához az arra jogosult tulajdonos Google-engedélyezése, védett hitelesítő tárolás és függetlenül megőrzött helyreállítási kulcs szükséges.

Egy zöld fejlesztői teszt vagy egy feltöltött fájl önmagában nem igazolja a teljes helyreállíthatóságot. Az elfogadást a mentés, feltöltés, visszatöltés, feloldás és izolált helyreállítás együttes bizonyítéka adja. Elveszett helyreállítási kulcs mellett a titkosított állomány tartalma nem tekinthető hozzáférhetőnek.

A mentési rendszer nem ad jogosultságot éles foglalásra, vendégküldésre vagy az éles adatbázis módosítására. Az itt leírt szöveg még nem közzétett vagy elfogadott szerződéses feltétel.

## Közzétételi lehetőség ellenőrzése

- Meglévő teszt-Netlify host ismert, de a saját Google Cloud domainellenőrzés és a használható saját domain nincs igazolva. Egy működő Netlify URL önmagában nem bizonyít domain-tulajdonosi ellenőrzést.
- Az éles sarberkito.hu módosítása nincs engedélyezve; ahhoz nem adtunk hozzá oldalakat.
- Google Cloud adminművelethez nincs elérhető csatlakozó, és a Work Cloud-konzol böngészős útvonala blokkolt. Nincs bizonyított közzétételi út; találomra megadott URL nem kerül az OAuth-beállításokba.
- A publikálást és Google-ellenőrzést nem tekintjük elvégzettnek.

Hivatalos követelmények: https://support.google.com/cloud/answer/15549049
