# Sárberki V1 – Gmail és szerveres tesztügyek iPhone-os ellenőrzése

> **2026-10-17 frissítés:** a kombinált friss Gmail→azonos Writer dedup→preview/audit próba már lezárt; az alábbi korábbi nyitottként jelölés történeti. [Aktuális rövid készülékpróba](IPHONE-PWA-ACCEPTANCE-2026-10-17.md). A tényleges iPhone/PWA továbbra külön kapu; a sikeres Gmail-próbát ne ismételje meg csak e régi lista miatt.

> **Aktuális folytatási állapot (2026-10-17):** [Összevont elfogadási leltár](V1-ACCEPTANCE-CHECKPOINT-2026-10-17.md).
> Az alábbi dátumozott részek történetiek. A Gmail OAuth-olvasás, a privát tesztreceipt
> felhős Writer/Reader/audit útja és a négy zárt nyelvi minta külön-külön már igazolt.
> Ezeket ne indítsd újra „hiányzó” feladatként. A friss olvasásból ugyanazon receipt
> közvetlen felhős feldolgozásáig tartó kombinált próba és a tényleges iPhone/PWA
> ellenőrzése külön nyitott bizonyíték. Titok, alias vagy admin kerülőút nem használható.

Dátum: 2026-10-12. Kizárólag `gmail-test-subject-allowlist`, Netlify: `https://leafy-chimera-2403e5.netlify.app/`.

## 0. Legfrissebb állapot (korábbi blokkolók feloldva, 2026-10-12)

### Writer-hitelesítés bekötése – védett, rögzített szintetikus minta

A védett bejelentkezőűrlap változatlan Supabase Auth belépést használ. A tesztoldal
„Writer · rögzített szintetikus Reader-tesztügy” részében külön, explicit gomb hívja
a `writer-reader-fixture` POST végpontot. Ez a frissített Auth-munkamenet és a DB-ben
ellenőrzött `sarberki-test` **read + write** tagság után, szerveroldalon használja a
`syntheticReaderFixtureRequest()` mintát a meglévő ingest-and-draft runtime-on.
Nem fogad vendégadatot, ügyazonosítót, tenantot, szerepet vagy szabad műveletet a
böngészőtől. Idempotens mentést végez; csak ügyazonosítót/verziót és igazolási
metaadatokat ad vissza. Jelszó és Bearer-token nem kerül a válaszba vagy naplóba.
Nincs új SQL, service role, jogosultságmódosítás vagy külső küldés.

A meglévő Reader cookie-s ügy-API és kliens továbbra is kizárólag GET/olvasás;
a Writer-mintavégpont **nem** enged általános cookie-s szerkesztést vagy jóváhagyást.
Reader hívás 403; a frissített Reader-cookie visszakerül, így olvasása megmarad.
Hiányzó CSRF, hibás Origin, lejárt/visszavont Auth vagy eltávolított write-tagság
nem hoz létre ügyet. A production hoston a kapu zárt.

Védett élő ellenőrzés a teszt-Netlify commitazonosságának igazolása után:

1. A meglévő Readerből kijelentkezés, majd a **meglévő Writer Auth-fiókkal** belépés
   a tesztoldal védett űrlapján. Jelszót vagy tokent ne másolj chatbe/DevToolsba.
2. A Writer-rész mintalétrehozó gombja. A kijelzett `caseId` és verzió nem titok;
   második kattintás ugyanazt a mentett mintát adja vissza.
3. Writer kijelentkezés, Reader belépés. Ügylista → azonos `caseId` kiválasztása →
   mentett tervezet előnézete. UNKNOWN kapacitás/ár, pending állapot; nincs küldés.
4. Readerrel a mintalétrehozás megtagadva; szerkesztés és jóváhagyás továbbra tiltott.

Bizonyítékhatár: a célzott Auth/HTTP integráció szimulált; a meglévő PostgreSQL
RLS-tesztek helyi valódi motoron futnak. Célzott teszt: 45 PASS / 0 FAIL / 0 SKIP;
teljes helyi regresszió: 1428 PASS / 0 FAIL / 0 SKIP. Élő Writer Auth és felhős ügymentés csak
a fenti emberi belépés után igazolható. A végrehajtó környezetben nincs Writer
hitelesítő adat vagy támogatott, már bejelentkezett felhőböngésző. Ezért a valódi
lépéshez védett felületi emberi közreműködés kell; Reader vagy admin SQL nem pótlás.
V2/V3 érték: a meglévő hitelesítés, közös runtime és atomi tárolás megmarad;
ez a rögzített tesztminta nem általános külső végrehajtási engedély.

