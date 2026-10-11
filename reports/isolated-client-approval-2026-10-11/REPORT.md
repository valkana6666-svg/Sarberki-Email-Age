# Elkülönített szerveres jóváhagyás – klienskapcsolat

Dátum: 2026-10-11. Kizárólag `gmail-test-subject-allowlist`.
Kiinduló commit: `6c247e8399905ef36c2b71ccdcf8c10eb8a3d44c`.

## Megőrzött bizonyítékok

- [38139291482](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38139291482): elkülönített valódi Auth/API/SQL jóváhagyás és audit, újraindítás utáni visszaolvasás. Ebben a folytatásban nem ismételtük.
- [38149366865](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38149366865): valódi Chromium, szintetikus Gmail, ismeretlen kapacitás melletti jóváhagyástiltás és jóváhagyott állapot/esemény hiánya. A korábbi 38135068778 futásnak ezt a sikertelen assertionjét lezárja; más részeinek eredményét nem írja át.

## Elkészült

A meglévő `createCaseStoreClient` új `approve` művelete alapból tiltott.
Kizárólag külön `isolatedApproval: true` és
`approvalTarget: 'https://isolated-approval.supabase.co'` mellett kérhető;
ez kliensoldali előfeltétel, nem jogosultsági bizonyíték. A szerver saját
kapuja és ellenőrzései továbbra is kötelezők és változatlanok.

Az új `createIsolatedApprovalReview` böngészőkompatibilis összekötő
kizárólag GET-tel visszaolvasott, pending állapotú, szintetikus, tárolt
tervezetet fogad el. A read-only preview nem helyettesíti ezt a tervezetet.
Web Crypto SHA-256-tal az ellenőrzött szöveghez és a tárolt CAS-verzióhoz
kötjük a kérést. A kezelőnek ugyanazt a szöveget és verziót kell külön
megerősítenie. E-mail vagy foglalás nem készül.

Egyszerre egy művelet futhat. A jóváhagyási kísérlet a helyi review-jogot
már a POST előtt törli; hiba, verzióütközés vagy bizonytalan válasz után
újra kell olvasni az ügyet. A törölt review egy későn befejeződő GET után
sem áll vissza. Siker kizárólag a várt új verzió, tenant, ügy, állapot,
reviewedRevision és draftHash együttes egyezésekor adható vissza.

## Új ellenőrzés

`node --test tests/isolated-approval-review.test.mjs`

8 PASS / 0 FAIL. Szintetikus, hálózatmentes kliens/transport próbák:
alapértelmezett tiltás, eredeti projekt kizárása, pontos hash/CAS kérés,
hibás tervezet, megváltoztatott szöveg, verzió/ügy eltérés, megerősítés
hiánya, CAS-hiba, hibás válasz, párhuzamos kérés, törölt review és HTTP
jogosultságmegtagadás.

A meglévő client módosítása miatt öt érintett
`tests/synthetic-server-preview.test.mjs` kompatibilitási ellenőrzés is
futott: 5 PASS / 0 FAIL. A 935-ös teljes suite és a sikeres Chromium/Auth
próbák nem ismétlődtek. Ez nem új teljes E2E-igazolás.

## Megmaradó feladat

Ez újrahasználható klienskapcsolat, nem bekapcsolt kezelőfelület. A fő
oldal nem importálja és nem inicializálja automatikusan. Következő lépés:
külön elkülönített UI-próba a hitelesített operátori session, tárolt
tervezet, kifejezett megerősítés és szerveres audit együtt ellenőrzésére.
Az eredeti Supabase- és Netlify-kapukat nem aktiváltuk; adatbázis-, Auth-,
Netlify- vagy Previo-beállítást nem módosítottunk. A tényleges laptop
ügytár-exportja és a külső helyreállítási konfigurációk továbbra sem
helyettesíthetők szintetikus teszttel.
