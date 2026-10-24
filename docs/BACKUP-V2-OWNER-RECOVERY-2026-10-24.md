# Hátralévő tulajdonosi ellenőrzések – 2026-10-24

## 1. Független V2-kulcs visszaolvasása

A meglévő mentés már feloldható a runnerben tárolt V2-kulccsal. Ez nem bizonyítja a tulajdonos külön példányának helyességét.

Egyetlen szükséges művelet: a tulajdonos a saját külön jelszókezelő-példányából olvassa vissza **a jelenlegi mentést titkosító, már megőrzött jelszót**, és a repository Settings → Secrets and variables → Actions → New repository secret biztonságos felületén mentse `SARBERKI_BACKUP_V2_OWNER_RECOVERY_PASSPHRASE` néven.

Nem új véletlen jelszó szükséges. A SHA256 ellenőrzőösszeg nem jelszó. A meglévő `SARBERKI_BACKUP_V2_PASSPHRASE` értékét ne változtassa meg. Az érték ne kerüljön chatbe, képernyőképbe, naplóba vagy dokumentumba.

Ezután a tesztágon egy `[backup-v2-owner-key-probe]` jelölésű, aktuális HEAD-re épülő engedélyezett kérés indítható. A már elkészült `drive-acceptance` job ebben a módban csak az önállóan visszaolvasott owner secretet kapja, a szokásos V2-kulcsra nincs visszaesés. A pontos Drive-bájtok relay-azonosságát, a teljes burkolat feloldását és az izolált SQL-visszaállítást ellenőrzi. Éles/forrás DB-hitelesítő nem adható a jobnak. PASS után a próba-secret tulajdonosi törlése külön elvégezhető; a jelszókezelő-példány megmarad.

A külön GitHub secret csak az egyszeri biztonságos beadás helye, nem helyettesíti a GitHubtól független tulajdonosi megőrzést. Másnak nem adtunk új hozzáférést.

## 2. A korábban képen megjelent Google backup client secret letiltása

Aktuális állapot: **BLOCKED / NEM IGAZOLT**. Nincs használható Google Cloud adminhozzáférés; a korábbi Site Unavailable/OAuth/Branding kört nem ismételtük. Nem történt automatikus visszavonás vagy klienslétrehozás. A korábbi képen látható Enabled állapot történeti.

Tulajdonosi eljárás:

1. A Google Cloud projektválasztóban kizárólag `sarberki-drive-backup-512615` legyen kiválasztva (projektszám: `1010465901774`).
2. Google Auth Platform → Clients → a dedikált **Sarberki Drive Backup**, Web application kliens. A Gmail-projektet és Gmail-klienst ne nyissa meg módosításra. Név és projektazonosító egyezése nélkül álljon meg.
3. A Client secrets listán a létrehozási dátum és az állapot alapján azonosítsa az október 24-én létrehozott, képen megjelent régi titkot. A teljes érték megjelenítése/másolása nem szükséges.
4. Ha a régi titok Enabled, válassza a **Disable** műveletet, és ellenőrizze a Disabled állapotot. Az új mentési bridge nem használ saját Google OAuth-secretet, ezért ehhez nem szükséges új titkot gyártani.
5. Bizonyíték: dátum, projekt/kliens neve és Disabled állapot; titkos értéket ne tartalmazzon. Ha már Disabled vagy Deleted, ne generáljon új klienst csak az ellenőrzésért.
6. Ha nincs Disable lehetőség, a felületen ne próbáljon találgatással továbblépni. A dedikált, bizonyítottan használaton kívüli kliens törlése külön tulajdonosi döntés; automatikusan nem végezzük el. Új secret létrehozása önmagában nem tiltja le a régit. Ismételt Branding/Publish nem visszavonás.

A letiltás a régi klienssecret használatát szünteti meg; nem állítjuk, hogy ettől minden korábban kibocsátott Google access token is azonnal megszűnik. Ha a backup OAuth-hozzájárulás külön visszavonása szükséges, csak a dedikált backup alkalmazás azonosított kapcsolata érinthető, a ChatGPT Drive-csatlakozás és a Gmail-kliens nem.

Hivatalos útmutató: https://support.google.com/cloud/answer/15549257?hl=en

## 3. Netlify és felügyelt Supabase konfiguráció

A meglévő teszt-site konfigurációs felülete ebben a böngészőben belépést kér:
https://app.netlify.com/projects/leafy-chimera-2403e5/configuration/general

A teljes platformpróba előtt szükséges az engedélyezett tulajdonosi bejelentkezés és a célként használt elkülönített, ingyenes környezet lehetőségének ellenőrzése. Nem kérünk API-tokent chatben. Éles site/projekt és domain nem módosítható. Az aktuális hiányokat a BACKUP-V2-PLATFORM-INVENTORY-2026-10-24.md és a korábbi RECOVERY-OWNER-ACTIONS-2026-10-21.md tételesen tartalmazza.

## 4. Értesítési próba

A felhős vezérlőben egyszeri `DRILL-20261024-DRIVE-ACCEPTANCE` szintetikus ChatGPT-értesítési próba van kérve. Nem állítunk elő valódi mentési hibát és nem küldünk e-mailt/Pushovert. A kliensoldali megérkezés bizonyítéka tulajdonosi visszaigazolás vagy szolgáltatói kézbesítési bizonyíték. A `delivery_status=unknown` nem PASS.
