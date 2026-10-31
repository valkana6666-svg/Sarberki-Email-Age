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
