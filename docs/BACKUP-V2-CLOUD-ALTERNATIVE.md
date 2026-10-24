# Teljesen felhős alternatíva – 2026-10-24

## Választott út és igazolásának határa

GitHub Actions readonly teszt-DB export → meglévő titkosítás és izolált SQL-restore → a teljes csomag AES256 GPG-burkolata → egyedi GitHub staging artifact → pontos artifact-ID letöltése, hash/eredet/tényleges lejárat ellenőrzése → külön SQL-restore a letöltött bemenetből → a csatlakoztatott Drive eszközzel külön felhős átvitel → pontos Drive-ID letöltése és SHA256-egyezés.

A felhős Work-automatizmus a GitHub és a Drive már engedélyezett csatlakozóit használhatja. A runner nem kapja meg a csatlakozó tokenjét. Az elakadt saját Google OAuth-kliens nem függősége ennek az útnak. Google OAuth-titkot nem használunk, nem másolunk és nem kérünk. A kiszivárgott backup kliens titkának visszavonása/cseréje továbbra is külön biztonsági feladat; a Gmail-kliens érintetlen.

A Supabase-tesztprojekt `mojnqizbcaczstguikpv` ACTIVE_HEALTHY, PostgreSQL 17.11. Az export hozzáférése readonly marad. Supabase Storage ugyanahhoz a szolgáltatói fiókhoz kötné a mentést és külön runner-íróhitelesítést igényelne. Új fizetős tárolót nem rendeltünk.

## Valóban elvégzett felhős átadás

A GitHub `39478336014` futás `12290960278` artifactját töltöttük le, majd új fájlként megőriztük a meglévő privát Drive-mappában. Forrás: október 20-i részleges, korábbi helyreállítási csomag; nem új export, és nem új kulcs-visszaállítási próba.

- Drive-ID: `1tDlk62kE1fpcGOsdRtUVtAeH0jYJDX9K`
- Link: https://drive.google.com/file/d/1tDlk62kE1fpcGOsdRtUVtAeH0jYJDX9K/view?usp=drivesdk
- Méret: 11 209 788 bájt.
- SHA256: `93c5deb5f5e8cc73b33c0b6cf756f33a0f7d0af96ca9decbaca670cbbb1778c8`.
- Pontos Drive-ID szerinti tényleges visszatöltés és hash-egyezés: PASS.
- ZIP CRC: PASS.
- Metaadat-visszaolvasás: a kijelölt mappa, egyetlen tulajdonosi jogosultság; nyilvános megosztás nincs.
- A benne lévő adatbázis dump/roles/manifest GPG-titkosított. A külső ZIP és a nyilvános projektforrás/leltár nem teljes egészében titkosított; ezt a régi archívumot változatlanul őriztük meg.
- Új feloldás és SQL-restore ebből a Drive-példányból: NEM IGAZOLT. A korábbi hibás jelszópróbát nem ismételtük meg.

## Új fejlesztés

A `[backup-v2-cloud-bridge-run]` jelölés az engedélyezett tesztágon a Google OAuth nélküli `github-bridge` tárolási útvonalat választja. Az exporthoz továbbra is kell `SARBERKI_V2_ENABLED=yes` és az új `SARBERKI_BACKUP_V2_PASSPHRASE`. A meglévő DB-secretet használja, a régi mentési jelszóra nincs visszaesés.

A staging feltöltés 90 napot kér, nem ír felül korábbi artifactot. A visszaolvasás az upload-artifact által visszaadott ID-t használja. A metaadat-ellenőrzés megköveteli a megfelelő repo/ág/run/commit azonosságot, a nem lejárt állapotot és legalább 80 nap tényleges hátralévő megőrzést. A helyreállítás nem fogad tetszőleges bemeneti könyvtárat vagy forrás-DB hitelesítőt. A proof artifact csak a távoli SQL-restore sikeres befejezése után készülhet el.

GitHub staging nem független tartós tároló. A Drive-átadás külön kapu. A nyilvános repó artifactjai olvasói jogosultsággal letölthetők: az érzékeny tartalomnak már feltöltés előtt titkosítottnak kell lennie. Az új github-bridge út feltöltés előtt a teljes ZIP-et AES256 GPG-burkolatba zárja, friss kulcstárral visszafejtve ellenőrzi, és csak a `.zip.gpg` fájlt és hash-ét tölti fel. A letöltött burkolatot tmpfs-ben oldja fel a csomagellenőrzéshez. A korábbi Drive-példány történeti formátuma ettől nem változik.

## Napi indítás és hibafigyelés

