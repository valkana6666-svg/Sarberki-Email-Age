# V1 – szerveroldali exact Gmail receipt, célzott futtatás (2026-10-15)

## Futtatott tesztek
A `gmail-server-exact-receipt.test.mjs` és a `shared-core/server-exact-gmail-receipt.mjs` ellenőrzött GitHub-tartalmának helyi másolatából, a `/mnt/data/sarberki_server_receipt` elkülönített könyvtárban:

`node --test gmail-server-exact-receipt.test.mjs`

Node.js **v22.16.0**; TAP: **3 tests, 3 pass, 0 fail, 0 skipped**.

Ellenőrzött esetek: izolált Netlify/Supabase konfigurációs kapuk, pontos forrás és envelope egyezés, módosított szöveg/címzett/references elutasítása, privát törzshash és feladó ellenőrzése.

## Hatókör
Az eredmény **helyi másolaton** futtatott célzott modul- és tesztellenőrzés, nem a teljes repository `npm test`, nem GitHub Actions CI, és nem bizonyítja a telepített Netlify, Gmail OAuth, Supabase Writer/Reader vagy audit végpontok működését. A szerveroldali konfigurációt nem kapcsoltuk be, titkot nem olvastunk, éles vendégadatot nem kezeltünk.

## Következő kapu
A teljes `npm run test:gmail` és `npm test` futtatása az eredeti tesztág checkoutján/CI-ben, utána a teszt-Netlify commitazonosító és a hitelesített szintetikus Gmail → Writer → Reader visszaolvasás igazolása.
