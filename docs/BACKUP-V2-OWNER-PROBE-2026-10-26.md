# Független tulajdonosi V2-kulcspróba – 2026-10-26

Kérés: owner-key-probe-20261026-0525. Kizárólag gmail-test-subject-allowlist, meglévő drive-acceptance job, külön PostgreSQL cél.

A tulajdonos megerősítette a külön megőrzött kulcspéldányt; a GitHub felületi duplicate-name üzenet igazolja a SARBERKI_BACKUP_V2_OWNER_RECOVERY_PASSPHRASE secret meglétét. Értékét nem olvastuk. Megléte nem bizonyítja helyességét vagy független eredetét; csak a próba eredménye és a tulajdonosi nyilatkozat együtt értelmezhető.

A meglévő, változatlan workflow rögzített történeti bemenete: Drive 1Q2FnZL9O2_Fkq83koM2z-LOi4wTo9VoQ; snapshot run 40124286342; commit 1e17a56b50fe8ef8ca0aab3119dda8f66581e2f9; ciphertext 3315880 bájt; SHA256 3ea25b89805a62f8bfe0956398b5e65f9b54d36e09cba939f5074d0ab42870f8. A Git blob relay az eredeti, korábban pontos Drive-ID alapján letöltött bájtokat őrzi. Ez nem friss Drive-letöltés és nem október 25-i/26-i snapshotpróba.

Kizárólag az owner-recovery secret kapható meg; normál V2-kulcsra nincs fallback. Nincs forrás-DB credential, export, éles DML, Netlify, Pushover, vendégküldés vagy automatizálásmódosítás. Nincs új kulcs vagy OAuth-kliens. Az ütemezett napi exportkérés fájlja nem változik.

Elvárt bizonyíték: pontos run/attempt/verification commit, VALIDATED-INPUT.json independent_owner_key_probe=PASS, rögzített Drive/hash azonosság, ISOLATED-RESTORE.json full_restore=PASS és verification_completed=true. A commit csak kérés; eredmény jelenleg NEM IGAZOLT. Teljes platform-helyreállítást nem bizonyít.
