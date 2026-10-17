# Sárberki V1 – friss mentés és kezelői PWA, 2026-10-17

Kizárólag `gmail-test-subject-allowlist`. A programozást és ellenőrzést közvetlenül Codex végezte; nem indult párhuzamos agent vagy új szabálymotor.

## Kiindulás és új fejlesztés

A felhasználó által igazolt `4647a34b6c2c3a6e442b6be1d2d41dad754ee3d1` után az `acadd2de5c8417e50ffa62c37d9b74c82fe654a3` a lemondási audit visszaolvasásának adatvédelmi szigorítását tartalmazta. Megőriztük; nem ismételtük meg a már lezárt Gmail OAuth/dedup/felhős audit próbát.

- Mentési kérés: `a76d3bc5c3657808e022f7874cf78295ff6b1ff4`.
- PWA-kód: `19dae9d50ccb0b9fb6ea9eca25830ff637f1c922`.
- Új kezelői `operator.webmanifest`, saját alkalmazásazonosítóval és TESZT névvel; a meglévő képek újrahasznosítása.
- Főképernyős indítás: `/index.html`, levélválasztó, query, OAuth-fragment és session nélkül. A manifest nem hoz létre hitelesítést vagy jogosultságot.
- Szűk statikus build-kivétel csak erre a root-manifestre; más root-manifest és privát/server/teszt fájl továbbra sem publikálható. Új canary ellenőrzi ezt.
- Explicit manifest MIME a Netlify teszttelepítésen; új CI static-only smoke ellenőrzi a HTML-kötést, a pontos manifestet, a két PNG méretét és a no-store fejlécet.
- Nem készült offline vendégadat-/API-cache vagy háttérben működő levélbeolvasás.

## Friss titkosított mentés és helyreállítás

[Backup run 39027707428](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39027707428): offline safety és export/restore job SUCCESS. A forrás a kijelölt sarberki-test projekt; csak olvasás. A restore külön, eldobható PostgreSQL 17 szolgáltatásba történt, forráshitelesítés nélkül.

| Ellenőrzés | Tényleges eredmény |
| --- | --- |
| AES256 titkosítás és új runneren feloldás/visszaolvasás | PASS |
| Ciphertext SHA256 és aktuális run/commit/projekt kötés | PASS |
| Teljes SQL-restore | PASS |
| Minden archivált tábla COPY-adatának egyezése | 49/49 |
| Szerepkör-attribútumok és szekvenciák | Egyeznek |
| Case manifest: táblák, RLS, policy, grant, constraint, függvények, audit/hash | Minden mező egyezik |
| Hét kötelező ügytábla, beleértve mindkét új szolgáltatástáblát | PASS |
| `sc_service_link_decisions` | 1 visszaállított döntés |
| `sc_service_approvals` | 0 sor; séma és üres adatkészlet egyezik |
| RLS, CAS/előzmény/egyediség/audit rollback fixture | PASS, helyreállított SQL-adatbázison, szimulált JWT-claims |
| Rollback utáni manifest | Változatlan |
| Auth API-belépés a helyreállított platformba | NEM FUTOTT |

Az üres dézsajóváhagyási tábla nem igazol meglévő ilyen rekordot. Az új szolgáltatási RPC-k restore utáni külön funkcionális próbája nem része ennek a runnak; a korábbi izolált PostgreSQL/PGlite siker-/tiltási és titkosított export/restore tesztjeik külön bizonyítékok. Az SQL-restore nem teljes Supabase-platformhelyreállítás: szerepkörjelszavak nincsenek a mentésben; OAuth/Netlify/API-konfiguráció, Auth szolgáltatás és objektumtárfájlok külön helyreállítási feladat. A stock PostgreSQL-ben a tagsági grantor restore_admin lett, miközben a tagsági opciók és eredeti szerepkör-attribútumok megmaradtak.

## Megőrzés, integritás és jogosultság

A külön elmentett `Sarberki-V1-mentes-2026-10-17.zip` tartalmazza a három titkosított fájlt, eredeti ellenőrzőösszegeket, provenance-t, összesített restore-bizonyítékot és magyar útmutatót. A ZIP maga nem titkosított; az adatbázis, szerepkörök és részletes manifest a .gpg fájlokban AES256-tal titkosítottak. Feloldó jelszó nem került a csomagba, kódba vagy jelentésbe.

- Csomag mérete: 120253 bájt.
- Csomag SHA256: `8010e053fab42205b86d98542d3ed2c30921000b15c5dbddabaf1a069ad68b6d`.
- Tartósan külön mentett példány visszaolvasva; teljes ZIP-hash, ZIP CRC és minden belső fájl ellenőrzőösszege PASS.
- A helyi csomag és a visszaolvasott példány fájljoga 0600. Nem történt megosztás vagy hozzáférési jog bővítése.
- Ideiglenes GitHub encrypted artifact: `12099416369`, lejárat **2026-10-24 11:12:58 UTC / 13:12:58 Budapest**.
- Ideiglenes restore artifact: `12099605642`, lejárat **2026-10-24 11:12:57 UTC**.
- A külön mentett csomagra nem a GitHub hétnapos artifact-törlése vonatkozik. Tárolói automatikus lejáratot a mentési válasz nem közölt; korlátlan megőrzést nem állítunk.
- Javasolt megőrzési szabály: legalább 30 nap és a következő igazolt mentésig; utána tulajdonosi felülvizsgálat. Automatikus törlés vagy új mentési ütemezés nem lett beállítva. A jelszót külön védett helyen kell megőrizni.

