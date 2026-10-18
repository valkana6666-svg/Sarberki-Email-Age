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

## Végleges CI és mobilbizonyíték

Alkalmazásjavítás: `0080482aeb9dc917a34e69b20a7a8cbc5fae4b65`. A kezdeti mobilrun 39065615772 sikertelen volt: az új teszt nem egyértelmű summary szelektora két elemet talált, még a fókuszpróba előtt. A selector pontosítása két tesztcommitban történt, az alkalmazáskód változtatása nélkül. Ezt nem minősítjük sikeres próbának.

Végleges tesztcommit: **`4ebe84c2a68260510e5b7d3f4fc3ad1fb8d1831a`**. [CI 39065773141](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39065773141), job `117492997666`: **1810 PASS / 0 FAIL / 0 SKIP**, exact deployed SHA megegyezik. Windows offline másolási job és a telepített ellenőrzések sikeresek. Élő Previo nem futott.

[Mobil 39065773119](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39065773119), job `117492997468`: Reader **12 PASS**, Writer/approval/deadline/focus **26 PASS**, összesen **38 PASS / 0 FAIL**. A focus-only visszatérés valódi kezelt DOM-előnézetének törlése Chromium és WebKit alatt külön PASS, kizárólag mock session GET-tel; a régi magyar/angol preview nem állt vissza magától, mentés nem történt. Ez nem tényleges iPhone-hitelesítés.

Az új verzió betöltéséhez a főképernyős kezelőt egyszer teljesen be kell zárni az alkalmazásváltóban, majd az ikonjáról újraindítani. Ezután normál tesztbelépés/ügylista/preview, másik alkalmazás 5–10 másodpercre, visszatérés. E második szakaszban már nem kell bezárni a kezelőt. Elvárt: régi preview üres, session-ellenőrzés után külön újra lekérhető. A tulajdonosi visszajelzésig a korábbi készülékes hibát nyitva tartjuk.

## 2026-10-18 06:58–06:59 Budapest – tényleges iPhone-visszatérés PASS

A tulajdonos előzőleg egyértelműen jelezte, hogy a 06:55-kor látható angol v4-preview még a váltás előtti állapot. Az új IMG_8864–8868 sorozatban az Óra/Időzítők alkalmazás, utána a kezelőben azonos kiválasztott ügy/verzió mellett **üres angol és magyar előnézet**, valamint **A tesztügy vagy munkamenet megváltozott. Új előnézet szükséges.** látszik. A belépési részben **Hitelesített tesztkezelői olvasás aktív**. A tulajdonos „Ez lett” visszajelzése a kért alkalmazásváltási próba eredményét jelöli.

Ezzel a konkrét korábbi készülékes hiba – a megmaradó régi cloud preview – a vizsgált visszatérésre **lezárható**. A pontos OS-eseménysorrendet, automatikus versus kézi session-helyreállítást és teljes HTTP-forgalmat nem állítjuk. A jelen képek nem mutatnak az érvénytelenítés UTÁN újra lekért friss preview-t; ez az utolsó külön olvasási pont még nyitott. Teljes Writer/approver, hálózatvesztés/lejárt session/dupla approval/PWA-mátrix ettől nem lesz PASS. A reggeli korábbi kép BUILD 70d9b89-et azonosított; a mostani részletképek nem teljes commitazonosítók. Nincs új kód, CI, mentés, email, Pushover vagy Previo művelet.
