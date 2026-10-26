# Sárberki V1 – október 26-i Drive-visszaolvasási és helyreállítási audit

Dátum: 2026-10-26 (Europe/Vienna). Kizárólag a `gmail-test-subject-allowlist` tesztág dokumentációja. Nem keletkezett új export, SQL-visszaállítás, éles művelet vagy deploy ebben az auditban.

## Friss, tényleges Drive-fájl-visszaolvasás: PASS

- Eredeti GitHub Actions export: [40287618008](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/40287618008), commit `e4dea749c855490de06fbb876f19d7795ab0f321`; safety és export-restore: SUCCESS; drive-acceptance: SKIPPED.
- GitHub staging artifact: `12634757514` (`sarberki-cloud-stage-40287618008-1`), lejárat 2027-01-24.
- Google Drive teljes staging ZIP: `1-MEy-X7J3Be34aiT_62ue9Zh7v0BZIgW`, fájlnév `sarberki-cloud-stage-40287618008-1.zip`. Google Drive metadata szerint `shared=false`, jogosultságként csak az owner szerepel.
- Az eredeti Google Drive-fájlt a csatlakoztatott Drive-kapcsolat 2026-10-26-án teljes bináris ZIP-ként újra letöltötte; az ellenőrzést a letöltött bájtokon végeztük, nem csak a metadata alapján.
- Teljes ZIP méret: **2 906 436 bájt**.
- Teljes ZIP SHA-256: `2777ebc9a72cd4d8973d27c8824961f39ab9e43521b3db92c0446d278238d22b`, egyezik a GitHub artifact hiteles digestjével.
- A ZIP két szabályos tagja: `sarberki-recovery.zip.gpg` (2 906 024 bájt) és `sarberki-recovery.zip.gpg.sha256` (92 bájt).
- A belső ciphertext ellenőrzőösszeg-fájl tartalma: `5756eb4ae5640a4c3da88dd081a08533b1bd54be7ad64c01d8edc8e11227130b  sarberki-recovery.zip.gpg`; egyezik a korábban rögzített proof adatokkal. A belső ciphertext teljes, külön SHA-256 újraszámítása az audit későbbi ellenőrzési pontja marad, ha nem történt meg.
- A helyi ZIP olvasható és a két fájl listázható; a teljes ZIP-egyezés mindkét belső fájl azonosságát bizonyítja az eredeti GitHub staging ZIP-hez képest.

## Pontosan mit igazol az adatbázis-visszaállítás?

- A fenti október 26-i GitHub `export-restore` SUCCESS, beleértve az izolált SQL-visszaállítást a GitHubról visszatöltött stagingből.
- **Október 26-i Drive-fájlból, külön SQL-visszaállítás: NOT_RUN.** A sikeres SHA-256 egyezés nem ugyanaz, mint egy Drive-fájlból indított SQL restore job.
- Történeti, korábbi snapshotra a független tulajdonosi kulcspróba is sikerült: [run 40269163858](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/40269163858), Drive `1Q2FnZL9O2_Fkq83koM2z-LOi4wTo9VoQ`, 49 összehasonlított tábla, `drive-acceptance=SUCCESS`, `full_restore=PASS`, `verification_completed=true`. Az eredeti 2026-10-24-i snapshot új ellenőrzése; NEM október 26-i SQL-próba.
- A meglévő `scripts/backup-v2-drive-relay.py` történeti alapbeállítás szerint az október 24-i snapshot ciphertext Git-blobjára van rögzítve. A workflow `drive-acceptance` feladata commitüzenet-markerre indul, és október 26-án a friss exportnál SKIPPED volt.
- Ne módosítsunk vagy használjunk feloldókulcsot a chaten; ne indítsunk új exportot pusztán a helyreállítási próba kedvéért. Az október 26-i Drive SQL-próbához a tényleges Drive-bájtok biztonságos, zárt végrehajtókörnyezetbe történő átadása, a meglévő védett kulcs és dátum-/hash-specifikus bizonyíték szükséges. A publikus GitHub-repóba új tartós ciphertext blob létrehozását külön biztonsági döntés nélkül kerüljük.

## Platformhelyreállítási ellenőrzés

A Supabase `sarberki-test` projekt 2026-10-26-i közvetlen, csak olvasási vizsgálata: `ACTIVE_HEALTHY`, PostgreSQL 17.11.0.003; egy aktív Edge Function (`reader-password-reset`, v9); `storage.buckets` 0 rekord, `storage.objects` 0 rekord; `vault.secrets` 0 rekord. A 49 DB tábla összehasonlítása nem bizonyítja a teljes hosted platform visszaállítását.

Nyitott teljes helyreállítási kapuk: Supabase Auth runtime/Site URL/OAuth/SMTP/JWT konfiguráció és éles belépési próba az izolált célon; Edge/Storage/Vault szolgáltatások helyreállítása; Netlify build/deploy konfiguráció és környezeti titkok tulajdonosi újrakonfigurálása; kapcsolatok újraélesztése; végponttól végpontig HTTPS használati próba, tartós újraindítás. Új projekt, költség, főág/production, titkoskulcs, valódi vendég vagy foglalás nem érinthető automatikusan.

## Elfogadás

**Drive bináris sértetlenség: PASS. 2026-10-26 Drive-ból SQL-restore: NOT_RUN. Teljes platformhelyreállítás: NOT VERIFIED.**
