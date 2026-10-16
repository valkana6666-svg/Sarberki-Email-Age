# Previo dézsajegyzetek: szigorú dátumhatár – 2026-10-16

Ág: kizárólag gmail-test-subject-allowlist. Kiinduló távoli HEAD: fe9f8623cdae4e27c2a13f48b7c9855ab4ae8b07. A meglévő CI Actions branch-szűrővel ellenőrizve: run 38933806670, job 117084122068, 1634 PASS / 0 FAIL / 0 SKIP; capacity regression 38933806654 SUCCESS. A korábbi kész implementációkat nem ismételtük meg. Nyitott PR a kapcsolt felhasználó lekérdezésében nincs; külön Codex-feladatszolgáltatás állapota nem hozzáférhető, feladatátadást nem állítunk. A programozást ebben a Codex-munkatérben közvetlenül végeztük.

## Reprodukált hiba

A reader és a szintetikus adapter regex + Date.parse validátora elfogadta a nem létező 2026-02-30T18:00:00Z időpontot. A reader CANDIDATES_ONLY eredménnyel meghívta az injektált fake forrást (1 hívás), a fixture-adapter elfogadta a hibás foglalást. Ez nem élő Previo-hívás és nem hamis AVAILABLE bizonyíték, de hibás időszak jutott át a forráshatáron.

## Javítás

Mindkét modul a már létező parseOffsetInstant függvényt használja a server-tub-availability modulból. Új dátumértelmező, válaszmotor, API-művelet vagy jogosultság nem készült. A meglévő naptári nap-, óra-, UTC-offset- és évhatár ugyanaz a bemeneti oldalon és az elérhetőségi/jóváhagyási bizonyítékban. Hibás start és end egyaránt zárt: UNKNOWN/INVALID_QUERY, üres jegyzetlista, nulla forráshívás; hibás fixture esetén az adapter létrehozása elutasított, nem tűnik el csendben egy lehetséges ütközés.

Új negatív esetek: február 30., nem szökőévi február 29., április 31., 24:00 rollover, +14:01 és +15:00 offset. Pozitív kontroll: valódi szökőnap és az őszi óraátállítás azonos helyi idővel, de két külön UTC-offsettel. A jegyzetlista továbbra sem bizonyít teljes naptárt.

## Eredmények

- 5 érintett suite: 37 PASS / 0 FAIL / 0 SKIP.
- A kapacitásváltozás miatt egyszer lefuttatott teljes helyi npm test: 1638 PASS / 0 FAIL / 0 SKIP, 24.6 másodperc.
- git diff --check: PASS.
- A módosított commit CI-je és pontos teszttelepítése commit után ellenőrizendő; a helyi siker nem azonos felhős igazolással.

## Meglévő integrációs kapuk

A tesztoldal a böngészőben fe9f862 builddel jelent meg. A meglévő HttpOnly munkamenet helyreállt, a hitelesített lista a korábbi 8 szintetikus ügyet visszaadta, köztük a 0febcd75-d954-49cf-a5e8-70e7d8ce14dd v1 felülvizsgálatot. Új ügyet vagy mintalevelet nem hoztunk létre. A korábbi jelentés szerint annak tényleges rendezéséhez read+write+approve fiók szükséges; a tesztkód PostgreSQL-igazolása ezt nem helyettesíti.

A Gmail OAuth/beolvasás, AI-fordítás és zárt MIME Writer/Reader bizonyítékok külön korábbi mérföldkövek. A teljes tényleges Gmail→AI→ügy→ajánlat→jóváhagyás láncot ezek összességéből nem nyilvánítjuk igazoltnak. Valódi vendégadat tilos; élő Previo-forrás hitelessége, teljes lefedettsége és zárolásmentessége továbbra sem igazolt. Az emberi összerendelés és külön dézsajóváhagyás kódja és helyi PostgreSQL-próbái elkészültek, a megfelelő felhős jóváhagyói munkamenet és tényleges megbízható dézsaforrás nyitott kapu.

V2/V3-érték: egyetlen szigorú időpontértelmezési szabály a forrás és bizonyíték határán. Nincs automatikus küldés, foglalás vagy külső végrehajtási képesség.

Production/main, honlap, jogosultságok, DB-séma, hitelesítő adatok és mentések változatlanok. Nem történt Gmail-/Previo-/AI-providerhívás, Pushover-küldés vagy felhős ügyírás. Takarékosság: meglévő CI visszaolvasása, csak az új hiba célzott próbája és a kötelező teljes regresszió.
