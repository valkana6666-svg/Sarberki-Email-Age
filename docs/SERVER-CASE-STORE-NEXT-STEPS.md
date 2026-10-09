# Központi szerveroldali foglalási ügytár – fokozatos bevezetés

## Állapot

A `shared-core/server-case-service.mjs` egy **szerveroldali alkalmazásrétegbeli alap**, nem éles adatbázis és nem publikált végpont. A böngészős `booking-cases.mjs` továbbra is változatlanul működik. Nincs automatikus ügyadat-migráció, nincs külső szolgáltatás kiépítve, éles adatmódosítás nem történt.

## Biztonsági szerződés

A szolgáltatás kizárólag **szerveroldalon igazolt** identitást elfogadó `resolveAuthority(requestContext)` függvénnyel konfigurálható, amely `{subject, tenants: {sarberki: ['read','write']}}` alakú *ellenőrzött jogosultságokat* ad vissza. A beérkező request body vagy böngészőben szereplő tenant ID **nem jogosultság**. A `resolveAuthority` kizárólag már ellenőrzött, szerver által kezelt session/tokeneredményből építhet jogosultságot. Ha ilyen nincs, nem szabad az ügytárat elérhetővé tenni.

A tárolóadapter szerződése:

- `get(tenantId, caseId)` → rekord vagy `null`;
- `list(tenantId)` → a tenant saját rekordjai;
- `insert(tenantId, caseId, record)` → atomi insert, csak új kulcshoz `true`;
- `compareAndSwap(tenantId, caseId, expectedRevision, record)` → atomi, tenant+ügy+verzió feltételű módosítás, siker esetén `true`.

**Kötelező**: tartós háttértár, adatbázis-szinten garantált atomikus feltételes írás, tenant+ügy összetett kulcs és a szerveroldali hozzáférés-ellenőrzés. Egy kliensoldali `localStorage`, egy szerverprocessz memóriája vagy a fenti függvényneveket utánzó, de nem atomi adapter nem alkalmas éles adatokra.

Minden tárolási válasz tenant/ügy egyezés-ellenőrzésen megy át; hibás visszaadásnál a szolgáltatás leáll az adott műveletre (fail-closed). Minden íráshoz verzióellenőrzés kell, hogy két kezelő ne írja felül egymás módosításait. Ezzel önmagában még nem kész az üzenetsorrend, a duplikátumkezelés, az auditálás vagy a teljes GDPR-folyamat.

## Következő munkák – ebben a sorrendben

1. **Hitelesítési és tárolási döntés:** válassz egy támogatott, valóban tartós szerveroldali adatbázist, a Netlify-hitelesítés és a titokkezelés pontos módját. A szükséges hozzáférést és működési szabályokat külön egyeztesd. Amíg nem ellenőrzött, nincs nyilvános ügy-API.
2. **Tárolóadapter:** készíts atomikus insert/CAS műveleteket, egyedi `(tenant_id, case_id)` kulccsal, szerveroldali tenant-szűréssel, titkos kapcsolati adatok kizárólag környezeti tárolásával. A tárolás legyen titkosított, menthető, megfelelő adatmegőrzéssel és törléssel.
3. **Szerveroldali azonosítás:** token/session ellenőrzése *minden* ügyolvasás és ügyírás előtt; böngészőből küldött identitásra vagy szerepkörre nem szabad hagyatkozni. Többkezelős jogosultság, minimális szükséges hozzáférés.
4. **Ügyállapot-adapter:** a meglévő `booking-cases.mjs` parse/link/merge szabályait emeld át a csatornafüggetlen folyamathoz úgy, hogy a mentést a szerver hajtsa végre. Auditálható, idempotens Gmail-import és ütközéskezelés kell.
5. **Migráció:** készíts kezelő által indított, előnézett, naplózott és visszafordítható export/import útvonalat a böngészős ügytárból. Nem szabad automatikusan törölni vagy feltölteni régi ügyadatokat.
6. **Szigetelési tesztek:** két mesterséges tenant, két kezelő, tiltott hozzáférések, üzenetduplikátumok, versenyhelyzetek, hiányzó hitelesítés, meghibásodott DB, új és régi ügyváltozatok.
7. **Korlátozott tesztaktiválás:** csak külön tesztkörnyezetben, éles levelek küldése és Previo-írás nélkül, igazolt biztonsági ellenőrzés után.

A `PREVIO_READ_SAFETY_VERIFIED` kapcsolót ez a fejlesztés nem módosítja. Az élő Previo-útvonalat nem teszteli.

## Hosszú távú stratégia

A központi ügytár alapja az e-mail, chatbot és telefonos AI közös ügyállapotának. A Sárberki az első alkalmazás, de a szerveroldali jogosultsági határt már most úgy tervezzük, hogy később több vállalkozás adata soha ne keveredhessen. A teljes többvállalkozásos üzem csak további, külön igazolt biztonsági fejlesztéssel lehetséges.
