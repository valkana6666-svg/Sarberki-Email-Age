# Szerver-chat és napi kezelő – 2026-10-29

Kizárólag `gmail-test-subject-allowlist`, teszthost `leafy-chimera-2403e5.netlify.app`.

## Igazolt kiindulópont

- HEAD: `0974c016f5640d9d281057a88dbfb33edfdc271f`. Az `ae641e4` és `eaeab97` ennek közvetlen ősei: a megszakított deploy nem távolította el a kódjukat.
- Ezt a teljes SHA-t adta az élő `/api/health`; `autoSend=false`, `autoBookingModification=false`.
- Teljes CI SUCCESS: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/40823496704 ; kapacitásregresszió SUCCESS: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/40823496723 . A mobil workflow SKIPPED, nem mobil PASS.
- Az élő `/api/server-chat-preview` és a régi közvetlen function URL egyaránt 503 `PREVIEW_DISABLED`. Nincs igazolt hosted beszélgetés; az engedélykapcsoló nincs megkerülve.
- A session végpont hitelesítés nélkül 401 `AUTH_REQUIRED`. A napi kezelő élő Chrome-ban belépést kér, tiltja az ügybetöltést, a kategóriák csak magyarázatot váltanak. Ez nem fizikai iPhone.

## Elkészült változás

- A napi kezelő ugyanazt a `createServerChatClient` és hitelesített operátori sessiont használja, mint a meglévő szerveres előnézet. Nincs külön válaszmotor, adattár vagy jogosultsági rendszer. A napi kezelő magyar nyelvet kér a közös motortól.
- Bejelentkezés szükséges, minden chatkérés előtt friss sessionellenőrzés. Kijelentkezés, új belépés és háttérbe kerülés törli a beszélgetést; a régi munkamenet késői válasza nem jelenhet meg.
- A kliens a Netlify esetleges sima szöveges hibaválaszát is kezeli: 429 külön várakozási üzenet, 401/403 külön hozzáférési hiba. Nincs automatikus újrapróbálás; sikertelen üzenet nem kerül a beszélgetési előzménybe.
- A 30 körös, 1000 karakter/üzenet, 12000 összkarakter és 16000 UTF-8 bájt korlátok megmaradnak; a teljes kérés méretét a kliens már a hálózati kérés előtt ellenőrzi.
- A napi mobil CI a valódi meglévő szerver-chat handleren és közös motoron futtat szintetikus, izolált kéréseket. Több kör, reset, 429, újratöltés, Reader-tiltás és a régi tesztfelület ellenőrzése; külső szolgáltató nélkül.

## Biztonság és bizonyítékhatár

A szerver-chat csak `language` és `messages` mezőt fogad. Hamis tenant, ügyazonosító, szerepkör, evidence vagy action elutasítva. Auth + DB read membership + CSRF után fut a meglévő motor. Ez az előnézet nem olvas ügytárat, nem kérdez kapacitást, nem ír adatot, nem foglal és nem küld levelet. A negatív tesztek injektált, külső hívást tiltó szolgáltatókkal futnak; ez nem általános penetrációs bizonyíték.

A Supabase projekt ACTIVE_HEALTHY; közvetlen metadata-lekérdezéssel mind a tíz `sc_*` táblán aktív RLS igazolt. Az ügy/audit/message-key SELECT policy tenantjogot kér; a membership SELECT csak saját userre szól. Vendégtartalmat és kulcsot nem olvastunk. A security advisor három policy nélküli, RLS-védett belső táblát, a szándékos authenticated definer RPC-ket, az `event_trigger` típusú `rls_auto_enable` végrehajtási jogát és a kikapcsolt kiszivárgottjelszó-ellenőrzést jelzi. Az event-trigger típus önmagában nem bizonyít normál RPC-végrehajthatóságot. Nincs DB- vagy jogosultság-módosítás; hosted Writer/Reader/Approver aktus nem történt.

Netlify rate limit: a config 10 kérés/60 másodperc, IP+domain összesítéssel. Egy legfeljebb 11 kéréses, hitelesítés nélküli, szintetikus próba 11 darab 503-at adott, 429-et nem. Az élő limit **NEM IGAZOLT**; a mérés nem rögzített stabil kliens-IP-t és időablakot. Nem tekintjük késznek, és nem engedélyezzük a chatkaput erre hivatkozva. A szabály telepítési utófeldolgozási naplója és ellenőrzött időablakú próba kell.

Hivatalos konfigurációs referencia: https://docs.netlify.com/build/functions/api/ és https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/ . A támogatott konfiguráció és az élesben ténylegesen érvényesülő szabály külön bizonyítandó.

## Tesztek

- Célzott Node: 36 PASS / 0 FAIL / 0 SKIP.
- Teljes helyi Node: 2402 PASS / 0 FAIL / 0 SKIP, benne PGlite/PostgreSQL-szemantikájú jogosultság-, CAS-, audit- és csatornaparitás-próbák. Ez nem friss hosted négynyelvű Gmail E2E.
- Helyi Chromium/WebKit: SKIP, a CDN böngészőcsomag sérült ZIP-pel érkezett. GitHub mobil CI külön igazolandó.
- Build és diff whitespace ellenőrzés PASS. Új commit CI és pontos új tesztdeploy csak sikeres futás után állítható.

## Hátralévő feladatok, változatlan korlátok

