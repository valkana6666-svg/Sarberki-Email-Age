# Sárberki V1 folytatása – tényleges végrehajtási jelentés

Dátum: 2026-10-10. A V1 még nem aktiválható; CASE_STORE_ENABLED marad disabled.

## Kiindulás és megőrzött munka

A távoli gmail-test-subject-allowlist ág tényleges HEAD-je ea31859a107c6aa9b9f37ba3eb21932315a67734 volt. Innen, külön helyi worktree-ben folytattam. A régebbi munkakönyvtár és a benne lévő tulajdonosi jelszócsere-segéd változatlan; azt nem futtattam és nem commitoltam. Elolvastam az AGENTS.md, docs/SERVER-CASE-STORE-NEXT-STEPS.md, reports/server-continuation-2026-10-10/REPORT.md, reports/owner-safety-audit-2026-10-10/READONLY-CHECK.md és BACKUP-RESTORE.md anyagokat. Nem épült új architektúra vagy chatbot.

A commitmentés előtt a távoli tesztág 87b36be9c3b48a383d98d5c820279fb73abfccbf HEAD-re változott. A friss mailbox RFC-reference scope, kliens case_id approve-védelme, stageFacts/cabinKey alapú szűrés és Windows PowerShell mentési segéd megmaradt. Az összevezetés után teljes regressziót és frontend buildet újra futtattam; az előző jelentés és tesztkimenet PREVIOUS-* fájlokban megőrzött. Az ea31859 alapon létrejött b0df9d8 GitHub commit objektum nem került az ágra, mert a HEAD közben megváltozott; nem történt force-update.

## ELVÉGEZVE / TESZTELVE

1. Új tulajdonosi exportsegéd: scripts/owner-encrypted-backup.py. A meglévő Windows PostgreSQL 17 + Gpg4win programokat használja, nem telepít. Csak a kijelölt projekt London Session pooler kapcsolata engedélyezett, port 5432, verify-full TLS. A jelszó helyi rejtett bevitel, nem parancssori argumentum vagy fájl. Teljes logikai custom dump, Auth-adatok, jelszó nélküli role-export és readonly manifest közvetlenül titkosításba folyik. A ciphertext visszaolvasása és tartalomjegyzéke ellenőrzött a sikerjelző előtt; ez nem restore. Git könyvtár tiltott, Windows célkönyvtár ACL szűkített, hibás export nem publikál kész fájlt.
2. A meglévő szerveres review folyamat szigorítása: valódi naptári napok és 0–17 gyermekéletkorok ellenőrzése minden provider-hívás előtt. Áradat csak azonos tartózkodáshoz, megfelelő tenant/háztípushoz és friss ellenőrzési időhöz köthető. Hibás, hiányzó, idegen vagy elavult ár, illetve pricing outage: price_unknown + pending tervezet; upstream hiba nem kerül a válaszba. A kapacitás frissességét az árlekérés után újra ellenőrzi.
3. A meglévő server-booking-runtime belső reviewAndDraft művelete elkészült. Írási jogosultság a provider-hívás előtt, authority újbóli ellenőrzése és CAS a hívások után. A meglévő válaszolómotor szövege append-only tervezetként menthető, synthetic és reviewStatus jelöléssel. A korábbi üzenetek/tervezetek megmaradnak. Az SQL által tiltott state.quote/state.availability útvonal nem nyílt meg, a jóváhagyás pending. A művelet nem került a publikus HTTP handlerbe; megbízható belső fixture-provider szükséges.
4. Helyi PostgreSQL/PGlite-próba az eredeti, változatlan telepítési migrációval: kinyerés → fixture kapacitás → fix egységár → belső tervezet → CAS-tárolás → audit. Két konkurens reviewed draft közül pontosan egy sikerült; a tárolt revision 3, audit revisionök 1/2/3, a legutolsó audit hash megegyezett az ügy JSON hashével. Ez tényleges helyi PostgreSQL SQL-végrehajtás, szimulált authority; nem új felhős Auth E2E.
5. npm ci sikeres; teljes végső regresszió 890 PASS / 0 FAIL / 0 skipped. A kiinduló 855 mellett 18 saját és 17 közben érkezett Node-teszt. Külön mentési helper offline tesztje: 3 PASS / 0 FAIL (célprojekt/TLS/port, archívumkötelező tartalom, pipe és hibás export takarítása). Az utóbbi teszt szimulált encryptort használ; nem GPG-kriptográfiai igazolás.
6. Frontend build: 49 asset; dummy kulcs-sentinellek, server-* modulok, Supabase server repository és Python-helper nem kerültek a publikált frontendbe. Git diff --check sikeres.

