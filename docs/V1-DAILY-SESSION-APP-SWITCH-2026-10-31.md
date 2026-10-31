# Napi kezelő – iPhone-alkalmazásváltás és 30 perces tétlenségi korlát (2026-10-31)

Ág: `gmail-test-subject-allowlist`. AGENTS.md blob `be27bd2dfb4795496bd9f3d64ad60ada1123de5b`, kiinduló HEAD `d358f767cb08d2272e91ad77a805b1b69aceff6e`.

## Kiváltó ok (kódból reprodukálva)
- `napi-kezelo/napi.mjs`: `visibilitychange` (hidden) és `pagehide` → `suspend()` → `lockSession()`: törölte a levéllistát, a kijelölt levelet, az AI-előnézetet, a nyitott ügyet, a szerkesztést és a chatet. Visszatéréskor a süti miatt bejelentkezve maradt, de minden adat elveszett, és a Gmailt újra be kellett olvasni.
- `shared-core/operator-cookie-session.mjs`: csak 7 napos abszolút lejárat volt, tétlenségi korlát nem.

## Választott megoldás (meglévő rendszer javítása, új hitelesítés nélkül)
- **Szerver:** a meglévő AES-GCM sütibe `idleExpiresAt` került. Bejelentkezéskor és minden sikeres hitelesített kérésnél (restore, védett olvasás/írás/jóváhagyás) a szerver órája szerint `now+30 perc` (legfeljebb az abszolút lejáratig). Lejárt tétlenség: 401 `SESSION_IDLE`, Auth- vagy DB-hívás nélkül. Kliensoldali óra vagy fejléc nem számít; a mező módosítása az AEAD miatt elbukik; a túl távoli érték elutasítva (60 s példányok közötti óraeltérés-tűrés). Kijelentkezés tétlenség után is visszavonja az Auth-munkamenetet. A régi, mező nélküli süti egyszeri újrabelépést kér.
- **Kliens:** háttérbe kerüléskor a nézet csak elrejtődik (`body.concealed`, a tartalom CSS-sel láthatatlan), a memóriabeli állapot megmarad. Visszatéréskor egy szerveroldali munkamenet-ellenőrzés fut: siker esetén ugyanott folytatható, elutasítás esetén zárás és teljes törlés. Valódi kezelői aktivitás (érintés/billentyű) legfeljebb 5 percenként csúsztatja a szerveroldali határidőt. Folyamatban lévő Google-engedélyezés vagy beolvasás a meglévő, biztonságos felfüggesztési úton marad.
- **Nincs tárolás:** levéltörzs, AI-szöveg és Gmail-token sem localStorage-ban, sem sessionStorage-ban. A Gmail-token továbbra is csak egyszer, memóriában használt; a beolvasott lista nem igényel tokent.

## Tudatos korlátok
- Teljes oldalfrissítés vagy az iOS általi lapkilövés után a bejelentkezés megmarad (ha a 30 perc nem telt le), de a levéllista, a kijelölés és a nem mentett szerkesztés elvész, mert vendégadatot nem tárolunk a böngészőben. Ehhez szerveroldali piszkozatmentés kellene (külön döntés).
- A tétlenségi határ az összes kezelői felületre érvényes (közös süti). A chatbot kezelői paneljének meglévő 5 perces automatikus frissítése nyitott, látható lapon életben tartja a munkamenetet (P1, nem módosítva).
- Az iOS alkalmazásváltó pillanatképének időzítése és a valódi háttérbe kerülés csak fizikai eszközön igazolható.

## Fizikai iPhone FAIL kivizsgálása (2026-10-31, telepített `4966d05`)

Tünet: bejelentkezve maradt, de a 38 beolvasott levél és a „Proba123” szerkesztés eltűnt ChatGPT-re váltás után.

A kódban csak két út vezet „bejelentkezve, de üres levéllista” állapothoz:
1. **Reprodukált programhiba:** visszatéréskor a munkamenet-ellenőrzés *bármilyen* hibája (iOS-en a visszatérés utáni első kérésnél gyakori átmeneti „Load failed”) `failed()` → `lockSession()` hívással mindent törölt; a következő láthatóvá válás `resume()`-ja a süti alapján csendben visszaléptetett. Regressziós teszt: az eredeti kódon elbukott („stays concealed, not wiped”).
2. **iOS lap-újratöltés** (a JavaScript-környezet megszűnik): a memóriabeli állapot elvész, a süti miatt a belépés megmarad. Ezt fizikai eszköz nélkül nem lehetett reprodukálni; NEM IGAZOLT gyökérok.

Javítás (`napi-kezelo/napi.mjs`):
- Visszatéréskor csak `AUTH_REQUIRED`/`FORBIDDEN` zár és töröl. Átmeneti hiba esetén a tartalom rejtve marad („A kapcsolat még nem ellenőrizhető. Érintse meg a képernyőt az újrapróbáláshoz.”), érintésre vagy újabb visszatéréskor újrapróbál; ellenőrzés nélkül nem jelenik meg adat.
- A háttérbeli aktivitásfrissítés átmeneti hibája nem töröl.
- Újratöltés-felismerés: elrejtéskor csak egy időbélyeg kerül a `sessionStorage`-ba (levél, AI-szöveg, token nem). Ha újratöltés után megtalálható, a felület kiírja, hogy az iOS újratöltötte az oldalt, és a levelek biztonsági okból nem tárolódnak. Normál visszatéréskor, záráskor és kijelentkezéskor törlődik. Ez a következő fizikai próbán bizonyítja vagy kizárja a 2. utat.

Ha a 2. út igazolódik: a levélállapot újratöltésen átívelő megőrzéséhez szerveroldali munkamenethez kötött, titkosított, rövid élettartamú helyi pillanatkép vagy szerveroldali piszkozat kellene; ez külön döntés.

## Második fizikai iPhone FAIL (telepített `da97c3e`) – kivizsgálás

Tünet: bejelentkezve, a 6 tárolt ügy megvan, a 38 levél és a „Proba123” eltűnt, újratöltési figyelmeztetés nincs.

Automatizált reprodukció ugyanazzal a forgatókönyvvel (beolvasás, AI-javaslat, szerkesztés, elrejtés/visszatérés), egyszeri próbaként három verzión:
- `d358f76` (a munkamenet-javítás előtti kód): bejelentkezve=igen, levelek=0, ügyek=6, szerkesztés törölve, figyelmeztetés nincs – **pontosan a megfigyelt tünet**.
- `4966d05` és `a91f3c1`: levelek=3, ügyek=6, „Proba123” megmaradt.

Következtetés: a telepített új kód a normál alkalmazásváltáskor megőrzi az állapotot. A megfigyelt tünetet két, kívülről azonos eset okozhatja:
1. a főképernyős (standalone) alkalmazás a korábbi kódot futtatta – benne nincs frissítés gomb, a régi JavaScript a teljes bezárásig fut;
2. az iOS újraindította az alkalmazást, és a `sessionStorage`-ban lévő újratöltési jelölő elveszett, ezért nem jelent meg figyelmeztetés.

Egyik sem igazolt fizikai eszközön. Javítás (új rendszer nélkül, meglévő modulokkal):
- A napi kezelő láblécében megjelenik a futó verzió a meglévő `sarberki-chatbot-project/version-status.mjs`-sel; eltérésnél „Új tesztverzió érhető el” és Frissítés gomb.
- Az újratöltési jelölő (csak időbélyeg) `localStorage`-ba került, hogy az iOS-újraindítást is túlélje; csak 30 percen belüli jelölő számít, olvasás után törlődik.
