# Főképernyős iPhone: megmaradó előnézet – fókuszvédelem

A tulajdonos 2026-10-17 22:07 Budapest időpontban jelezte: a főképernyős ikonról megnyitott alkalmazás másik alkalmazásból visszatérve megtartotta a régi szerveres előnézetet. Ez a fizikai készülékes lifecycle-próba sikertelen; a korábbi sikeres olvasási előnézet és a korábbi emulált visibility/pagehide-próbák nem zárják le. A pontos iOS-eseménysorrend, a telepített build SHA és a visszatérés közbeni hálózati forgalom a szóbeli jelzésből nem állapítható meg. Nem állítunk igazolt Safari-motorhibát vagy végleges gyökérokot.

Kiindulás: a8558b2d6a905fde167a94f12978b31ecd6f3c9b, kizárólag gmail-test-subject-allowlist.

## Célzott javítás

A fő kezelő `operator-login-ui.mjs` eddig visibilitychange/pagehide/persisted pageshow eseményre zárt. A window blur most szintén lezárja az aktív nézetet. Window focus esetén az aktív előnézet akkor is érvénytelenedik, ha nem előzte meg blur vagy visibility/pagehide esemény. Utána a meglévő soros, epoch-védett munkamenet-GET fut; nincs automatikus ügy-/tervezet-visszatöltés, írás vagy approval replay.

Az érvénytelenítés a meglévő session-changed eseményt használja, ezért az angol és magyar szerveres előnézet, szerkesztési állapot és szolgáltatásbizonyíték a meglévő mechanizmussal törlődik. A régi session CSRF-hozzáférése tiltott. Ismételt focus a folyamatban lévő restore alatt nem indít párhuzamos kéréseket; elutasított session zárva marad. Ez konzervatív védelem: egy fókuszt elvevő rendszerablak után is újra kell kérni az előnézetet.

Ez a módosítás a bejelentett fő kezelő/PWA útvonalra szól; nem állítjuk a külön cloud-approval oldal vagy a külön chatbot új készülékes ellenőrzését. A böngésző által egyáltalán nem jelzett/felfüggesztett operációsrendszer-eseményre nincs JavaScript-garancia. A javítást ezért valódi iPhone-on is igazolni kell.

## Ellenőrzés

Célzott helyi tesztek: **54 PASS / 0 FAIL / 0 SKIP** (`operator-login-ui`, `synthetic-server-preview`, `cookie-json-request`). Három új teszt: blur nélküli/focus-only visszatérés, blur utáni visszatérés, elutasított újraellenőrzés; korábbi session tiltott, nincs párhuzamos restore vagy POST. Szintaxis és diff-check PASS.

A mobilpróba új ellenőrzése valódi kezelt DOM-előnézetet tölt be, majd visibility/pagehide nélkül szintetikus FocusEventet küld. Ellenőrzi az angol/magyar preview törlését, a kizárólag session-GET forgalmat és a mentés hiányát Chromium/WebKit alatt. Ez emuláció, nem iOS operációsrendszer-szintű mérés. A commit CI/mobil és pontos deploy eredménye külön rögzítendő.

Nem volt production/main módosítás, valódi vendégadat, Gmail-olvasás, email/Pushover, Previo vagy foglalás. Nincs új mentésigény. V1 becslés marad 93%; a készülékes lifecycle-kapu a javítás után is ellenőrzésre vár. V2/V3: a közös session/epoch határ megmarad, nincs második jogosultsági motor vagy automatikus végrehajtás.
