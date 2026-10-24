# Az utolsó öt mentési elfogadási feladat – 2026-10-24

| Feladat | Minősítés | Bizonyíték és pontos akadály |
|---|---|---|
| 1. Tényleges Drive-letöltésből teljes SQL-restore | PASS | Run 40125387830, commit e1161695b083ba3a38d2002c81c3958dd35af037, artifact 12573715153. 49 tábla/COPY-adat, teljes táblakészlet, szekvencia, role attribútum, case-manifest, RLS/CAS/audit rollback és verification_completed=true. Forráskapcsolat NEVER_OPENED; új export nem futott. |
| 2. Időzített új mentés, automatikus Drive-átadás, hibaértesítés kézbesítése | BLOCKED | Vezérlő engedélyezve; első új, időzített end-to-end futás még nincs. Október 24-én már volt kérés, napi duplikátum nem indítható. A következő napi jogosult indítás Europe/Vienna szerint október 25-én 08:00 után lehetséges; az óraátállást az IANA-zóna kezeli. Egyszeri DRILL-20261024-DRIVE-ACCEPTANCE szintetikus ChatGPT-értesítés kért; unknown delivery nem PASS. |
| 3. Független tulajdonosi kulcspéldány visszaolvasása | BLOCKED | Külön megőrzés tulajdonosi állítása megvan, de ez nem decrypt-bizonyíték. Elkészült a csak külön owner-recovery secretet használó próbamód, rendes V2-kulcsra visszaesés nélkül. A tulajdonosnak a külön megőrzött meglévő jelszót kell a SARBERKI_BACKUP_V2_OWNER_RECOVERY_PASSPHRASE secretbe beadnia. |
| 4. Teljes platformhelyreállítás | BLOCKED | Friss readonly Supabase-leltár: 0 Storage-bucket/objektum, 0 Vault-titok, aktív reader-password-reset v9 verify_jwt=true. A teljes SQL/role/extension helyreállítás PASS. Netlify újra loginoldalt mutat; Auth/provider/SMTP/JWT, site/team/context titkok, gateway/Edge és új izolált HTTPS teljes helyreállítása nincs bizonyítva. |
| 5. Korábbi dedikált Google backup client secret | BLOCKED | Jelenlegi státusz adminhozzáférés nélkül nem olvasható. Nincs ismételt OAuth/Branding kör vagy automatikus visszavonás. Pontos, projekthez/klienshez kötött tulajdonosi Disable-eljárás elkészült. Új bridge nem használja a titkot; Gmail-kliens változatlan. |

## Bizonyítékok

- Mentési snapshot: 40124286342; tényleges Drive-fájl: https://drive.google.com/file/d/1Q2FnZL9O2_Fkq83koM2z-LOi4wTo9VoQ/view
- SHA256: 3ea25b89805a62f8bfe0956398b5e65f9b54d36e09cba939f5074d0ab42870f8
- Drive-SQL-próba: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/40125387830
- Nem titkos SQL-proof tartós Drive-példánya: https://drive.google.com/file/d/1IAI9SI_cW4fY9gptMFEKMTXbbcJt-hoc/view
- Proof GitHub-lejárata: 2027-01-22T19:27:37Z. Az eredeti snapshot artifactja: 2027-01-22T19:13:11Z.
- BACKUP-V2-DRIVE-SQL-PROOF-2026-10-24.md: géppel olvasható teljes, titokmentes SQL-bizonyíték.
- BACKUP-V2-PLATFORM-INVENTORY-2026-10-24.md: friss platformleltár és hozzáférési határok.
- BACKUP-V2-OWNER-RECOVERY-2026-10-24.md: pontos tulajdonosi eljárások.

## Elfogadási határ

Az öt feladatból egy lezárt PASS; négyben vannak külső vagy jövőbeli futási bizonyítékot igénylő kapuk. Ez nem a teljes mentési projekt 20%-os készültsége, mert a korábbi export/titkosítás/átadás/GitHub-restore szakaszok már külön PASS eredményűek. Súlyozott teljes készültségi százalékot nem találunk ki. 100% nem állítható.

A tényleges Drive-letöltés titkosított bájtjait a Work pontos Git-blob objektumként továbbította az izolált runnernek. A runner fix blobazonosságot, teljes SHA256-t, méretet, snapshot-eredetet és ZIP-határt ellenőrzött. A titkosított csomag nem lett repo-fájlba commitolva; kulcs/nyílt SQL nem került átadásra vagy naplóba. A csomagban lévő kódot nem futtattuk.

## V1-re visszatérés

A korábbi alkalmazás-CI 40124649923 teszthibákat mutatott. Az első azonosított ok a lejárt október 23-i szintetikus tartózkodási fixture valós órával, a másik a Gmail VM-harnessből hiányzó AbortController/setTimeout/clearTimeout. A tesztórák kizárólag tesztfájlban rögzítettek, az alkalmazáskód és biztonsági kapuk nem változtak. Célzott helyi eredmény: 55 PASS, 0 FAIL, 0 SKIP. A teljes helyi npm-regresszió: 1903 PASS, 0 FAIL, 0 SKIP (52,6 másodperc). Az új commit CI-je külön ellenőrzendő. A Pushover-státusztesztben a hiányzó window tesztobjektum is pótolva; tényleges küldés nincs.
