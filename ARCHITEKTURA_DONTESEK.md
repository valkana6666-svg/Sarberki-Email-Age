# Sárberki – architektúra-döntések

Frissítve: 2026-10-05

## Miért létezik ez a fájl?

Ez a fájl nem üzleti szabálylista. A konkrét működési szabályokat a `szabalyok.txt` és a futó modulok tartalmazzák.

Itt azt rögzítjük, **miért ilyen felépítésű a rendszer**, hogy később egy refaktor vagy új fejlesztő ne bontson le véletlenül fontos biztonsági határokat.

## AD-01 – Az LLM nem az üzleti szabálymotor

**Döntés:** az LLM nyelvi értelmezésre és megfogalmazásra használható, de ár, előleg, lemondás, kapacitás, háztípus-korlát vagy PMS-állapot nem lehet kizárólag promptban tárolt döntés.

**Indok:** a kritikus szabályoknak determinisztikusan tesztelhetőnek kell lenniük.

**Következmény:** a Sárberki-specifikus szabályok kódolt konfigurációban és modulokban vannak; a levélgenerálás ezeket használja.

## AD-02 – Strukturált állapot a szabad szöveg helyett

**Döntés:** érkezés, távozás, felnőttek, gyermekek és életkoruk, háztípus, egységszám, árstátusz és review-státusz külön mező.

**Indok:** így külön ellenőrizhető, hogy mi ismert, mi hiányzik és mi következtetett.

**Következmény:** hiányos vagy ellentmondó adat esetén a rendszer megáll vagy csak a szükséges adatot kérdezi vissza.

## AD-03 – Külső rendszerenként külön adapter

**Döntés:** Gmail, Previo, MNB és későbbi integrációk külön rétegen keresztül érhetők el.

**Indok:** a külső API-változás ne írja át közvetlenül az üzleti vagy levélgeneráló logikát.

**Következmény:** bemenet- és kimenetvalidáció, hibakezelés és forrásstátusz adapterenként tesztelhető.

## AD-04 – Fail closed

**Döntés:** bizonytalan, hiányos vagy megváltozott külső válasz esetén ne legyen találgatás.

**Indok:** hamis ár vagy hamis szabad kapacitás nagyobb kockázat, mint az, hogy a rendszer emberi ellenőrzést kér.

**Következmény:** ismeretlen Previo mező/útvonal, árfolyamforrás-hiba vagy nem hitelesített mapping esetén review/error állapot.

## AD-05 – Human approval az ügyfél felé menő kritikus lépéseknél

**Döntés:** a rendszer tervezetet készít; automatikus vendége-mail és PMS-foglalás nincs.

**Indok:** az MVP célja a kezelő gyorsítása úgy, hogy az üzleti és pénzügyi döntések felett megmaradjon az emberi kontroll.

**Következmény:** jóváhagyott ár külön kezelői művelettel kerülhet a válaszba; küldés nem automatikus.

## AD-06 – Previo olvasási és írási határ szigorú szétválasztása

**Döntés:** a nyilvános Reservation+ felületből csak a szükséges keresési/occupancy/price útvonalakat vizsgáljuk. Foglalási, vendégadat- vagy fizetési lépés nem része az adapternek.

**Indok:** nincs hivatalos Previo API-hozzáférésünk, és a dokumentálatlan nyilvános foglaló végpontok mellékhatásmentessége nem teljesen bizonyított.

**Következmény:** a Previo-hívások biztonsági kapuhoz kötöttek; a részletes státusz a `PRICE_SOURCE_STATUS.md` fájlban van.

## AD-07 – Hiteles forrás elsőbbsége

**Döntés:** élő, ellenőrzött külső adat > rögzített fixture > belső referencia/fallback > nincs adat.

**Indok:** külön kell választani a ténylegesen lekért árat attól, amit csak referencia-számítás ad.

**Következmény:** a rendszer a forrásstátuszt is kezeli, nem csak az összeget.

## AD-08 – Élő adatból offline regressziós fixture

**Döntés:** a már hitelesen összevetett Previo eredményekből rögzített fixture készülhet.

**Indok:** a legtöbb regressziós tesztnek hálózat nélkül, ismételhetően kell futnia.

**Következmény:** az offline teszt azt védi, hogy a saját kódunk ne változtassa meg észrevétlenül a már ellenőrzött feldolgozást; nem bizonyít friss Previo árat.

## AD-09 – Tesztág és production szétválasztása

**Döntés:** fejlesztés kizárólag a `gmail-test-subject-allowlist` ágon és a külön teszt Netlify oldalon történik.

**Indok:** a kísérletek, élő integrációs próbák és dokumentációs fejlesztések ne érintsék az éles rendszert.

**Következmény:** `main` / production csak külön, explicit döntéssel módosítható.

## AD-10 – Business profile / shared-core irány

**Döntés:** a közös technikai motor és a Sárberki-specifikus üzleti profil különválasztása.

**Indok:** a cél hosszabb távon nem egyetlen keményen beégetett szálláshelyi script, hanem újrahasznosítható mag + cserélhető üzleti profil.

**Következmény:** a Sárberki-specifikus értékeket a business profile/config adja a közös moduloknak.

## AD-11 – Dokumentált bizonyossági szintek

**Döntés:** külön kell jelölni a VERIFIED, referencia, review_required és NOT YET VERIFIED állapotokat.

**Indok:** a projektben több adatforrás és több bizonyítási szint létezik; ezek összemosása hibás automatizáláshoz vezethet.

**Következmény:** a dokumentáció és a UI sem állíthat biztos tényt arról, ami csak feltételezés vagy kézi ellenőrzést igényel.

## AD-12 – Daktela mintaként, nem függőségként

**Döntés:** a Daktela nyilvános dokumentációját architekturális referenciaként használjuk, de a Sárberki rendszernek nincs Daktela runtime-függősége.

**Indok:** a hasznos minta a komponensek szétválasztása: flow, context, integráció, hibaág, tudás és human-in-the-loop.

**Következmény:** a saját megvalósítás önállóan fejleszthető, tesztelhető és később más ügyfélprofilra adaptálható.

## Kapcsolódó projektfájlok

- `szabalyok.txt` – aktuális üzleti és működési szabályok
- `PRICE_SOURCE_STATUS.md` – Previo árforrás és biztonsági bizonyítás
- `DAKTELA_TANULSAGOK.md` – külső architekturális minták és bizonyítási határok
- `FORRASOK.md` – külső és belső forrásjegyzék
- `business/sarberki/profile.mjs` – Sárberki üzleti profil
- `business-config.mjs` – konkrét Sárberki konfiguráció
