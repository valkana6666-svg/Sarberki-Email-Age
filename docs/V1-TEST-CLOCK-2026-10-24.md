# V1 történeti tesztórák javítása – 2026-10-24

## Hiba és eredmény

A 40124649923 alkalmazás-CI történeti, október 23–25-i fixture-adatokkal az október 24-i valós órán futott. A múltbeli érkezést az alkalmazás helyesen elutasította, ezért a teszt nem érte el a kapacitás/ár/jóváhagyási ellenőrzést. A Gmail VM-harnessből az új időkorlátos olvasó AbortController/setTimeout/clearTimeout elemei, a külön státuszharnessből a window objektum hiányzott.

A javítás kizárólag öt tesztfájlt érint. A Node Date-mock a történeti fixture, JWT, bizonyíték és a valódi beágyazott PostgreSQL óráját együtt rögzíti; a hook utána visszaállítja az órát. A Gmail VM a valódi tesztidőzítőket kapja, a HTTP továbbra is fake transport. Az alkalmazásban nincs új óra-override, múltbeli dátumok engedélyezése, fixture-scope bővítése vagy küldési jog.

Új negatív próba: múltbeli érkezésnél sem kapacitás-, sem árforrást nem szabad hívni. Eredmény PASS.

## Bizonyíték

- Célzott négyfájlos futás: 55 PASS, 0 FAIL, 0 SKIP, valódi PGlite PostgreSQL és szintetikus Auth/Gmail HTTP.
- Három külön Pushover státuszteszt: 3 PASS, 0 FAIL, 0 SKIP; csak mock, nem kézbesítési bizonyíték.
- Teljes npm test: 1903 PASS, 0 FAIL, 0 SKIP, 52,6 másodperc.
- Az éles környezet, main, valódi e-mail és Previo-írás változatlan/tiltott.
- CI és pontos tesztdeploy-egyezés a publikálás után külön ellenőrzendő; a helyi PASS nem hosted end-to-end igazolás.

## V2/V3 érték

A történeti regresszió és a valós szolgáltatói idő külön bizonyítékként kezelhető. Nem készült második üzleti döntésmotor vagy új jogosultsági rendszer.