- A Reader belépés, automatikus munkamenet-visszaállítás és kijelentkezés **valós Work felhőböngészős ellenőrzése a felhasználó beszámolója szerint sikeres**. Ez nem fizikai iPhone/Safari-teszt. Ellenőrzött megvalósítás: `2546d88042edd291ae27cac85b510b146e2d9efa`; 1420 PASS, 0 FAIL, 0 SKIP és 12 szintetikus Chromium/WebKit mobilpróba. Netlify azonos commitot futtatott.
- Reader továbbra is csak olvasó; írás és jóváhagyás tiltott. A korábbi `SESSION_SETUP_REQUIRED` megállapítás történeti, **nem aktuális feladat**.
- Supabase `sarberki-test` ügytárban az utolsó read-only ellenőrzés egy `auth_probe_...` azonosítójú, 0 tervezetet tartalmazó ellenőrző ügyet mutatott. Ez a Reader biztonsági ügyazonosító-szűrőjéhez és a mentett választervezet próbájához **nem alkalmas**; meglévő sort ne nevezd át és ne írd át SQL-lel.
- Elkészült a `shared-core/synthetic-reader-fixture.mjs` idempotens, kizárólag `.invalid` feladójú mintája és a `tests/synthetic-reader-fixture.test.mjs` Writer→tárolás→Reader lista/előnézet negatív tesztje. Ezek nem hoznak létre felhős ügyet maguktól, és nem nyújtanak új hozzáférést.
- **Következő valódi felhős lépés:** hitelesített, `sarberki-test` tenanton `write` jogosultságú meglévő Writer-munkamenettel hívd a `booking-cases` API `ingest-and-draft` műveletét a `syntheticReaderFixtureRequest()` adataival (kézzel ne add meg az ügyazonosítót). Utána az eredmény `caseId`/`revision` mezőit és a Reader cookie-s lista + előnézet sikerét igazold. Az API maga ellenőrzi a szerepet, a tenantot, a `.invalid` feladót, az atomikus mentést és a duplikációt. **Reader cookie, projektadmin SQL, service role vagy titok chatbe másolása nem helyettesítheti a Writer-hitelesítést.**
- Ha nincs biztonságosan elérhető Writer Auth-munkamenet, ezt konkrét akadályként jelezd; ne kérj vagy jeleníts meg jelszót a chatben. A Work csak valódi támogatott felületen vagy védett auth-folyamatban kérjen belépést.
- Valódi Gmail→felhő útvonal és fizikai iPhone Safari-próba külön ellenőrizendő. Az új mintán sem történhet email-küldés, foglalás vagy Previo-írás.



## 1. Mi készült el kód- és CI-szinten?
- Gmail readonly → adatkinyerés → helyi szerkeszthető és ténylegesen tárolt tervezet: mockolt/izolált tesztekkel ellenőrzött.
- A szintetikus Supabase-ügytár előnézeti GET útvonala, jogosultsági kapu és CAS/verziózott tervezet mentés: tesztelt.
- Új `operator-login-ui.mjs`: explicit Supabase Auth tesztoperátori belépés, visszaállítás, kijelentkezés, HttpOnly cookie, kliensoldalon csak CSRF nonce és lejárat. A cookie-s munkamenet kizárólag olvasásra használható; írás, jóváhagyás, e-mail-küldés tilos.
- Szintetikus ügyválasztó: csak `sarberki-test` tenant, `.invalid` feladók és szabályos tesztügy-azonosítók listázhatók. Az előnézeti űrlap a kiválasztott ügy verzióját kapja.
- A külön Bearer/Auth írási funkció továbbra is csak explicit külső, megbízható sessionnel és `synthetic-only` szerveres kapuval használható; a cookie-bejelentkezés nem kapcsolja be.

