# Izolált szintetikus Gmail-olvasás E2E – 2026-10-14

Alap: `gmail-test-subject-allowlist`, `4ea4b936117b60ad461a7a616faf2cfb8a12b218`.

## Igazolt hiány és minimális javítás

A korábbi tesztek a Gmail transformot és a PostgreSQL-láncot külön kapcsolták
össze; a tényleges read-gomb / GIS callback / picker / normalized-event út nem
érte el ugyanabban a próbában a meglévő explicit felhős mentés controllerét.

Az új teszt először **1 PASS, 4 FAIL** eredményt adott. A rossz fiók és sikertelen
display tiltása sikeres volt, DE/SI/EN esetén azonban a pontos registry-levél
Gmail pickerből megnyitva sem engedélyezte a felhős mentés gombját. Ennek konkrét
oka: `loadedMail` csak a külön fixture-load gombnál kapott értéket, a meglévő
`sarberki:gmail-normalized` listener nem stage-elte a pontos Gmail-read rekordot.

Az engedélyezett javítás kizárólag az `operator-login-ui.mjs` meglévő listenerét
érinti. Busy állapotban a korábbi invalidáció változatlan; nem érvényteleníti a
fixture-load várakozó turnjét. Egyébként először törli a korábbi staged állapotot,
majd csak aktív session, pontos registry JSON, aktuális törzs és egyező event
message ID esetén engedélyezi az **explicit** Writer-mentést. Automatikus POST
nincs. Normál/idegen/módosított levél és inaktív session továbbra sem írhat.

Gmail policy, protected renderer, üzleti szabály, API guard, registry, cookie
Auth, jogosultság, SQL vagy CI workflow nem változott. A már jóváhagyott HU ügy
és az eredeti v4 cloud minta nem érintett; a Codex izolált futása nem végzett felhős műveletet.

## Új összekötött bizonyíték

```sh
node --test tests/gmail-read-cookie-postgres-e2e-20261014.test.mjs \
  tests/operator-login-ui.test.mjs
```

**19 PASS, 0 FAIL, 0 SKIP**: az új integration fájl 6 ellenőrzése és a közvetlenül
érintett meglévő controller suite 13 ellenőrzése. Más suite és teljes kézi
regresszió nem indult. A korábbi 1472 teszt eredménye az alapállapot bizonyítéka,
nem az új commit teljes CI-eredménye. Syntax/static build és
`git diff --check` sikeres; a publikálandó controller bájtra egyezik a forrással.

| Út / ellenőrzés | Bizonyíték |
|---|---|
| Read gomb → GIS callback | A változatlan `gmail-readonly.js` tényleges callbackje fut, controlled fake GIS-szel; readonly scope, consent, account hint és granted-scope beállítás ellenőrzött |
| Profile → list → message GET | Csak szimulált Gmail GET-ek megengedettek; rossz profile account után nincs list/message kérés; az eredeti query és lapozás ellenőrzött |
| INBOX / dátum szűrés | A régi és SENT fake MIME nem kerül a pickerbe; a meglévő Gmail policy változatlan |
| MIME / picker / display | A valódi transform UTF-8/base64url és DE multipart plain-text alternatívát olvas; a tényleges picker/open handler fut |
| Staging / explicit mentés | A tényleges `initOperatorLoginPanel` normalized listener stage-el; a display callback csak DOM-ot és eventet ad, nem hívja közvetlenül az API-t; valódi controller Save indítja a cookie API-t |
| Kizárt inputok | Nem regisztrált sender, módosított subject/törzs, eltérő event ID és inaktív session → disabled save, nulla felhős POST |
| Sikertelen feldolgozás | False/throw display callback után nincs helyi read marker; Gmail token nem kerül localStorage-ba és nem exportálódik a window-ra |
| DE / SI / EN ügy | A tényleges cookie handler, szerveres kinyerés, repository és PostgreSQL tárolja a pontos nyelvet, Oct23–25 dátumot, 2 felnőtt/0 gyermek, Deluxe és kitalált telefont; tárolt levél saját nyelvű, HU review magyar |
| Ismételt megnyitás / mentés | Azonos levél ismételt explicit save-ja ugyanazt a v1 ügyet adja, nem hoz létre új verziót |
| Reader | A tényleges readonly cookie kliens listáz és tárolt draftot preview-z; exact-fixture ingest, review és approve tiltott, a v2 változatlan |
| Külön jóváhagyó | Read+approve / write nélküli szerep; review-write tiltott; exact tárolt hash jóváhagyható; stale/repeated approve tiltott; ügyenként egy audit azonos actorral és v3-mal |
| Új PostgreSQL-példány | Dump után új PGlite-példányból RLS-védett cookie readback három internálisan jóváhagyott ügyet és ügyenként egy auditot igazol |

