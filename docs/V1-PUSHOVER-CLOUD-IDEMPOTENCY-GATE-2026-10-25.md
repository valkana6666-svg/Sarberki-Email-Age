# Sárberki V1 – Gmail/Pushover felhős figyelés: biztonsági kapu és implementációs terv
Dátum: 2026-10-25. Hatókör: kizárólag `gmail-test-subject-allowlist`, szintetikus tesztfiók. Ez a dokumentum nem engedély a figyelés vagy küldés bekapcsolására.

## Forrásból igazolt jelenlegi határ
- `gmail-readonly.js`: a `startPushoverWatch` böngészőidőzítőt állítana be, de az olvasási/OAuth folyamat nem indítja. A helyi `pushoverNotifiedIds` böngészőtároló nem több eszközön egységes és nem tartós szerveroldali tranzakció.
- `netlify/functions/pushover-gmail.mjs`: a POST kérést korlátozza a tesztoldalra, OAuth Gmail profilt és INBOX-állapotot ellenőriz, utána közvetlenül Pushoverhez küld. A forrásban nincs üzenetazonosítóra vonatkozó atomikus szerveroldali idempotencia-ellenőrzés. Két érvényes, ismételt kérés ezért két értesítést eredményezhet.
- A `tests/pushover-gmail-function.test.mjs` egyszeri kézbesítést és negatív hitelesítési eseteket modellez; két ismételt vagy párhuzamos kérés pontosan egyszeri kézbesítését nem bizonyítja.
- A Netlify-fiókban Stopped builds és kreditvédelem van; ezt változatlanul meg kell őrizni. Nincs bizonyított 0–24 órás, szerveroldali levélfigyelés.
- `deliveryUnknown:true` válasz esetén a szolgáltatói kimenet bizonytalan; nem szabad vak újraküldéssel ismételt Pushovert okozni.

## V1 döntési javaslat – bekapcsolás előtt
1. Készíts külön, RLS-sel védett, tenant- és teszt-Gmail-fiókhoz kötött kézbesítési naplót: egyedi kulcs (tenant, mailbox, gmail_message_id, notification_type). Ne a levél tárgyából, dátumából vagy vendégadatból képezz azonosítót.
2. Egyetlen tranzakcióban foglald le az értesítési szándékot; versenyhelyzetben csak egy Worker kaphat küldési jogot. A `pending/sending/sent/outcome_unknown` állapotok és a lease/lejárat kezelése legyen explicit. Külső hívás és DB-visszaigazolás között nem garantálható abszolút exactly-once; bizonytalan kimenet ne indítson automatikus duplikált küldést.
3. Ellenőrizd a szolgáltatói API request-ID és a push telefonos kézbesítési bizonyíték különbségét. Nyers OAuth token, Pushover kulcs, levéltörzs és vendégadat ne kerüljön auditba vagy logba.
4. Először kizárólag szintetikus, oldalról független, manuálisan indított szerveroldali teszt. A tesztfiókon kívül fail-closed. A cron/polling alapértelmezésben OFF, automatikus üzemhez külön költség- és jogosultságjóváhagyás kell.
5. Készíts célzott teszteket: két egymás utáni kérés, párhuzamos kérés, POST timeout/kimenet ismeretlen, duplikált Gmail lista, tokenlejárat, rossz tenant/fiók, újraindított Worker, lejárt lease, vészleállító kapcsoló, valódi telefoneszközön külön elfogadás.
6. A tényleges felhős időzítőt ne az iPhone böngészőjére építsd. A Netlify költségeit és a támogatott trigger-/ütemezési megoldást ellenőrizd telepítés előtt; ne hozz létre automatikusan új fizetős szolgáltatást.

## Kiadási és üzemi korlát
Az általános `y` nem jelent új Netlify-kiadás- vagy Pushover-küldésengedélyt. A korábban külön engedélyezett *egyetlen* tesztkiadás célja kizárólag `leafy-chimera-2403e5`; ezt a Pushover-tervet ne csomagold bele váratlanul. Main, éles Netlify, Previo-írás, valódi vendéglevelek, és a backup-folyamat érintetlen.

## Későbbi Work indító sorrend
Első lépés: biztonságos, tartós Netlify-tesztoldal-kezelés kialakítása, hozzáférés és automatikus build/credit guard ellenőrzése. Második: már előkészített V1 összevont tesztkiadás pontos SHA-val és build-stop visszaállítással. Harmadik: a fenti duplikációvédelmi megoldás célzott tesztelése, **külön** engedélyezett értesítés nélkül. Negyedik: Previo olvasási szolgáltatói garancia és dézsa valódi forráskötés.

Állapot: csak forráskód-audit és megvalósítási terv; nem új működő funkció, ezért a V1 készültségi százalékot nem növeli.
