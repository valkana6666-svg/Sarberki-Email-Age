# Sárberki V1 – külső konfigurációk helyreállítási felkészültsége

2026-10-17. Forráskód- és dokumentációleltár, nem Google/Netlify/Supabase adminexport. Titkos értéket nem kértünk, olvastunk ki vagy jelenítettünk meg. Semmilyen szolgáltatói beállítást nem módosítottunk.

## Mi igazolt most?

- Október 17-i AES256 SQL-mentés: 49 tábla teljes visszaállítása, adat-/séma-/jogosultság-/audit-egyezés.
- Új szolgáltatási RPC-k működése és tiltásai a visszaállított DB-n, rollbackkel.
- Valódi izolált GoTrue/PostgREST: új szintetikus tesztfiók login, ügy-/tervezetmentés, Reader-tiltás és újraindítás utáni visszaolvasás.
- Az eredeti fiókok tényleges újrabelépése, az admin/MFA helyreállíthatósága és a külső konfigurációk teljes, hiteles mentése **NEM IGAZOLT**.

Részletek: [aktuális restore](../reports/restored-v1-runtime-2026-10-17/REPORT.md), [korábbi külső hiányok](RESTORE-GAPS-2026-10-11.md). A régi 43 táblás/Auth-nem-futott megállapítás történeti; az új 49 táblás/izolált Auth-eredmény felülírja, a külső konfigurációs hiányokat nem.

## Google / Gmail

| Megőrzendő adat vagy hozzáférés | Forrás / ellenőrzési határ |
| --- | --- |
| Projekt tulajdonosa, helyreállító admin, MFA és fiók-helyreállítás | Nem derül ki a gitből; védett tulajdonosi ellenőrzés szükséges, titkok chatbe másolása nélkül |
| OAuth-kliens, engedélyezett JavaScript-originek, consent/app státusz, tesztfelhasználók | A nyilvános kliensazonosító az index meta-mezőjében van. A tényleges adminbeállítások exportja nincs igazolva |
| Elkülönített Gmail tesztfiók, gmail.readonly scope, engedélyezett levélkör | `gmail-policy.mjs`, `gmail-readonly.js`; a privát receipt további szerveroldali kötése nem váltható ki tárgyszűréssel |
| Másik eszköz új hitelesítése | Normál Google-bejelentkezés és hozzájárulás; régi token kimásolása nem megoldás |

Új origin nem adható hozzá automatikusan. A Gmail-alapkapcsolat már igazolt; pusztán e leltár kedvéért nem olvastunk új levelet. Google figyelmeztetésnél vagy MFA-nál emberi hitelesítés szükséges, kerülőút nélkül.

## Netlify / GitHub

Megőrzendő: site-azonosító és tulajdonosi hozzáférés; repository-kapcsolat; kizárólagos tesztág; deploy-kontextusok; functions runtime; környezeti változók neve, scope-ja, titkos/nem titkos besorolása és a védett titoktárbeli hivatkozása. A gitben megvan a build-parancs, publish/functions útvonal, redirect, no-store és manifest MIME a `netlify.toml`-ban. A tényleges szolgáltatói scope/adminállapot nincs exportálva.

| Konfiguráció neve | Szerep és biztonságos helyreállítási feltétel |
| --- | --- |
| `URL`, `SUPABASE_URL` | Nem titkos célazonosság. A jelenlegi teszthost és projekt több szerveres/kliensoldali kapuban rögzített |
| `SUPABASE_PUBLISHABLE_KEY` | Klienshez engedélyezett publikus projektkulcs; nem lehet secret/service_role helyettesítés |
| `CASE_STORE_ENABLED`, `CASE_STORE_TEST_TENANTS` | Csak külön igazolt tesztkörnyezetben: `synthetic-only`, illetve `sarberki-test,demo-test`; alaphelyzetben zárt |
| `SARBERKI_OPERATOR_SESSION_KEY` | Szerveroldali titok; hiánykor session setup zárt. Csere érvényteleníti a régi sütiket |
| `CASE_APPROVAL_ENABLED`, `ISOLATED_APPROVAL_ATTESTATION_KEY` | Szintetikus, rögzített ügyek külön jóváhagyási kapuja és titka. Korábbi aláírások nem helyettesítik az aktuális ár-/kapacitásbizonyítékot |
| `CASE_EXACT_RECEIPT_ENABLED`, `CASE_EXACT_RECEIPT_PRIVATE_JSON` | Egyetlen pontos tesztreceipt kapuja és privát konfigurációja; értékét nem dokumentáljuk és nem bővítjük |
| `SARBERKI_TRANSLATION_ENABLED`, `OPENAI_TRANSLATION_MODEL`, `OPENAI_TRANSLATION_API_KEY` | Zárt szintetikus fordítás kapcsolója, modellneve és védett kulcsa. Régi alias: `AI_TRANSLATION_API_KEY`; a kanonikus név elsőbbségét meg kell őrizni |
| `PREVIO_READ_SAFETY_VERIFIED`, `PREVIO_CAPACITY_READ_SAFETY_VERIFIED`, `PREVIO_CAPACITY_TEST_TOKEN` | Jelen munkában mindkét élő olvasási kapu tiltva marad; token nem kérhető chatbe |
| `PUSHOVER_API_TOKEN`, `PUSHOVER_USER_KEY` | Külön titkok; a jelen próbák nem küldenek értesítést, helyreállítás nem aktiválhat küldést |
| `SUPABASE_AUTH_TEST_UNTIL` | Régi, korlátozott Auth-próba időkapuja; nem általános belépési vagy új jogosultsági engedély |
| `SARBERKI_BACKUP_PASSPHRASE`, backup/restore workflow kapcsolók | Védett CI-titok és változók; a jelmondat külön tulajdonosi megőrzésének igazolása továbbra szükséges |