A csomag eredeti STATUS.txt fájlja exportkori állapot: akkor még nem futott restore/tartós másolat. A később elkészült ISOLATED-RESTORE.json és e jelentés pontosítja ezt; az eredeti fájlt nem írtuk át.

## Tesztek és bizonyítékszintek

- A mentési commit normál CI-je [39027707440](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39027707440): **1786 PASS / 0 FAIL / 0 SKIP**, exact test deploy, session/ügytár tiltási kapuk és Windows offline másolás SUCCESS. Élő Previo-lépés szándékosan nem futott; ez nem npm SKIP.
- Új PWA/build célzott ellenőrzés: **3 PASS / 0 FAIL / 0 SKIP**; syntax és diff-check PASS. Ezek átfednek a későbbi teljes CI-vel, nem összegezendők.
- PWA-commit [CI 39028144863](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39028144863), job 117383103727: **1788 PASS / 0 FAIL / 0 SKIP**. `DEPLOY SYNC PASS`: expected = deployed = `19dae9d50ccb0b9fb6ea9eca25830ff637f1c922`. Az új PWA static deploy smoke, a session/ügytár kapuk, MNB/árreferencia és Windows offline backup-copy SUCCESS. Capacity workflow [39028144781](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39028144781) szintén SUCCESS; átfedő tesztjeit nem összegezzük. Élő Previo nem futott.
- [Mobil-emuláció 39028144770](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39028144770): **12 PASS / 0 FAIL**, 6-6 Chromium/WebKit ellenőrzés 390×844 nézetben. Hiányzó Auth, szöveg-escape, magyar bizonytalansági állapotok, 44px érintési cél/no overflow, verzióváltáskori törlés, kontrollált Reader login→ügylista→előnézet→logout. Külső hálózat blokkolva; csak szintetikus mock auth/transport. Tényleges iPhone/Safari/PWA-telepítés és mobilos Writer/approver végrehajtás ettől még **NEM IGAZOLT**.

A teljes regresszió a meglévő HU/DE/EN/SI paritás-, adatmegőrzési, bizonytalansági, ház-/létszám-/árszabály-, dézsaszándék-, jogosultsági és auditpróbákat is futtatja. A Gmail read-cookie-PostgreSQL E2E kontrollált GIS/Gmail/Auth transporttal, tényleges controller/handler/repository/SQL/RLS/CAS kóddal igazolja a szintetikus levél→ügy→tervezet→Reader→külön approver→audit útvonalat. Ez nem új élő Google- vagy Previo-bizonyíték. A korábban lezárt friss Gmail→azonos Writer dedup→preview/audit rész a [külön jelentésben](../gmail-exact-cloud-chain-2026-10-17/REPORT.md) érvényes marad.

## Fennmaradó kapuk és becslés

Becsült V1-készültség **92%**, mérnöki becslés, nem tesztarány vagy élesítési engedély. A korábbi 91%-hoz képest a friss, új sémát is lefedő restore és külön visszaolvasott mentés lezárult, a kezelői PWA-indítás hiánya javítva. A következő kapukat a zöld tesztek nem helyettesítik:

| Hátralévő feladat | Becsült aktív munka |
| --- | --- |
| Tényleges iPhone/Safari és telepített főképernyős mód: login, lista, előnézet, szerep szerinti Writer/approve, újranyitás/kijelentkezés | 1–2 óra |
| Teljesen új tesztplatform helyreállítása, külső konfiguráció és valódi Auth API-login | 1–3 óra |
| Previo teszt-hozzáférés ellenőrzése, mellékhatásmentes olvasási műveletek igazolása és adapter bekötése | 3–6 óra a hozzáférés után |
| Hiteles ház-/dézsabizonyítékkal szintetikus felhős pozitív és negatív végponti jóváhagyási próba, audit-visszaolvasással | 2–4 óra |
| Tulajdonosi tisztázást igénylő üzleti határok lezárása és célzott elfogadás | 2–4 óra a döntések után |

Összesen körülbelül **9–19 aktív munkaóra**, a külső hozzáférésre/válaszra várakozás nélkül; az esetleg feltárt hibák növelhetik. A 2027-es ár és a bizonytalan gyermekárhatár nem található ki. Ismeretlen vagy nem aktuális ár/kapacitás mellett a végleges jóváhagyás tiltott marad.

Következő konkrét lépés: az aktuális tesztbuild tényleges iPhone/Safari + főképernyős elfogadási próbája. A Previo elérhetővé válásakor kizárólag a jóváhagyott tesztkapcsolat, bizonyítottan mellékhatásmentes olvasási adapter következhet. A meglévő tesztadapter/stabil interfész addig megmarad; nem új API vagy jogosultsági rendszer készül.

V2/V3: változatlan közös döntési mag, tenant, Auth/RLS, külön read/write/approve, CAS és audit; a PWA csak új belépési felület. Nincs production/main módosítás, éles e-mail/Pushover, Previo-művelet vagy valódi foglalás. A sarberkito.hu honlapot nem vizsgáltuk újra és nem módosítottuk.
