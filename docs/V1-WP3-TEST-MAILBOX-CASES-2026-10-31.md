# V1 – 3. munkacsomag: tesztlevél-ügyek felhős kezelése – offline SQL-tervezet (2026-10-31)

Ág: `gmail-test-subject-allowlist`. Kiinduló HEAD `a0834a7e52980cb0b2ffb948c316dfb60a789e3d`. AGENTS.md blob `be27bd2dfb4795496bd9f3d64ad60ada1123de5b`. D1–D3 tulajdonosi döntések a feladat szerint érvényesek.

## Választott, egyszerűbb út
A hosztolt `sc_write_case` nem változik, így a hosztolt függvénydefiníciók exportja nem blokkol. Helyette additív, kizárólag TESZT-projektre telepíthető, alapból kikapcsolt képesség (`deployment/test-mailbox/install.sql`):
- `sc_test_mailbox_config` – tulajdonosi kapcsoló, alapértelmezés: kikapcsolva; kliens nem olvashatja/írhatja.
- `sc_test_mailbox_cases` – eredet-nyilvántartás; csak `sc_tm_create` írja. Ami nincs benne, az sosem tesztlevél-ügy.
- `sc_tm_actor` – közös belső kapu: kapcsoló, TESZT-kötés, Supabase-JWT (kiállító, lejárat, munkamenet-azonosító), nem visszavont munkamenet, jogosultság.
- `sc_tm_create` – Writer; a 2. munkacsomag szerinti szerveroldali HMAC-ot (`test-mailbox-source-v1`) az adatbázis maga számolja újra (`sc_isolated_approval_mac`, meglévő kulcs); 120 mp frissesség; egy üzenet, forrás és boríték egyezik, nem válasz, címzett a tesztfiók, `.invalid` feladó tiltva (névterek elválasztva); duplikált üzenet tiltva (`sc_message_keys`). Tanúsítás és kulcs nem tárolódik.
- `sc_tm_redraft` – Writer; csak új tervezet hozzáfűzése (`createdBy` a szerver szerint), függőben, visszaküldés után (csak eltérő szöveggel) vagy elutasítás után (újranyitás); jóváhagyott ügy V1-ben végleges; döntés vagy audit nem módosítható.
- `sc_tm_decide` – független Approver (a legutóbbi tervezet szerzője nem lehet); csak függőben lévő ügyre, a pontos tervezet-hash-re; `approve` → `approved_internal` (`test-mailbox-v1`, kapacitás/ár nem igazolt, küldés és foglalás tiltva), `return` → `returned_for_edit`, `reject` → `rejected`; döntések hozzáfűzéssel.
- Minden sikeres változás: CAS (`revision`), egy auditsor (`tm_create`, `tm_redraft`, `tm_approve`, `tm_return`, `tm_reject`).
- Service role nem futtathatja; az ügyírás a felhasználó Supabase-munkamenetével történik.

`deployment/test-mailbox/rollback.sql`: csak az új függvényeket törli és a kapcsolót kikapcsolja; ügyek, audit, üzenetkulcsok és nyilvántartás érintetlenek. Meglévő függvény nem változott, ezért nincs mit visszaállítani; az újratelepítés kikapcsolt állapotban indul.

## Bizonyíték (valódi PostgreSQL-szemantika, PGlite)
`tests/test-mailbox-sql-pglite.test.mjs`, a hosztolttal azonos rétegsoron (ügytár → cloud-approval → külön jóváhagyói jog → exact-receipt → test-mailbox). Az elfogadási feltételek 1–10. pontja külön részteszt. 13 SQL-mutációból 12 bukik; egy (S5) egyenértékű, mert a törzs-hash egyezését a függvény külön is ellenőrzi.

## Nem igazolt / következő lépések
- Hosztolt migráció, szerveroldali bekötés (`booking-cases` új műveletek a 2. csomag modulján át), Netlify-kapcsoló, napi felület (4. csomag), iPhone: NEM IGAZOLT.
- Hosztolt telepítés előtt: friss mentés (`sarberki.tm_backup_sha256`), tulajdonosi futtatás, majd a kapcsoló bekapcsolása külön döntéssel.