1. Netlify limit telepítési bizonyíték, hosted szintetikus chatkapu és hitelesített chatpróba. A környezetben nincs operátori Writer/Reader jelszó vagy Netlify konfigurációs hozzáférés.
2. #8: valós szerveres állapoton alapuló kategóriaszűrés, eredeti üzenet/előzmény, a meglévő Writer/Approver műveletek napi felületi bekötése, külön elutasítási életciklus és türkiz eredeti ikon. A jelenlegi listaválasz csak tenant/caseId/revision; az állapotot nem találjuk ki.
3. Friss hosted Gmail → ügy → közös mag → HU/DE/EN/SI tervezet → emberi jóváhagyás → mentés/audit, deduplikáció és reload. A korábbi bizonyítékok: `docs/V1-GMAIL-VERIFIED-CLOSURE-2026-10-28.md`, `docs/EXACT-GMAIL-HOSTED-ACCEPTANCE-2026-10-26.md`; nem friss próbának jelentve.
4. Previo API jogosultság, dokumentált mellékhatásmentes olvasás, tényleges mapping és hiteles ár/kapacitás. Jelen próba nem hívta a Previo-t. Szimuláció nem foglalás.
5. Az új napi/chatfolyamat fizikai iPhone/Safari/PWA próbája. A korábban elfogadott október 25-i Safari logout/audit bizonyítékot nem nyitjuk újra.

A jelen bővített scope-ra körülbelül **80% mérnöki készültségi becslés** adható; nem mért százalék, nincs elfogadott súlyozott mérőszám és nincs 100%-os bizonyíték. A korábbi, eltérő scope-ú 91% nem vihető át automatikusan. Hátralévő aktív munka becslése **20–35 óra**, hozzáférésekre várakozás nélkül: szerver-chat/limit hosted lezárás 2–4; napi ügyéletciklus 8–14; integrált hosted négynyelvű és eszközteszt 4–7; Previo olvasási integráció 6–10. Ez a tartomány az ismert API-képességektől és hibáktól függ.

Következő legfontosabb feladat a rate limit tényleges érvényesülésének bizonyítása, majd a meglévő hitelesített chat előnézet hosted próbája. V2/V3 érték: ugyanaz a kliens, session és közös motor, külön műveleti jogosultságokkal; új platform nem készült.

## Kiegészítő nyelvfelismerési javítás és mobil bizonyíték

A rövid „Van szabad Deluxe faház 2027.06.10-12 között?” üzenet az auto nyelvben német választ adott: a magyar ö/ü német ékezetbónusza felülírta a magyar lexikai bizonyítékot. A közös nyelvfelismerőben a megosztott ö/ü önmagában nem ad német bónuszt, ha van magyar kulcsszó; az ä/ß és a német szöveg felismerése megmarad. Nincs ár-, foglalási vagy egyéb üzleti szabályváltozás. Az új regresszió magyar és német mintákat is tartalmaz. Nyelvi/szerveres célzott: 25 PASS; a teljes helyi csomag az új teszttel 2402 PASS / 0 FAIL / 0 SKIP.

A napi mobil próba a változatlan eredeti TESZT megnyitásakor deklarált Google GSI scriptet helyben blokkolja, ahogy minden külső kérést. A diagnosztika külön számolja a blokkolt kérést és az ismeretlen külső próbálkozást; a napi oldal külső próbája továbbra hiba. Az első két CI hibás tesztelvárását javítottuk, nem alkalmazáshibát fedtünk el.

Napi mobil SUCCESS: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/40831898713 , 14 PASS (Chromium + WebKit), 0 tényleges külső kérés, 2 blokkolt régi GSI loader, 0 váratlan külső próbálkozás. A nyelvi javítás utáni új mobil futás külön ellenőrizendő.

## Kiadás előtti végleges bizonyíték

Alkalmazáscommit: `fbe80a8e2a375f37743517301b7de24f4e96e040`.

- Teljes CI SUCCESS, 2402 PASS: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/40832118448 .
- Kapacitásregresszió SUCCESS: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/40832118405 .
- Napi kezelő Chromium/WebKit SUCCESS: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/40832118452 .
- Chatbot mobil/cookie SUCCESS: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/40832118364 .
- Négynyelvű paritás SUCCESS: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/40832118374 .
- A változatlan meglévő Gmail/Writer/Reader/külön approver mobil UI 12 + 28 PASS: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/40831767393 . Ez szintetikus böngészőtransport; nem friss hosted Writer/Approver-mentés.

Második, időmért rate-limit próba: 11 kérés 13,11 s alatt, majd 12 s várakozás után két további kérés; összesen 35,23 s. Mind a 13 válasz 503, 429 továbbra sincs. A Netlify hivatalos dokumentáció legfeljebb 10 s késést ír az érvényesítésre; ezt a próba kivárta. Stabil kliens-IP nem igazolt. A hosted rate-limit lezárás továbbra NEM IGAZOLT, a chat aktiválása nem történt meg.

A biztonsági advisor figyelmeztetéseinek hivatalos értelmezése: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable és https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . A definer RPC-k belső jogosultsági ellenőrzése külön vizsgálandó; nem vontuk vissza vakon a működéshez szükséges jogokat.

Ez az összegyűjtött, ellenőrzött változáscsomag egyetlen engedélyezett Netlify TESZT-kiadást kér. A tényleges új `/api/health` SHA, statikus assetek és zárt chatkapu a telepítés után ellenőrizendő. Az alkalmazás üzleti szabályai, production, vendégküldés és valódi foglalások érintetlenek.