A main nem változik. A natív GitHub schedule nem oldja meg a tesztág indítását. Az alternatív indító a felhős Work-automatizmus: a csatlakoztatott GitHub eszközzel egy dátumozott kérésfájl és jelöléssel ellátott commit készülhet, az aktuális HEAD-re építve, force nélkül. Egy napon legfeljebb egy kérés, aktív futás mellett nincs új indítás. Az óránkénti ellenőrzés átadhatja a már kész csomagokat és jelezheti a hibát vagy 26 óránál régebbi teljes mentést. Ez agent-alapú felhős vezérlés, szolgáltatói hozzáférésre és a Work futtatási keretére támaszkodik; nem garantált, önálló infrastruktúra-szintű scheduler.

A `BACKUP-V2-CLOUD-CONTROL.md` JSON-tartalmú kapcsoló alapértelmezése tiltott. Az indítás csak az új secret biztonságos beállítása és a tulajdonosi kulcsmegőrzés igazolása után engedélyezhető. Az automatizmus konfigurálása nem bizonyít napi mentést: az első valóban időzített teljes futás és a Drive-átadás PASS szükséges. Az óránkénti hibafigyelés legfeljebb közel egyórás felismerési késéssel járhat; értesítéskézbesítés nincs még próbával igazolva.

## Igazolt elfogadási állapot – 2026-10-24 21:16 Europe/Vienna

Részletes gépi bizonyíték: `BACKUP-V2-ACCEPTANCE-2026-10-24.json`.

- Commit: `1e17a56b50fe8ef8ca0aab3119dda8f66581e2f9`; run: `40124286342`, attempt 1.
- Safety: 56 PASS, 0 FAIL, 0 SKIPPED, tényleges GPG-próbával.
- Csak olvasható friss tesztprojekt-export: PASS; forrásmanifest változatlan.
- Teljes AES256 GPG-burkolat és visszafejtés: PASS.
- Teljes első SQL-restore és a pontos GitHub artifact-ID letöltéséből végzett második SQL-restore: PASS; mindkettőnél 49 tábla, verification_completed=true.
- Staging artifact `12571839611`; proof `12572595315`; tényleges lejárat `2027-01-22T19:13:11Z`.
- Drive-fájl: https://drive.google.com/file/d/1Q2FnZL9O2_Fkq83koM2z-LOi4wTo9VoQ/view
- A pontos Drive-ID szerinti tényleges visszatöltés SHA256-ja: `3ea25b89805a62f8bfe0956398b5e65f9b54d36e09cba939f5074d0ab42870f8` (3 315 880 bájt), PASS.
- Drive-mappa és új fájlok ACL-je: kizárólag a tulajdonos; régi fájlt nem töröltünk és nem írtunk felül.
- A V2 titkos jelszó formátuma igazolt, értékét nem olvastuk ki. Tulajdonos külön megőrzést megerősített; független kulcs-visszaolvasási próba még nincs.
- A runner-kapu `SARBERKI_V2_ENABLED=yes`; a vezérlő JSON engedélyezve. A napi indításnak az első tényleges időzített futás után lesz bizonyítéka.

A futásban javított hibák: Git telepítése checkout elé; pontos konténer-munkamappa Git-bizalma; egyetlen artifact-ID fájljainak közvetlen letöltési könyvtára; kizárólag az izolált próba által létrehozott szerepkörök és szerverparaméter-jogosultságaik takarítása a külön restore-próbák között.

## Fennmaradó kapuk

1. A ténylegesen Drive-ról visszatöltött bájtokból új SQL-restore még NEM FUTOTT. A GitHub-visszatöltés SQL-próbája és a Drive bájtszintű hash-egyezése külön bizonyíték. A Work futtató nem kapja meg a runner jelszavát, a runner nem kapja meg a Drive-csatlakozó hitelesítőjét; támogatott biztonságos bemenetátadás szükséges a külön próbához.
2. Első időzített teljes futás, hibaértesítés kézbesítése és tulajdonosi független kulcs-visszaolvasás még NEM IGAZOLT.
3. GitHub-, Netlify-, Auth/Edge/Storage/Vault teljes platform-helyreállítás hiányai megmaradnak, a csomag RECOVERY-GAPS.json fájljában tételesen.
4. A korábban képen megjelent, dedikált Google backup client secretet a tulajdonosnak vissza kell vonnia/cserélnie. Az új mentési út nem használja; Gmail-klienshez nem nyúltunk.
5. Megőrzés: GitHub 90 nap igazolt; Drive-példányokat nem törlünk, kvótától függnek. Korlátlan tárhely vagy teljes rendszerhelyreállítás nincs igazolva. Készültség nem 100%.

## Hivatalos források

- https://docs.github.com/en/actions/tutorials/store-and-share-data
- https://github.com/actions/download-artifact
- https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts
- https://supabase.com/docs/guides/platform/backups
- https://developers.google.com/workspace/drive/api/guides/handle-errors