## Tényleges felhős, kizárólag olvasási ellenőrzések

Supabase sarberki-test / mojnqizbcaczstguikpv: Healthy, PostgreSQL 17.11.0.003. A meglévő readonly recovery-manifest a tényleges felhős adatbázison lefutott:

- 5 sc_* tábla, mindegyiken aktív RLS; FORCE RLS nincs bekapcsolva.
- 2 tenant, 3 tagság, 2 ügy, 2 message key, 3 auditrekord; Auth felhasználók száma 3.
- Audit gaps = 0, latest_hash_mismatches = 0.
- authenticated jogosultság az öt táblán SELECT; nincs INSERT/UPDATE/DELETE/TRUNCATE. A meglévő read policy-k és kulcsok jelen vannak.
- sc_has_permission és sc_write_case security-definer, üres search_path, authenticated EXECUTE grant.
- A role-inventory szerint service_role még rendelkezik REFERENCES/TRIGGER/TRUNCATE grantokkal. Nem állítjuk, hogy minden privilegizált DB-role művelet tiltott; az alkalmazási adapter privilegizált kulcsot elutasít. Admin-kulcsok érvényessége/visszavonása tulajdonosi leltár nélkül nem igazolt.
- Az összegzés csak metaadat és auditkonzisztencia; nem helyettesíti a tényleges operátori Auth-munkameneteket.

A Netlify tesztoldal health végpontja a kiinduláskor ea31859a107c6aa9b9f37ba3eb21932315a67734 deployt jelentette. booking-cases: HTTP 503, CASE_STORE_DISABLED; Auth-tesztkapu: HTTP 404, kikapcsolva. A health livePriceVerified mezője konfigurációs állítás, nem új élő Previo-egyezés vagy hivatalos API-engedély bizonyítéka. A fejlesztési commit utáni deployt külön kell ellenőrizni.

## BLOKKOLVA

- Teljes titkosított **felhős** adatbázismentés: nem futott le. Az agent nem éri el a tulajdonosi Windows laptop DB-jelszavas munkamenetét/GPG titkos kulcsát/független tárolóját. Az agent környezetében nincs pg_dump/psql/pg_restore; a GPG-agent socket indítása sem engedélyezett. A segéd előkészítése nem mentés. A Windows telepítéseket nem ismételtem meg.
- Független tárolói visszaolvasás és teljes izolált forrásrestore: nem történt meg, nincs igazolt célkörnyezet. A korábbi PGlite-fixture restore továbbra is helyi szintetikus próba.
- Új valódi Auth session tesztek: 0 új futás. A korábbi 25 PASS történeti eredmény. Lejárt access token, refresh-token visszavonás utáni újrafelhasználás, teljes felhős reviewed-draft útvonal új eredménye nem igazolt. A lezárt Auth-kaput nem nyitottam meg, jelszót nem kértem chatben és nem változtattam meg.

## MÉG NEM KÉSZ – V1 aktiválási feltételek

