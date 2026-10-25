# Sárberki V1 – mentés és iPhone-elfogadás, 2026-10-25

## Mai mentés lezárása
Friss ellenőrzés: 2026-10-25 12:51 UTC (13:51 Europe/Vienna). Nem indult új export.
Snapshot kezdete: 2026-10-25T07:24:26.8379175Z, helyben 08:24.
Run: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/40172605691
Attempt: 1; export commit: 817212439d3ac426ca4ce1b1005015054701e832.
Safety és export-restore job SUCCESS; a külön drive-acceptance job SKIPPED, nem annak tulajdonítjuk a Drive-eredményt.

Pontos GitHub artifact-ID szerinti új letöltések:
- staging: 12590478636; proof: 12590413782.
- Mindkettő nem lejárt; expires_at: 2027-01-23T07:23:48Z (08:23:48 Europe/Vienna).
- Korlátozott ZIP-vizsgálat: kevesebb mint 30 bejegyzés, egyenként 10 MB alatt, összesen 20 MB alatt; abszolút és szülőkönyvtár-útvonal kizárva; CRC PASS. Nem futtattunk csomagolt kódot.
- Staging pontosan sarberki-recovery.zip.gpg és sarberki-recovery.zip.gpg.sha256.
- GITHUB-STAGING.json artifact/run/commit/hash azonosság PASS; artifact API head_branch gmail-test-subject-allowlist.
- github-restore-evidence/ISOLATED-RESTORE.json: full_restore=PASS, verification_completed=true, tables_compared=49, input_mode=exact_id_github_download.
- A GITHUB-STAGING.json korábbi NOT_YET_RUN / NOT_YET_TRANSFERRED_TO_DRIVE mezői a staging létrehozásakor érvényes állapotok. A későbbi SQL-proof és a külön Drive-visszaolvasás bizonyítja a továbblépést; nem írtuk át a régi proofot.

## Drive pontos fájlok és új bájtellenőrzés
Mappa: https://drive.google.com/drive/folders/1EE2ioPs_8OwpnttT9hYHba_Y9_aWwcqz
A friss mappa-ACL és a ciphertext/proof/hash fájlok ACL-je kizárólag valkana6666@gmail.com owner hozzáférést tartalmaz.
A run/attempt/hash fájlnevek és a meglévő átadási nyugta alapján minden mai fájl már jelen volt. Új feltöltés, duplikáció, törlés, felülírás és megosztásmódosítás: 0.

- Ciphertext: https://drive.google.com/file/d/1ZMFd9AKqC3XFGSQ2fdvCetNUQo62tMia/view
- Hash: https://drive.google.com/file/d/17tdzF9Zk55kVNZLBV4nkJwnXG5H3fFga/view
- Proof: https://drive.google.com/file/d/1_bUeaINwTtt0EPrDASqAp5pDPkfBMVY8/view
- Korábbi átadási nyugta: https://drive.google.com/file/d/1YpVSrTAteg_nmaXrEyumN8vD8pQTHQ1s/view

A pontos Drive-ID-val most újra letöltött ciphertext 3365494 bájt.
SHA256: 2318f15062a770c37aadf034bb04a6f421aef0aa42bb40ea4eada105c37ef9f7
A helyi hash tényleges visszatöltött bájtokból számítva PASS, teljes bájtegyezés a most letöltött GitHub staging ciphertexttel PASS.
A Drive proof ZIP teljes bájtegyezése a pontos GitHub proof artifacttal PASS; a Drive hash-fájl is egyezik.
Ez nem csupán szerveroldali checksum-metaadat.

Bizonyítékhatár: a mai GitHub-letöltésből 49 táblás SQL-restore PASS; a mai Drive-visszatöltésből új SQL-restore NEM FUTOTT. A történeti 40125387830 Drive-SQL próba október 24-i csomagra vonatkozik. Titkot nem olvastunk ki és nem fejtettünk vissza.

## Safari – tényleges tulajdonosi iPhone-próba lezárva
Kiadott commit: 75c2469f88589375310334f78b9b85708f38542b.
Javítás: 02a5208b8150c0cecf796aebfd374e0b41f952f3; a kiadási commit azonos forrásfát tartalmaz.
Netlify teszt-site: leafy-chimera-2403e5; deploy 6addf31de3bcf9847d3861d1.
A korábbi kiadásban 1 build / 1 deploy történt; a mostani lezárásban 0.
Build status visszaállítva Stopped; nem aktiváltuk újra.

