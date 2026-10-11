# Tartós izolált kezelői tesztkörnyezet előellenőrzése – 2026-10-11

Kiinduló tesztági HEAD: 76f7b3c2520ae8ab4486e79f83bd1dec5f90f211.
Friss branch-szűrt Actions-lekérdezés: a legújabb jóváhagyási futás
[38154710516](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38154710516)
sikeres, c8ba033 commit. Újabb futást a lekérdezés nem tartalmazott.
A HEAD dokumentációs [skip ci] commitján 0 check-run található; ez nem teszt-PASS.
A korábbi sikertelen próbákat a későbbi sikeres futás lezárta.

## Tényleges új eredmény

Codex bevonásával új, mellékhatásmentes konfigurációvalidátor és CLI készült.
`node scripts/isolated-persistent-preflight.mjs --config /biztonsagos/hely/config.json`
csak a helyi konfigurációt olvassa. Nem indít szervert/deployt, nem kapcsolódik
DB-hez, nem aktivál jóváhagyást. Siker esetén CONFIG_VALID mellett explicit
false a deploymentVerified/authenticationVerified/persistenceVerified.
A kulcs és fájlolvasási hiba részlete nem kerül a kimenetbe.

Mind a tíz mező kötelező: enabled:true; operatorOrigin és expectedOperatorOrigin
azonos kanonikus HTTPS origin; databaseHost külön isolated nevű szolgáltatás;
databaseName:sc_approval_test; syntheticOnly:true; emailSendingEnabled:false;
pushoverSendingEnabled:false; realBookingsEnabled:false; attestationKey
szerveroldali lowercase64hex. A kulcsot privát titoktárból kell adni, nem GitHubba.
Az isolated DNS-név szintaktikai védelem, nem tényleges távoli izolációigazolás.
Telepítés előtt a cél DB identitását és kizárólag szintetikus tartalmát külön
ellenőrizni kell. A meglévő forrásprojekt és tesztoldal nem használható új
jóváhagyási célként. A jelenlegi runtime/gatek nem változtak.

Új célzott helyi eredmény: 9 PASS / 0 FAIL, TARGETED-TESTS.txt.
Külön branch-szűrt GitHub Actions workflow kizárólag ezeket a teszteket futtatja,
titkok, npm telepítés, adatbázis és külső üzenetküldés nélkül.
A korábbi 957 + 12 teszt és böngészős lánc bizonyítékát nem futtattuk újra.

## Friss konfigurációs leltár

| Komponens | Bizonyított | Nem igazolt / szükséges |
|---|---|---|
| Gmail OAuth | Forrásban nyilvános client ID és gmail.readonly scope, tárgyszűrés | Google-admin consent/status/test-users/origin lista és új belépés nincs ellenőrizve; token nincs kérve |
| Previo | Külön tiltó kapuk és konfigurációnevek a forrásban | API-hozzáférés/titok megléte és mellékhatásmentes élő kapacitásolvasás nem igazolt; szolgáltatói kérés nem történt |
| Supabase | list_projects: sarberki-test ACTIVE_HEALTHY, PG17; aktív modern publishable és legacy anon kulcs jelen van, értékek nem szerepelnek | 0 development branch; nincs külön tartós jóváhagyási projekt. list_migrations üres, önmagában nem jelenti a meglévő DB-séma hiányát. Auth/provider/SMTP teljes konfiguráció nem exportált |
| Netlify teszt | Kizárólag leafy-chimera-2403e5 /api/health GET: HTTP200, channel a tesztág, deployedCommit c8ba033, autoSend:false/autoBookingModification:false | Health statikus livePriceVerified mezője nem élő Previo-bizonyíték. Site-admin/env/secret-konfigurációhoz nincs elérhető Netlify connector |
| Titkok | Supabase publishable/anon kulcsok aktív metadata igazolt; izolált attestation korábbi egyszer használatos tesztben létrejött | Netlify/GitHub repository secret-ek neve/jelenléte innen nem olvasható. Nem állítjuk hiányzónak a hozzáférhetetlen titkokat. Tartós attestation/JWT/DB credential és host titoktár még nincs igazolva |

Nincs külön, tartós HTTPS operator host, hozzáférhető telepítési cél és igazolt
persistent-volume/secret-store konfiguráció. A jelenlegi izolált böngészős
oldal loopback-only; iPhone felé HTTPS-en még nem működik. A validátor nem
oldja fel ezt a kaput. Következő fejlesztés: külön tartós server adapter,
pontosan rögzített HTTPS origin, saját Auth és sc_approval_test DB, majd teljes
böngészős és volume-visszaállítási próba. Új fizetős infrastruktúra létrehozása
nem történt; meglévő külön teszthost admin-hozzáférés vagy jóváhagyott új cél
szükséges a tényleges telepítéshez.

## Mentés és helyreállítás

A korábbi Approval_UI ZIP friss ellenőrzése: CRC rendben; SHA256
`dd33ff4ff04f70fd3bf1aafaa12ea2a96b3ca342639bd2c96fbd288758986887`;
552/552 tartalmi ellenőrzőösszeg egyezik. A ZIP forráspillanatképe 76f7b3c.
Ez a jelen fejlesztés új preflight fájljait még nem tartalmazza; azok GitHub
commitban tároltak, a ZIP-et nem állítjuk legfrissebb teljes mentésnek.

Korábbi izolált DB-restore: 43 archivált tábla és 10 leltármező igazolt a
38129512850 futásban. Ez és az új szintetikus Auth/API/restart jóváhagyási
próba eltérő bizonyítékok; nem bizonyítják a teljes platform újraépítését.
Hiányzik még a Gmail/Netlify/Supabase Auth/provider/DNS/secret konfiguráció
hiteles leltára, a külön GPG-jelmondat megőrzésének igazolása, a laptop
localStorage ügy- és Gmail-előzményeinek exportja, és az új tartós szolgáltatás
volume+Auth+audit visszaállításának tesztje. Részletek:
[RESTORE-GAPS](../../docs/RESTORE-GAPS-2026-10-11.md).
Az eredeti DB és laptop állapota nem változott; új restore nem történt.