## Bizonyíték szintje és nyitott határok

Ez **izolált szintetikus transport E2E**, nem tényleges Google OAuth vagy
valódi mailbox-olvasás. A fake GIS, Gmail profile/list/message HTTP és Supabase
Auth HTTP kontrollált válaszokat adnak; nincs külső hálózat. A meglévő cookie
titkosítás, controller, API/runtime/repository, PostgreSQL-szerepek/RLS/CAS,
session/issuer feltételek, attesztáció és tranzakciós audit tényleges kódon futnak.

A régi `index.html` display/renderer callbackje ebben a tesztben DOM/event
helyettesítés; nem új implementált elemző vagy API-bypass. A valódi helyi display
folyamathoz korábbi külön bizonyíték tartozik. Az új teszt nem futtat élő
Previo-, Pushover-, Gmail-, Netlify- vagy Supabase-műveletet, admin/service role
alkalmazásjogosultság-megkerülést, e-mail-küldést vagy valódi vendégfeltöltést.
Kizárólag új, eldobható PGlite-adatbázis kitalált identitásainak/sémájának
test-provisionálása történik.

A három fake message/thread ID a zárt registry kitalált, verziózott azonosítója.
A Google valós üzenetazonosítókat rendel: ezek leképezése és tényleges OAuth
transzportja **nincs igazolva és nincs megnyitva**. Nem bővítettük a registryt
tetszőleges Google ID-ra vagy `.invalid` feladóra. Valódi Gmail rekord nem kap
automatikus felhős írási jogot a listener-javítástól.

Az izolált test jóváhagyási szerepe szimulált; nem jelent tényleges emberi
jóváhagyást a már meglévő felhős DE/SI/EN ügyekre. A koordinátor külön végzi a
hivatalos felületi kézi readback / emberi jóváhagyási átadást. Az új commit és
telepített test build SHA ellenőrzése közzététel előtt még hátravan; a régi teljes
CI-eredményt nem tulajdonítjuk ennek a patchnek. Production/main változatlan.

## Koordinátori felhős ellenőrzés és továbbvitel

A Work csak a három meglévő DE/SI/EN ügy védett visszaolvasását végezte:
`a11209e5-c49a-4748-ab98-3acdd2683089`,
`bea0998c-59dc-4a9c-8689-31b90fec1639`,
`926cc81d-16a1-435f-bfd3-41e874c1b1bc`. Mindhárom v2 / pending / audit=[].
A német tárolt tervezet és magyar ellenőrző szöveg betöltve; tényleges személyes
jóváhagyása külön kezelői lépés. A korábban igazolt HU v3 jóváhagyást nem ismételtük.

A felhasználó kizárólag célzott futásokat kért: az új commit a GitHub teljes
Actions-futását kihagyó `[skip actions]` jelöléssel készül. CI workflow és
jogosultság nem változik; a korábbi 1472 PASS a 4ea4b936 alaphoz tartozik.
A Netlify teszttelepítés pontos SHA-ját a Work külön ellenőrzi.

V2/V3 érték: az olvasási csatorna és az explicit, hitelesített írási művelet
határa megmarad; a determinisztikus mag, tenant, külön szerepek és audit
változatlanul használhatók. A bizonyíték korlátja a fent leírt szimulált
Google/Auth transzport; élő adatkapcsolatot és automatikus végrehajtást nem igazol.
