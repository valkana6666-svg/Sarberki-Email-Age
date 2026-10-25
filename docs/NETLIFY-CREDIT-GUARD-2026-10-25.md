# Netlify-kreditvédelem – 2026-10-25

Kizárólag a gmail-test-subject-allowlist ág változik. Main, production, PR #7 és a külön mentési ág változatlan.

## Aktuális, adminfelületen igazolt állapot

2026-10-25-én a tulajdonos jóváhagyta a Google-belépést, és a tulajdonosi fiókot választotta. A friss Netlify-munkamenet sikeres.

- Projekt: leafy-chimera-2403e5; site ID a státuszjelvényben: 9a251556-467c-4d18-a701-5d85ec159a83.
- Repository: valkana6666-svg/Sarberki-Email-Age; a tesztprojekt Netlify által production branch-nek nevezett ága: gmail-test-subject-allowlist. Ez NEM az éles moonlit projekt.
- Build status: Active → Stopped, elmentve és visszaolvasva.
- A Deploys oldalon „Builds are stopped”, a Trigger deploy gomb disabled (isEnabled=false). Nem próbáltunk szándékos buildindítást.
- Branch deploys: csak a kijelölt ág. PR Deploy Previews korábban bármely erre az ágra irányuló PR-nél engedélyezve; a Stopped builds az automatikus buildet ezeken is megállítja. Ezt a PR-beállítást külön nem változtattuk.
- A Build hooks szakasz csak Add build hook gombot mutatott, meglévő hookbejegyzést nem.
- Kreditmaradék: 500 / 500; October 25 grant, No expiration. Auto recharge: Disabled. A felület néhány perces számlázási késést jelez; a maradék pillanatfelvétel, nem jövőbeli költséggarancia.
- A Sep 28–Oct 27 számlázási bontás: 1167 Production deploy, 17505 kredit; teljes felhasználás 17529.9 kredit. Az adott Netlify-környezetben egy Production deploy így 15 kreditnek felelt meg.
- A projektbontás eltérő, Sep 27–Oct 25 időablakában leafy: 1178 build, átlag 18 s, összesen 340 perc; restore tesztprojekt: 25 build, 6 perc; fabulous-macaron: 1 build. A buildszám és a számlázott Production deploy szám nem ugyanaz a mutató/időablak.

Adminbizonyítékok:
https://app.netlify.com/projects/leafy-chimera-2403e5/configuration/developer-settings
https://app.netlify.com/projects/leafy-chimera-2403e5/deploys
https://app.netlify.com/teams/valkana6666/billing/general

## Igazolt kiváltó tényező és bizonyítékhatár

A korábbi sarberki-test workflow minden ágpush után npm testet, majd automatikusan az adott SHA-val egyező Netlify-telepítést és HTTPS smoke teszteket várt el. Ez fejlesztési commitonkénti telepítési kényszert okozott. A Netlify adminfelületén a Git-integráció és az aktív buildállapot frissen igazolt. A deployelőzmények külön kiadást mutattak a 4afcc14 dokumentációs, az e116169 SQL-próba és az 1e17a56/53abf61/caf45bb/daab220/8df2155 mentési commitokra is. A fő költségforrás a tesztág gyakori Git-pushainak automatikus kiadása volt; mind az 1167 számlázott esemény egyedi teljes auditját nem végeztük el. A GitHub-tesztek önmagukban nem deployparancsok. Nem állítjuk, hogy mind az 1167 telepítést ez a workflow indította.

A megvásárolt 500 kredit teljes aktuális maradékát most az adminfelület is igazolta, a fenti késleltetési korláttal.

## Elkészült korlát

- A normál push-CI csak GitHubon fut. A Netlify ellenőrzése külön deployed-test-verification job; workflow_dispatch és verify_deployed=true kell hozzá. Ez a job sem telepít.
- A Gmail célzott readonly workflow automatikusan csak a kapcsolódó fájlok változására fut, élő Google-hívás és deploy nélkül. A pontos deploy-ellenőrzés külön választható.
- A netlify.toml ignore parancsa a leafy-chimera-2403e5 tesztoldalon alapból leállítja a buildet. Csak a kijelölt ágon, önálló sor elején szereplő [netlify-test-release] commitjelölés engedélyezhet buildet. Sikertelen Git-azonosításnál a tesztbuild tiltott.
- Más SITE_NAME esetén az ignore parancs nem tilt új buildet; a production main konfigurációját nem módosítjuk.
- A védelmet bevezető commit [skip netlify] jelölést is kap. Nincs release marker, nincs deployparancs vagy új Netlify-hitelesítő.

Korlát: az ignore parancsot a Netlify build hook megkerülheti. Az adminoldali Stopped builds most igazoltan aktív; a hookszakasz nem mutat meglévő hookot. A Git-oldali védelmet nem nevezzük a fiók minden lehetséges indítására kiterjedő tiltásnak. A build kezdeti előkészítésének díjmentességét nem állítjuk.

## Következő ellenőrzött kiadás

1. Több fejlesztés összegyűjtése, érintett célzott GitHub-tesztek PASS.
2. Adminhozzáféréssel kizárólag a leafy tesztprojekt azonosítása; normál állapotban Project configuration → Developer settings → Continuous deployment → Build settings → Build status: Stopped builds. Az éles moonlit projektet ne módosítsa.
3. Szükséges tesztkiadáskor a tesztprojekt buildjének ideiglenes aktiválása és egyetlen [netlify-test-release] jelölésű, ellenőrzött kiadási commit. Kiadás után vissza Stopped builds. Az aktiválás önmagában nem telepítés.
4. Pontos kiadási SHA ellenőrzése a /api/health válaszában, majd kézi verify_deployed=true ellenőrzés ugyanarra a kiadási SHA-ra. Fejlesztési HEAD és kiadási SHA tudatosan eltérhet; ez nem ok újabb automatikus deployra.
5. iPhone-on csak a megváltozott funkció ellenőrzése. Ne telepítsünk dokumentáció, mentés vagy puszta tesztmódosítás miatt.

## Ellenőrzés

Új, célzott kaputesztek: 4 PASS / 0 FAIL / 0 SKIP. Ellenőrzik a normál/mentési commit tiltását, a rossz ág tiltását, a production oldal változatlan útvonalát és az offline CI–HTTPS ellenőrzés szétválasztását. A Netlify-fiók tényleges Stopped builds állapotát a sikeres belépés után a mentett beállítás és a tiltott Trigger deploy gomb igazolta.

A tesztoldal health végpontja a módosítás előtt HTTP 200 és 20c0c9dfd8e17f75bd54381db5268101c92ad91b telepített SHA-t adott. A korábbi pontos deploy-egyezés így frissen igazolt. A kód jelen módosításai nem igényelnek új alkalmazásdeployt.

Források:
- https://docs.netlify.com/build/configure-builds/ignore-builds/
- https://docs.netlify.com/build/configure-builds/stop-or-activate-builds/