Tulajdonosi képek és kifejezett szóbeli megerősítés:
- 13:29 IMG_9215–9217: Kijelentkezve, üres és tiltott védett felület.
- 13:30 IMG_9218–9220: vissza/előre után Bejelentkezés szükséges.
- 13:31 IMG_9221 és „Frissítettem” megerősítés: frissítés után belépés szükséges.
- IMG_9226 és tulajdonosi megerősítés: közvetlen megnyitáskor belépést kért; utána a tulajdonos maga nyomta meg a bejelentkezési gombot.
- 13:43 IMG_9236–9237: kézi újrabelépés után tárolt audit visszaolvasható, case 982fc2fa-1e79-478b-8241-2a59f73027b8, revision=3, internally_approved, korábbi jóváhagyó és időpont megmaradt.
Eredmény: az elvégzett iPhone-folyamat PASS. Nem minden Safari/PWA-verzió vagy minden hálózati helyzet bizonyítása. Új Safari-próba nem szükséges ehhez a lezáráshoz.
Korábbi teljes CI: 1908 PASS / 0 FAIL; run 40176463838. Nem ismételtük meg. A jelenlegi dokumentációs változás nem új kódteszt-bizonyíték.

## Külön alacsony prioritású felületi hiba
Az isolated-approval-panel.mjs INVALID_DRAFT hibája után a „Nincs jóváhagyás” kijelentés a helyi felülvizsgálat állapotát összekeveri a tárolt ügy jóváhagyásával.
A képen az audit internally_approved állapotot tartalmaz, miközben a már jóváhagyott tervezet nem tölthető be új pending jóváhagyásra.
Javasolt későbbi megfogalmazás: „A tervezet nem tölthető be új jóváhagyásra. A tárolt állapotot az audit visszaolvasásával ellenőrizheted.”
Állapot: OPEN / LOW; most nincs alkalmazáskód-változás vagy deploy. A mentett jóváhagyás nem törlődött.

## Következő V1-feladat és prioritás
A korábbi elfogadási mátrix, Gmail-eredetjelzés, kreditvédelmi checkpoint és a jelenlegi CI áttekintve. Kész fejlesztést nem indítunk újra.
Kiválasztott következő V1-elfogadási feladat: az új Gmail-eredetjelzés egyetlen, már meglévő szintetikus levél readonly megnyitásán történő készülékes igazolása a már kiadott builden. A kód és negatív tesztbizonyíték kész; hiányzó fizikai bizonyítékot új offline teszttel nem pótolunk. Nincs új levél, küldés, ügyírás vagy deploy. A tulajdonosi telefonos próba külön, rövid következő lépésként előkészítve; ebben az ellenőrzésben nem történt meg.

Fennmaradó helyreállítási/biztonsági kapuk:
1. Tulajdonos külön megőrzött kulcsának független visszaolvasási/feloldási próbája NEM IGAZOLT. Secret név megléte nem bizonyítja a tartalom helyességét; értéket nem olvasunk.
2. DRILL-20261024-DRIVE-ACCEPTANCE ChatGPT-kimenet megtörtént; tényleges telefonos értesítés kézbesítése UNKNOWN. Nem ismételtük és nem küldtünk e-mailt/Pushovert.
3. Teljes GitHub–Netlify–Supabase Auth/konfiguráció/Edge/Storage/Vault helyreállítás NEM IGAZOLT; SQL és Auth táblasorok nem bizonyítanak működő Auth API-bejelentkezést vagy külső titkok pótlását.
4. A korábban képen megjelent dedikált Google backup OAuth-secret visszavonása NEM IGAZOLT. Külön tulajdonosi biztonsági feladat, Gmail- és ChatGPT Drive-csatlakozó érintése nélkül; Branding nem újrakezdendő.
5. Élő Previo olvasás mellékhatásmentességi/szolgáltatói kapuja és a pontos üzleti határértékek megmaradnak. Previo-írás tiltott.

Készültségi munkabecslés: V1 85–90%, teljes önálló foglaláskezelő 30–40%. Nem mért tesztlefedettség: a V1 szabálymag, tervezetek, jogosultságok és az itt lezárt mobilfolyamat működnek; szolgáltatói, üzleti és teljes helyreállítási kapuk maradnak. Az önálló rendszerhez az engedélyezett küldés/foglalás, fizetés és üzemi felügyelet külön megvalósítás és bizonyítás.

Main, más ág, PR #7, éles Netlify, valódi levelezés és Previo-írás változatlan. Nincs 100%-os helyreállíthatósági állítás.
