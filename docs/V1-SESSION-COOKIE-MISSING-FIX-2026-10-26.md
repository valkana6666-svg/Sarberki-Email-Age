# SESSION_COOKIE_MISSING – cookie-életciklus javítása

Alap: `73bea25c9e06623b954d7c5304732a41795adbbd`, kizárólag `gmail-test-subject-allowlist`. Work hosted bizonyítéka: login után, még frissítés előtt az első ügylista HTTP401 / SESSION_COOKIE_MISSING. Nincs deploy ebben a feladatban.

## Bizonyított törlési pont

A kiadott `shared-core/operator-cookie-session.mjs` hiányzó cookie-ra is `clearOperatorCookie` választ adott. Az `operator-session` handler ezt tényleges `Set-Cookie` törlő fejlécként adta tovább. Ez a REQUEST cookie-járól döntött, de a válasz a böngésző válaszérkezéskori közös cookie-tárát módosította.

Reprodukált sorrend:

1. B lap cookie nélkül restore-t indít; a 401-es válasz késik.
2. A lap sikeresen belép. A login `Set-Cookie` létrehozza a HttpOnly cookie-t.
3. Megérkezik B korábbi 401-e. A benne lévő Max-Age=0 törlő fejléc törli A új cookie-ját.
4. A első ügylista-kérése már munkamenet nélkül érkezik: HTTP401 / SESSION_COOKIE_MISSING.

A kliens epoch-ellenőrzése nem elég: a HTTP-cookie feldolgozása a JavaScript válaszellenőrzése előtt történik. Az egy-egy klienspéldányon belüli sor sem koordinál külön lapokat. A kiadott SHA elkülönített forrásmásolatán az új regresszió RED (első ügylista401, elvárt200); a javítással GREEN. A kiadott forrás natív Chromium-próbája is elbukik a késleltetett401-es részben, miután a négy alap életciklus-ellenőrzés sikerült. A javított forrással ugyanaz a natív cookie-táras, kétlapos próba és a rotációs ellenőrzés is sikeres. Ez egy konkrétan reprodukált kódhiba; a korábbi Work-kérés teljes hálózati időrendjét nem állítjuk utólag mértnek.

## Tényleges javítás

- Olvasási, login-, refresh- és authority-hiba továbbra is megtagadja a hozzáférést, de nem küld cookie-törlést. Az elavult kérés nem törölheti a böngésző újabb munkamenetét. Hibás/lejárt/visszavont cookie-val továbbra sincs hozzáférés. Az explicit logout megőrzi a friss Auth-visszavonást és a cookie-törlést, az upstream hibás logout pedig továbbra sem állít sikert.
- A két login-kliens a POST után cookie-val végrehajtott GET restore-ral ellenőrzi az elfogadást. Csak azonos CSRF-kötésű és abszolút lejáratú, frissen hitelesített metadata után aktív a session. Cookie-elutasításnál nincs hamis „belépett” állapot vagy aktív ügylista.
- A közös cookie JSON-transzport a támogató HTTPS-böngészők natív Web Lockját használja. A főfelület, a chatbot és a cloud approval kliens azonos originhez tartozó locknéven sorosítja a login/restore/protected/logout kéréseket a válasz teljes beolvasásáig. A várakozó timeout abortál, nincs automatikus újraküldés. Web Locks nélkül a korábbi helyi sorok megmaradnak; a hibaválaszok nem törölnek cookie-t ezen böngészőkben sem. Régi, lockot nem használó lap késői anonim 401-e is tesztelten ártalmatlan az új kóddal kiszolgálva.

HttpOnly, Secure, SameSite=Strict, Path=/, Domain hiánya, 7 napos abszolút lejárat, AEAD/origin/project-kötés, CSRF, friss Auth és DB-tagság, tenant/RLS és az exact Gmail kapui változatlanok. Nincs böngészőben tárolt Auth-token, service-role vagy jogosultságbővítés. Nincs új adatbázis vagy SQL-módosítás.

## A teljes továbbítási lánc ellenőrzése

