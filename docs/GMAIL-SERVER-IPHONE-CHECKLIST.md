# Sárberki V1 – Gmail és szerveres tesztügyek iPhone-os ellenőrzése
Dátum: 2026-10-12. Kizárólag `gmail-test-subject-allowlist`, Netlify: `https://leafy-chimera-2403e5.netlify.app/`.

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
- Azonos `mailbox_id` és `message_id` ismétlése nem hoz létre második ügyet vagy újabb piszkozatverziót. Változott tényadat esetén a következő tervezet új ügy- és tényverzióhoz kötött.
- A felület meglévő cookie-s Reader bejelentkezése `read-only`: **nem** kap ilyen importálási vagy szerkesztési jogosultságot. A szerver API alapértelmezésben továbbra is letiltott.
- Bizonyíték: szintetikus, izolált unit/integrációs tesztek és az adott commit GitHub CI-je; nem élő Gmail-import, nem valós iPhone Auth/E2E. A Gmail OAuth → tényleges vendéglevél → szerveres ügy migrációja továbbra is tiltott és nem megvalósult.

## 2. Mi nincs igazolva, és mi blokkol?
- A Netlify tesztkörnyezet `CASE_STORE_ENABLED=synthetic-only`, `CASE_STORE_TEST_TENANTS`, `SUPABASE_URL`, publikus Supabase kulcs és titkos `SARBERKI_OPERATOR_SESSION_KEY` együttes konfigurációja nem igazolt a jelenlegi kiadásra. Nem szabad ezeket GitHubba vagy ügyféloldali fájlba írni.
- A Reader Supabase Auth-fiók helyes jelszava és a valós telefonos bejelentkezés nem igazolt. A projekt-/adatbázis-/Gmail-jelszó nem azonos a Reader Auth-jelszóval.
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
