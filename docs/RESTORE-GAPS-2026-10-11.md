# A teljes Sárberki-rendszer helyreállításának határai

## Igazolt izolált eredmény

A `38129512850` Actions-futás az eredeti `38127744637` mentést új,
elkülönített PostgreSQL 17.11 adatbázisba teljesen betöltötte. Mind a 43
archivált COPY-tábla adattartalma és a szekvenciák egyeztek. Az ügytár
ellenőrzőjegyzékének mind a 10 mezője egyezett, beleértve a jogosultságokat,
policykat, függvényeket, kulcsokat és audithasheket. A DB-ben 2 ügy, 2 tenant,
3 tagság, 2 üzenetkulcs, 3 auditesemény, 3 Auth-user és 3 identity volt.
A Vault-ban 0 secret volt. Az új Linux-környezetes visszafejtés sikeres.
Valódi SQL RLS/CAS/history/uniqueness/audit-próba sikeres, szimulált JWT-claimmel.
Valódi Auth/API-bejelentkezés és teljes szolgáltatás-E2E nem történt.
A role-attribútumok egyeztek; a role-tagságok adományozója az izolált
bootstrap-admin lett. Ez dokumentált metaadat-eltérés. A forrás DB-t a
restore job nem csatlakoztatta. A cél DB és konténerei megszűntek.

Ez a leltár a 2026-10-11-i ZIP tényleges tartalmának és a forráskódnak az
ellenőrzésén alapul. Nem Netlify- vagy Google-adminisztrációs export.
A végleges izolált teszt eredménye a csomag `recovery/ISOLATED-RESTORE.json`
fájljában található. A korábbi 910 sikeres teszt és 243 egyező ellenőrzőösszeg
elfogadott előzmény; ezek önmagukban nem bizonyítanak adatbázis-visszaállítást.

## Mi található a mentésben?

- A tesztági projekt forrás-pillanatképe, függőségek zárolófájlja,
  build-program, Netlify-függvények és `netlify.toml` átirányításai/fejlécei.
- Valódi PostgreSQL 17 custom archívum, Auth és alkalmazási táblákkal.
  Három külön GPG AES-256 fájl: adatbázis, jelszó nélküli szerepkörök és
  exportkori ügytár-ellenőrzőjegyzék. A ZIP nem fejti vissza ezeket.
- SQL-jogosultságok, policyk, függvények és adatbázis-metaadatok az archívumban.
- Egy lezárt `reader-password-reset` Edge Function v9 kódja és leltára.
- A Gmail kliens nyilvános OAuth-kliensazonosítója, tesztfiók- és
  tárgyszűrési szabályai, `gmail.readonly` scope a forráskódban.
- Nyilvános Supabase CA-tanúsítvány és helyreállítási dokumentáció.

## Pontos hiánylista és következmények

