# Telepítési és helyreállítási útmutató – szintetikus TESZT

## Jelenlegi állapot

Nincs létrehozott Supabase-projekt, régió, project ref vagy cloud DB. Netlify-fiók/csomag/aktuális környezeti változók nem lettek átállítva. A bejelentkezési akadály nem kerülhető meg. Tulajdonosi jelszó/OTP/API-kulcs soha nem kérhető chatbe.

## Szolgáltató és költségellenőrzés – 2026-10-09

A meglévő Netlify serverless funkció és Supabase Auth/PostgreSQL együtt illeszkedik a projekthez; nincs szükség VPS-re és nincs indok szolgáltatóváltásra.

Supabase Free: 2 aktív projekt, 500 MB DB/projekt, 50 000 havi aktív felhasználó, 5 GB egress, 1 GB Storage; 7 nap alacsony aktivitás után szünetelhet. Free-ben nincs automatikus adatbázismentés/PITR: saját mentés és restore-próba kell. Free szervezetben dolgozz; Pro szervezet új projektje költséget okozhat. Tulajdonosi jóváhagyás nélkül ne rendelj fizetős csomagot.

Konkrét EU régióként Frankfurt `eu-central-1` vagy Ireland `eu-west-1` választható. Általános Europe csoport helyett konkrét EU régiót válassz; London/Zurich nem EU. A tényleges régióválasztást létrehozáskor kell ellenőrizni.

Szolgáltatói állítás: AES-256 tárolási titkosítás és TLS adatátvitel; fő adatbázis/mentés a választott régióban. EU-régió önmagában nem zár ki minden nemzetközi feldolgozást: támogatás, telemetria és alfeldolgozók is vizsgálandók. DPA, adatkezelő/adatfeldolgozó szerep, naplómegőrzés és törlési folyamat a tulajdonos jóváhagyására vár; nincs megfelelőségi tanúsítás.

Netlify aktuális új credit-based Free csomag: 300 kredit/hó; régi fiók legacy csomagon is lehet. A jelenlegi fiók csomagja és fogyasztása nem ismert. A puszta repository-kapcsolat nem bizonyít ingyenes vagy EU-ban maradó funkciófuttatást. Ellenőrizd a tényleges csomagot, a futtatási/adatfeldolgozási régiót és a limiteket; ne válts fizetősre.

Hivatalos források:
- https://supabase.com/docs/guides/platform/billing-on-supabase
- https://supabase.com/docs/guides/platform/regions
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/reference/javascript/auth-getuser
- https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq
- https://supabase.com/downloads/docs/Supabase%2BDPA%2B260317.pdf
- https://docs.netlify.com/manage/accounts-and-billing/billing/overview/
- https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/

## Tulajdonosi aktiválási sorrend

1. Tulajdonos lépjen be Supabase-be biztonságos bejelentkezési folyamaton; az új fiókot, 2FA-t, CAPTCHA-t és szükséges jogi elfogadást ő végezze. Hozzon létre `sarberki-ai-test` projektet Free szervezetben, konkrét EU régióban. Új DB-jelszó megadása tulajdonosi lépés. Rögzítsd a projekt nevet/refet/régiót titok nélkül.
2. Futtasd a verziózott SQL-t: `supabase/migrations/202610090001_case_store.sql`. Az első migráció tranzakciós és újrafuttatható; jövőbeli változás új migráció legyen, a már telepítettet ne írd át. A táblák és a két RPC a public sémában vannak. Táblák írására nincs authenticated grant.
3. Készíts külön tesztoperátorokat az Auth felületen. Ha a folyamat e-mailt küld, ne vendégnek küldj és ne kapcsolj be vendéglevelezést. Az üzenetadatok legyenek kitaláltak, `.invalid` feladóval. A tesztkezelőket a tulajdonos adja hozzá a memberships táblához; ezekhez nem kerül jelszó a repóba.
4. Tulajdonosi DB-munkamenetből bootstrapolj tenantokat és tagságokat, valódi felhasználó-UUID-t csak az admin felületen adj meg. Minta:

```sql
insert into public.sc_tenants(tenant_id,name) values
 ('sarberki-test','Sárberki szintetikus teszt'),('demo-test','Második szintetikus tenant')
 on conflict(tenant_id) do nothing;
-- Paraméterezett admin lekérdezés, nem végrehajtható literal credential:
-- insert into sc_memberships(tenant_id,user_id,can_read,can_write,can_approve)
-- values ($tenant,$auth_user_uuid,true,$writer,false);
```

Két sarberki-test kezelő kell: első write, második read (a konfliktuspróbához ideiglenesen write). Harmadik kezelő kizárólag demo-test tag. Jóváhagyási jog csak célzottan adható. Ne engedj önkiszolgáló tagság- vagy szerepkörírást.

