# Teszteredmények – 2026-10-09

| Ellenőrzés | Darabszám | Pass | Fail | Skip | Környezet |
|---|---:|---:|---:|---:|---|
| Kiinduló npm test | 755 | 755 | 0 | 0 | Node helyi, eredeti HEAD |
| Célzott szerveralap | 35 | 35 | 0 | 0 | Node + PGlite |
| Végső npm test | 780 | 780 | 0 | 0 | Node + PGlite |
| Valódi felhős E2E | 0 | — | — | — | Nem végrehajtva: nincs Supabase-projekt/session |

Kiinduló SHA: 3768f54fe80913b72ad66a3a137a1a0cc449b42c.
Implementáció SHA: 4c66c83ce850ec0fdafa1ebce12182d65a04ae54.
25 új teszt: 21 server-foundation + 4 supabase-policy. A célzott kör 10 korábbi server-case-service tesztet is tartalmaz.

Parancsok:

```sh
npm ci
node --test tests/server-case-service.test.mjs tests/server-foundation.test.mjs tests/supabase-policy.test.mjs
npm test
git diff --check
```

A végső teljes regresszió a legutolsó SQL-validációs szigorítást is tartalmazza; 780 PASS, 0 fail/cancelled/skipped/todo. A SQL-policy tesztet a teljes npm test automatikusan futtatja, nem opcionális skip.

## Mit igazolnak a próbák?

1. Két mesterséges tenant; writer/reader/foreign operátor. Valódi PostgreSQL RLS szerepkörváltással, auth.uid fixture-rel; nincs mock SQL-értelmező.
2. Migráció kétszer futtatva: SQL-szintaxis, idempotencia, policy/execute és közvetlen táblagrantek.
3. Anonymous és üres identity tiltva; reader nem írhat; idegen tenant 0 olvasható sor és RPC-tíltás; tagság/audit közvetlen változtatása tiltva.
4. CAS stale revision=false, új insert konfliktus=false, mailbox/message cross-case ütközés teljes rollback; korábbi üzenetek nem törölhetők, fake evidence/approval tiltott.
5. Teljes helyi PGlite adatkönyvtár mentése és új motorba visszatöltése; ügy, audit SHA-256 és foreign-user RLS egyezik.
6. Netlify handler→authority→motor→repository→PostgreSQL lánc szintetikus HTTP/Auth fixture-rel: import, duplicate, két operátor olvasása, update, read-only/foreign tiltás, draft mentés.
7. Két operátor párhuzamos alkalmazási CAS: pontosan egy siker és egy konfliktus; nincs csendes adatvesztés. Ez Map-repository szimuláció, nem két felhős PostgreSQL connection terhelési próba.
8. Régi üzenet történeti megőrzése, feladószintű automatikus link kizárása, mailbox/thread namespace, ár-/kapacitásinvalidálás a meglévő motoron.
9. API kikapcsolt/production/anonymous gate hálózati hívás nélkül, upstream 401/DB hiba redakciója, rossz adapterválaszok tiltása, helyi migrációelőnézet.
10. Belső tervezet verziózása; quote/availability nincs igazoltnak feltöltve; nincs küldő művelet.

## Mit nem igazolnak?

Valódi Supabase Auth login/expiry/refresh; tényleges felhős policy és Netlify deployment; két valódi böngészősession; felhős backup/restore; Gmail OAuth-hiteles import; UI átállás; éles Previo adat. Ehhez 0 élő kérés történt. Meglévő projekt regressziójában a korábbi tenant/reply-context és bizonytalan kapacitás negatív tesztek is futottak.

A baseline Git-bundle visszaállítása külön checkoutban ugyanazt a kiinduló SHA-t adta. Ez forráskódmentés, nem adatbázismentés. A teljes fontos forrás és a jelentések a tesztágon maradnak.