A táblázat az alkalmazás forrásából származó név-/funkcióleltár, nem a tényleges szerveroldali értékek listája. Újratelepítéskor az élő küldési/Previo-kapuk nem másolhatók át automatikusan aktív állapotba.

**Fontos célkötés:** egy új Netlify- vagy Supabase-projekt nem lesz működő másolat csupán két környezeti változó átírásával. A `shared-core/operator-cookie-session.mjs`, `shared-core/cloud-synthetic-approval.mjs`, `shared-core/server-exact-gmail-receipt.mjs`, `cloud-approval-session.mjs`, a SQL-kötések és egyéb tesztkapuk pontos hostot/projektet ellenőriznek. Új célhoz teljes kötésleltár, célzott kód-/konfigurációmigráció és új elfogadási bizonyíték kell; a kapuk lazítása vagy keresés-csere jellegű megkerülése tilos. Ez jövőbeli helyreállítási feladat, most nincs új cél aktiválva.

## Supabase

A DB-archívum nem teljes platformkonfiguráció. Külön megőrzendő/ellenőrizendő: projekt/admin/MFA; régió és PostgreSQL/extension verziók; Auth Site URL és redirectek; signup/MFA/provider/SMTP szabályok; JWT-aláírókulcsok védett kezelése; API-kulcsok; exposed schemák; Edge Function deploy/secret beállítások; Storage objektumok bájtjai és Vault-kulcskezelés.

A schema/migration/RLS/függvény/jogosultság a mentés része. A role-jelszavak nincsenek benne. A jelenlegi Storage-állomány külön, aktuális szolgáltatói leltárát nem végeztük el; a régi 0 objektumos leltárból nem következtetünk mai teljességre. Az új tesztcélon a fiókprovisionálás nem bizonyítja az eredeti fiókok jelszavas/MFA belépését.

## Biztonságos helyreállítási sorrend

1. A tulajdonosi hozzáférések és a külön őrzött mentési jelmondat elérhetőségének védett ellenőrzése, jelszó/kulcs átadása nélkül.
2. Pontosan azonosított mentés és kódverzió; ciphertext/provenance/hash ellenőrzés.
3. Új, elkülönített DB/Auth/REST cél felépítése, minden külső küldési/Previo-kapu zárva.
4. SQL-adat-/séma-/RLS/CAS/audit és szolgáltatási rollback; normál felhasználói Auth és szerep szerinti tesztek. Alkalmazási service_role vagy admin SQL nem helyettesíti a Writer/Reader belépést.
5. Külső adminbeállítások védett helyreállítása. Új host/projekt esetén előbb a fent felsorolt kódkötések auditált migrációja; régi jóváhagyások friss bizonyíték nélküli átvétele nélkül.
6. Pontos deploy SHA, iPhone/Safari/PWA és szintetikus E2E. Élesítéshez külön tulajdonosi döntés; a jelen feladat nem engedélyezi.

## A lejárati kockázat mostani kezelése

- Az eredeti titkosított mentés külön megőrzött, SHA256-visszaolvasott csomagja: `Sarberki-V1-mentes-2026-10-17.zip`, 120253 bájt, SHA256 `8010e053fab42205b86d98542d3ed2c30921000b15c5dbddabaf1a069ad68b6d`. Az ideiglenes GitHub-példány október 24. 13:12:58 Budapest időpontban jár le.
- A **teljes** új helyreállítási bizonyíték (három eredeti JSON) külön is elmentve és visszaolvasva: `Sarberki-V1-helyreallitasi-bizonyitek-2026-10-17.zip`, 4538 bájt, SHA256 `dfd71f13ec6654be28808e26825fa33aa7bb0fd433c31275ddba41656ebbb50b`. Megegyezik az eredeti GitHub artifacttal; ZIP CRC és sikeres állapotjelzők is ellenőrizve. A GitHub artifact 2026-10-24 14:10:22 Budapest időpontban jár le; a külön mentett példány nem erre a hétnapos megőrzésre támaszkodik.
- A gitben az összesített [EVIDENCE.json](../reports/restored-v1-runtime-2026-10-17/EVIDENCE.json) és jelentés is megmarad. A teljes ZIP külön megőrzésével a lejárat előtti másolás már megtörtént; új restore vagy új artifact gyártása nem kellett.
- Külön tárolói automatikus lejáratot a mentési válasz nem közölt; korlátlan megőrzést nem állítunk. Javaslat: legalább 30 nap és a következő igazolt mentésig; ezt nem állítottuk be automatikus törlési szabályként.
- A tulajdonos saját offline/pendrive-másolata és a jelmondat másik eszközről elérhetősége külön **NEM IGAZOLT**. A titkosított csomag és a feloldó jelszó külön védett helyen maradjon; titkot ne másoljon chatbe.

Minden megállapítás a tesztrendszerre vonatkozik. Domain/DNS, éles Gmail/SMTP/Pushover és Previo nem változott.

## Ellenőrzött hivatalos hivatkozások

2026-10-17-én ellenőrizve, kizárólag olvasva. A hivatkozások nem helyettesítik a tényleges adminexportot.

- [Google Identity Services tokenmodell](https://developers.google.com/identity/oauth2/web/guides/use-token-model) és [OAuth-kliens webes beállítása](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).
- [Netlify Functions környezeti változók](https://docs.netlify.com/build/functions/environment-variables/): a Functions scope/deploy-kontextus külön megőrzendő; a netlify.toml önmagában nem a szerveroldali titkok mentése.
- [Supabase adatbázis-mentések](https://supabase.com/docs/guides/platform/backups): a DB-mentés és a Storage objektumok bájtjai külön hatókör.
