# Friss teszteredmények – 2026-10-10

| Ellenőrzés | PASS | FAIL | Megjegyzés |
|---|---:|---:|---|
| Végső npm test | 890 | 0 | 0 skipped/cancelled/todo; 18 saját + 17 közben érkezett a 855 kiindulóhoz |
| PostgreSQL célzott suite | 7 | 0 | A 890 részhalmaza; eredeti migráció + review/draft/audit |
| Foundation + review célzott suite | 70 | 0 | A 890 részhalmaza |
| Python backup-helper offline suite | 3 | 0 | Külön suite; pipe encryptor szimulált, nincs felhős dump |
| Új valódi Supabase Auth/E2E | 0 | — | BLOKKOLVA; korábbi 25 PASS nem friss eredmény |
| Valódi felhős backup/izolált restore | 0 | — | BLOKKOLVA; nincs kész mentés |

Parancsok: npm ci; node --test tests/server-foundation.test.mjs tests/synthetic-booking-review.test.mjs; node --test tests/supabase-policy.test.mjs; npm test; python3 scripts/test_owner_encrypted_backup.py; git diff --check.

Az első Python-pipeline próba feltárta a bezárt stdout utáni communicate() hibát; wait()-re javítva a végső 3 teszt sikeres. A valódi GPG fixture-kulcspróba nem futott végig, mert gpg-agent socket létrehozás tiltott; ezt nem PASS-ként számoljuk. A végső offline suite explicit szimulált encryptort használ. A helper Windows/pg_dump/GPG tényleges tulajdonosi futása hátravan.

Frontend: COMMIT_REF kiinduló SHA + dummy env-sentinellek mellett 49 asset. Sentinel és server-only modul/backup-helper a dist-ben nem található. Összevezetés után 87b36be forrással is újrafuttatva. A generált build-info.mjs visszaállítva, nincs commitolt buildtermék.

Felhős readonly: 5 RLS-es tábla; 2 ügy, 3 audit; audit gaps/hash mismatches = 0. Auth-kapu HTTP 404; booking-cases HTTP 503 CASE_STORE_DISABLED. Ez nem Auth/E2E-tesztszám.

A teljes végső kimenet az AUTOMATED-TEST-OUTPUT.txt, a PostgreSQL-részhalmaz a POSTGRES-TEST-OUTPUT.txt fájlban. A részhalmazokat nem adjuk újra a teljes tesztszámhoz.

A két változat egyesítése után 890 PASS / 0 FAIL; az ea31859 alapon futtatott 873-as és a párhuzamos 872-es eredmény külön előzmény, nem külön új tesztösszeg. A végső 70-es célzott kimenet TARGETED-TEST-OUTPUT.txt-ben. A PowerShell-helper futása ebben a Linux agentkörnyezetben nem tesztelt.

Telepítés után a Netlify health a 606b915a9dc3c182270325a356adc450c4cc3a47 fejlesztési SHA-t jelentette; ügy-API 503 CASE_STORE_DISABLED, Auth-kapu 404 kikapcsolva. Ez exact tesztdeploy és lezárás igazolása; új felhős Auth/E2E és új push-CI PASS nincs igazolva.
