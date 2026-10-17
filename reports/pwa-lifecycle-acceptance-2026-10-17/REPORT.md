# Sárberki V1 – PWA-visszatérés, elfogadási és helyreállítási felkészültség

## Legutóbbi kiegészítés – szimulált kapcsolatvesztés

A felhasználó folytatási kérése után az új `20d0d19e08a363be164eb2b29cf8a33221f36930` tesztcommit csak a mobil-bizonyító scriptet bővítette; az alkalmazáskód az alább leírt `76874a6` változattal azonos.

- [Végleges CI 39034873883](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39034873883), job `117402559047`: **1796 PASS / 0 FAIL / 0 SKIP**, exact deployed SHA = `20d0d19e08a363be164eb2b29cf8a33221f36930`.
- [Végleges mobilrun 39034873884](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39034873884), job `117402558859`: Reader 12/12 + Writer/approver 22/22 = **34 PASS / 0 FAIL**. Két új eset motoronként: kapcsolat nélküli Writer-visszatérés lezárja a hozzáférést, majd explicit restore nem ment levelet; kapcsolat nélküli approval-load törli a régi tervezetet, és explicit újrabetöltés nem állítja vissza a megerősítést vagy játssza újra az approval POST-ot.
- A hálózathiba helyi route-abort, nem valódi iPhone repülő üzemmód vagy lassú hálózat mérése. Hosszú válaszidő, több lap közös sütiforgatása és tényleges iOS hálózatváltás továbbra is eszközös hatókör.
- A korábbi 30/30 és 76874a6 alábbi eredménye történeti, sikeres előzmény; a végső állapotot ez a kiegészítés pontosítja. Készültség továbbra 93%, a valós iPhone/PWA kapu nyitott.


2026-10-17. Kizárólag `gmail-test-subject-allowlist`; Codex közvetlen fejlesztés/ellenőrzés, párhuzamos agent nélkül. Kiindulás `f2766ec19857ee2dc52e0cdeef6116c22650b783`; az előző igazolt alkalmazáskód `0f09633fc4cc23aa0cf91b667508a46f09d5ac23`, 1789/0/0.

## Elkészült fejlesztés

A kezelőoldal pagehide esetén eddig csak a levelezési staginget törölte, a felhős session/előnézet maradhatott. A külön jóváhagyó oldal ugyan törölt, de bfcache-visszatérésre nem végzett automatikus újraellenőrzést. A háttérben befejeződő korábbi Auth-válasz és az új foreground-kérés további elavult állapotot vagy párhuzamos cookie-forgatást okozhatott.

- A Reader/Writer kezelő és a külön jóváhagyó háttérbe kerüléskor lezárja a felhős nézetet és törli a régi megerősítést/jelszómezőt.
- Visszatéréskor normál szerveres session-ellenőrzés történik; késői régi login/restore válasz nem aktiválja újra a lezárt nézetet.
- Az approval-oldal meglévő session-helperének epoch- és restore-coalescing mechanizmusát használjuk; érvénytelenített korábbi restore után legfeljebb egy új ellenőrzés történik.
- A fő kezelő ugyanabba a helyi sorba teszi a cookie-s ügykéréseket és az Auth-kéréseket. Várakozás közben elavult session/nézet művelete nem indul el. Ez egyetlen böngészőpéldány kéréssora, nem több Safari/PWA lap vagy szerverpéldány globális lockja.
- A lejárt helyi session nem ad új CSRF-tokent és lezárja a felhős hozzáférést. A szerver továbbra is minden műveletnél ellenőrzi az Auth- és DB-jogokat.
- Nem készül új jogosultsági/üzleti rendszer, háttérpolling, automatikus jóváhagyás vagy hálózati írásismétlés.

Érintett megvalósítás: `operator-login-ui.mjs`, `cloud-approval-session.mjs`. Új/érintett regresszió: `tests/operator-login-ui.test.mjs`, `tests/cloud-approval-lifecycle.test.mjs`, `scripts/operator-write-approval-mobile-proof.mjs`.

## Igazolt eredmények

Utolsó ellenőrzött kód: **`76874a6f991c2c273215946cecc1542bd38b26ad`**.

| Ellenőrzés | Eredmény |
| --- | --- |
| Célzott lifecycle/role/Gmail-PostgreSQL regresszió | 42 PASS / 0 FAIL / 0 SKIP; átfed a teljes CI-vel |
| [Teljes CI 39034507721](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39034507721), job 117401513480 | **1796 PASS / 0 FAIL / 0 SKIP** |
| Pontos Netlify build | DEPLOY SYNC PASS; expected = deployed = fenti teljes SHA |
| Telepített manifest/ikon/MIME/no-store; session/ügytár kapuk; MNB/árreferencia | SUCCESS; nincs Previo-hívás |
| [Mobil 39034507728](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39034507728), job 117401513537 | Reader 12/12 és Writer/approver 18/18, összesen **30 PASS / 0 FAIL** |
| Capacity regresszió 39034507718, Gmail manual check 39034507758, offline Windows copy | SUCCESS; átfedő tesztek nem összegezendők |
| Fizikai iPhone, telepített PWA, iOS háttérfolyamat, Safari/PWA sütimegosztás | **NEM IGAZOLT** |

