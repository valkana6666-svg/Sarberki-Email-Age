# Netlify és Pushover ellenőrzés – 2026-10-25

A meglévő Work-böngészős Netlify-belépés ebben a folytatásban új hitelesítés nélkül működik. Más munkamenetre való öröklés nem igazolt. Build Stopped marad, új build/deploy nincs. Utolsó olvasott kreditmaradék 470/500; nem új számlázási leolvasás.

A c8750e0787a4309698b6c4ade23103be5db54e0e tiszta kiadási jelölt korábbi helyi ellenőrzése 1910/0/0. Netlify UI retry a branch HEAD-et használja; nem megfelelő a rögzített commithoz. Az API commit_sha opció támogatott, de nincs biztonságosan csatlakoztatott API-hitelesítő. A PAT dokumentált beállításai nem igazolnak egyetlen site-ra korlátozást, ezért nem hoztunk létre széles tokent. Forrás: https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/ és https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/ . A kiadás nem történt meg.

Új Pushover-teszt: a teljes migráció izolált PGlite adatbázisban, szintetikus anon/authenticated/service_role szerepekkel. 2 PASS / 0 FAIL / 0 SKIP. Meglévő ledger-teszt 3 PASS / 0 FAIL / 0 SKIP. Teljes GRANT/REVOKE és SECURITY INVOKER RPC végrehajtás; browser szerepek táblához és claim RPC-hez tiltva; rossz tenant/mailbox tiltva; duplicate és outcome_unknown nem kap új claimet. Nem többkapcsolatos PostgreSQL-versenypróba; helyben nincs psql/postgres/docker futtató.

Biztonsági határ: service_role BYPASSRLS és közvetlen táblamódosítási jog marad. A terminális állapot védelme az RPC útvonalon igazolt, nem tetszőleges privilegizált UPDATE ellen. Az endpoint nincs bekötve. Más tenant támogatása nincs: a migráció minden eltérő tenantot elutasít. Provider request-ID nem telefonos kézbesítési bizonyíték.

Supabase-migráció alkalmazása, Pushover-küldés, Gmail-figyelés és Netlify-deploy: 0. Következő kapu: izolált, többkapcsolatos valódi PostgreSQL jogosultsági/versenyteszt; majd külön ellenőrzött server-only bekötés. Százalék nem nő puszta tesztbővítéstől.
