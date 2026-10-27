# V1 pending ügy és teljes szerkesztési-jóváhagyási átvétel

Alap: `7634b0410f3e938666547e4c51517c27759f263a`, kizárólag gmail-test-subject-allowlist. A munkamenet elfogadott, nem újranyitott feladat. V1 87% marad a hosted átvételig. Nincs deploy, valódi vendégadat, küldés, Previo-írás, mentési művelet vagy jogosultságmódosítás.

## Tényleges felhős leltár – csak SELECT

A már engedélyezett pontos szintetikus identitások között nincs megfelelő együzenetes pending booking-review ügy. Az en/de/si és a v2 Reader minta internally_approved; ezeket nem nyitjuk újra. A pending HU `fa570d0b-1ea9-4568-a8f2-08b4dec446d0` kétüzenetes, a `0febcd75-d954-49cf-a5e8-70e7d8ce14dd` service_link_review. Egyik sem tehető szerkeszthetővé a kapu lazításával. A régi minták tartózkodása október 23–25., már elmúlt; a valós dátumellenőrzést nem fagyasztjuk vissza az alkalmazásban.

Ellenőrzött DB-tagság: 3 can_read+can_write fiók, 2 can_read+can_approve fiók. Különböző, az Auth-táblában is létező Writer és Approver szereplő létezik. Csak olvasásra jogosult tagság (can_read=true, can_write=false, can_approve=false): 0. Új jogosultságot nem adtunk. A ténylegesen kiválasztott fiókok friss Auth-/tagságellenőrzését minden API-művelet a meglévő védelemmel végzi. A jelszavak rendelkezésre állását vagy a két ember konkrét hosted belépését nem állítjuk a DB-leltárból.

## Elkészült minimális programfunkció

Az eddigi Writer-végpont új, paraméterezhetetlen művelete:

`POST /.netlify/functions/writer-reader-fixture`

Törzs: `{"action":"prepare-editable-fixture"}`. A meglévő cookie, CSRF és Writer-tagság szükséges; sem tenant, sem vendégszöveg, tények vagy tetszőleges ügyazonosító nem adható hozzá. A régi create-reader-fixture művelet kompatibilitása megmarad, de az új UI-gomb a teljes szerkesztési mintát készíti elő.

A végpont először megfelelő meglévő pending, pontosan engedélyezett, jövőbeli, reviewed ügyet keres, és azt írás nélkül visszaadja. Ha nincs, egyetlen állandó identitású új rekordot készít a meglévő ingest → reviewAndDraft → sc_write_case/CAS/audit úton. Az idempotens ismétlés nem ír új revíziót, nem törli a már szerkesztett szöveget, és nem készít új ügyet. Jóváhagyott saját minta ismételt előkészítése409, újranyitás és auditmódosítás nélkül. Lejárt új minta nem készíthető elő.

Rögzített új azonosító: **`case-editable-review-20261026`**. Tenant sarberki-test; vendég `guest@editable-review-20261026.invalid`; egyetlen pontosan rögzített üzenet; Deluxe, 2026-11-26–28, 2 felnőtt, 0 gyermek, kitalált telefon. A rekord-, feladó-, üzenet-, dátum- és létszámegyezés együtt szükséges: nem általános .invalid vagy többüzenetes engedélyezés. A fixture provider csak a régi rögzített időszak és ez az egy új pontos időszak szintetikus bizonyítékát adja; nincs élő kapacitás vagy valódi vendégár.

A szerveres előkészítő nem kerül a statikus buildbe. Az általános SQL/RLS, jóváhagyási RPC, HMAC, revízió/hash, külön szerkesztő-jóváhagyó és együzenetes védelem megmarad. Nincs migráció, új grant, service-role vagy második munkafolyamat-motor.

## Az ügy létrehozásának bizonyítékhatára

A rögzített új azonosító a felhős SELECT pillanatában még nem létezik. **Hosted rekordot Codex nem hozott létre:** ehhez a meglévő Writer API hitelesített munkamenete szükséges, amely itt nincs rendelkezésre bocsátva. SQL-es INSERT/RPC-vel nem kerülünk meg jogosultságot vagy üzleti műveletet. A működő rekord-előkészítést és a teljes láncot elkülönített PostgreSQL-ben, a valódi handlerekkel elkészítettük és ellenőriztük. A Work új tesztkiadás utáni egyetlen Writer-gombnyomása végzi a tényleges hosted előkészítést. Ha időközben lett más alkalmas engedélyezett pending ügy, a gomb azt adja vissza.