1. A tulajdonosi exportsegéd tényleges futtatása, titkosított mentés + független másolat visszaolvasása + teljes izolált restore. Lépések az OWNER-BACKUP-STEPS.md-ben.
2. A hivatalos Previo API-engedély és csak olvasási jogosultság igazolása. A nyilvános hivatalos API-dokumentáció ellenőrzött, de a Sárberki szerződés/jogosultság állapota nem. A Previo dokumentáció külön API-hozzáférést és korlátozott díjmentes próbalehetőséget ír le; szolgáltatást nem rendeltem, e-mailt nem küldtem, élő kapacitás/ár végpontot nem hívtam. Forrás: https://help.previo.app/en/doc/api-access/ .
3. A jelenlegi SQL tudatosan tiltja a tartós ár/kapacitás bizonyítékot. Megbízható szerveres adapter és külön verziózott evidence-migráció csak a jóváhagyott, mellékhatásmentes forrás ismeretében készíthető el; a kliens által küldött proof nem elfogadható. A jelen fixture-review nem igazol élő elérhetőséget vagy vendégárat.
4. Valódi mailbox üzenetazonosítók szerveres származtatása/olvasási csatlakoztatása, operátori munkamenet és felügyelt tervezetkezelés bekötése; jelenleg csak a meglévő szintetikus ingest/parser/draft útvonal vizsgált.
5. Friss valódi Auth-negatív próbák és teljes Netlify → Supabase → audit szintetikus E2E a mentési, restore- és provider-feltételek után; majd felügyelt tesztverzió külön döntéssel. Most nincs aktiválás.

## Fájlok és commit

Az újonnan érkezett scripts/owner-encrypted-backup.ps1 TLS-ellenőrzését is verify-full-ra szigorítottam, rendszer CA-val vagy explicit -CaFile paraméterrel; role-export postgres kezdőadatbázissal. Ez forrásellenőrzés, nem Windows-futtatási igazolás.

Módosult: shared-core/server-booking-runtime.mjs, server-case-service.mjs, server-synthetic-booking-review.mjs; tests/server-foundation.test.mjs, supabase-policy.test.mjs, synthetic-booking-review.test.mjs. Új: scripts/owner-encrypted-backup.py, scripts/test_owner_encrypted_backup.py és reports/v1-completion-2026-10-10/ jelentés, útmutató és friss tesztkimenetek.

A GitHub commit kizárólag a gmail-test-subject-allowlist ágra kerül, a pontos commitazonosító a záró chatjelentésben szerepel. A telepített SQL-fájl, main és üzemi production változatlan. Nincs valódi e-mail, foglalásmódosítás, vendégadat, fizetős erőforrás, jelszócsere, localStorage-migráció vagy CASE_STORE_ENABLED aktiválás.

A távoli ág ezután 1a6d234e6664aef1ffecbd908f39d76a0cdfeea9 dokumentációs commitot kapott; csak a korábbi 872-es CI/deploy igazolásának két sora változott. Ezt a PREVIOUS-REPORT.md megőrzi. A 890-es teljes ellenőrzés forráskódja ettől nem változott; a végleges commit szülője a friss 1a6d234.

## Telepítés utáni friss ellenőrzés

A tényleges fejlesztési GitHub commit 606b915a9dc3c182270325a356adc450c4cc3a47 a kizárólagos tesztágra került. A git fetch a távoli SHA-t és a 508451a5a06c6ab26077948c4ea1bd6e93cd8b4c tree-t visszaigazolta; a helyi változat diffje a távoli commithoz üres. A Netlify teszt health végpontja ugyanezt a deployedCommit értéket adta. A telepítés után booking-cases HTTP 503 CASE_STORE_DISABLED és supabase-auth-test HTTP 404 kikapcsolva. autoSend/autoBookingModification false. Az új GitHub Actions push-futás állapotát a rendelkezésre álló lekérdezés nem tudta visszaigazolni, ezért a 890-es eredmény a helyi teljes regresszió bizonyítéka; nem állítunk új CI PASS-t vagy felhős Auth/E2E-t. Ez a záró dokumentációs módosítás nem változtat alkalmazási kódot.
