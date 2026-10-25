# Sárberki Backup V2 – 2026-10-25 napi mentés, felhős átvitel audit

Állapot: **GITHUB EXPORT ÉS VISSZAÁLLÍTÁS PASS; GOOGLE DRIVE KÉZI PÓTLÁS IGAZOLT; AUTOMATIKUS DRIVE ÁTADÁS NEM IGAZOLT.**

Ez a fájl kizárólag bizonyíték- és teendőnyilvántartás. Nem tartalmaz feloldókulcsot, OAuth titkot vagy vendégadatot, és nem engedélyez új mentést, éles írást vagy deployt.

## Azonosítók és eredmények

- Dátum: 2026-10-25, időzóna Europe/Vienna.
- GitHub Actions run: 40172605691, ág: `gmail-test-subject-allowlist`.
- GitHub staging artifact ID: 12590478636 (`sarberki-cloud-stage-40172605691-1`).
- GitHub proof artifact ID: 12590413782.
- GitHub archívum SHA-256: `dc6ae5198c8d9b437fc0a1dd9b625b55b3bbe21abd0dd645395828f967ebedfe`.
- Archívum mérete: 3 365 906 bájt; benne `sarberki-recovery.zip.gpg` és `sarberki-recovery.zip.gpg.sha256`.
- GitHub Actions `export-restore`: SUCCESS; 49 SQL-tábla összehasonlítva, elkülönített teljes SQL-restore PASS (a GitHub archívumból).
- GitHub Actions `drive-acceptance`: SKIPPED; `github-bridge` módban a Drive transzferlépések kimaradtak.
- A 2026-10-25-i automatikus átvitelből eredően a Drive mappában `sarberki-40172605691-1-2318f15062a770c3.zip.gpg.sha256` látható, de az azonos nevű önálló `.zip.gpg` állományt a keresés nem mutatta.
- Külön, a jelen beszélgetésben végrehajtott **kézi felhős pótlás**: a teljes GitHub staging ZIP archívum feltöltése a meglévő Drive mentési mappába.
- Drive file ID: `1ZW4Cec2LekVksRCjGbowI6BeEQFcB5TN`.
- Drive fájlnév: `sarberki-cloud-stage-40172605691-1.zip`.
- Drive folder ID: `1EE2ioPs_8OwpnttT9hYHba_Y9_aWwcqz`.
- Drive metaadat-ellenőrzés: 3 365 906 bájt; `shared=false`, csak tulajdonosi jogosultság listázva.
- Drive-ról a ZIP bájtjai külön visszaolvashatók voltak; a visszatöltött archívum helyben SHA-256 egyezéssel és `zipfile.testzip()` ellenőrzéssel PASS.
- **FIGYELEM:** a GitHub Actions belső SQL-visszaállítása nem egyenlő a kézzel feltöltött Drive fájlból végrehajtott önálló SQL-restore teszttel.

## Külön lezárandó elfogadási kapuk

1. Igazolni, hogy az automatikus GitHub → Drive átadás ütemezetten, kézi jelenlét nélkül továbbítja **magát a teljes titkosított archívumot**, nem csak az ellenőrzőösszeget.
2. Automatikus pontos Drive-file-ID visszaolvasás + teljes SHA-256 összehasonlítás, majd elkülönített SQL-visszaállítás a tényleges Drive-bájtokból.
3. A tulajdonos saját kulcsmegőrzésével független feloldási és helyreállítási próba (kulcsot tilos dokumentációba vagy chatbe másolni).
4. Teljes platform-helyreállítási terv (Supabase Auth/Edge/Storage/Vault, Netlify konfiguráció és környezeti változók) külön elfogadási bizonyítékkal.
5. Sikertelen mentés/átadás és sikeres futás értesítési kézbesítésének igazolása.
6. A dedikált korábbi backup OAuth-kliens esetlegesen kitett titkának tulajdonosi visszavonása, ha még nem történt meg.

## Biztonságos következő végrehajtási lépés

A meglévő backup-workflow és a `github-bridge` relay implementációjának feltárása után olyan felhős folyamat szükséges, amely minden nap **titkosított artifactot** másol Drive-ra, majd pontosan azt visszaolvassa és ellenőrzi. Új OAuth köröket, helyi Windows-függőséget, GitHub-szekret publikálást, automatikus vendéglevél-küldést és Netlify-deployt nem szabad indítani. A GitHub staging artifact 2027-01-23-ig jelzett elérhetősége nem hosszú távú backup-garancia.
