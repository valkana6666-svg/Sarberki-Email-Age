# Felnőttlétszám és helyi gyermekhiány-jelzés – 2026-10-17

## Hiba és javítás

A Gmail-felületen nyolc felnőttnél a hiánylista gyermekstátuszt kért,
miközben a közös választervezet ezt már nem kérdezte. A deriveCaseView
korábban minden üres gyermeklétszámot visszakérdezendőnek jelölt.

A helyi hiánylista most nem kérdez vissza, ha a felnőttlétszám pozitív egész,
az összlétszám hiányzik vagy egyezik vele, és az aktuális levél nem említ
gyermeket. Ez kizárólag megjelenítési szabály: az üres/null gyermekadat nem
lesz explicit 0, nincs ügy-/tény-/tervezetverzió-migráció vagy felhős írás.
Eltérő összlétszám, ismeretlen felnőttlétszám és bizonytalan gyermekemlítés
továbbra gyermekstátusz-pontosítást kér; explicit gyermekeknél az életkor
ellenőrzése megmarad. Kapacitás-/ár-/jóváhagyási kaput nem nyitunk.

A sarberki-core meglévő gyermekemlítési kifejezése egy közös hasChildMention
segédbe került. A Gmail party-projekció és intake-normalize ugyanezt hívja,
azonos felismerési kifejezéssel; nincs új nyelvi motor vagy díjszabály.
Idézett előzmény nem számít aktuális gyermekemlítésnek.

## Tesztbizonyíték

- Kiinduló kód cdb7784c1331deca87080b322bcc24fbd953c066, meglévő CI
  39014112364: 1692 PASS / 0 FAIL / 0 SKIP, exact deploy PASS.
- Három új case-state regresszió: HU/DE/EN/SI pozitív és negatív minták,
  eltérő total, hiányzó adults, idézett gyermekek, kötelező gyermekkorok,
  változatlan state és megmaradó kapacitási tiltás.
- Új inline UI/Gmail-import regresszió: a tényleges hiánylista, figyelmeztetés
  és tervezet egyezik; gyermek hozzáadása/életkor-kitöltése/ismét kiürítése
  visszaállítja, majd feloldja a megfelelő hiányokat. Nincs hálózati hívás.
- Javítás előtt az új három állapottesztből két reprodukáló FAIL, egy PASS.
- Javítás után 66 célzott PASS / 0 FAIL / 0 SKIP.
- Teljes helyi npm test a cdb7784 bázison: 1696 PASS / 0 FAIL / 0 SKIP.
  A közös parsersegéd kiemelése és a kapacitásbemeneti jelentés indokolta.
- Az időközben érkezett, külön fájlt érintő paritástesztek felülírás nélkül
  átvéve: új bázis 517503a2b9e30fb7ae02aff812e157066f5524f6.
  Az érintett paritásfájl 44 PASS / 0 FAIL / 0 SKIP ezen a kombinált állapoton.
  A teljes korábbi suite-ot emiatt helyben nem ismételtük; a commit CI-je
  külön ellenőrizendő. A célzott futások átfednek, nem összeadandók.
- git diff --check: PASS. Az első új UI-orákulum undefined helyett a valódi
  üres string állapotot várja; a kód nem módosult az orákulum kedvéért.

Módosult: case-state.mjs, sarberki-core.mjs, intake-normalize.mjs,
tests/case-state.test.mjs, tests/case-ui.test.mjs és ez a jelentés.
Csak offline szintetikus/VM és a teljes suite izolált PostgreSQL-próbái.
Nincs új Gmail/OAuth, valódi vendégadat, e-mail/Pushover, Previo vagy foglalás.
Production/main és a korábban igazolt privát receipt v1 változatlan.

V1 kb. 91%, mérnöki becslés. A kisebb UI-javítás nem zárja le az iPhone/PWA,
végső snapshot/restore és Previo-tesztkapcsolat kapuit. Következő feladat a
végső jelölt mentési lefedettségének ellenőrzése, az új szolgáltatássémával.
V2/V3: közös, csatornák között újrahasznosított értelmezés; a megjelenítés nem
hamisít explicit vendégtényt és nem ad külső végrehajtási jogosultságot.

## Későbbi összevonás és a régi tesztelvárások korrekciója

A mentés előtt a távoli ág 7bbc113-ra, majd bccc6501441a4095a83ddb44fc0cc60bb3261cda
állapotra lépett. A sarberki-core időközben kapott fizetési/lemondási
változásai és az új paritástesztek megmaradtak; a saját helperhunk tisztán
egyesült. A korábbi tesztbizonyíték erre az új kódra már nem volt elegendő.

A 7bbc113 kódon futó teljes ellenőrzés 1781 tesztből 1778 PASS / 3 FAIL /
0 SKIP eredményt adott. Mindhárom hiba a változatlan gmail-normalize.test.mjs
régi elvárása: automatikus lemondási ígéret; 15 főre felső lemondási sáv;
15 főre felső előlegszázalék. A távoli bccc650 [CI 39023485427](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39023485427)
is FAILURE volt. Nem a gyermekhiánylistát igazítottuk hibás orákulumhoz.

A gmail-normalize.test.mjs most a jóváhagyott „15 fő felett” határt ellenőrzi
14/15/16 fős pozitív esetekkel, négy nyelven. A befecskendezett különböző
lemondási napok csak tesztadatok, nem új üzleti szabály. A határidőteszt
tiltja az automatikus törlési ígéretet és megköveteli a munkatársi tájékoztatást.
Productionkódba ezek miatt további üzleti változtatás nem került.

A bccc650 bázison az új paritásfájl 117 PASS / 0 FAIL / 0 SKIP;
a javított Gmail-normalize + case-state/UI + Gmail-party célpontok együtt
137 PASS / 0 FAIL / 0 SKIP. A végső teljes futás és a commit CI-je külön
ellenőrizendő; a korábbi futások számai történeti részállapotok.

Végleges helyi teljes futás bccc650 bázison: **1785 PASS / 0 FAIL / 0 SKIP**,
git diff --check PASS. A három régi elvárás korrekciója után indokolt
ismétlés; nem a már sikeres korábbi változat indokolatlan újratesztelése.
