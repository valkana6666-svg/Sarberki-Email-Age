# Zárt szintetikus Gmail UI → felhős ügytár – előkészített változás

Dátum: 2026-10-14. Alap: `gmail-test-subject-allowlist`,
`010a0816fc1e935b06a2e35e4588e9d7c34f5c11`.

**A kód és az izolált bizonyíték elkészült; a felhős telepítés és új ügyeken végzett
kezelői próba még NEM IGAZOLT.** Nincs új endpoint, Auth, tároló, szabálymotor,
DB-migráció, jogosultságbővítés, titokprovisionálás vagy valódi vendégadat.
A korábbi eredeti jóváhagyott v4 ügyet nem írtuk és nem hagytuk jóvá újra.

## Pontos engedélyezett készlet és guarddiff

| Nyelv | Üzenetazonosító | Feladó |
|---|---|---|
| HU | `sarberki-closed-mail-hu-20261014-v1` | `hu@closed-mail-fixture.invalid` |
| DE | `sarberki-closed-mail-de-20261014-v1` | `de@closed-mail-fixture.invalid` |
| SI | `sarberki-closed-mail-si-20261014-v1` | `si@closed-mail-fixture.invalid` |
| EN | `sarberki-closed-mail-en-20261014-v1` | `en@closed-mail-fixture.invalid` |

Mindegyiknél a mailbox pontosan `sarberki_closed_mail_fixture`, a thread
`sarberki-closed-thread-{nyelv}-v1`, a received_at
`2026-10-14T06:00:00.000Z`. Teljes törzs: a verziózott
`shared-core/synthetic-mail-fixtures.mjs` négy változatának pontos szövege.
Mind a négy 2026-10-23–25., Deluxe, 2 felnőtt, 0 gyermek igény; telefonszámuk
szándékosan kitalált, nem használható kontakt: `+36 00 000 0000`.
A Gmail-wrapper tárgya pontosan `TESZT SÁRBERKI CLOSED {HU|DE|SI|EN}`.

Szerveri ingesthez minden envelope mező egyenlősége és pontos kulcskészlet
szükséges. Extra RFC metadata / case-id, idegen sender, azonosító, dátum, thread,
mailbox vagy egyetlen módosított törzskarakter is tiltott. A MIME UI provenance
ellenőrzi a pontos tárgyat és Gmail-wrapper providerét is; a szerver az envelope
tartalmát önállóan egyezteti a beépített registryvel, nem bízik a UI validációban.
Tetszőleges `.invalid` cím vagy kliens által állított normalizált tény nem elég.

Olvasható guarddiff:

```diff
 assertCloudSyntheticReviewCase(record):
+ if(matchesClosedSyntheticMailRecord(record))return;
  // Az eredeti Reader fixture összes meglévő ellenőrzése változatlan.

 cookie POST ingest-and-draft:
+ pontos cloud project/host/feature/key kapu
+ tenantId=sarberki-test, expectedRevision=0
+ kizárólag tenantId/action/envelope/expectedRevision
+ teljes envelope = az egyik zárt registry bejegyzés
+ protectedWrite: friss Auth + DB Write + same-origin POST + CSRF
  meglévő runtime.ingest(...,{persistDraft:true}) + repository + SQL
```

A már létező bearer alkalmazásút nem változott. A cookie út nem enged általános
ingest-et, kliens `values`-t, `approvedCaseId`-t vagy más tenantot. A runtime ismét
a meglévő normalizálóval nyeri ki a tényeket, atomikusan tárolja a függő draftot;
duplikált message nem hoz létre új verziót. A cloud review/approve/readback az
eredeti mintát VAGY egy pontos zárt új registry-recordot fogad el. Az SQL/RPC,
attesztáció, session, RLS, CAS és audit változatlan, külön Writer és read+approve
kezelővel.

## Felhasználói út

Az `index.html` Gmail szekciója három konkrét vezérlőt kapott: nyelvválasztó,
„Szintetikus Gmail MIME betöltése”, külön „Betöltött tesztlevél mentése a felhőbe”.
Ugyanaz az `operator-login-ui` controller, busy gate és létező cookie session
kezeli őket. A load a meglévő `sarberkiGmailTransform` és `displayGmailRecord`
függvényeken megy át, a meglévő helyi analyze/renderer szövege változatlan.
A load önmagában nem indít felhős írást. A save kizárólag a még mindig pontosan
azonos, betöltött registry-recordot továbbítja; session-/nyelv-/más Gmail-ügy
váltása érvényteleníti a staged bejegyzést, módosított aktuális törzsnél nincs írás.
Friss Auth és valódi Write jog a szerveren kötelező, Reader/approver nem írhat.

A visszakapott caseId/revision kiválasztja a meglévő Reader-előnézetet. A külön
jóváhagyási link csak validált caseId-t tölthet elő a hivatalos felületen: nem
indít load, review, írás vagy approve műveletet. Writer külön előkészít, a külön
jóváhagyó elolvassa a tárolt teljes szöveget és csak explicit checkbox/kattintás
után hagyja jóvá. Korábbi jóváhagyást nem hozunk létre újból.

