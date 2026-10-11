# Sárberki helyreállítás – 2026. október 11.

**Döntés: a teljes rendszer biztonságos helyreállítása még nem igazolt.** A korábbi adatbázis- és elkülönített runtime-bizonyíték érvényes; a hiányzó külső konfigurációkat és a valódi laptopadatokat ez a csomag nem helyettesíti.

## Bizonyíték és hatókör

- Korábban igazolt: 43 adatbázistábla, 910 sikeres teszt, RLS/CAS, GPG-adatmentés hordozhatósága. Nem ismételtük meg.
- `RUNTIME-CHAIN.json`: 38134400747 futás; elkülönített Auth/API/SQL lánc, jogosultságok, deduplikáció, ügy és tervezet megmaradása Auth/REST újraindítás után.
- `BROWSER-CHECKS.json`: 38135068778 futás, c166eac565092051fc270e6fb981a0b4b119b58d. Valódi Chromium, szintetikus Google API és üzleti adatok; minden külső hívás blokkolva vagy helyettesítve. Az egész futás **sikertelen**, ezért nem tekinthető teljes jóváhagyási lánc-bizonyítéknak. A JSON-ban korábban PASS-ként rögzített ellenőrzések külön sikeresek.
- `NEW-CHECKS.json`: kizárólag a még nem futott Previo-szakasz helyi, szintetikus ellenőrzése, `SARBERKI_RECOVERY_STAGE=previo-only`. Chromium/Gmail/UI korábbi sikeres lépések nem ismétlődtek.
- Production/main nem módosult. A forrás Supabase projekten csak állapot- és katalógusolvasás történt, írás nem. E-mail és valódi foglalás nem készült, levelet nem módosítottunk.

## Gmail

A kapcsolt tesztfiók profilja és üzenetazonosító-listája GET művelettel olvasható. Üzenettörzset nem olvastunk a valódi fiókból. A kapcsolt eszköz saját OAuth-hitelesítése különbözik a webalkalmazásétól: ez nem bizonyítja az alkalmazás Google Cloud-konfigurációjának visszaállíthatóságát.

A mentett kliens csak `gmail.readonly` scope-ot kér, `include_granted_scopes=false`, a kijelölt tesztfiókra ellenőrzi a profilt, és GET műveletekkel olvas. A token memóriában marad, nem kerül a localStorage-ba vagy mentésbe. Új böngészőmunkamenetben új OAuth szükséges. A szintetikus tesztben hibás fiók és 401 válasz esetén nem indult üzenetolvasás. Refresh token nincs a helyi exportban. A token lejáratakor nincs külön azonnali memóriatörlés; a 401 az olvasást megállítja. Teljes OAuth-visszaállítás csak az eredeti Cloud-projekt hozzáférésével vagy megfelelő új klienssel igazolható.

A bejelentkezett oldal értesítési figyelőt is indíthat. A mostani ellenőrzés ezt külső hívásra nem engedte; élő automatizmust helyreállításkor sem szabad aktiválni az átvételig.

## Kezelőfelület

Szintetikus érdeklődésből értelmezett dátumok/létszám, ügy és tervezet létrejött. Ügy és tervezet böngészőújraindításkor megmaradt. A helyi ügytár titkosított exportja ellenőrizhető, és üres, más originű böngészőkörnyezetbe visszaállítható.

**Hiány:** a belső jóváhagyás gomb a felületen jóváhagyott állapotot mutat, de a mentett ügyben az állapot `pending`, és a jóváhagyási esemény nem került tartós auditba. A felülethez nincs bekötött hitelesített kezelői jóváhagyási út. A szerveres engedélyvizsgálat korábban igazolt, de ez nem egyenlő a teljes végrehajtott jóváhagyással. Az API csak ingest/draft műveletet enged; a forrás SQL `sc_write_case` jóváhagyási útja kifejezetten tiltott. Ezt nem oldottuk fel és az eredeti adatbázist nem módosítottuk.

Az ismeretlen kapacitás UI státuszára vonatkozó utolsó böngészőassertion nem teljesült; ez a rész nem igazolt. A megelőző helyi export és újraindítás sikeres. A teljes jóváhagyási munkafolyamat befejezéséhez külön megvalósítás és elkülönített szerver/UI-vizsgálat kell.

## Previo

Élő Previo-t nem hívtunk: a keresési POST kérések mellékhatás-mentességéhez nincs új, külső igazolás. Szintetikus HTTP-válaszokkal a tényleges visszaállított Previo-parser és adapter működött: 2 szabad egység AVAILABLE, 0 UNAVAILABLE, hiányzó kapacitás UNKNOWN és `availableUnits=null`. Az adapter foglaláslétrehozást/módosítást/törlést nem enged.

A szintetikus adapter-bizonyíték időbélyegét 1 másodperccel múltba állítottuk, hogy a rögzített ellenőrzési időhöz tartozzon. A jelenlegi adapter alapértelmezett `now` értéke a hálózati válasz előtt készül; a későbbi friss időbélyeg ezért UNKNOWN eredményt is okozhat. Ez nem téves szabad kapacitást ad, de élő használat előtt külön javítás/vizsgálat szükséges. Vendégajánlat csak friss, egyértelmű és megfelelő típusra/dátumra érvényes AVAILABLE bizonyíték alapján engedhető.

## Pontos hiányleltár

