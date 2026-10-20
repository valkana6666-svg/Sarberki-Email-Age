# Sárberki V1 – konfigurációs helyreállítási terv, 2026-10-20
## Értelmezés
A mentés teljesnek csak a szükséges szolgáltatói konfigurációk, külön őrzött kulcsok és a tényleges elfogadási próbák birtokában nevezhető. SQL restore nem egyenlő Netlify/Supabase platform-visszaállítással. A működő main/production és sarberki-test konfigurációja nem módosul. Email/Pushover/Previo műveletek nem indulnak.

## Hiány- és hozzáférési mátrix
| Összetevő | Elérhető mentés / bizonyíték | Pontosan hiányzó hozzáférés vagy igazolás |
|---|---|---|
| Git | Összes lekért ref, teljes history, kód/workflow/migráció | Új célrepóhoz tulajdonosi létrehozás/push; Actions titkok értéke nem olvasható vissza |
| GitHub Actions | Védett exportjelmondat futtatásra használható | Tulajdonosnál külön jelmondatpéldány megléte nem igazolt; új repo secret újra beállítandó |
| Supabase DB/RLS | Titkosított dump és 49 táblás visszaállítás | Új projekt létrehozásához szervezeti jogosultság és cél-DB hitelesítés; role-jelszavak külön újralétrehozandók |
| Supabase Auth | Mai izolált Auth-próba eredménye külön JSON | Dashboard Auth konfiguráció-export: Site URL, redirect allowlist, email/jelszó policy, MFA, OAuth providerek, SMTP; szolgáltatói kulcsok |
| REST | Mai külön PostgREST próba | Hosted exposed schemas, szerepkörök/JWT konfiguráció dashboard-exportja; managed gateway nem azonos a lokális adapterrel |
| Edge | reader-password-reset v9 forrás, verify_jwt=true; elkülönített handlerpróba | Supabase Edge gateway/JWT-integráció és titkos környezet teljes helyreállítása nem igazolt; hozzáférés kell a célprojekt Edge deploy/config-hoz |
| Storage | Korábbi mai leltár szerint 0 bucket/0 objektum; a DB snapshot tartalmaz metadata táblákat | Új objektumok változásellenőrzése és új cél Storage szolgáltatásbeállításai külön szükségesek |
| Netlify teszt | netlify.toml, Functions, helyi build; korábbi HTTP/buildazonosító | Hitelesített hozzáférés leafy-chimera-2403e5 site build/deploy beállításaihoz, környezeti értékekhez, domain/DNS/Git-kapcsolathoz és deployment metadata-exporthoz |
| Netlify production | Korábbi publikus HTTP-ellenőrzés | moonlit-torrone-88b39d beállításaihoz kizárólag olvasó fiókhozzáférés; éles site módosítása tilos |
| Gmail | Kód/readonly adapter és szűkített tesztkapuk a Gitben | Tesztpostaláda tulajdonosi Google OAuth jóváhagyása, OAuth client és readonly refresh token biztonságos újralétrehozása |
| OpenAI fordítás | Adapter és kapuk a Gitben | OPENAI_TRANSLATION_API_KEY vagy AI_TRANSLATION_API_KEY a megfelelő projektből; OPENAI_TRANSLATION_MODEL és SARBERKI_TRANSLATION_ENABLED tényleges értékei; élő API-hívás nem része ennek a próbának |
| Kezelői session | Adapter/kód | SARBERKI_OPERATOR_SESSION_KEY külön védett érték; SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, CASE_STORE_ENABLED, CASE_STORE_TEST_TENANTS, URL tényleges Netlify-konfigurációja |
| Previo | Forrásadapter és biztonsági kapuk | Tulajdonosi API-szerződés/teszt-hozzáférés és beállítások; élő írás és foglalás tiltott |
| Outlook/SMTP, Pushover | Kódban lévő konfigurációhivatkozások | Szolgáltatói tulajdonosi hozzáférés a hitelesítő adatok újralétrehozásához; küldési teszt tiltott |
| Tartós mentés | Korábbi ZIP külön tárolva; friss artifact 90 napos | A friss egyesített ZIP független tartós tárba mentése helyi fájlkezelés hiányában nem végezhető el e munkamenetből |

A fenti változónevek forráskódban igazolt hivatkozások, nem fiókszintű export. Semmilyen titkos értéket nem kell a chatbe másolni.