A két új böngészős eset motoronként szimulált pagehide/pageshow eseménnyel igazolja a Writer-hozzáférés törlését és az approval-megerősítés érvénytelenítését, majd a GET session-restore-t. Nincs automatikus save/approve POST. A Chromium/WebKit 390×844 környezet kontrollált, teljesen szintetikus API/Auth válaszokat kap; ez nem fizikai Safari- vagy új élő Auth-bizonyíték.

A helyi első új cloud-lifecycle harness két assertionje hibázott, mert a valódi panel nem a fixture dokumentumát kapta. A tesztharness javítása után a valódi panelreset is lefut; a végleges CI hibamentes. A további sorosítás miatt három tesztet a kérés tényleges aszinkron indulására kellett várakoztatni. A biztonsági követelményeket nem lazítottuk.

## V1 elfogadási tesztek

[Összevont elfogadási mátrix](../../docs/V1-ACCEPTANCE-MATRIX-2026-10-17.md): HU/DE/EN/SI adat-/nyelvmegőrzés; szerepek/tenant/CAS/audit; bizonytalan ár/kapacitás; szolgáltatási és szállásjóváhagyás elkülönítése; hiányos/ellentmondó ügyek. A régi sikeres élő Gmail-, fordítás- és SQL-restore próbát nem indítottuk újra. A kliensmódosítás miatt célzottan újrafutott a meglévő szintetikus Gmail→cookie→PostgreSQL→Reader→külön approver→audit E2E, sikeresen. Az üzleti döntési kód nem változott; az új CI a meglévő többnyelvű/biztonsági regressziókat is futtatta.

Nem állítjuk a teljes nyitott üzleti mátrix lezárását: az egymásba érő 3/8 éves gyermekárhatár, a még nem jóváhagyott 2027-es ár és a teljes 729/730/731 napos, hiteles előzményre épülő törzsvendég-automatizálás nem található ki. Bizonyítatlan ár/kapacitás mellett nincs végleges jóváhagyás.

## Külső konfiguráció és tartós bizonyíték

Elkészült a [friss helyreállítási leltár](../../docs/EXTERNAL-RECOVERY-READINESS-2026-10-17.md), forráskód szerinti változónevekkel, scope-/host-/projektkötésekkel, tulajdonosi hozzáférési és titoktárbeli hiányokkal. A Google/Netlify/Supabase hivatalos leírásait olvasva ellenőriztük. Ez nem tényleges adminexport; titkos értéket nem kértünk és nem jelenítettünk meg, beállítást nem módosítottunk. Új host/projekt nem köthető be pusztán env-átírással, mert több meglévő biztonsági kapu pontos célazonosságot vár.

A 39031412013 restore-run **teljes eredeti** három JSON-ját tartalmazó GitHub ZIP külön megőrizve és visszaolvasva. Név: `Sarberki-V1-helyreallitasi-bizonyitek-2026-10-17.zip`; 4538 bájt; SHA256 `dfd71f13ec6654be28808e26825fa33aa7bb0fd433c31275ddba41656ebbb50b`. ZIP CRC, a három pontos belső fájlnév és sikerjelző, majd a külön mentett példány teljes SHA256-egyezése PASS. A helyi példányok 0600 jogosultságúak; nincs megosztás. Ez bizonyítékcsomag, nem új SQL-mentés.

A GitHub-példány tényleges metadata szerint még nem lejárt; lejárata 2026-10-24 **14:10:22 Budapest**. A külön megőrzés már megtörtént, nem szükséges megvárni a lejáratot vagy újrafuttatni a restore-t. A korábbi 120253 bájtos titkosított DB-csomag változatlanul külön megőrzött és visszaolvasott. Korlátlan tárolási garanciát, tulajdonosi pendrive-másolatot vagy jelszókezelőbeli jelmondat-hozzáférést nem állítunk igazoltnak.

## Készültség és elengedhetetlen következő lépés

V1 **kb. 93%**, változatlan mérnöki becslés. A mai javítás valós session/lifecycle kockázatot kezel és bővíti az automatizált lefedettséget, de a fizikai készülék és a szolgáltatói/üzleti kapuk ettől nem zárulnak le; a tesztszámból nem emelünk készültségi százalékot.

A következő tényleges elfogadási lépés a tulajdonos iPhone-ján Safari → főképernyős indítás → meglévő Reader tesztbelépés → ügylista/előnézet → háttér/visszatérés. [Háromperces, minimális kézi útmutató](../../docs/IPHONE-PWA-ACCEPTANCE-2026-10-17.md). E munkakörnyezet nem vezérli a felhasználó telefonját; ez a bizonyíték nem automatizálható innen. A teljes Writer/approver és Safari/PWA külön sütik vizsgálatának további készülékes pontjai ott külön szerepelnek.

További kapuk: külső admin/MFA/redirect/provider konfiguráció tényleges védett megőrzése; hiteles ház-/dézsaforrás; okt. 19–20. után Previo teszthozzáférés és olvasási mellékhatásmentesség igazolása; bizonytalan üzleti határértékek tulajdonosi tisztázása. Aktív hátralévő becslés kb. 9–18 óra, várakozás és újonnan feltárt hibák nélkül.

Production/main, valódi vendégadat, éles e-mail/Pushover, Previo-hívás/írás, valódi foglalás és jogosultságmegkerülés nem történt. V2/V3: meglévő közös mag, Auth/tenant/RLS/CAS/audit és külön read/write/approve változatlan; a helyi sor nem jelent új műveleti jogosultságot.