## Élő provider mellékhatásának kizárása a helyi fixture-betöltésnél

A meglévő Gmail display analysis-ready és gmail-normalized eseményei automatikus
kapacitás/ár adaptereket indítanak. Ezeket nem rejtett event-capture tiltással
kerültük meg. Az `availability-recommend.mjs` és `price-check.js` legkorábbi
provider pontjai a pontos aktuális Gmail registry-record + aktuális törzs
egyezésénél leállnak. Megmaradnak a normál UI-események és helyi renderer.
A korábbi jóváhagyott ár, pending quote és kapacitás-evidence nem használható
ellenőrzött adatként: a már meglévő invalidateQuote / availability actions és
UI-törlés alkalmazásával csak függő, nem ellenőrzött helyi állapot marad.
Későn beérő provider-válasz sem írhat vissza ellenőrzött adatot.

A kézi ár/kapacitás gomboknál ugyanaz a guard működik. A régi helyi Approve
közvetlen beforeApproval útja miatt a `booking-runtime.mjs` kizárólag böngészős
transport callbackje is visszautasítja a pontos current fixture-kérést az első
fetch előtt. A core beforeApproval és üzleti szabály nem változott. A guard
csak tiltani tud; nem ad jogosultságot vagy elérhetőségi bizonyítékot. Nem-fixture
adatokon a korábbi provider kapuk változatlanok. A szintetikus árat és készletet
csak a meglévő felhős synthetic review adapter szolgáltatja, élő Previo nélkül.

## Külön igazolt élő nyelvhiba célzott javítása

Az első automatikus német kérdésben a `Telefon` közös DE/SI token miatt az eddigi
konzervatív kapcsolási szabály unknown-t adott, a session HU-ra esett vissza.
A meglévő nem konzervatív intake-detektor ugyanarra a mondatra DE-t adott.
A `chat-session.mjs` az első turnben most ezt a már létező intake-detekciót
használja; későbbi nyelvváltásnál a korábbi conservative szabály változatlan.
Manual override és reset változatlan. Védett `sarberki-core` detektor, vendégszöveg
vagy üzleti szabály nem változott. A tényleges német mondat, SI/EN közös kontakt
szavak, kétértelmű első üzenet és későbbi bizonytalan turn regressziója sikeres.

## Célzott ellenőrzés

```sh
node --test tests/closed-synthetic-mail-registry.test.mjs \
 tests/cloud-synthetic-approval.test.mjs tests/operator-cookie-session.test.mjs \
 tests/operator-login-ui.test.mjs tests/chatbot-auto-language.test.mjs \
 tests/availability-reply.test.mjs email-price-chain.test.mjs
```

**128 PASS, 0 FAIL, 0 SKIP.** Tartalom: tényleges Gmail transform négy offline
MIME mintával; exact registry és módosított envelope/subject/törzs elutasítás;
cookie transport/CSRF/origin/Reader tiltások; meglévő PostgreSQL RPC + négy nyelvű
új ügy tárolása, idempotencia, külön approval és audit; változatlan eredeti
szintetikus record; UI explicit load/save és readonly session; provider-auto
események / kézi gombok zero fetch; korábbi ordinary provider tesztek és nyelvi
regressziók. A provider guard aktuális record/törzs-kötése és UI-edited-message
tiltása után csak az érintett három suite ismét futott: **79 PASS, 0 FAIL, 0 SKIP**.

```sh
node --test tests/closed-mail-browser-transport.test.mjs
```

**1 PASS, 0 FAIL, 0 SKIP**: kézi local approval közvetlen transportja fixture
esetén zero fetch; nem-fixture esetén az eredeti szerverkapu továbbra is érvényes.
Összesen 129 külön célzott ellenőrzéshez áll rendelkezésre sikeres bizonyíték.
Szintaxis, static build (fixture UI + új public registry jelen van) és
`git diff --check` sikeres. Teljes kézi regresszió nem indult.

## Állapot és következő ellenőrzés

Ez offline MIME és izolált PostgreSQL/DOM-harness bizonyíték; nem tényleges Gmail
OAuth-fiókból fogadott levél. A felhős változás alkalmazása előtt a koordinátor
ellenőrzi a pontos registry/guarddiffet, commitot, CI-t és Netlify build SHA-t.
Utána hivatalos Writer-belépéssel csak a zárt négy mintára végezhető kezelői
load/save → Reader → külön emberi review/approve → reload/audit próba. A régi v4
mintát nem hagyjuk jóvá újra, valódi levél nem tölthető fel. A teljes valódi Gmail
transzport és végleges vendégár/élő Previo-bizonyíték továbbra sem igazolt ebből
az előkészített patchből; production/main aktiválást nem tartalmaz.
