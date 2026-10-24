# Google Drive előkészítés – Sárberki #6, 2026-10-24

## Választott irány: meglévő privát Google Drive
A csatlakozóval elérhető a tulajdonos My Drive tárhelye, rajta korábbi Sárberki-mentéssel. Külön, nem megosztott mappa készült:
https://drive.google.com/drive/folders/1EE2ioPs_8OwpnttT9hYHba_Y9_aWwcqz
A permissions visszaolvasása egyetlen tulajdonosi jogosultságot igazolt; nincs anyone/domain megosztás. A korábbi fájlokhoz nem nyúltunk.

114 bájtos szintetikus próbafájl feltöltése és visszaolvasása sikeres, SHA256:
9c6b5170e7f1f26fb9d6f471331c3d5bb6770f4f1cbf4a5628cbf61fcbaa896c
Ez tárhelypróba, nem adatbázismentés és nem titkosítási/restore-bizonyíték.
Az elérhető szabad kvóta nem igazolt: a böngésző Google-bejelentkezést kér. A feltöltő ezt az API-n ellenőrzi, és hiányzó kvótaadat vagy elégtelen hely esetén nem vált fizetős csomagra, hanem leáll.

## Alternatívák
- Supabase: a csatlakoztatott Sárberki szervezet Free csomagos. Az ingyenes Storage kerete 1 GB; ugyanannál a szolgáltatónál és forrásprojekt mellett gyengébb a függetlenség. Új bucketet vagy projektet nem hoztunk létre.
  https://supabase.com/docs/guides/storage/pricing
- Cloudflare R2: Standard tárhelyhez 10 GB-month ingyenes keret szerepel a díjszabásban, de új fiók/billing és hozzáférés szükséges; nem aktiváltunk szolgáltatást.
  https://developers.cloudflare.com/r2/pricing/
- AWS S3: a tulajdonos szerint nincs külön tárhely; nem hoztunk létre fizetős szolgáltatást.
A meglévő Drive ezért elsődleges előkészített irány, új előfizetés nélkül. Az egyéb, nem csatlakoztatott személyes tárhelyfiókok meglétét nem állítjuk ellenőrzöttnek.

## Elkészült automatizálás
backup-v2-drive.py: Google OAuth refresh a GitHub Secrets-ben tárolt credentialből; drive.file scope; rögzített célmappa és owner-only ACL ellenőrzése; kvótaellenőrzés; minden futáshoz új fájlazonosító; pontos ID szerinti letöltés és SHA256-egyezés. 5 MB felett resumable feltöltés, rögzített Google HTTPS-végpontok. Régi mentés törlése vagy felülírása nincs. Az alkalmazásverziózás külön fájlokkal történik; nem WORM/ObjectLock szolgáltatás.
A normál workflow csak teljes SQL-restore PASS után tölthet fel. A drive.file OAuth-jogosultság nem öröklődik a chat csatlakozójából a GitHub runnerre.

## Automatikusan beállított, nem titkos GitHub-változók
SARBERKI_V2_STORAGE_PROVIDER = drive
SARBERKI_V2_DRIVE_FOLDER_ID = 1EE2ioPs_8OwpnttT9hYHba_Y9_aWwcqz
Az exportot engedélyező kapcsolót nem aktiváltuk.

## Egyszeri, feltétlenül szükséges tulajdonosi lépés
Jelentkezz be a megnyitott Google-ablakban a valkana6666@gmail.com fiókkal. A jelszó és 2FA-kód csak a Google felületére kerüljön.
Ezután a meglévő Google Cloud projektben előkészíthető a célra korlátozott OAuth-hozzáférés. A drive.file engedélyhez a célmappát a megfelelő alkalmazás számára Google Pickerrel meg kell jelölni; egy pusztán más kliens által létrehozott mappa-ID nem ad automatikusan hozzáférést. Meglévő Gmail OAuth scope-ot/klienskonfigurációt nem írunk át. Az OAuth consent és az új hitelesítő adat engedélyezése tulajdonosi művelet.
https://developers.google.com/workspace/drive/api/guides/api-specific-auth
https://developers.google.com/identity/protocols/oauth2/web-server

