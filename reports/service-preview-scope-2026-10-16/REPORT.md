# Szolgáltatásügy kezelői előnézetének pontosítása

Kizárólag gmail-test-subject-allowlist. Kiindulás: 811cdf7132d88f8af5abaed606a0da69a44e967e (1638 PASS / 0 FAIL / 0 SKIP).

A tényleges szintetikus felhős ügyösszerendelés után a dézsaügy vendégtervezete helyesen nem kért új szállást, de a „Hiányok és pontosítás” panel a szállásmotor általános dátum-/létszámkérdéseit mutatta. A javítás kizárólag a kezelői megjelenítés hatókörét pontosítja.

A runtime a már meglévő serviceOnly besorolásból explicit boolean mezőt vetít ki. A panel kizárólag serviceOnly===true és szolgáltatásprojekció mellett mutat dátum/kezdés/időtartam-hiányokat, ügykapcsolási állapotot és külön elérhetőségi/jóváhagyási követelményt. Visszavonás és ellentmondáskódok megmaradnak. Vegyes és korábbi válaszformátumoknál a szálláshiányok nem tűnnek el.

A döntésobjektum, kapacitás, ár, audit, jóváhagyási és szerkesztési jogosultság változatlan. A jelző nem jogosultság és nem új válaszmotor. Nincs providerhívás vagy szerveroldali döntés átírása.

Új regressziók a meglévő UI-suite-ban: teljes szolgáltatásigény és változatlan biztonsági mezők; hiányos időszak és rendezés; vegyes/legacy jelző; visszavonás és ellentmondás. A meglévő MIME→cookie→PostgreSQL integráció a serviceOnly igaz/hamis vetítést is ellenőrzi.

A helyi futtatókörnyezet transporthibája miatt ebben a körben nem állítunk helyi teszteredményt. A módosított commitot a meglévő tesztági CI ellenőrzi, teljes npm testtel és pontos teszttelepítés-ellenőrzéssel. Új kézi workflow nem indul.

A korábbi, felhasználó által engedélyezett teszt-Approver írásijog-bővítés és a normál cookie/CSRF útvonalon végzett felhős ügyösszerendelés külön bizonyíték: review 0febcd75-d954-49cf-a5e8-70e7d8ce14dd v1→v2; cél fa570d0b-1ea9-4568-a8f2-08b4dec446d0 v4 változatlan teljes sorhash-sel; egy egyező döntés és audit. Ezeket most nem ismételjük.

A Previo teszthozzáférést a tulajdonos 2026-10-19-én intézi. Addig nincs élő Previo-hívás vagy külső készletbizonyíték. Main/production, honlap, vendégadat, küldés, DB-séma és jogosultságok ebben a körben változatlanok.

V2/V3-érték: a közös szolgáltatásbesorolás megőrzése a kezelői felületig. Takarékosság: nincs új motor, integráció vagy fizetős AI-hívás; a meglévő CI ellenőrzi a szűk változtatást.