| Láncszem | Bizonyíték |
|---|---|
| Login válasz | A valódi handler sikeres válaszában Set-Cookie jelen van; token nincs a JSON-ban. |
| Netlify-válaszformátum | Az eddigi Lambda-kompatibilis `headers['Set-Cookie']` formátum dokumentáltan támogatott. Nem cseréltük találgatás alapján más API-ra. A hibaválaszok törlő fejlécét távolítottuk el. |
| Böngésző-elfogadás | Valódi Chromium HTTPS-origin és natív cookie-tár: HttpOnly/Secure/Strict, helyes Path, Domain nélküli __Host cookie, nincs JS-cookie-/tokenhozzáférés. |
| Credentials | A login, a bizonyító restore és a védett klienskérés `credentials='same-origin'`; a regresszió ezt ellenőrzi. |
| booking-cases | Első és ismételt védett olvasás, majd újratöltés/új böngészőkörnyezet utáni olvasás sikeres ugyanazzal a cookie-életciklussal. |
| Késői törlés/rotáció | Kétlapos késleltetett anonim401-próba, két független transzport natív lockos restore/rotációja, várakozási timeout, hibás/hiányzó cookie és logout negatív tesztek. |

Elsődleges Netlify-szerződés: https://docs.netlify.com/build/functions/lambda-compatibility/ . A teszt a valódi cookie-t és a valódi handlereket használja; Auth/REST és a Netlify event adapter szintetikus. A tényleges Netlify CDN-en történő új login Set-Cookie-továbbítását innen nem állítjuk mértnek: a titok nélküli hosted kéréshez a futtató nem kapott HTTP-választ (NETWORK_UNAVAILABLE). Nincs bizonyított privát konfigurációs eltérés vagy indokolt konfigurációmódosítás.

## Ellenőrzés és fájlok

Célzott: `node --test tests/operator-cookie-session.test.mjs tests/operator-login-ui.test.mjs tests/chatbot-operator-session.test.mjs tests/cookie-json-request.test.mjs tests/exact-receipt-offline.test.mjs` → **113 PASS / 0 FAIL / 0 SKIP**. Az exact-receipt teszt elkülönített PostgreSQL-motoros, a session Auth/REST szintetikus.

Böngésző: `scripts/operator-cookie-browser-proof.mjs` valódi Chromium → **6 PASS / 0 FAIL**, külső kérés **0**. Cookie-létrehozás, reload/új context, védett Reader, revoke/logout, kétlapos késői401 és natív Web Locks. Nem tényleges iPhone- vagy hosted-bizonyíték. A meglévő Gmail és Writer/Approver mobilproof mockjait az új kötelező restore-hoz és a session változatlan abszolút lejáratához igazítottuk; helyi Chromiumon a két script külön 6 és 14 PASS. Ezek csak mock UI-bizonyítékok, nem új hosted mentések/jóváhagyások. A CI mindkét motort futtatja.

Teljes helyi `npm test`: **2224 PASS / 0 FAIL / 0 SKIP**. Az adott commit GitHub CI-je a végleges átadási jelentésben. A teljes regresszió részeként a meglévő tesztek futnak, külön ár-/mentésfejlesztés vagy új mentés nem indul.

Programfájlok: `shared-core/operator-cookie-session.mjs`, `shared-core/cookie-json-request.mjs`, `operator-login-ui.mjs`, `sarberki-chatbot-project/operator-session.mjs`. Bizonyíték: a fenti négy célzott tesztfájl, `scripts/operator-cookie-browser-proof.mjs`, `scripts/gmail-server-mobile-proof.mjs` és `scripts/operator-write-approval-mobile-proof.mjs`; az exact-receipt tesztet nem módosítottuk. Ár-, mentési-, Netlify-konfigurációs, main- és production-fájl nincs módosítva. A korábbi 2027-es munka elkülönített stashben megmaradt.

## Egyetlen Work tesztkiadás

1. Zöld commit-CI után a Work adja ki az összevont javítást egyszer a leafy-chimera-2403e5 tesztoldalra, pontos SHA-val; másik deployt Codex nem indít.
2. Normál belépés → a POST utáni cookie-bizonyító restore sikeres → ügylista200 → ismételt ügylista200 → teljes frissítés → restore200 → ügylista200 → logout → lista/restore401. A UI csak a bizonyító restore után jelezhet hitelesített állapotot.
3. Második lap restore-jával párhuzamos próba: egyik lap visszaállítása ne törölje a másik friss sessionjét. Hibás/hiányzó cookie és CSRF továbbra elutasított, nincs titkos fejlécérték másolása vagy naplózása.
4. Csak a hosted siker után folytatható az elkülönített pending Writer → mentés → Reader → független Approver → audit lánc. A V1 készültségét addig nem emeljük.
