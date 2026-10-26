# Független tulajdonosi V2-kulcspróba – 2026-10-26

Kérés: owner-key-probe-20261026-0525. Kizárólag gmail-test-subject-allowlist, meglévő drive-acceptance job, külön PostgreSQL cél.

A tulajdonos megerősítette a külön megőrzött kulcspéldányt; a GitHub felületi duplicate-name üzenet igazolja a SARBERKI_BACKUP_V2_OWNER_RECOVERY_PASSPHRASE secret meglétét. Értékét nem olvastuk. Megléte nem bizonyítja helyességét vagy független eredetét; csak a próba eredménye és a tulajdonosi nyilatkozat együtt értelmezhető.

A meglévő, változatlan workflow rögzített történeti bemenete: Drive 1Q2FnZL9O2_Fkq83koM2z-LOi4wTo9VoQ; snapshot run 40124286342; commit 1e17a56b50fe8ef8ca0aab3119dda8f66581e2f9; ciphertext 3315880 bájt; SHA256 3ea25b89805a62f8bfe0956398b5e65f9b54d36e09cba939f5074d0ab42870f8. A Git blob relay az eredeti, korábban pontos Drive-ID alapján letöltött bájtokat őrzi. Ez nem friss Drive-letöltés és nem október 25-i/26-i snapshotpróba.

Kizárólag az owner-recovery secret kapható meg; normál V2-kulcsra nincs fallback. Nincs forrás-DB credential, export, éles DML, Netlify, Pushover, vendégküldés vagy automatizálásmódosítás. Nincs új kulcs vagy OAuth-kliens. Az ütemezett napi exportkérés fájlja nem változik.

Elvárt bizonyíték: pontos run/attempt/verification commit, VALIDATED-INPUT.json independent_owner_key_probe=PASS, rögzített Drive/hash azonosság, ISOLATED-RESTORE.json full_restore=PASS és verification_completed=true. A commit csak kérés; eredmény jelenleg NEM IGAZOLT. Teljes platform-helyreállítást nem bizonyít.

## Tényleges eredmény

LEZÁRVA az október 24-i, fent azonosított snapshot és a tulajdonos által külön megőrzöttnek megerősített kulcspéldány körében. A meglévő owner-secretet a GitHub runner használta, az asszisztens a titkos értéket nem olvasta. A secret eredetének külön megőrzését a tulajdonos nyilatkozata támasztja alá, nem a secret metaadata.

- Kéréscommit: 32b61691ac7fe0e2028e3da0a55eb126887db41f.
- Ellenőrzési run: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/40269163858, attempt 1.
- safety SUCCESS; drive-acceptance SUCCESS; export-restore SKIPPED (nem új export).
- Pontos proof artifact-ID: 12626918991; sarberki-drive-restore-proof-40269163858-1; lejárat 2027-01-24T04:27:26Z.
- Pontos artifact-ID letöltés és a két JSON-tag vizsgálata megtörtént.
- VALIDATED-INPUT.json: independent_owner_key_probe=PASS, whole_package_decryption=PASS, owner_key_source=independently_reentered_owner_secret; normál V2-kulcs üres, nincs fallback. A verification_run és verification_commit a fenti futáshoz kötött.
- ISOLATED-RESTORE.json: full_restore=PASS, verification_completed=true, tables_compared=49, case_manifest=PASS, portable_decryption=PASS_ON_NEW_LINUX_RUNNER_NO_DPAPI.
- A VALIDATED-INPUT.json sql_restore=NOT_YET_RUN mezője a feloldás utáni, SQL előtti időpillanat; a későbbi ISOLATED-RESTORE.json bizonyítja az SQL PASS-t. Az eredeti proofot nem írtuk át.

Bizonyítékhatár: a korábban pontos Drive-ID alapján letöltött ciphertext változatlan Git blob relay-e, nem mostani közvetlen Drive-letöltés. Nem október 25-i/26-i snapshot; nem a napi ütemezett lánc próbája; nem Netlify/Auth/Edge teljes platform-restore. Az első owner-key probe új elfogadási kaput zárt, ezért nem indokolatlanul ismételtük a történeti SQL-próbát. A napi automatizálás és a BACKUP-V2-RUN-REQUEST.md nem változott. Nincs production, cloud DDL/DML, vendégküldés, Pushover vagy Netlify-deploy.

## Proof tartós Drive-megőrzése

A 12626918991 artifact változatlan ZIP-bájtjai új fájlként a kijelölt mappába kerültek. Drive-ID: 1h6qfJCxrFWojbDlIXE5tZaPMtW6FUj2V; link: https://drive.google.com/file/d/1h6qfJCxrFWojbDlIXE5tZaPMtW6FUj2V/view?usp=drivesdk . Méret 4627 bájt; SHA256 95843daf9fdce25c892a9d2bb4d4729ff68d6f779ba0a3f7e0d3db0b1ac95a12. A mappa és új fájl ACL-je kizárólag valkana6666@gmail.com owner. Pontos Drive-ID szerinti tényleges bináris visszatöltés és SHA256-egyezés PASS. Nincs korábbi fájl felülírás/törlés vagy megosztásmódosítás. Ez proof-archívum, nem új adatbázismentés és nem ebből a proof ZIP-ből végzett új SQL-restore.
