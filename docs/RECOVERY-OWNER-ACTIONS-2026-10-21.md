# Sárberki V1 – tulajdonosi helyreállítási teendők, 2026-10-21

Állapot: RÉSZLEGES – HIÁNYOSSÁGOKKAL. Ez végrehajtható eljárás és hiánylista, nem végrehajtott kulcsmentés. A korábbi október 20-i konfigurációs tervet e dátumozott kiegészítéssel és a csomag Netlify-jelentésével együtt kell olvasni.

## A jelenlegi hozzáférési akadály

Október 21-én a Supabase projekt dashboardja bejelentkezésre irányított, a Netlify nyitóoldala szintén belépést kért. A korábbi hitelesített Netlify-leltár és statikus archívum megmarad; ezek történeti megfigyeléseit nem vonja vissza az új munkamenet belépési igénye. A GitHub-tesztág olvasható és módosítható. Supabase és Netlify platform-konfigurációra jelenleg nem áll rendelkezésre hitelesített dashboard-munkamenet. Nem történt jelszó-, szerepkör-, kulcs- vagy szolgáltatásmódosítás.

## Feloldókulcs külön megőrzése

1. A tulajdonos saját megbízható gépén/jelszókezelőjében keresse meg a meglévő SARBERKI_BACKUP_PASSPHRASE értéket. A GitHub Actions secret nem olvasható vissza; az újonnan generált jelmondat nem nyitja ki a régi mentést.
2. A meglévő értéket jelszókezelőben és külön, fizikailag védett offline példányban őrizze. Ne másolja chatbe, nyílt ZIP-be vagy GitHub-fájlba. A kulcs megőrzésének PASS bizonyítéka csak az érték nélküli átadási jegyzőkönyv lehet, azzal a feljegyzéssel, hogy a tulajdonosi példány mely titkosított snapshotot nyitotta ki.
3. Külön, megbízható környezetben próbáljon visszafejteni a tulajdonosi példánnyal; az ellenőrzés az eredeti exportmanifesttel és SQL-feldolgozással történjen. Éles DB-hez ne kapcsolódjon. Nyílt dumpot csak védett titkosított háttértáron/RAM-ban kezeljen, ne tegye a végső ZIP-be.
4. Ha az érték elveszett, de a GitHub Actions secret még működik: ne írja felül! Lehetséges mentőút egy külön, felülvizsgált workflow, amely a meglévő titokkal a mentést visszafejti, és a tulajdonos által átadott GPG nyilvános kulcsra újratitkosítja. A privát kulcsot a tulajdonos hozza létre és őrzi; csak a nyilvános kulcs és az ellenőrzött ujjlenyomat adható át. A workflow sem a régi jelmondatot, sem a nyílt dumpot nem naplózhatja vagy töltheti fel artifactként. E mentőút ebben a munkamenetben NEM futott: nincs tulajdonosi nyilvános kulcs és külön privátkulcsos visszafejtési bizonyíték.
5. Ha sem a jelmondat, sem a futtatásra használható régi secret nem elérhető, a régi titkosított mentés nem állítható helyre új kulccsal. Új, olvasási DB-export és új, külön megőrzött kulcs szükséges.

## Netlify – teljes konfiguráció

A korábban hitelesítetten látott teszt-site 17 változóneve a csomag 03_NETLIFY/AUTHENTICATED_CONFIGURATION_2026-10-21.json fájljában van. Ez nem teljes team-level és context-level értékexport. Az összes változónál rögzítendő: név, site/team eredet, build/functions/runtime scope, production/deploy-preview/branch context, titkos státusz, újralétrehozási jogosult. Nyílt jelentésbe csak név és metaadat kerülhet.

| Csoport | Változónevek | Biztonságos helyreállítás |
|---|---|---|
| Ügytár | SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, CASE_STORE_ENABLED, CASE_STORE_TEST_TENANTS, SUPABASE_AUTH_TEST_UNTIL | Új elkülönített projekt címe és publishable kulcsa; csak szintetikus tenant és aktuális, szűk tesztengedély. A régi lejáratot ne hosszabbítsa meg a forrásrendszeren. |
| Jóváhagyás/receipt | CASE_APPROVAL_ENABLED, CASE_EXACT_RECEIPT_ENABLED, CASE_EXACT_RECEIPT_PRIVATE_JSON, ISOLATED_APPROVAL_ATTESTATION_KEY | Célkörnyezetben kezdetben tiltva; privát receipt-konfiguráció külön titkoskezelőben. Ne bővítse az engedélyezett postaládát/levélkört. |
| Session | SARBERKI_OPERATOR_SESSION_KEY | Új célkörnyezethez külön kriptográfiai kulcs; régi sessionök folytatása nem ígérhető. |
| Fordítás | AI_TRANSLATION_API_KEY, OPENAI_TRANSLATION_MODEL, SARBERKI_TRANSLATION_ENABLED | Megfelelő OpenAI-projekt tulajdonosi hozzáférése; külön célkulcs biztonságos csatornán, kezdetben kikapcsolt fordítás. |
| Pushover | PUSHOVER_API_TOKEN, PUSHOVER_USER_KEY | Szolgáltatói tulajdonosi leltár/titkosított export; küldési próba tilos. |
| Egyéb | PREVIO_READ_SAFETY_VERIFIED, SECRETS_SCAN_OMIT_KEYS | Previo-kaput tiltottra állítsa a célon; titokellenőrzést ne gyengítsen pusztán a build sikeréért. |

