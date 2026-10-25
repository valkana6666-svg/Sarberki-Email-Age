# Netlify-kreditvédelem – 2026-10-25

Kizárólag a gmail-test-subject-allowlist ág változik. Main, production, PR #7 és a külön mentési ág változatlan.

## Igazolt kiváltó tényező és bizonyítékhatár

A korábbi sarberki-test workflow minden ágpush után npm testet, majd automatikusan az adott SHA-val egyező Netlify-telepítést és HTTPS smoke teszteket várt el. Ez fejlesztési commitonkénti telepítési kényszert okozott. A Netlify-fiók belépést kér: a 1167 telepítés pontos okonkénti bontása, Git-integrációja, branch/preview beállításai, build hookjai és aktuális kreditmaradéka NEM IGAZOLT. A GitHub-tesztek önmagukban nem deployparancsok. Nem állítjuk, hogy mind az 1167 telepítést ez a workflow indította.

A megvásárolt 500 kredit tulajdonosi adat; aktuális maradékként nem könyvelhető el.

## Elkészült korlát

- A normál push-CI csak GitHubon fut. A Netlify ellenőrzése külön deployed-test-verification job; workflow_dispatch és verify_deployed=true kell hozzá. Ez a job sem telepít.
- A Gmail célzott readonly workflow automatikusan csak a kapcsolódó fájlok változására fut, élő Google-hívás és deploy nélkül. A pontos deploy-ellenőrzés külön választható.
- A netlify.toml ignore parancsa a leafy-chimera-2403e5 tesztoldalon alapból leállítja a buildet. Csak a kijelölt ágon, önálló sor elején szereplő [netlify-test-release] commitjelölés engedélyezhet buildet. Sikertelen Git-azonosításnál a tesztbuild tiltott.
- Más SITE_NAME esetén az ignore parancs nem tilt új buildet; a production main konfigurációját nem módosítjuk.
- A védelmet bevezető commit [skip netlify] jelölést is kap. Nincs release marker, nincs deployparancs vagy új Netlify-hitelesítő.

Korlát: az ignore parancsot a Netlify build hook megkerülheti. Az adminoldali teljes Stop builds beállítás és a hookleltár külön ellenőrzést igényel. A Git-oldali védelmet nem nevezzük a fiók minden lehetséges indítására kiterjedő tiltásnak. A build kezdeti előkészítésének díjmentességét nem állítjuk.

## Következő ellenőrzött kiadás

1. Több fejlesztés összegyűjtése, érintett célzott GitHub-tesztek PASS.
2. Adminhozzáféréssel kizárólag a leafy tesztprojekt azonosítása; normál állapotban Project configuration → Developer settings → Continuous deployment → Build settings → Build status: Stopped builds. Az éles moonlit projektet ne módosítsa.
3. Szükséges tesztkiadáskor a tesztprojekt buildjének ideiglenes aktiválása és egyetlen [netlify-test-release] jelölésű, ellenőrzött kiadási commit. Kiadás után vissza Stopped builds. Az aktiválás önmagában nem telepítés.
4. Pontos kiadási SHA ellenőrzése a /api/health válaszában, majd kézi verify_deployed=true ellenőrzés ugyanarra a kiadási SHA-ra. Fejlesztési HEAD és kiadási SHA tudatosan eltérhet; ez nem ok újabb automatikus deployra.
5. iPhone-on csak a megváltozott funkció ellenőrzése. Ne telepítsünk dokumentáció, mentés vagy puszta tesztmódosítás miatt.

## Ellenőrzés

Új, célzott kaputesztek: 4 PASS / 0 FAIL / 0 SKIP. Ellenőrzik a normál/mentési commit tiltását, a rossz ág tiltását, a production oldal változatlan útvonalát és az offline CI–HTTPS ellenőrzés szétválasztását. A Netlify-fiók tényleges Stop builds állapotát csak belépés után lehet igazolni.

A tesztoldal health végpontja a módosítás előtt HTTP 200 és 20c0c9dfd8e17f75bd54381db5268101c92ad91b telepített SHA-t adott. A korábbi pontos deploy-egyezés így frissen igazolt. A kód jelen módosításai nem igényelnek új alkalmazásdeployt.

Források:
- https://docs.netlify.com/build/configure-builds/ignore-builds/
- https://docs.netlify.com/build/configure-builds/stop-or-activate-builds/