## 1/A. Szintetikus levélből szerveres ügy és választervezet – 2026-10-12
- Az opt-in szerver API `action=ingest-and-draft` végpontja ugyanazt a közös üzenetértelmező és választervező magot használja, mint a meglévő rendszer.
- Kizárólag `sarberki-test` tenanten, hitelesített `write` jogosultsággal, `.invalid` végű szintetikus feladónál használható. Manuálisan megadott ügyazonosítóval vagy emberi linkelési kérés megkerülésével nem használható.
- A beolvasott tesztlevél, értelmezett adatok és ellenőrzést igénylő választervezet ugyanabban az egyetlen `insert` vagy atomikus `compareAndSwap` műveletben mentődik; nincs automatikus küldés vagy foglalás.
- A szintetikus importnál a szerver a levél szövegéből **saját maga újraértelmezi a foglalási adatokat**. A böngészőből beküldött `values` mező nem számít hitelesnek, és nem írhatja felül az érkezést, létszámot, szállástípust vagy más ügytényt; az ismeretlen adat hiányos marad.
- Azonos `mailbox_id` és `message_id` ismétlése nem hoz létre második ügyet vagy újabb piszkozatverziót. Változott tényadat esetén a következő tervezet új ügy- és tényverzióhoz kötött.
- A felület meglévő cookie-s Reader bejelentkezése `read-only`: **nem** kap ilyen importálási vagy szerkesztési jogosultságot. A szerver API alapértelmezésben továbbra is letiltott.
- Bizonyíték: szintetikus, izolált unit/integrációs tesztek és az adott commit GitHub CI-je; nem élő Gmail-import, nem valós iPhone Auth/E2E. A Gmail OAuth → tényleges vendéglevél → szerveres ügy migrációja továbbra is tiltott és nem megvalósult.

## 1/B. Valódi felhős kapuellenőrzés – 2026-10-12

A tesztoldal aktuális, `ef9edefae285afeb50363b1da3d21261fe4365a7` kiadásán a GitHub Actions titok nélküli, bejelentkezés nélküli GET-próbát végzett.

- Tesztkezelői session: `HTTP 503 SESSION_SETUP_REQUIRED` – **BLOKKOLT: Netlify sessionkörnyezet nincs teljesen konfigurálva**.
- Szintetikus ügytár: `HTTP 401 AUTH_REQUIRED` – az ügytár tesztkapuja be van kapcsolva, és anonim olvasást megtagad; valós Auth/adatolvasás ezzel még nem igazolt.
- Művelet: kizárólag GET, nincs jelszó, cookie, ügyadat-olvasás, levélküldés, Pushover vagy foglalás.
- A Netlify/GitHub SHA-egyezés `DEPLOY SYNC PASS`, regresszió `1418 PASS, 0 FAIL, 0 SKIP`; CI: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38301274950.
- Supabase `sarberki-test` (projekt `mojnqizbcaczstguikpv`) `ACTIVE_HEALTHY`, az 5 `sc_*` tábla RLS-védett; 3 megerősített Auth-fiók, 1 kizárólag Reader-tagság; egy `.invalid` feladójú ügy, valódi feladójú ügyek nélkül (összesítő, csak olvasó ellenőrzés).

### Kizárólag Netlify test site – szükséges külső adminisztratív lépés

A `leafy-chimera-2403e5` **tesztwebhely** Functions futtatási környezetében ellenőrizendő:

1. `CASE_STORE_ENABLED=synthetic-only`, `CASE_STORE_TEST_TENANTS=sarberki-test,demo-test`, `URL=https://leafy-chimera-2403e5.netlify.app` – az anonim ügy-API válasza alapján ezek a kapufeltételek teljesülnek.
2. `SUPABASE_URL=https://mojnqizbcaczstguikpv.supabase.co`, megfelelő aktív `SUPABASE_PUBLISHABLE_KEY` (publishable; lehet nyilvános, de ne változtasd indokolatlanul).
3. `SARBERKI_OPERATOR_SESSION_KEY` = 32 bájtnyi kriptográfiai véletlen **64 lowercase hex karakterként**, csak Netlify Functions környezeti titokban. Új érték esetén a korábbi tesztkezelői cookie-k érvénytelenednek. Titkot nem szabad GitHubba, chatbe, jelentésbe, frontendbe vagy logba másolni.
4. A Netlify tesztkontextus beállításai után csak az érintett tesztfunkciók újratelepítése; main/production ne módosuljon.
5. A titok nélküli `node scripts/operator-cloud-preflight.mjs` próba ismétlése. Sikeres session-setup esetén cookie nélküli GET-re `401 AUTH_REQUIRED` várható, nem `503 SESSION_SETUP_REQUIRED`. **Ez sem helyettesíti a valódi Reader Auth/iPhone belépést.**

