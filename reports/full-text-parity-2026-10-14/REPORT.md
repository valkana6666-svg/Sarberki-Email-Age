# Sárberki – jóváhagyott teljes vendégszöveg-paritás, 2026-10-14

Alap: `gmail-test-subject-allowlist`, `222fbfd69faa0879732130767e044695ac0d0ecc`.
A projektgazda külön engedélyezte, hogy a chatbot ugyanazt a meglévő teljes
e-mail-szöveget használja, az üzleti szabályok változtatása nélkül.

## Elkészült

A `shared-core/inquiry-channel-adapters.mjs` `buildChatInquiryReply` függvénye
ugyanazt a már létező `renderEmailDecision` hívást használja, mint az
e-mail-adapter. A teljes vendégszöveg és a magyar kezelői levél betűre azonos
azonos tények, nyelv és evidenciák mellett. Nem csak státuszrészt, normalizált
tényeket vagy döntést hasonlítunk. A chatbot teljes levélszövege hosszabb lett;
az e-mail-szöveg, központi renderer és üzleti döntés nem változott.

Nem változott normalizáló, ár-, kapacitás-, dézsa-, lemondási vagy foglalási
szabály, Auth/RLS/CAS/audit, adatbázis és approval guard. Nincs második renderer,
küldési művelet vagy felhatalmazás. A korábban jóváhagyott felhős v4 ügyet nem
módosítottuk és nem hagytuk jóvá ismét.

## Tényleges hívási utak

| Megjelenítési út | Ellenőrzött viselkedés |
|---|---|
| Booking-chat: `chat-session.mjs` → közös chatbot-adapter → `chat-view.mjs` | A session teljes `.text` és `.response.reply` értéke az e-mail-adapter teljes levele; a view `textContent` útján változtatás nélkül jeleníti meg |
| Chatbot inquiry preview | A tényleges availability válasz `.response.reply` értéke ugyanaz a teljes e-mail-szöveg |
| Szerveres e-mail: `server-booking-runtime.mjs` ingest / preview → e-mail-adapter | A mentett atomikus szintetikus draft ugyanaz a teljes `.text`; négy nyelven a chatbot-adapterrel és HU review-val exact egyezés |
| Általános chatbot FAQ | Változatlan; nem a booking-agent tervezete, ezért nem cseréltük a válaszait e-mail-levelekre |
| Reader operator portal | A `renderCentralConversation` rövid belső státuszpanelje változatlan; nem a vendégchat kimenete és nem küldhető önálló vendégdraftként |
| Régi helyi Gmail UI | `index.html` / `case-state.mjs` és Gmail transform közvetlen központi renderer útja változatlan; nem állítunk azonosságot a még nem bekötött felhős Gmail UI-ra |

## Célzott ellenőrzés

```sh
node --test tests/full-guest-channel-parity-20261014.test.mjs \
  tests/synthetic-mail-postgres-e2e-20261014.test.mjs \
  tests/chatbot-session.test.mjs tests/chatbot-auto-language.test.mjs \
  tests/chatbot-inquiry-preview.test.mjs tests/channel-review-translation.test.mjs \
  tests/server-inquiry-planner.test.mjs tests/central-channel-parity.test.mjs
```

Az első célzott futás 63 ellenőrzésből 59 PASS és 4 FAIL eredményt adott: a régi
négy fordítási teszt a magyar rövid státuszszöveget várta. Az elvárt viselkedést
a jóváhagyott teljes levélre frissítettük: teljes guest text és teljes HU review
egyenlőség az e-mail-adapterrel; a közös státuszrész a levélben továbbra is
megmarad. Ezt a kizárólag érintett tesztfájlt újrafuttattuk:

```sh
node --test tests/channel-review-translation.test.mjs
```

**6 PASS, 0 FAIL, 0 SKIP.** Így mind a 63 külön célzott ellenőrzéshez rendelkezésre
áll sikeres bizonyíték az új megvalósítással; a teljes korábbi 1457 tesztet nem
ismételtük meg kézzel. A korrigált négy elvárás nem rejti el hibás döntést:
az e-mail/chat döntés és safety továbbra is azonos, az ismeretlen/stale
kapacitás vagy ár, hiányzó adatok és jogosulatlan művelet blokkolása változatlan.

Az öt új konkrét szövegteszt HU/DE/SI/EN nyelven a tényleges booking session és
preview kimenetét ellenőrzi, valamint a hiányzó dátumos esetet. A joined
PostgreSQL-próba négy MIME levélből, kitalált kapacitás/árból, Reader tiltásokból,
külön jóváhagyóból, ismeretlen kapacitás/ár miatti tiltásból és újraindítás utáni
auditból áll; szimulált Auth HTTP, tényleges PGlite PostgreSQL motor. A testsuite
nevében szereplő iPhone állítás nem új fizikai eszközpróba ebben a munkában.

`git diff --check` sikeres. Az új commit, CI és pontos Netlify build SHA a
közzététel előtti állapotban **NEM IGAZOLT**; ezt a koordinátor külön ellenőrzi.

## Fennmaradó V1-feladat

A közös szerveres e-mail és tényleges booking-chat szövegparitása lezárható.
A régi Gmail kezelőfelület felhős Writer ingest-and-draft bekötése és a tényleges
Gmail/OAuth → tartós ügy → Reader → jóváhagyás út továbbra sem teljes E2E kész.
A korábbi `email-e2e-2026-10-14/PLAN.md` zárt szintetikus integrációs terve külön
következő lépés; ebben a változásban nem általánosítottuk a cloud fixture guardot,
nem kapcsoltunk be valódi vendégadatot, e-mail-küldést vagy Previo-írást.
