# V1 AUTH_REQUIRED – célzott javítás és bizonyítékhatár, 2026-10-26

Alap: `87ed3762a3c00dad61411a8992208eced57c6ea6`. Kiadott tesztverzió a Work jelentése szerint `179cd76247d8affe61db59c539f741cf7bfd8c09`; itt nem történt deploy. Kizárólag gmail-test-subject-allowlist.

## Bizonyított hiba és megmaradt hosted akadály

A Work jelentése felületi AUTH_REQUIRED, tényleges HTTP-/fejlécbizonyíték nélkül. Nem bizonyít cookiehibát, privát konfigurációs eltérést vagy Supabase-hibát. Nem kérünk ugyanilyen új, fejlécadat nélküli próbát. A futtatókörnyezet credential-free hosted preflightja nem adott HTTP-választ (`httpStatus=null`); ez hozzáférési korlát, nem a szolgáltatás HTTP-hibája. Hosted belépést itt nem végeztünk.

Két programhiba külön bizonyított és regresszióval javított:

1. `operator-login-ui.mjs`: a védett ügylista 401-e után megmaradt a hitelesítettként jelzett session és az aktív ügylista-gomb. Most az adott session 401-e lezárja a helyi hozzáférést. Késői, régi session hibája nem törölheti az új sessiont. A 403 külön jogosultsági/kérésvédelmi elutasítás marad.
2. `sarberki-chatbot-project/operator-session.mjs`: a restore és a védett olvasás 403-át AUTH_REQUIRED-re írta át. Most FORBIDDEN marad, így nem állít hiányzó hitelesítést a jogosultsági/CSRF-határ helyett.

Ezek a félrevezető állapot és hibabesorolás gyökérokai. **Nem állítjuk, hogy a Work első hosted kérésének szerveroldali elutasítását is ezek okozták.** A helyes, szintetikus határadatokkal a teljes login/list/restore út működik; nincs igazolt általános session-producer/consumer inkompatibilitás. Privát konfigurációs eltérést nem igazoltunk, ezért privát értékváltoztatási utasítást sem adunk találgatás alapján.

## AUTH_REQUIRED keletkezési helyei

| Réteg | Konkrét feltétel | Eredmény / új fix diagnosztika |
|---|---|---|
| Főfelületi kliens | Hiányzó/lecserélt session, rejtett oldal, helyileg lejárt metadata vagy elavult sorba állított kérés | Helyi AUTH_REQUIRED; nincs feltételezett HTTP-státusz |
| Chatbot kliens | Hiányzó/lejárt metadata vagy szerver HTTP401 | AUTH_REQUIRED; HTTP403 külön FORBIDDEN |
| booking-cases előkapu | Nincs cookie-mód és nincs érvényes alakú Bearer fejléc | HTTP401 AUTH_REQUIRED |
| Cookie-olvasó | Nincs pontosan egy elvárt cookie | HTTP401 SESSION_COOKIE_MISSING / SESSION_COOKIE_INVALID |
| Cookie-olvasó | Rossz formátum/AEAD-kötés, eltérő kulcs, hibás payload vagy megengedettnél hosszabb hátralévő idő | HTTP401 SESSION_COOKIE_INVALID; nem külön kulcs-orákulum |
| Cookie-olvasó | Hitelesen dekódolt, lejárt lejárati idő | HTTP401 SESSION_EXPIRED |
| Auth jelszó/refresh | Upstream 400/401 | HTTP401 AUTH_LOGIN_REJECTED / AUTH_REFRESH_REJECTED; upstream403 továbbra403 |
| Auth-válasz validáció | Hibás tokenalak/role/subject/expiry/refresh | HTTP401 AUTH_REQUIRED |
| Host/Origin/Fetch Metadata | Nem megfelelő eredet vagy operátori fejléc | HTTP403 FORBIDDEN; nem AUTH_REQUIRED |
| CSRF | Hiányzó/hibás/nem egyező cookie-hoz kötött nonce | HTTP403 CSRF_REJECTED |
| Friss Auth/DB authority | Auth-/tagság-lekérdezés elutasított vagy nincs read tagság | HTTP403 AUTHORITY_REJECTED / MEMBERSHIP_DENIED |
| Auth/storage szolgáltatás | Hálózati vagy upstream szerverhiba | HTTP503; nem hiányzó sessionnek minősített hiba |