Netlify hozzáférés nélkül a változókat a GitHub-kódból **nem lehet ellenőrizni vagy biztonságosan beállítani**. A kezelői bejelentkezés, a fizikai iPhone Safari/PWA és a teljes Gmail E2E ettől még NEM IGAZOLT. Semmilyen éles üzem nem aktiválható.

## 2. Mi nincs igazolva, és mi blokkol?
- A korábbi Netlify session-konfigurációs probléma a Work ellenőrzése szerint megszűnt. Ezután a tényleges Reader-belépés és visszaállítás sikeres volt; új belépés/konfiguráció-vizsgálatot csak új hiba esetén indíts.
- A felhős Writer Auth-mal, jogosult `ingest-and-draft` hívással létrehozott **szabályos szintetikus ügy és tárolt tervezet** még nincs igazolva. A meglévő `auth_probe_...` ügy 0 tervezettel nem alkalmas. A fizikai iPhone Safari és PWA továbbra sem igazolt.
- A böngészőből beolvasott valódi Gmail-levél nem kerül fel a szintetikus felhős ügytárba. Valódi e-mail vagy vendégadat feltöltése TILOS ebben a tesztkörben. Az éles Gmail→szerver végponttól végpontig folyamat még külön, megfelelő adatvédelmi és jogosultsági jóváhagyással készülhet el.
- A CI szintetikus teszt és a Playwright/WebKit emuláció nem valós iPhone-bizonyíték.

## 3. Valódi iPhone – minimális biztonságos teszt
1. Safari → `https://leafy-chimera-2403e5.netlify.app/` → „Tesztkezelői bejelentkezés – kizárólag szintetikus ügyek olvasása”.
2. Először „Korábbi tesztbelépés ellenőrzése”. Érvényes session nélkül elutasítást kell kapni, és az előnézet nem férhet hozzá az adatokhoz.
3. Ha az adminisztrátor korábban **külön, a tesztoldalhoz** aktiválta a biztonságos session-kulcsot és a szintetikus ügytárat, csak a meglévő Supabase Auth Reader tesztoperátori e-mail/jelszóval jelentkezz be a helyi űrlapon. Titkot soha ne küldj chatben, GitHubon, képernyőképen.
4. „Szintetikus tesztügyek betöltése” → válassz megfelelő azonosítót → „Kiválasztott ügy megnyitása az előnézetben” → „Szerveres tervezet előnézete (nem ment)”.
5. Ellenőrizd a hiányokat, a magyar kezelői szöveget, az UNKNOWN kapacitás/ár jelzését. A szerkesztési és mentési gombnak az olvasó munkamenetben tiltva kell maradnia.
6. „Kijelentkezés”: az előnézet és a szerkeszthető tartalom azonnal törlődjön. Válassz másik ügyet vagy változtasd a verziót: régi válasz ne jelenjen meg újra.
7. Jelöld külön a Safari vs. főképernyős PWA eredményeket; cookie-/munkamenet-megosztást ne feltételezz. Ellenőrizd álló/fekvő nézetben és billentyűzettel.
8. Sikertelen belépésnél csak a hibakódot és nem titkos képernyőképet jegyezd fel. `SESSION_SETUP_REQUIRED` vagy `CASE_STORE_DISABLED`: admin beállítás még hiányzik. `AUTH_REQUIRED`: külön Auth-azonosság/jelszó probléma lehet.

## 4. V1 átadási kritérium
A munka akkor tekinthető teljesnek, ha külön igazolható a hitelesített, tartós, jogosultságvédett Gmail→ügy→tervezet→szerkesztés→újraolvasás folyamat és az emberi jóváhagyás kezelői lépése. A cookie-s olvasási próba fontos részteszt, **nem igazolja** ezt a teljes élő láncot.

Nincs automatikus vendéglevelezés, foglalás, Pushover-küldés vagy Previo-írás. Main/production tiltott.
