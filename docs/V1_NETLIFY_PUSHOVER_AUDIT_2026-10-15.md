# Sárberki V1 – Netlify Pushover végpont statikus audit (2026-10-15)

## Ellenőrzött források
- `netlify.toml`
- `netlify/functions/pushover-gmail.mjs`
- `gmail-readonly.js`
- `docs/V1_GMAIL_POLLING_AUDIT_2026-10-15.md`

## Igazolt a tesztág kódjából
- A Pushover végpont `/api/pushover-gmail` útvonalon Netlify function `config.path` segítségével van regisztrálva; ezért nem szükséges hozzá külön `netlify.toml` redirect.
- A kérés csak `POST`, `application/json`, pontos tesztoldali `Origin`, megfelelő `context.site.name` és `request.url.origin` esetén halad tovább.
- A Bearer-tokenből Gmail-profil ellenőrzése történik, és csak `sarberkiprojecttest@gmail.com` fogadható el.
- Az üzenetet a Gmail API-ból újra lekéri; `INBOX` és dátumszűrő teljesülése szükséges.
- A Pushover-küldés külső mellékhatás: `POST https://api.pushover.net/1/messages.json`. Nem egyenlő Gmail-küldéssel, de valós értesítést és szolgáltatáshasználatot eredményezhet.
- A kliensoldali `startPushoverWatch` függvény deklarált, de a fájlon belül nincs meghívva. Az OAuth callback nem indítja.

## Nem bizonyított
- Hogy a Netlify jelenleg telepített buildje azonos a vizsgált tesztággal.
- Hogy más frontend, ütemezés, külső szolgáltatás nem hívja a végpontot.
- Hogy az értesítési szolgáltatás éles kulcsai be vannak-e állítva (titkokat nem olvastunk).
- Hogy a GitHub Actions/Netlify aktuális futásai sikeresek.

## Kockázat és döntés
A felhasználó leállította a folyamatos figyelést. A V1 lezárásához **ne indítsunk** Pushover pollingot, és ne hívjuk a külső értesítő végpontot. A végpontot ne töröljük vakon, mert más tesztek vagy későbbi modulok hivatkozhatnak rá. A Netlify tesztdeployment, a kódverzió és az esetleges külső hívók ellenőrzése külön feladat.

## Prioritás
1. Élő Gmail OAuth csak a kijelölt tesztfiókkal és `gmail.readonly` scope-pal.
2. Gmail → Writer → Reader → emberi jóváhagyás szintetikus E2E.
3. Telepített teszt-Netlify commit és feature flag állapot ellenőrzése, titkok feltárása nélkül.
4. Previo élő lekérdezési kapu továbbra is zárva, amíg a mellékhatásmentesség nincs igazolva.

Ez dokumentációs audit. Nem történt Netlify-módosítás, Pushover-küldés, Gmail-olvasás vagy Previo-művelet.
