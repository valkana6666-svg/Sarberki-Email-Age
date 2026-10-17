# Gmail vegyes szállás-/dézsaérdeklődés javítása – 2026-10-17

## Reprodukált hiba

A szabad faházról és dézsáról egyszerre érdeklődő levél a helyi ügytárban
`service_request` besorolást kapott. A közös dézsaparser csak kifejezett
szállásfoglalási igét ismert fel; a „lenne-e szabad faházuk” kérdést nem.
Az inline elemző eredeti `availability_request` szándékát ez felülírta.
A `deriveCaseView` ezért nem mutatta a hiányzó telefonszámot/gyermekkorokat,
és nem kapcsolta be a szállásügy kapacitásfigyelmeztetését.
Nem állítjuk, hogy ezzel felhős jóváhagyás vagy külső foglalás történt.

## Javítás és határ

A meglévő közös `requestsAccommodation` felismeri a szállásnévhez közvetlenül
kötött elérhetőségi kérdést magyarul, angolul, németül és szlovénül.
Nem a teljes levél tetszőleges „szabad” szava dönti el a szándékot: az
„elérhető dézsa a meglévő házunknál” továbbra külön szolgáltatási útvonal.
Nincs második parser/motor, új jogosultság vagy séma. A kérdés nem bizonyít
szabad kapacitást, és nem ad dézsajóváhagyást.

Új UI-regresszió a valódi inline elemzőt, Gmail-importot és helyi runtime-ot
futtatja kitalált `.invalid` feladóval. Igazolja a helyes szállásbesorolást,
a hiányzó telefonszámot és gyermekkorokat, a kapacitásfigyelmeztetést,
a tiltott jóváhagyási gombot és pending állapotot. A javítás előtti futás
1 FAIL-lel reprodukálta a téves service_request besorolást.
Két további teszt négy nyelven ellenőrzi a vegyes érdeklődést és az ellenpéldát.

## Ellenőrzés

- Kiinduló commit: `394c8abaf89456a4b4200cbf4dfbac42be9547f4`.
- Meglévő [CI 39011314108](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39011314108):
  1685 PASS / 0 FAIL / 0 SKIP, exact deploy PASS; újrafuttatás nélkül átvéve.
- Érintett két célpont: 61 PASS / 0 FAIL / 0 SKIP.
- Teljes helyi `npm test`: 1688 PASS / 0 FAIL / 0 SKIP.
  A besorolás kapacitáskaput érint, ezért az AGENTS.md alapján indokolt.
- `git diff --check`: PASS.
- A célzott és teljes futás átfed, nem összeadandó.

Ezek offline szintetikus/VM és a teljes suite meglévő izolált PostgreSQL
bizonyítékai. Új postaládalevél, tényleges Gmail OAuth, managed DB-írás,
e-mail/Pushover, Previo-hívás és foglalás nincs. Production/main változatlan.
A commit saját CI/deploy eredménye külön ellenőrizendő.

Meglévő helyi `duplicate` ügyek régi szándékát nem migráljuk automatikusan;
a friss új üzenet besorolását javítjuk. Az engedélyezett pontos receipt teljes
lánca, tényleges iPhone/PWA, végső mentés/restore és Previo-tesztkapcsolat
továbbra külön nyitott kapu. V1 becslés kb. 90%.

V2/V3: az egységes magban maradó csatornabesorolás őrzi az elkülönített
szállás-, szolgáltatás-, kapacitás- és jóváhagyási felelősségeket.
