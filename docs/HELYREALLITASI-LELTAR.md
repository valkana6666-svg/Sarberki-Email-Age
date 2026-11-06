# Helyreállítási leltár – titkok és platform-beállítások (Claude, 2026-11-06)

**Csak nevek és lelőhelyek, értékek SOHA.** Az értékek helye: a tulajdonos jelszókezelője (vagy az adott szolgáltatás felülete). Forrás: a kód tényleges változóhasználata (`netlify/functions`, `shared-core`, `.github/workflows`), 2026-11-06. A mentés ezeket szándékosan **nem** tartalmazza.

## 1. Netlify (TEST-oldal: `leafy-chimera-2403e5`) – környezeti változók
| Név | Mire kell | Titok? | Honnan pótolható új oldalnál |
|---|---|---|---|
| `SUPABASE_URL` | az adatbázis címe | nem | az (új) Supabase-projekt címe |
| `SUPABASE_PUBLISHABLE_KEY` | nyilvános kliens-kulcs | nem (nyilvános) | Supabase → Project Settings → API Keys |
| `SARBERKI_OPERATOR_SESSION_KEY` | a kezelői belépési süti titkosítása | **igen** | **újragenerálható** (64 hex, `openssl rand -hex 32`); csak újrabelépést okoz |
| `ISOLATED_APPROVAL_ATTESTATION_KEY` | szerver-aláírás (mentés, ár, nincs hely) | **igen** | **egyeznie kell** az adatbázis `sc_isolated_approval_key` sorával: a visszaállított DB-ből kiolvasható, vagy mindkét helyen együtt cserélendő |
| `OPENAI_TRANSLATION_API_KEY` / `AI_TRANSLATION_API_KEY` | magyar gépi fordítás | **igen** | OpenAI-fiók → API keys (új kulcs) |
| `OPENAI_TRANSLATION_MODEL`, `SARBERKI_TRANSLATION_ENABLED` | fordítás modellje / kapcsoló | nem | a régi érték |
| `PUSHOVER_*` (`USER_KEY`, `API_TOKEN`, `ENABLED`, `LEDGER_ENABLED`, `SUPABASE_*`) | értesítés (most KI) | **igen** | Pushover-fiók; csak ha újra kell |
| `CASE_STORE_ENABLED=synthetic-only`, `CASE_STORE_TEST_TENANTS=sarberki-test,demo-test` | ügytár kapu | nem | fix érték |
| `CASE_APPROVAL_ENABLED`, `CASE_CLARIFICATION_ENABLED`, `CASE_EXACT_*`, `CASE_TEST_MAILBOX_INGEST_ENABLED`, `CASE_TEST_MAILBOX_SEND_ENABLED`, `CASE_TEST_MAILBOX_SEND_LEDGER` | funkciókapcsolók | nem (kivéve `CASE_EXACT_RECEIPT_PRIVATE_JSON`: **igen**) | a régi értékek; a küldést csak tudatosan kapcsold vissza |
| `PREVIO_*` (`READ_API_ENABLED`, `API_KEY`, `HOTEL_ID`, `RATE_PLAN_ID`, `ROOM_KIND_MAP`) | Previo-olvasás (most KI) | `PREVIO_API_KEY`: **igen** | Previo; csak ha be volt kapcsolva |
| `SARBERKI_DEPLOYMENT`, `SARBERKI_LIVE_*`, `CASE_LIVE_MAILBOX_ENABLED` | éles üzemmód | nem | TEST-ben **ne legyenek beállítva** |
**Új oldalnál:** a Netlify az `URL` változót maga adja; a kód ehhez köti a belépést, ezért egy új oldal címét a kódban (`server-deployment.mjs` TEST-értéke) is át kell írni – ezt Claude végzi a próba előtt.

## 2. GitHub – titkok és változók (repository / környezet)
| Név | Mire kell | Hol |
|---|---|---|
| `SARBERKI_BACKUP_DB_URL` | a napi mentés (csak olvasó) | repo secret |
| `SARBERKI_BACKUP_V2_PASSPHRASE`, `SARBERKI_BACKUP_V2_OWNER_RECOVERY_PASSPHRASE` | a mentés titkosítása / tulajdonosi visszafejtés | repo secret; **a tulajdonosi példány a jelszókezelőben – nélküle a mentés használhatatlan** |
| `SARBERKI_V2_DRIVE_OAUTH_JSON` | Drive-feltöltés (drive.file) | repo secret |
| `SARBERKI_TEST_DB_INSTALL_URL` | jóváhagyott TEST-telepítés | `test-db-install` környezet |
| `SARBERKI_RESTORE_DRILL_DB_URL` | újraépítési próba (új projekt) | `restore-drill` környezet (lásd `UJRAEPITESI-PROBA.md`) |
| `vars.SARBERKI_V2_ENABLED`, `vars.SARBERKI_V2_STORAGE_PROVIDER` (=drive) | mentés kapcsolói | repo variables |
Régi, nem használt: `SARBERKI_BACKUP_PASSPHRASE`, `SARBERKI_V2_STORAGE_*`, `PREVIO_CAPACITY_TEST_TOKEN`.

## 3. Supabase-projekt – a DB-n kívüli beállítások (kézzel)
- **Authentication → URL Configuration:** Site URL = a Netlify-oldal címe; Redirect URLs: ugyanaz (a belépés jelszavas, a kód nem használ e-mailes linket).
- **Authentication → Providers:** Email (jelszó) bekapcsolva; nyilvános regisztráció **kikapcsolva** (fiókot csak a tulajdonos hoz létre).
- **Auth-munkamenet:** alapértékek; a 30 perces tétlenséget a kód kezeli.
- **Felhasználók:** a mentésből visszajönnek (jelszó-hash-sel együtt); belépési próba szükséges.
- **Edge Function `reader-password-reset`:** lezárt (HTTP 410), csak ha kell: `recovery/edge-20261020/`.
- **Tárhely (Storage), Vault:** most üres; nincs teendő.

## 4. Google Cloud – Gmail-olvasás (OAuth-kliens `233144344335-…`)
- **APIs & Services → Credentials → OAuth 2.0 Client → Authorized JavaScript origins:** add hozzá az új Netlify-oldal címét (pl. `https://<új-oldal>.netlify.app`). Enélkül a napi kezelő „E-mailek beolvasása” gombja nem működik.
- A tesztfelhasználó (`sarberkiprojecttest@gmail.com`) és a `gmail.readonly` jogosultság változatlan.

## 5. A visszaállítás sorrendje röviden
1. Új Supabase-projekt → 2. DB visszaállítása a Drive-mentésből (folyamat: `sarberki-restore-drill.yml`) → 3. Supabase-beállítások (3. pont) → 4. Netlify-oldal + változók (1. pont; az aláírókulcs a DB-ből) → 5. Google-origin (4. pont) → 6. belépés és egy ügy megnyitása → 7. mérés (tábla-, ügy-, audit-, tagsági egyezés) és időzítés.