5. Valós Supabase Auth sessionökből ellenőrizd: anonymous/lejárt token tiltás; reader írástiltás; idegen tenant 0 sor/tiltás; két writer CAS 1 siker/1 konfliktus; azonos mailbox+message egyszer; audit append-only; SQL meghibásodás rollback. A tokeneket soha ne írd riportba vagy shell-historyba.
6. Készíts titkosított off-site teszt-DB mentést, és állítsd vissza külön, izolált teszt-DB-be. Egyezzen a rekord-/auditdarabszám és hash, a memberships és policy maradjon meg. Csak sikeres restore után aktiválj.
7. A Netlify **leafy-chimera-2403e5 teszthelyen** állítsd be szerveroldalon az üres példa változóit. A `SUPABASE_PUBLISHABLE_KEY` az adott projekt publikus/publishable kulcsa legyen; service_role nem használható. Először `CASE_STORE_ENABLED=disabled`. Soha ne állítsd ezeket a production helyen vagy frontend bundle-ban.
8. Kontrollált aktiváláshoz `CASE_STORE_ENABLED=synthetic-only`, `CASE_STORE_TEST_TENANTS=sarberki-test,demo-test`, Netlify `URL=https://leafy-chimera-2403e5.netlify.app`. A beépített `URL` teszthostot bizonyít; API-hívó böngészős header nem írhatja át. Previo kapcsoló maradjon tiltott. Új tesztdeploy után ellenőrizd a közvetlen funkciót: `/.netlify/functions/booking-cases`.
9. GET lekérés query: tenantId és opcionálisan caseId. POST import: tenantId, envelope, values, expectedRevision, opcionálisan approvedCaseId. Új ügy revision=0; meglévő ügy módosításánál a GET-ben olvasott revision. POST tervezet: action=draft, tenantId, caseId, expectedRevision. Authorization csak ellenőrzött operátor bearer token. Nincs raw case/ár/kapacitás/jóváhagyás feltöltési útvonal.
10. Két külön böngészős Auth sessionnel végezd el a Netlify–Supabase E2E próbákat. A jelenlegi UI/localStorage maradjon változatlan. Az aszinkron `case-store-client.mjs` csak későbbi, külön UI-integrációban kapcsolható be.

## Mentés, retention és helyreállítás

Javasolt TESZT megőrzés: szintetikus ügyek legfeljebb 30 nap; napi mentésből 7, heti mentésből 4 példány. Ez terv, nem bekapcsolt időzítő. Valódi adatokhoz külön tulajdonosi retention döntés kell. GDPR törlésnek az ügyüzenetekre, draftokra, auditaktorokra és backupokra is ki kell terjednie; erre nincs még publikus törlő API.

PostgreSQL logical backuphoz titkos connection string helyett helyi, védett pg_service konfiguráció alkalmazható:

```sh
PGSERVICE=sarberki_test pg_dump --format=custom --no-owner --file=case-store.dump
pg_restore --list case-store.dump
# Csak külön üres, izolált restore célban, tulajdonosi felügyelettel:
PGSERVICE=sarberki_restore pg_restore --no-owner --exit-on-error case-store.dump
```

A teljes Supabase helyreállítás Auth- és platformelemeket is érinthet. A pg_dump önmagában nem ment Storage objektumot, Netlify konfigurációt, Auth szolgáltatási beállítást vagy signing key-t. Ezek külön, titokkezelőben őrzött helyreállítási tervet igényelnek. Free-ben nincs implicit szolgáltatói restore-garancia. Mentést és titkos adatot tilos GitHubra feltölteni.

Leállítás: CASE_STORE_ENABLED=disabled; új telepítés esetén is ellenőrizd a 503-at. A böngésző tovább használja az eredeti localStorage-t. Ügyeket ne törölj és ne emelj át automatikusan. SQL rollbacknél ne DROP-olj adatot: előbb mentés, külön teszt restore és tulajdonosi döntés.

Kódvisszaállítás: a kiinduló commitból külön izolált checkout és teszthely-deploy készíthető; közös tesztágon ne force resetelj és ne írd felül az új munkát. `git revert` csak a kiválasztott saját commitokra, újabb HEAD ellenőrzése után. A mainhez ne nyúlj.

## Nyitott aktiválási előfeltételek

Tulajdonosi login; Free/EU projekt és DB-jelszó; operator Auth; DPA/Netlify régió/csomag ellenőrzés; valós RLS/CAS/Auth E2E; titkosított off-site mentés és restore; használati korlát/monitorozás. Valódi Gmail-adat csak külön, engedélyezett következő szakaszban. A `.invalid` cím sem tesz személyes adatot tartalmazó levélszöveget szintetikussá.
