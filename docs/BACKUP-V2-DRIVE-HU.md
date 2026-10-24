# Aktuális végrehajtási állapot – 2026-10-24

Ez a szakasz felülírja az alábbi történeti hozzáférési és ágállapotot.

- Engedélyezett végrehajtási ág: gmail-test-subject-allowlist. A backup/issue-6-cloud-recovery ág és PR #7 változatlan; a mentési fájlokat onnan vettük át, a tesztág két Gmail commitjának megtartásával.
- Dedikált Cloud-projekt: sarberki-drive-backup-512615; alkalmazás: Sarberki Drive Backup. A kliens és Branding képernyővel igazolt, a Testing állapot és az inaktív Publish app szintén. A konkrét publikálási hiány nincs közvetlen admin-hozzáféréssel feltárva. A kötelező URL-ek nélküli közzétételt nem tekintjük támogatottnak.
- A Work böngésző közvetlen Google Cloud-elérése Site Unavailable hibát ad. Ez nem bizonyít Google-szolgáltatáskiesést vagy hibás felhasználói beállítást. A kliens titkának cseréje innen nem végezhető el; nem állítjuk késznek.
- A GitHub Actions Secrets UI most csak SARBERKI_BACKUP_DB_URL és SARBERKI_BACKUP_PASSPHRASE neveket mutat. A SARBERKI_V2_DRIVE_OAUTH_JSON és SARBERKI_BACKUP_V2_PASSPHRASE hiányzik. A meglévő secretértékeket nem olvastuk ki és nem cseréltük.
- A Drive-mappában változatlanul egy 114 bájtos próbafájl és a 2 068 093 bájtos előkészítő ZIP van. Ezek nem friss DB-mentések.
- A scope-ellenőrzés pontosan drive.file jogosultságot és nem üres access tokent követel; Gmail és egyéb extra scope elutasítva.

## Új javítás: helyreállítás a Drive-ról visszatöltött csomagból

A feltöltő most a Google által visszaadott pontos fájlazonosítóval letöltött válasz bájtjait külön, védett könyvtárba menti. A `backup-v2-readback.py` ellenőrzi a két távoli fájl SHA256-értékét, a ZIP pontos engedélyezett tartalmát, méretkorlátját és a futás/commit/tesztprojekt eredetét. Csak a hat adatbázis-állományt bontja ki; a forráskódot nem futtatja.

Ezután a workflow külön SQL-helyreállítást végez ebből a letöltött bemenetből, forrásadatbázis-hitelesítő nélkül. Bizonyítéka sikeres futás esetén `drive-restore-evidence/ISOLATED-RESTORE.json`, benne `input_mode=exact_id_drive_download`, a Drive-fájl ID-ja és hash-e. A feltöltés előtti restore megmarad biztonsági kapunak, de nem helyettesíti ezt a második próbát.

Fejlesztési ellenőrzés: 17 feltöltőteszt és 15 távoli csomagellenőrző teszt PASS. Ezek szintetikus tesztek; valódi Google-feltöltés vagy SQL-restore nem történt ebben a munkamenetben. A korábbi 23 tesztet nem futtattuk újra változatlan megoldás igazolásaként.

A bemutatkozó, adatkezelési és feltételoldalak szövegtervezete: [BACKUP-V2-PUBLIC-PAGES.md](BACKUP-V2-PUBLIC-PAGES.md). Nincs közzétett URL vagy igazolt domainellenőrzés; a Publish app konkrét hiánya továbbra is adminhozzáférést igényel.

## Hitelesítés és alternatívák

A személyes My Drive tárhelyhez továbbra is felhasználói offline OAuth a választott út. A Testing refresh token hét napos korlátja miatt ez nem fogadható el tartós automatikus mentésnek. A Production állapot önmagában sem bizonyít megújítást, kvótát, célmappa-hozzáférést vagy tulajdonosi kulcsmegőrzést.

Service account nem egyszerű helyettesítő személyes My Drive-ra: nincs saját Drive kvótája; Shared Drive vagy felhasználói delegálás szükséges. Személyes Gmailhez nem feltételezünk Workspace-delegálást. A meglévő csatlakozó tokenje nem exportálható a runnernek. iCloud szerveres hitelesítés és szinkronkörnyezet nem elérhető; nem hozunk létre kerülőutat Apple-jelszóval.

Hivatalos források:
- https://developers.google.com/identity/protocols/oauth2
- https://support.google.com/cloud/answer/15549049
- https://developers.google.com/workspace/drive/api/guides/about-shareddrives
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule

## Nem teljesített elfogadási kapuk

1. Publikálási konfiguráció konkrét hiányának megoldása; szükség esetén valós bemutatkozó/adatkezelési/feltételoldalak tulajdonolt domainen. Nincs kitalált URL vagy jogi megfelelési állítás.
2. A képen megjelent dedikált backup client secret cseréje biztonságos adminfelületen. Gmail-kliens és annak tokenjei érintetlenek.
3. Offline consent és minimális drive.file hozzáférés a rögzített mappához; a Google Picker kiválasztás vagy kliens általi létrehozás önállóan ellenőrizendő.
4. Új OAuth JSON és külön mentési jelszó védett GitHub Secrets-be, tulajdonosi független kulcspéldány igazolásával. Titok nem kerülhet chatbe, repóba, jelentésbe vagy képbe.
5. Valós runner tokenmegújítás/ACL/kvóta, readonly teszt-DB export, teljes izolált SQL-restore, titkosított feltöltés és exact-ID letöltés SHA256-egyezéssel. A letöltött csomagból való SQL-helyreállítás és a teljes platform konfigurációjának reprodukciója ettől külön kapu.
6. Ütemezés: GitHub schedule csak default ágon fut; main módosítása tiltott. Engedélyezett külső indítóhoz hozzáférés, vagy külön tulajdonosi döntés szükséges. Puszta cron-bejegyzés tesztágon nem megoldás. Napi futás és elmaradásfigyelés nincs aktiválva.

A mentés kapcsolója marad tiltva. Teljes helyreállítás, napi automatizálás és tulajdonosi kulcs-visszaolvasás nem PASS. A sikeres helyi szintetikus teszt csak fejlesztési bizonyíték.

---
## Történeti előkészítés (az alábbi állapotok nem új teljesítési igazolások)

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