Ne másolja át vakon a régi UI buildcommand/publish mezőit: az igazolt deploy a netlify.toml szerinti node scripts/build-static.cjs parancsot és dist könyvtárat használta. Mindkét eredeti site változatlan maradjon. A Functions forrást és függőségeit is telepíteni kell; a statikus deploy ZIP önmagában nem elég.

## Supabase Auth/SMTP/provider leltár

Szükséges a mojnqizbcaczstguikpv projekt konfigurációját olvasni képes szervezeti fiók, továbbá az új izolált célprojektet létrehozni/konfigurálni képes jogosult. Ezek megléte nem következik a DB SQL-hozzáféréséből.

Rögzítendő: Site URL, redirect allowlist; signup/anonymous/email/phone belépési kapcsolók; email-megerősítés; jelszópolicy; access-token élettartam és refresh/session policy; MFA; bekapcsolt OAuth providerek és callback-címek; SMTP host/port/TLS/feladó/rate limitek és sablonok; Auth hookok; API exposed schemas; JWT-aláírási mód/kulcsazonosítók; Edge verify_jwt és secret-nevek. Ne feltételezze a hiányzó értékeket, ne publikáljon jelszót, client secretet vagy JWT-aláírókulcsot.

A célon a saját HTTPS-címeket állítsa be. SMTP-t biztonságos levélnyelőre irányítsa vagy hagyja kikapcsolva; valódi címre próba nem küldhető. Auth-tesztfelhasználókat elkülönítetten, szintetikus adatokkal hozzon létre. A managed Auth-verzió, email-template és gateway-konfiguráció nem áll helyre pusztán SQL-importból.

## Külső integrációk

- Gmail: kizárólag sarberkiprojecttest@gmail.com, gmail.readonly. OAuth client tulajdonosi konfiguráció, engedélyezett origin/callback, consent/test-user hozzáférés és új readonly jóváhagyás kell. A böngészős access tokent ne exportálja. A végső próba ugyanazon engedélyezett szintetikus receipt friss olvasása → normál Writer mentés → dedup → Reader/audit. A külön régi részpróbák nem egyetlen új end-to-end esemény.
- OpenAI: csak a kijelölt projektben, célhoz kötött kulcs; régi működő kulcsot ne vonjon vissza. A kulcs létrehozása és a projekt hozzáférése külön tulajdonosi lépés. A változónév leltára nem működési bizonyíték.
- Pushover/Outlook: tulajdonosi újralétrehozási eljárás és titkoskezelő; e feladatban nincs küldési teszt.
- Previo: leltár és adapterforrás megőrzése. Nincs élő foglalás, írás vagy nem igazolt mellékhatású olvasási kérés; a független fejlesztés nem vár API-ra.

## Kötelező új platform-próba

Új Netlify HTTPS-cél és új izolált Supabase szolgáltatások; forrásprojekt/main/production változatlan. Kizárólag szintetikus fixture, küldés/értesítés/Previo tiltva. Belépés, cookie/CSRF, Writer-mentés, külön read-only fiók tiltásai, külön jóváhagyó, tenantelválasztás, audit/CAS/dedup, kijelentkezés, új belépés és új deploy utáni megmaradás vizsgálandó. A korábban teljes tesztjogot kapott reader nevű fiók nem használható read-only negatív bizonyítékként.

Az exportált reader-password-reset v9 handler szándékosan HTTP 410-et ad. Edge-próba: hiányzó/hibás JWT elutasítása a gatewayn; érvényes célprojektes JWT mellett a zárt handler 410, no-store, változatlan felhasználó. Ez nem jelszó-visszaállítási siker. A Deno-handler korábbi PASS eredménye nem gateway/JWT PASS.

## Mikor lehet TELJES ÉS ELLENŐRZÖTT?

Ha a külön tulajdonosi kulccsal tényleges decrypt sikerül; a konfigurációk és titkok biztonságosan rendelkezésre állnak vagy igazoltan újralétrehozhatók; a teljes új HTTPS/Auth/REST/RLS/Edge/alkalmazáslánc sikeres; a szükséges integrációk engedélyezett, nem küldő olvasási próbái bizonyítottak; minden fájl/hash és hozzáférés leltározott. A tiltott küldés/Previo-írás továbbra sem része az elfogadási próbának. A teljes platformpróba nélkül a ZIP fájlintegritás PASS mellett is RÉSZLEGES.