| Elem | Mentésben / igazolt | Még szükséges |
|---|---|---|
| Adatbázis | Három GPG-titkosított payload; 43 tábla korábbi visszaállítása | Új forrásmentés nem készült; az október 11-i snapshot utáni változásokat ez nem tartalmazza |
| Laptop böngészős helyi ügytára | Export/import program és szintetikus titkosított körteszt | Az eredeti laptop megfelelő böngészőprofiljának tényleges titkosított exportja; külön jelmondat |
| Supabase Auth/API | SQL/Auth séma és elkülönített szolgáltatáslánc | Dashboard Site URL és redirect-lista; signup/provider/MFA/SMTP beállítások; API exposure; JWT/aláírókulcs visszaállítási vagy rotációs terv; jogosult projekt-hozzáférés |
| Supabase kiegészítők | Forrás katalógusolvasás: 0 Storage bucket/object, 0 Vault secret; RLS az öt sc_* táblán; Auth séma 82 migráció; reader-password-reset Edge Function v9 | Edge runtime környezeti titkok értéke nem exportált; platformkonfiguráció olvasási/export hozzáférése |
| Gmail OAuth | Klienskód, publikus client ID a forrásban; readonly szerződés; tesztfiók elérhető | Google Cloud-projekt/consent app, publikálási státusz és tesztfelhasználók, authorized JavaScript origins és redirectek leltára; tulajdonosi hozzáférés; új gépen új hozzájárulás |
| Netlify teszt | netlify.toml, függvények és forrás; health/build-info c166eac commitot jelez, exportoldal HTTP 200; booking-cases korábbi GET 503 – zárt kapu | Site/team azonosító és hozzáférés, context-specifikus env-lista és biztonságosan külön tárolt értékek, build/repo/domain konfiguráció, letiltott automatizmusok ellenőrzése |
| GitHub | Workflow-források és futásazonosítók; kizárólag tesztág | Repo/environment változók és védett secret-nevek/hatókörök leltára, külön titokértékek és fiók-helyreállítás/MFA; az Actions 7 napos artifactjai helyett a csomag őrzi a JSON-bizonyítékot |
| Previo | Típusmapping, parser, adapter és szintetikus HTTP-teszt | Jóváhagyott élő, mellékhatásmentes ellenőrzési lehetőség; aktuális mapping és időbélyegkezelés igazolása |
| GPG-hozzáférés | Korábbi elkülönített visszaállítás a védett titokkal sikeres | Ugyanazon jelmondat külön, felhasználó által hozzáférhető biztonságos példánya; fiókvesztés esetére is elérhető |
| Teljes csomag titkosítása | Az adatbázis-payloadok GPG-titkosítottak; a helyi export külön titkosított | A külső ZIP önmagában nem titkosított. A teljes csomag titkosításához külön hozzáférhető kulcs/jelmondat és azzal végzett független readback kell |
| Kezelői jóváhagyás | Jogosultság-ellenőrzés külön runtime-ban | Tartós approval transition, állapot/audit mentése, hitelesített UI-integráció; teljes újraindítási teszt csak a javítás után |

## Új számítógépes helyreállítás sorrendje

1. A csomag sértetlenségét a külső SHA256 és a `SHA256SUMS.txt` alapján ellenőrizd. Először új, elkülönített célkörnyezetet használj; production végpontok és küldési/foglalási automatizmusok legyenek tiltva.
2. Az adatbázis GPG-payloadokat a külön őrzött jelmondattal fejtsd vissza. Kövesd az eredeti `VISSZAALLITAS.md` és `recovery/RESTORE-GAPS.md` leírását; az SQL önmagában nem telepíti a szolgáltatói Auth/API konfigurációját. A mellékelt runtime-eszközök a szükséges izolált szolgáltatásláncot mutatják be.
3. Állítsd helyre a fenti táblázatban felsorolt külön platformbeállításokat és hozzáféréseket. Tesztág/test Netlify/új adatbázis; API kulcsokat és jelszavakat ne írd dokumentumba vagy Gitbe.
4. Az eredeti laptopon, ugyanabban a profilban és originon nyisd meg a `https://leafy-chimera-2403e5.netlify.app/local-backup.html` exportoldalt. Készíts titkosított exportot, őrizd külön a legalább 16 karakteres jelmondatot. Az új, üres célügytárba importálj; már létező ügytárat ne írj felül.
5. Új gépen a Gmailhez új hozzájárulás kell. A fiók- és scope-ellenőrzést változatlanul hagyd; tokent ne másolj a mentésbe. Élő előnézet/értesítés csak külön biztonságos átvételi feltételekkel engedhető.
6. A jóváhagyási és audit-hiány kijavításáig, valamint Previo élő ellenőrzése nélkül ne minősítsd a teljes rendszert átadottnak. Ez a csomag rekonstruálható részrendszereket és bizonyítékokat tartalmaz, nem igazolt teljes éles átvételt.

## Felhasználói közreműködés

Az eredeti laptop titkosított exportja, a szolgáltatói adminisztrációs konfigurációk biztonságos exportja/olvasási hozzáférése és a külön őrzött mentési jelmondat meglétének ellenőrzése szükséges. Jelmondatot, tokent vagy kulcsot ne küldj beszélgetésben. Jelen munkához nincs további jóváhagyási kérés; a hiányzó hozzáféréseket nem lehet a forrásból kikövetkeztetni.
