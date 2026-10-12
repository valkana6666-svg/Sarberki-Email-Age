# Tartós tesztoperátori munkamenet

Ez a meglévő Netlify ügy-API cookie-alapú, csak olvasó hitelesítési adaptere. A jogosultságot változatlanul Supabase Auth és a DB-tagság/RLS határozza meg. Nincs új ügytár, DB-migráció, service-role kulcs vagy jóváhagyási funkció.

## Pontosan rögzített tesztkapuk

Kizárólag `https://leafy-chimera-2403e5.netlify.app`, `CASE_STORE_ENABLED=synthetic-only`, `CASE_STORE_TEST_TENANTS=sarberki-test,demo-test`, `SUPABASE_URL=https://mojnqizbcaczstguikpv.supabase.co` és megfelelő publikus Supabase kulcs engedélyezett. A cookie-ág csak `sarberki-test` GET ügy-/előnézetolvasásra használható. A meglévő bearer útvonal külön működik; cookie-val POST írás/jóváhagyás nem engedélyezett.

Új szervertitok: `SARBERKI_OPERATOR_SESSION_KEY`, kriptográfiai véletlen 32 bájt lowercase hex formában (64 karakter). Netlify functions titokként, kizárólag a tesztkontextusban kezelendő. Nem kerülhet kódba, buildbe, jelentésbe vagy böngészős konfigurációba. Ugyanaz a kulcs szükséges a funkciók és új deployok között; csere minden régi cookie-t érvénytelenít. Hiány/hibás formátum: `503 SESSION_SETUP_REQUIRED`.

## HTTP-szerződés

- `GET /.netlify/functions/operator-session`: visszaállítás/frissítés; `X-Sarberki-Operator: 1`, `Sec-Fetch-Site: same-origin`, pontos Host; Origin ha van, pontos tesztorigin. Cookie nélkül `401 AUTH_REQUIRED`.
- Ugyanerre `POST` JSON `{action:'login',email,password}`: pontos Origin és a fenti fejlécek is kötelezők. A jelszó csak a Supabase Auth-kérés idejére használható; sem tárolás, sem naplózás nincs.
- `POST` JSON `{action:'logout'}`: ugyanazok a kapuk, plusz `X-CSRF-Token`, amely a cookie stabil nonce-ával egyezik. Csak az aktuális Supabase session helyi scope-ja kerül kijelentkeztetésre.
- Cookie-s `booking-cases` GET: ugyanazok a fejléc-/hostkapuk és CSRF-egyezés; csak pontos `tenantId=sarberki-test`. A kliens nem ad Bearer tokent.

Sikeres munkamenetválasz kizárólag `authenticated`, `tenantId`, `expiresAt` (ISO, abszolút hét nap) és `csrfToken`. Nem tartalmaz access/refresh tokent. A cookie neve `__Host-sarberki-operator`: HttpOnly, Secure, SameSite=Strict, Path=/, Domain nélkül. AES-256-GCM titkosítja és hitelesíti a refresh tokent, CSRF nonce-ot és abszolút lejáratot; az origin/projekt kötés hitelesített kiegészítő adat. Nincs localStorage, sessionStorage vagy JS által olvasható Auth-cookie.

Minden visszaállítás és védett cookie-olvasás a Supabase refresh végponttal kezdődik, majd a meglévő `/auth/v1/user` és tagságellenőrzés történik. A friss cookie visszakerül a válaszba. Auth-elutasítás törli a cookie-t és megakadályozza az ügyolvasást; hálózati/5xx hiba `503`, nem törli a cookie-t, de nem ad ügyadatot. Logout upstream-hiba esetén a helyi cookie törlődik, `503` érkezik: távoli visszavonás ilyenkor nem állítható sikeresnek.

Minden session/cookie-adatválasz `private, no-store`; CDN-cache nem oszthatja meg a Set-Cookie választ. A stateless Netlify példányok között nincs hamis process-local lockgarancia. Párhuzamos refresh és elveszett válasz kezelése a Supabase forgatási/reuse viselkedésétől függ; a böngészőadapternek sorosítani kell saját kéréseit. Token-visszavonás és cookie-megőrzés valódi Auth/iPhone vizsgálata külön bizonyíték.

Safari és a főképernyős PWA tárhelye nem tekinthető automatikusan közösnek. Telepítéskor egyes WebKit-verziók átvehetnek cookie-t, később azonban a külön böngésző/PWA ágak forgatási lánca szétválhat. A régebbi refresh-tokenág Supabase általi elutasítása új belépést igényel; ez nem kerülhető meg token-reuse védelem kikapcsolásával. Nem ígérünk egyetlen belépést minden Safari/PWA kontextusra.

A hibás email/jelszó miatti `invalid_credentials` problémát a tartós cookie nem oldja meg. Jelszó-, felhasználó- vagy jogosultságmódosítás nem része ennek a fejlesztésnek. Valódi iPhone Safari/PWA-megőrzés és személyes hiteles belépés külön ellenőrzendő; helyi szintetikus teszt nem igazolja ezeket.

## Reader hozzáférés ellenőrzési eredménye

2026-10-12-i csak olvasási ellenőrzés: a Reader Auth-fiók megerősített,
nem tiltott/nem törölt, jelszóval rendelkezik; a `sarberki-test` tagsága
`can_read=true`, `can_write=false`, `can_approve=false`. A személyes Gmail-címhez
nincs projekt-Auth-fiók. A Supabase tulajdonosi/adminbelépés nem azonos az
alkalmazás Auth-fiókjával; adatbázis-kapcsolati jelszó sem helyettesíti azt.

A korábbi, 2026-10-09-i beállítási előzmény a Reader jelszavához az
Authentication → Users felületet jelölte meg, és külön adatbázis/projektjelszó
is készült. A felhasználó akkor lehetséges elütést jelzett a Reader beállításánál.
A mostani Auth-napló `invalid_credentials` hibát igazol; a beküldött titkot nem
olvassuk ki, ezért konkrét karakterhiba vagy a használt jelszó azonossága nem
bizonyított. Nem hozunk létre új felhasználót, nem próbálunk másik fiók titkával
belépni, és nem módosítunk jelszót külön jóváhagyás nélkül.

Hivatkozások: https://supabase.com/docs/guides/auth/sessions és https://supabase.com/docs/guides/auth/server-side/advanced-guide (2026-10-12 ellenőrzés).