Előkészített secretnevek:
- SARBERKI_V2_DRIVE_OAUTH_JSON: client_id, client_secret, refresh_token; kizárólag GitHub Secrets értékében, nem repóban vagy chatben.
- SARBERKI_BACKUP_V2_PASSPHRASE: új külön mentési jelszó, tulajdonosi jelszókezelős példánnyal.
Nem kérünk PowerShellt, programozást vagy fájlmásolást. A tokeneket nem lehet a csatlakozóból kiolvasni vagy titokban átruházni a runnerre.

## Még nem kész
Új titkosított DB-export és restore nem indult, a napi scheduler/freshness monitor nincs aktiválva. A Drive-előkészítés nem jelent 10/10-et. Bejelentkezés és egyszeri védett engedélyezés után jöhet a valós OAuth-preflight, új export, teljes izolált SQL-restore és titkosított ZIP feltöltés-visszaolvasása.


## Tulajdonosi pontosítás és szükséges következő lépés
A 2026-10-24-i közvetlen tulajdonosi utasítás és a #6 legfrissebb megjegyzése alapján meglévő fizetős Google Drive az elsődleges cél, meglévő iCloud+ 2 TB a másodlagos cél. Új tárhelyvásárlás nincs. A Drive pontos kvótája továbbra sem lett API-val igazolva. Az iCloud szabad helyére vonatkozó adat tulajdonosi/képernyős közlés, ebben a munkamenetben nem önálló mérés.

A meglévő PR #7 folytatódik; nincs új ág, mappa vagy szolgáltatás. A működő alkalmazás és a párhuzamos Work érintetlen. A legfrissebb #6 komment külön megerősíti, hogy a chat Drive-csatlakozó tokenje nem helyettesíti a GitHub runner külön OAuth-jogosultságát.

A Google OAuth külső alkalmazás Testing állapotában a Drive scope-os refresh token 7 nap után lejár. A tartós napi működés elfogadási feltétele ezért az ehhez megfelelően konfigurált külön OAuth alkalmazás, offline access, tulajdonosi consent, célmappa-kiválasztás és tényleges tokenmegújítás. A meglévő Gmail kliens nem módosítható. Új jogosultságot és hitelesítőt kizárólag tulajdonosi engedéllyel hozunk létre. Visszavonás, inaktivitás vagy egyéb Google-szabály később is érvénytelenítheti a tokent; ezt a freshness/hibajelzésnek kezelnie kell.
Forrás: https://developers.google.com/identity/protocols/oauth2

A böngészős Google-munkamenet nincs belépve; az account azonosítása után a jelszóoldalt előkészítettük. A következő egyetlen tulajdonosi lépés a Google-belépés befejezése (jelszó és esetleges 2FA kizárólag a Google oldalán). A Google Cloud/OAuth előkészítés és a kvóta ellenőrzése ezután folytatható; ez nem jelenti az OAuth vagy új backup-secret automatikus engedélyezését.

Az iCloudhoz nincs csatlakoztatott API-eszköz, és a szokásos C:/Users/kovac/iCloudDrive, C:/Users/kovac/iCloud Drive helyeken nincs elérhető szinkronmappa. Közvetlen szerveres feltöltést nem állítunk igazoltnak. A másodlagos megőrzés a később ellenőrzött titkosított ZIP-re alkalmazható, támogatott Apple-böngészős vagy beállított iCloud Drive-szinkronúton; valódi iCloud-visszaolvasásig NEM IGAZOLT. A működő elsődleges mentést ez nem blokkolja.
Apple útmutató: https://support.apple.com/en-gb/guide/icloud-windows/icwddbc813bd/icloud