## Automatizált bizonyíték

A tests/pending-editable-fixture.test.mjs valódi PostgreSQL-motort (PGlite), a telepítési SQL/RLS-t, a valódi cookie Writer-végpontot, booking-cases API-t és üzleti runtime-ot használja. Auth és REST szintetikus. Ellenőrzi:

- első előkészítésv2, ismétlés változatlan v2 és egyetlen rekord;
- Writer megnyitás, szövegszerkesztés v3, pontos whitespace/hash és új Reader-handleres visszaolvasás;
- előkészítés ismétlése a már szerkesztett pending ügyön: nem írja felül a szöveget és nem növeli az auditot;
- külön Approver v4 jóváhagyás; új Reader-handler visszaolvassa a mentett szöveget, reviewedRevision3, hash, actor és egy jóváhagyási audit;
- Reader írás, más tenant, hiányzó CSRF, régi revízió, hibás hash és a szerkesztő saját jóváhagyása akkor is tiltott, ha egyébként approve-joga van;
- jóváhagyás ismétlése, jóváhagyott ügy szerkesztése és újranyitása auditmódosítás nélkül elutasított;
- eltérő identitás/létszám, több üzenet és lejárt előkészítési időablak elutasított.

A PostgreSQL tesztben külön, csak olvasó Reader is van; ez **nem** a hosted projektben létrehozott jogosultság. Célzott csomag: **80 PASS / 0 FAIL / 0 SKIP** (pending fixture, operator UI, cloud approval, eredeti Reader fixture, statikus build, HU scope és cloud edit panel). A teljes regressziót a GitHub CI futtatja; a commit és CI-link a végleges átadásban szerepel. A meglévő cloud-edit, HU scope és statikus build tesztjei is megőrzik a régi határokat.

## Rövid Work-átvétel – egyetlen összevont tesztkiadás

1. Zöld commit-CI után egyetlen Work-kiadás a leafy-chimera-2403e5 tesztre, pontos build SHA ellenőrzéssel. A korábbi belépési/ár-/mentési átvételt nem kell megismételni.
2. Meglévő Writerrel: **Függő szerkesztési tesztügy előkészítése · Writer**. Rögzítsd a visszakapott azonosítót és revíziót. Új minta esetén case-editable-review-20261026, v2, pending. A megjelenő audit/szerkesztési link a cloud-approval oldalra vezet.
3. Writer: aktuális rekord betöltése, vendégszöveg szerkesztése (például: „Please confirm your estimated arrival time.”), mentés. Rögzítsd v3-at és az aktuális szöveghasht. Újratöltés után ugyanaz a szöveg maradjon.
4. Can_read jogosultságú fiókkal külön visszaolvasás: a mentett szöveg bájtpontosan azonos. Szigorúan csak Reader-jogú hosted negatív próbához jelenleg nincs megfelelő tagság; a tulajdonos meglévő jogosultságkezelési eljárásával kijelölt read-only tesztfiók szükséges. Codex nem ad magának vagy másnak új jogot.
5. A szerkesztőtől **különböző** meglévő Approver-fiók: friss v3/hash betöltése, szöveg elolvasása, explicit hozzájárulás, jóváhagyás. Újratöltéskor v4 internally_approved, reviewedRevision3, azonos hash, külön actor és egy tartós approve audit. A read-only visszaolvasás nem jóváhagyás, nincs küldés.
6. Régi v2/v3, Reader írás/jóváhagyás és más tenant elutasítása; jóváhagyott ügyet ne nyiss vissza újabb pozitív próba kedvéért. Az új előkészítő ismétlése a siker után409, nem új ügy.

A pozitív readbackhez can_read kell, ami létezik; a hosted szigorú Reader-only tiltás igazolásához a hiányzó read-only tagság külön feltétel. A teljes hosted lánc csak tényleges Work-bizonyítékkal PASS. Készültség marad87%.
