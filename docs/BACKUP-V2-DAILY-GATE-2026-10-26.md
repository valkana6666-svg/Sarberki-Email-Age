# Napi mentés – meglévő automatizálások szigorítása, 2026-10-26

Kiindulási GitHub HEAD: c85dab08180350f2f72565045e6c899991bf58fd. Bécsi idő az ellenőrzés kezdetén 04:23; 08:00/10:00 napi futás még nem esedékes. Nincs indítócommit, export, új workflow vagy új automatizálás.

## Ténylegesen végrehajtott javítás

Kizárólag a két már létező automatizálás prompt mezőjét pontosítottuk:
- GitHub: 6ade64f8a62081919480f38fd633e772, Sárberki napi GitHub-mentés.
- Drive: 6ade63fb740881919c0d30cc8931f890, Sárberki napi Drive-mentés.

Azonosító, enabled állapot, Europe/Vienna időzóna és napi 08:00/10:00 ütemezési karakterlánc megmaradt. Friss automations.peek visszaolvasás a módosított promptok pontos egyezését és az ütemezések változatlanságát igazolta. Mindkét feladat last_run_time és last_run értéke továbbra is null. Ez konfigurációs readback, NEM end-to-end futási PASS.

GitHub-pontosítás: 08:00 előtti tiltás; owner_independent_key_custody_confirmed ellenőrzés; branch-szűrt Actions GET és lapozás; aktív backup és napi duplikáció tiltása; friss HEAD + create_tree/create_commit/update_ref, expected_sha és force=false. A JSON-kapcsoló és workflow változatlan.

Drive-pontosítás: a keresés mellett kötelező mappalista; önálló ciphertext és az azt tartalmazó staging ZIP megkülönböztetése/elfogadása; puszta hashfájl nem mentés; owner-only ACL a feltöltés előtt; pontos artifact-ID és proof eredet/restore-állapot; kötelező teljes Drive-ID bájtvisszaolvasás és helyes hash-szint. A külső artifact ZIP digestje nem a belső .zip.gpg hash-e. Hiányzó bájtellenőrzés nem PASS. Más formátumú duplikátum, felülírás, törlés és megosztásmódosítás tiltva.

A Drive-SQL-restore továbbra is csak konkrét, ténylegesen lefutott és azonos run/hash/fájlhoz kötött bizonyítékkal lehet PASS. Enélkül NOT_RUN; a promptszigorítás nem pótolja és nem indítja el a próbát. Nincs új fizetős szolgáltatás, kulcskiolvasás, OAuth vagy Netlify-művelet.

## Meglévő mentési bizonyíték

A 2026-10-26 hajnali új olvasási ellenőrzés a V1-PROGRESS-2026-10-26.md fájlban: run 40172605691, commit 817212439d3ac426ca4ce1b1005015054701e832, stage artifact 12590478636, proof 12590413782; nem lejárt, lejárat 2027-01-23T07:23:48Z. Korábbi valódi GitHub-download SQL-restore 49 tábla, full_restore=PASS, verification_completed=true. Pontos Drive-ID 1ZMFd9AKqC3XFGSQ2fdvCetNUQo62tMia új visszatöltése 3 365 494 bájt; SHA256=2318f15062a770c37aadf034bb04a6f421aef0aa42bb40ea4eada105c37ef9f7. GitHub ciphertext és Drive-fájl bájtonként egyezett. Új SQL-restore nem futott.

A későbbi zöld safety-only 40229596076 nem új export. A 40125387830 külön Drive SQL-restore október 24-i történeti eredmény, nem a mai napi lánc.

## A helyreállítás még nyitott határa

Titkosított DB és aktuális gitforrás elérhető. Tulajdonosi külön V2-jelmondat megőrzése megerősített, független visszaolvasási próba nem igazolt. A régebbi helyreállítási tervek régi SARBERKI_BACKUP_PASSPHRASE neve a régi archívumokra vonatkozik; a V2-csomaghoz a V2-kulcs szükséges. Kulcsértéket nem olvastunk vagy másoltunk.

Netlify-forráskonfiguráció és helyreállítási eljárás létezik, teljes fiók/context titokhelyreállítás és új HTTPS platformpróba nincs. Az SQL-séma/adat/RLS/grant összehasonlítás nem teljes managed Auth/SMTP/OAuth/JWT/Edge/Storage/Vault szolgáltatáshelyreállítás. Új projekt/host a pontos biztonsági kötéseket nem kerülheti meg. A teljes új platformot nem hoztuk létre vagy aktiváltuk.

Következő bizonyíték: a már meglévő napi feladatok tényleges 08:00 és 10:00 utáni run/attempt/artifact/Drive/hash lánca. Ha nem futnak, nem feltételezünk sikert és nem indítunk párhuzamos ütemezést. Tulajdonosi külön kulcspróba, szolgáltatói helyreállítási hozzáférés és a dedikált régi backup OAuth-secret visszavonási bizonyítéka továbbra is szükséges, titkok chatbe másolása nélkül.

Alkalmazáskód ebben a részfeladatban nem változott; változatlan teljes regressziót nem ismételtünk. Utolsó igazolt alkalmazás-CI: 2158 PASS / 0 FAIL / 0 SKIP, run 40263671745; kapacitás run 40263671823 sikeres. V1 munkabecslés 85%, nem production-engedély és nem 100%-os helyreállíthatóság.