A szerver JSON csak az eddigi `error` kódot és fix `diagnostic.category` értéket ad hozzá. Nincs naplózás, cookie-/CSRF-/tokenérték, titkos konfiguráció, upstream törzs, személyes adat vagy sessionkulcs-ujjlenyomat. A kliens csak zárt kategórialistát és megengedett HTTP-státuszokat jelenít meg. Ismeretlen diagnosztikai szöveget nem tesz a felületre. A böngésző továbbra sem olvashat HttpOnly cookie-t.

Minden korábbi Auth-, CSRF-, Host-, SameSite-, lejárati-, tenant-, tagsági és RLS-feltétel változatlan. Nincs service-role, DDL/DML, vendéglevél, Previo vagy éles művelet.

## Célzott ellenőrzés

`node --test tests/operator-cookie-session.test.mjs tests/operator-login-ui.test.mjs tests/chatbot-operator-session.test.mjs tests/cookie-json-request.test.mjs`

96 PASS / 0 FAIL / 0 SKIP. A szerveres lánc valódi AEAD cookie-t és valódi két Netlify handlert használ egyetlen szintetikus cookie-tárral: login → első ügylista → új handlerpéldányos oldalfrissítés/restore → ügylista → logout → elutasított lista/restore. Az Auth és REST szintetikus, nem hosted vagy új PostgreSQL-bizonyíték. Külön teszt a hiányzó cookie, hibás CSRF, hiányzó tagság, visszavont Auth-refresh és szolgáltatáskiesés; a tiltott kérések nem jutnak ügytárolási olvasásig. A UI-teszt a téves hitelesített állapotot, a 401/403 szétválasztását és a diagnosztikai szöveg szűrését ellenőrzi.

Valódi Chromium-böngészővel a meglévő `scripts/operator-cookie-browser-proof.mjs` próba 4 PASS / 0 FAIL; külső kérés 0. Valódi HttpOnly/Secure/Strict cookie, újratöltés és új böngészőkörnyezetes restore, védett Reader-előnézet, visszavont session és logout utáni tiltás. Az Auth/REST és a Netlify event-adapter itt szintetikus; nem iPhone- vagy hosted-bizonyíték. Teljes regresszió: a végleges commit átadási jelentésében. Az ár- és mentési feladatokat nem nyitjuk újra; a kötelező npm test meglévő csomagja ezek tesztjeit is tartalmazza. A korábbi, külön 2027-es fejlesztés helyi stashben megőrzött, ebbe a commitba nem kerül.

## Egyetlen összevont Work-átvétel

Csak zöld CI után, a Work által koordinált egyetlen tesztkiadásban. Pontos build SHA ellenőrzése. Normál belépés → Szintetikus tesztügyek betöltése → teljes oldalfrissítés → automatikus restore → ugyanazon jogosult lista → kijelentkezés → lista/restore elutasítása. Nem kell fejléceket, cookie-t vagy tokent mérni/másolni: sikertelenségnél az új felületi HTTP-státuszt és fix kategóriát kell rögzíteni. A régi, diagnosztika nélküli próbát nem ismételjük.

- SESSION_COOKIE_MISSING: session válasz Set-Cookie-jelenléte és böngésző cookie-elfogadásának jelenléte biztonságos környezetben vizsgálandó, értékkiolvasás nélkül.
- SESSION_COOKIE_INVALID: a két Function azonos sessionkulcs-forrásának és azonos deployment-környezetének ellenőrzése a szolgáltatói felületen; nem állítunk előre kulcskülönbséget és nem kell értéket megosztani.
- AUTH_REFRESH_REJECTED: friss Auth-munkamenet életciklusa vizsgálandó; nem cookie- vagy RLS-kerülőút.
- MEMBERSHIP_DENIED / AUTHORITY_REJECTED: a meglévő tesztoperátor Auth/DB read tagságát kell ellenőrizni. Nem automatikus jogosultságbővítés.
- CSRF_REJECTED: az aktuális session metadata és a védett kérés nonce-kötését kell ellenőrizni; a kapu nem lazítható.
- SESSION_SETUP_REQUIRED: a meglévő Function setup-predikátumoknak való megfelelés ellenőrzése privát szolgáltatói felületen, titokérték nélkül. Pontos eltérést csak ténylegesen mért eredmény alapján lehet jelenteni.

A hosted működés és a pontos hosted gyökérok addig NEM IGAZOLT. Készültség nem emelkedik. A sikeres munkamenet-átvétel után következhet megfelelő, elkülönített pending szintetikus ügyön a Writer → mentés → Reader → független Approver → audit. Lezárt Gmail/HU ügyhöz nem nyúltunk, registry/jogosultsági kapu nem bővült.
