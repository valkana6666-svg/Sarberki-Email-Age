# Nyilvános árforrás – technikai állapot (2026-09-28)

- A hivatalos `https://sarberkito.hu/foglalas/` oldal beágyazott Previo foglalót használ. A meglévő `price-quote.mjs` böngészős adapter a dátum, háztípus, felnőtt létszám és végösszeg lépéseit célozza. Ez elkülönül az `index.html` adatkinyerésétől és a `price-check.js` választervezetétől.
- A helyi adapter a felnőtt létszámhoz illő Previo választást és az összesítőben szereplő létszámot ellenőrzi. Gyermekes árlekérés még nincs automatizálva. A `netlify/functions/price-quote.mjs` végpont szándékosan 503 / `unverified` választ ad, mert a szerveroldali Chromiumot a foglaló interaktív ellenőrzése akadályozza. Az oldalon nem azonosítottunk bizonyítottan stabil, támogatott, csak olvasási API-t.
- Az árhoz szükséges bemenet: pontos érkezés és távozás, egyértelmű háztípus, felnőttek száma, gyermekek száma és életkora. A konkrét Previo kérés paramétereit élő, akadálymentes böngészőhálózati vizsgálat nélkül nem tekintjük igazoltnak. Közvetlen végpontot ezért nem hívunk és szállásárat nem számolunk saját képlettel.
- Az árforrás további adapterként cserélhető: a jelenlegi `price-quote.mjs` publikus foglaló modul mellé később hitelesített Previo API adapter kerülhet. A szerveroldali végpont csak ellenőrzött összesítőt adhat vissza; a kezelő felülete a forrást, időpontot és összeget megjeleníti, majd külön emberi árellenőrzést kér a levélbe emeléshez.
- A sikertelen lekérés belső státusza `HITELES ÁRLEKÉRÉS SZÜKSÉGES`. A vendéglevél ilyenkor szám nélkül jelzi az ellenőrzést. Nem történik e-mail küldés, foglalás vagy pénzügyi művelet.

## Következő igazolható lépés

Olvasási jogosultságú Previo API dokumentáció vagy működő publikus, szerződésileg használható ár-végpont alapján ellenőrizni kell a gyermekkorok, kapacitás nélküli találat, háztípus és végösszeg szemantikáját. Ezután az adapterbe integrációs teszt kerül 2 felnőtt, 2 felnőtt és 2 gyermek, több háztípus, nulla kapacitás és árforrás-hiba esetére. Addig a Netlify végpont zárva marad.