## Biztonságos kulcsmentés és újralétrehozás
1. Tulajdonosi jelszókezelőben készítsen tételes leltárt: szolgáltatás, account/project/site azonosító, kulcs neve, szerepe, környezete, újralétrehozás jogosultja, 2FA-helyreállítás. Értéket csak a jelszókezelő tároljon.
2. A meglévő SARBERKI_BACKUP_PASSPHRASE kell a régi .gpg dumpok feloldásához. Új jelmondat nem nyitja ki a régi archívumot. A GitHub-secretből az érték nem exportálható. Tulajdonosi offline példány külön szükséges.
3. Ha titkos fájl exportálható, a tulajdonosi megbízható gépen külön, hozzáférésvédett ideiglenes könyvtárban állítsa össze. GnuPG AES256 szimmetrikus titkosítással, interaktív jelszókéréssel készítsen secrets.json.gpg fájlt; a jelszó ne kerüljön parancssori argumentumba, historyba, repo- vagy workflow-szövegbe.
4. A titkosított kulcsmentés ellenőrzőösszegét rögzítse. Külön megbízható környezetben visszafejtéssel ellenőrizze, a titkos értékeket ne naplózza. A nyílt ideiglenes fájlt csak titkosított háttértáron vagy RAM-ban kezelje; SSD-n a törlés nem jelent bizonyított fizikai felülírást.
5. A backup-jelmondatot, kulcsmentés-jelszót és 2FA helyreállító kódokat egymástól és a ZIP-től külön őrizze. Ne titkosítsa a régi mentés egyetlen feloldókulcsát kizárólag saját magával.
6. Nem exportálható token: új célkörnyezetben állítson elő új, legkisebb jogosultságú tokeneket. Gmailhez új readonly OAuth jóváhagyás; OpenAI-hoz célprojekthez kötött kulcs; Netlify-hoz célsite-ra szűkített hozzáférés, Supabase-hoz új célprojekt hitelesítés.
7. Új JWT/sessionkulcsoknál a régi sessionök érvénytelenedhetnek: új belépést kell elvárni. Ez dokumentált szolgáltatás-helyreállítás, nem a régi bejelentkezések folytatásának garanciája.
8. Meglévő éles kulcsot ne vonjon vissza/rotáljon a mentési feladat miatt. A célkörnyezetben zárt feature flagekkel állítsa be az új értékeket. Küldés/Previo írás továbbra is tiltott.
9. E csomag nem tartalmaz új titkoskulcs-exportot; a fenti eljárás nem végrehajtott kulcsmentés. Kulcsbiztonsági PASS csak tényleges külön ellenőrzés után adható.

## Netlify helyreállítási eljárás
Kizárólag új tesztsite-ot hozzon létre. Git bundle-ből új célrepó, a mentett tesztág és package_commit. A netlify.toml szerinti build/publish/functions; tényleges fiók runtime-verzió, build context, base directory, pluginok és deploy lock a hiányzó exportból pótlandó. A forrás által generált build-info egyezzen a teljes commit SHA-val.
A redirect/header- és Functions-konfigurációt a forrásból állítsa helyre. A környezeti értékeket titkoskezelőből, ne a ZIP-ből nyíltan.
Éles domaint/DNS-t ne irányítson át. Izolált HTTPS tesztdomainen kell Auth redirect/cookie és CSRF próbát végezni.
Kötelező elfogadás: belépés, újratöltés, Writer szintetikus ügymentés, Reader előnézet és írási tiltás, külön jóváhagyó, tenant-elkülönítés, kijelentkezés, újraindítás/deploy utáni megmaradás; minden kimenő küldés és foglalás tiltva.
A jelen munkamenet nem telepít új Netlify site-ot, mert nincs hitelesített Netlify-hozzáférés. Ez NEM IGAZOLT.

## Bizonyítékszintek és átadás
A JSON-jelentések az elsődleges műszaki bizonyítékok. A mai Docker Auth/REST lánc valódi szolgáltatásokkal, de szintetikus kapacitás/ár és belső HTTP-adapter mellett fut; nem teljes éles hálózati/Netlify folyamat.
Az Edge handler Deno-válasza külön bizonyíték, nem Supabase gateway/JWT teszt.
A korábbi artifactokat a friss csomag megőrzi. A korábbi 5,8 MB-os Library ZIP teljes byte-példányát hozzáférhető fájlkezelés nélkül nem lehetett beolvasni, ezért azt külön is őrizni kell; a friss csomag új Edge-pillanatképet és mai tesztbizonyítékot ad hozzá.
A 100%-os státuszt kizárják a még hiányzó hozzáférések és az új HTTPS Netlify platformpróba hiánya.