| Elem | Mi hiányzik / mi szükséges? | Következmény |
|---|---|---|
| GPG-jelmondat | `SARBERKI_BACKUP_PASSPHRASE` nincs a ZIP-ben; külön, másik gépről is elérhető jelszókezelőben vagy offline másolatban kell megmaradnia. | Enélkül a DB-mentés nem fejthető vissza. A távoli GitHub-titok nem letölthető jelszótár. |
| Böngésző ügytára | A laptop alkalmazásának tényleges `sarberki-booking-cases-v2` localStorage-tartalma és más tenantok `<tenant>-booking-cases-v2` adatai nincsenek exportálva. | A helyi ügyek, üzenetösszerendelések, ügyállapotok és tervezetek nem állíthatók vissza ebből a ZIP-ből. A szintetikus felhős DB nem helyettesíti ezeket. |
| Gmail helyi állapot | `sarberki.gmail.read-message-ids.v1` és `sarberki.gmail.pushover-message-ids.v1` nincs mentve. | Feldolgozási/értesítési előzmények új gépen eltérhetnek. |
| Google-fiók | Bejelentkezés, helyreállítási lehetőség, MFA és tulajdonosi hozzáférés nincs mentve. | Új gépen a fiókhoz külön hozzá kell férni és újra engedélyezni kell a Gmail-olvasást. |
| Google Cloud OAuth | Consent screen, app státusza, tesztfelhasználók, engedélyezett webes originek, projekt- és kliensadminisztrációs beállítások hiteles exportja nincs a ZIP-ben. | A nyilvános kliensazonosító önmagában nem hozza létre újra az OAuth-alkalmazást. Az app tokenje újra kérhető, nem kell régi tokent csomagolni. |
| Gmail felhős adatok | A postaláda, mellékletek, címkék és Gmail-szűrők teljes exportja nincs mentve. | A ZIP nem önálló postaláda-mentés. Ha a Gmail-fiók megmarad, az új gép onnan újra olvashat. |
| Netlify oldal | Site ID/tulajdonos, GitHub-összekötés, deploy kontextusok, build környezet, site-admin export nincs hitelesen mentve. | A forrásból új oldal építhető, de a felhős oldalbeállításokat külön vissza kell állítani vagy újra létrehozni. |
| Netlify környezeti változók | A tényleges szerveroldali értékek és kontextusonkénti beállítások nem szerepelnek. A forrás szerint: `PUSHOVER_API_TOKEN`, `PUSHOVER_USER_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `CASE_STORE_ENABLED`, `CASE_STORE_TEST_TENANTS`, `PREVIO_READ_SAFETY_VERIFIED`, `PREVIO_CAPACITY_READ_SAFETY_VERIFIED`, `PREVIO_CAPACITY_TEST_TOKEN`; a korlátozott Auth-próba beállításai csak akkor, ha még szükségesek. | A titkos értékeket külön biztonságos nyilvántartásból kell megadni vagy a szolgáltatónál újra kibocsátani. A kapuk alapértéke zárt maradjon. |
| Domain/DNS | Netlify domainhozzárendelés, külső DNS-zóna és domainadmin-hozzáférés nincs exportálva. | Egyéni domain teljes újraépítése nincs igazolva; az OAuth-originekkel is össze kell hangolni. |
| Supabase platform | Auth Site URL/redirect URL-ek, SMTP/provider beállítások, signup/MFA szabályok, JWT-aláírókulcsok, API-kulcsok, API-exposed schema konfiguráció, projekt/régió/admin-hozzáférés teljes exportja hiányzik. | Az SQL-visszaállítás nem állítja helyre az Auth/API szolgáltatás konfigurációját. Új projekt kulcsait és URL-jét az alkalmazásba kell kötni. Valódi új Auth-bejelentkezés külön tesztelendő. |
| DB role-jelszavak | A szerepkör-export szándékosan jelszómentes. | Az új cél login-jelszavait külön kell beállítani; az eredeti jelszót nem módosítjuk. |
| Supabase kiegészítők | PostgreSQL 17 és `pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `plpgsql`, `supabase_vault` 0.3.1 kompatibilitása szükséges. | Egyszerű PostgreSQL-ben a Vault nincs alapból telepítve. Az izolált próba minden eltérését az eredményfájl jelzi. |
| Storage/Vault | Külön csak olvasható leltárban 0 bucket, 0 object, 0 Vault-secret volt. Ez későbbi leltár, nem azonos tranzakció a dumppal. Külső Storage-bájtok és Vault gyökérkulcs nem szerepelnek. | Jelenleg nincs ismert hiányzó ilyen adat. Ha később lesz, külön mentés szükséges; a Vault-kulcs nem következik a SQL-exportból. |
| Edge platform | A mellékelt Edge-kódon túl deploy- és secret-konfiguráció teljes exportja nincs. | A lezárt funkció újratelepíthető, de teljes platformhelyreállítás nincs igazolva. |
| GitHub/automatizáció | Teljes Git-történet, GitHub repository secret/variable export, tulajdonosi tokenek, beállítások és esetleges külső automatizációk nincs mentve. | A forrás-pillanatkép önálló, a CI és külső ütemezés helyreállításához külön adminhozzáférés és leltár kell. |
| Previo/Pushover | Szolgáltatói fiókok, hozzáférések, esetleges kliensazonosítás és felhős konfiguráció nincs mentve. | Az integrációk új gépen/felhőben külön hozzáférést igényelhetnek. A helyreállítási vizsgálat nem hívja és nem aktiválja a Previót. |

A hiányzó titkok értékei nem kérhetők chatbe és nem másolhatók nyilvános
GitHub-forrásba. A Netlify/Google aktuális felhős konfigurációját nem állítottuk
át és nem exportáltuk; a táblázat a csomag hiányait mutatja, nem állítja,
hogy ezek a megmaradó szolgáltatói fiókokból ne lennének újra elérhetők.

## A számítógép elvesztésére adott válasz

**Ebből a ZIP-ből önmagában a teljes rendszer és minden helyi állapota nem
állítható vissza igazoltan.** A forráskód és a jelszóval hordozható
adatbázismentés rendelkezésre áll. Az alkalmazás új gépen felépíthető,
amennyiben a külön jelmondat és a szükséges felhős fiókhozzáférések megmaradnak.
A laptopon maradó ügytár nélkül a helyi ügyállapot teljessége nem biztosítható.
Az eredeti felhős szolgáltatások laptophiba esetén általában tovább működnek;
ez eltér a teljes felhős rendszer megsemmisülése utáni újraépítéstől.

A hiányzó laptopállapothoz kizárólag az adott laptop böngészőprofilja vagy
annak korábbi hiteles adatexportja adhat hozzáférést. Ebben a munkakörnyezetben
ez nem áll rendelkezésre. Nem helyettesítjük üres vagy szintetikus fájllal.
