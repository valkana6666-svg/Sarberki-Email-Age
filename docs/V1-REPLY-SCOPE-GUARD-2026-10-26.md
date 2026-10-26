# V1 – válaszegyeztetés vállalkozás- és postaláda-korlátja

2026-10-26. Kiindulási HEAD: a7b2eaba549a44c9588407f7cfc13e9ea23eb755.

## Bizonyított hiba és javítás

A reconcileIncomingReply szintetikus példában azonos feladó és thread_id mellett tenant-a/box-a ügyébe tenant-b/box-b üzenetéből frissítést fogadott el (MERGED, requiresHumanReview=false). A booking-cases.mjs saját postaládaszűrése már létezett; a külön közös identitássegéd nem vizsgálta az átadott scope-okat.

A sameBookingConversation most a feladó/szál/referencia vizsgálata előtt összeveti a tenantId/tenant_id és mailboxId/mailbox_id adatokat. Eltérő érték, csak az egyik oldalon ismert érték, hibás típus vagy egymásnak ellentmondó alias automatikus összerendelést nem enged. Az eltérő scope-ot RFC-hivatkozás sem írhatja felül. Az elutasított útvonal emberi felülvizsgálatot kér és megtartja a korábbi ügyadatokat.

A kétoldalt hiányzó scope régi szintetikus/legacy rekordokkal kompatibilis marad, a meglévő szigorú feladó- és thread feltételekkel. Ez nem teljes tenant-hitelesítés: a hívó kötelessége a megbízható forrásból származó tenant/mailbox bekötése, az Auth/RLS jogosultság külön kapu. Az AI-kimenet vagy levélszöveg nem jogosultsági forrás. Nincs új SaaS/tenant-rendszer vagy V2-fejlesztés.

## Teszt és határ

62 PASS / 0 FAIL / 0 SKIP helyi Node-teszt: 21 új scope-eset és 41 korábbi identity-shape, thread-identity és reply-reconcile regresszió. Köztük eltérő tenant/postaláda, kevert ismert/ismeretlen, hibás típus, aliasellentmondás, RFC-fallback tiltása és pozitív normalizált egyezés. Mind szintetikus, nem élő Gmail vagy PostgreSQL-jogosultsági próba. A jelen változás nem módosít Auth-ot, RLS-t vagy adatbázist. A commit teljes CI-jét külön kell visszaolvasni.

A korábbi külön Codex-alügynöki keretkorlát után a koordinátor végezte a konkrét javítást és tesztelést; új sikeres alügynöki futást nem állítunk.

## Üzemeltetési korlátok

A 2026-10-26 hajnali mentési olvasási ellenőrzés (V1-PROGRESS-2026-10-26.md) megmarad: október 25-i pontos GitHub artifact, Drive-bájtok és SHA256 egyezése igazolt; mai új export/Drive-átadás a 08:00/10:00 feladatok előtt még nem volt esedékes. Az első automatikus teljes lánc, független kulcspróba és teljes platform-restore nincs igazolva. Új mentési folyamatot nem indítunk.

Netlify-deploy, felhős migráció, valódi vendégadat/értesítés és Previo-művelet: 0. Rollback: az új scope-feltétel és teszt célzott revertje az engedélyezett ágon. A korábbi alakvalidáció és feladóvédelem nem vonandó vissza. A V1 85%-os korábbi munkabecslését új külső elfogadási bizonyíték nélkül nem emeljük.
