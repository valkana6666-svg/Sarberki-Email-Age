# Árlekérő végpont védelme – 2026-10-28

Kiinduló tesztági commit: `6af528500b4c32a937b9c3384df070b69ff77dac`.
Ág: `gmail-test-subject-allowlist`. Main/production nem módosul.

## Elkészült változás

- `netlify/functions/price-quote.mjs`: a HTTP-belépési pont a meglévő, titkosított kezelői sütit, CSRF-védelmet és friss Supabase Auth + DB Reader-tagságot ellenőrzi a külső ár-, kapacitás- és árfolyamforrás előtt. Nincs új jogosultsági rendszer vagy service-role használat.
- HTTPS és engedélyezett teszthost szükséges. A meglévő Previo-biztonsági kapcsoló zárva maradhat, és elsőbbséget élvez. A tesztkérés nem nyitja meg.
- Bearer/partner-token, hamis vagy hiányzó süti, hiányzó CSRF, idegen eredet, visszavont munkamenet, hiányzó vagy idegen tenant-tagság és Auth-hiba esetén nincs külső lekérdezés.
- A frissített süti a válasz fejlécébe kerül, token nem kerül a JSON-ba. Auth-hiba csak rögzített hibakódot ad.
- Netlify function rateLimit: 10 kérés / 60 másodperc, IP + domain szerinti csoportosítással. Az explicit `config.path` az `/api/price-quote` útvonalat védi; Netlify szerint ez a korábbi közvetlen function URL-t megszünteti. A régi TOML-átirányítást eltávolítottuk. Ez nem tenant-szintű vagy teljes költségplafon.
- `price-check.js`: az árlekérés a meglévő sorosított kezelői kéréskezelést és CSRF-adatot használja, ha van aktív kezelői munkamenet. Lejárt munkamenet után nincs névtelen újrapróbálás. A nyilvános referenciaár útvonala külön marad, nem ad élő Previo-engedélyt.

## Bizonyíték

- Végleges célzott teszt: **96 PASS / 0 FAIL / 0 SKIP**.
- Teljes `npm test`: **2380 PASS / 0 FAIL / 0 SKIP**.
- Tesztek: `tests/price-quote-access.test.mjs`, `tests/case-ui.test.mjs`, meglévő ár- és operator-cookie tesztek.
- A hozzáférési integráció valódi helyi sütititkosítást és helyettesített Auth/DB-/Previo-/MNB-válaszokat használ. Nem élő szolgáltatási bizonyíték. A teljes csomag helyi PGlite-alapú PostgreSQL-ellenőrzéseket is futtatott.
- Netlify edge 429 érvényesülése és telepített tesztoldali viselkedés: külön ellenőrzendő. A kódbeli konfiguráció önmagában nem élő bizonyíték.
- Élő Previo-hívás, valódi vendégadat, foglalás, e-mail- vagy Pushover-küldés nem történt.

## Következő feladatok és korlátok

1. Az adott commit CI-jének és teszttelepítésének ellenőrzése; éles integráció aktiválása nélkül.
2. A böngészőben futó döntési logika szerverre költöztetése külön, csatornaparitást megőrző változásban. Ez a javítás ezt még nem oldja meg.
3. Kódtár-hozzáférés szűkítése; a már nyilvánosságra hozott kód nem válik visszamenőleg titkossá. A jelen változás nem módosítja a repo láthatóságát.
4. Külső válaszok, timeout/retry és az összes többi integráció külön célzott ellenőrzése. Nem teljes biztonsági audit.

V2/V3 érték: a meglévő hitelesítési és tenant-határ újrahasznosítható marad. Reader-árlekérés nem ad jóváhagyási, küldési vagy foglalási jogosultságot.

## Telepítési ellenőrzés és útvonaljavítás

Az első telepített commit (`ba8842f0699aa021609d5bd6fc4167d0c81b073c`) build SHA-ja igazolt; mindkét GitHub CI-je sikeres. A Previo-kapu HTTP 503-at adott. A 15 kéréses, 13,6 másodperces névtelen próba nem adott 429-et. A hivatalos Netlify dokumentáció alapján a rateLimit mellé explicit config.path is szükséges: ezt a következő javítás pótolja, a régi TOML-átirányítás eltávolításával. A közvetlen function URL-re és az edge 429-re új telepítési próba szükséges.

Forrás: https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/ és https://docs.netlify.com/build/functions/configuration/ .
