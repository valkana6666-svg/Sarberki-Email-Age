# Dézsa V1-integráció — 2026-10-16

## Igazolt kiindulópont

Ág: gmail-test-subject-allowlist. HEAD: 1688024c387cb57625a54f1f91ce521e0c31ea9b. A commit CI-je sikeres, nem maradt függőben: 1557 PASS / 0 FAIL / 0 SKIP. Run: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38877755663 ; test job: 116896811577. A job pontos EXPECTED/deployed SHA-egyezést igazolt a leafy-chimera-2403e5 teszthoston. Offline Windows mentésmásolás is sikeres. Az élő Previo-lépés szándékosan kimaradt. Korábbi sikertelen köztes commitok után ez a HEAD zöld; a régi teszteket nem futtattuk újra.

A régi sarberki checkoutban maradt, még nem publikált válaszfordítási fejlesztést és képeket megőriztük. Az új munka külön sarberki-tub checkoutban, ugyanazon kizárólagos tesztágon történik; a korábbi módosítás nem kerül véletlenül ebbe a commitba.

## Feltárt hiányok

A classifier és az utolsó üzenetből számolt serviceRequest metaadat már létezett. Nem volt teljes szolgáltatásigény-ügyfolyamat vagy külön Reader-megjelenítés. Az összerendelés feladó + thread/RFC referencia alapján működött, foglalási hivatkozás ellenőrzése nélkül. Két nyelvi dézsafelismerési eltérés, valamint a szolgáltatás saját dátumának és a szállás dátumának elkülönítése igényel célzott ellenőrzést.

Hiteles üzleti konfiguráció: BUSINESS.hotTubRentalRules.houseNumbers = 1,2,3,4,5,6,11,12,13,14,15; a splitPhysicalUnits minden 7–10 A/B/C elemén hotTub:false. Külön bérelhető szolgáltatás. A fizikai alkalmasság nem elérhetőség-bizonyíték.

## Folyamatban

A Codex közvetlenül megkapta a minimális linked-service implementációt és a tíz kért szintetikus teszthelyzetet. A koordinátori diffreview külön felhívta a figyelmet a történeti levél utáni igény-újraaktiválás és a több eltérő booking reference nullára egyszerűsítésének veszélyére; mindkettőre célzott negatív ellenőrzést kértünk. Új kód, CI és tényleges felhős működés még NEM IGAZOLT.

Bizonytalan összerendeléskor megőrzendő az e-mail egy szolgáltatási ellenőrző ügyben (`service_link_review`), üres szállástényekkel; ez nem új szállásfoglalás. A Reader hét külön mezőt kap: igény ténye, dátum, kezdési időpont, időtartam, kapcsolódó ügy, ellenőrzési állapot, emberi jóváhagyás szükségessége. A szolgáltatás dátuma nem írhatja át a meglévő szállás dátumait.

Első implementációs réteg: közös storeban elkülönített szolgáltatási igény és szigorú összerendelés, szállástények megőrzése, új/történeti egyedi levél után jóváhagyás függőre állítása, visszavonás és idézett levelek kezelése; közös rendererben négynyelvű, kizárólag tájékoztató/pontosító tervezet; szerveres hétmezős projekció és Reader-megjelenítés. Nincs ár, megerősítés vagy belső házszám a vendégtervezetben.

Codex első célzott eredménye: 13 érintett suite, 80 PASS / 0 FAIL / 0 SKIP. Új `tests/tub-linked-service.test.mjs` fedi a kért tíz helyzetet és az azonos időbélyegű visszavonást. Új `tests/tub-linked-postgres.test.mjs` valódi PGlite PostgreSQL-motoron igazolja a normál Writer→service-followup→Reader utat, a Reader írási tiltását közvetlen SQL RPC-vel is, az ütköző CAS elutasítását és az audit/üzenetkulcsok számát. A koordinátor a tesztkódot és a diffet ellenőrizte. Ez helyi bizonyíték; további kis Gmail-kapu-patch és teljes CI még hátravan.

Elkészült a minimális felületi/Gmail-kapu is: a meglévő `ingest-and-draft` művelet egyetlen pontos magyar MIME-követőlevelet fogad el, a korábban mentett pontos HU alapesethez, aktuális CAS-revízióval. A szerver a mentés előtt ellenőrzi a rekordot és az egyértelmű összerendelést. Korábban belsőleg jóváhagyott alapesetnél az új levél függőre állítja az állapotot és eltávolítja a régi serverApprovalt. Az azonos követőlevél ismétlése idempotens. Új endpoint/action, általános `.invalid` engedély vagy kliens által állított tesztjelző nincs. A régi írási, CSRF-, Writer- és tenancy-védelem megmarad.

A meglévő szintetikus Gmail-panel egy Writer-gombot kapott, kizárólag az aktuális munkamenetben igazoltan mentett HU-alapesethez. A forrás-/session-/ügy-/revízióváltás és az aszinkron CSRF/response kontextusa védett. Utána a Reader-előnézet ügyazonosítója és revíziója frissül, a szolgáltatásjóváhagyási link nem jelenik meg. Külön szolgáltatásjóváhagyás még NEM IGAZOLT; ismeretlen dézsaelérhetőség nem jogosít megerősítésre.

További célzott eredmény: a kibővített 16 suite 125 PASS / 0 FAIL / 0 SKIP; a legutóbbi szigorított cookie/UI változat érintett részhalmaza 43 PASS. Ezek átfedő tesztek, nem összeadandó darabszámok. A koordinátor a Gmail-kapu diffjét külön ellenőrizte. A végső commit CI-je és a tényleges felhős működés még ellenőrzendő.

Módosított kódfájlok: booking-cases.mjs, central-reply.mjs, index.html, netlify/functions/booking-cases.mjs, operator-login-ui.mjs, sarberki-core.mjs, shared-core/server-booking-runtime.mjs, shared-core/synthetic-mail-fixtures.mjs, shared-core/tub-request.mjs, synthetic-server-preview.mjs. Tesztek: closed-synthetic-mail-registry, operator-cookie-session, operator-login-ui; új tub-linked-service és tub-linked-postgres. Sem adatbázismigráció, sem konfiguráció-/kulcsmódosítás nem történt.

## Publikált kód és tényleges felhős próba

Integrációs commit: 908a751500782e80c4738840c4631b5b755d2429, kizárólag a tesztágon. A böngészőben BUILD908a751 látható. Meglévő tesztoperátori cookie-munkamenet helyreállt; jelszót vagy tokent nem olvastunk/adtunk meg.

A HU alapminta a már meglévő fa570d0b-1ea9-4568-a8f2-08b4dec446d0 ügy v3 rekordját adta vissza; nem keletkezett új szállásügy. Az új rögzített Gmail MIME-követőlevél ugyanide v4-ként mentődött. A csak olvasási szerveres előnézet visszaadta: dézsaigény igen, 2026-10-24, 18:00, 24 óra, ugyanaz a caseId, elérhetőség NEM IGAZOLT, emberi jóváhagyás szükséges. A magyar tervezet a külön bérelhető dézsát és a még elvégzendő ellenőrzést mondja ki; nem megerősítés. Képek: cloud-reader-proof.jpg és cloud-reader-fields.jpg. Ez tényleges szintetikus felhős Writer→Reader-panel bizonyíték, nem új élő Gmail OAuth-próba vagy külön Reader-fiókos bejelentkezés. A valódi Reader szerep írási tiltását a PostgreSQL-próba igazolja.

## Nyitott CI-hiba

Run https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38890554396 , job116938723266: 1573 teszt / 1572 PASS / 1 FAIL / 0 SKIP. Hiba: tests/case-ui.test.mjs:100, integrated approval cannot override failed fresh capacity; az árquote null helyett jóváhagyott maradt. A kapacitás-regresszió workflow38890554563 is hibás. A 908a751 NEM zöld kiadásra jelölt állapot, és nem írjuk felül a hibás elvárást. A konkrét ok és a legkisebb biztonságos javítás közvetlen Codex-feladatként folyamatban. Az adott CI-ben a deploy-szinkron lépés a teszthiba miatt kimaradt; csak a böngésző rövid buildazonosítója és a felhős próba igazolt.

Más workflow-k ugyanazon SHA-n: V1 Gmail manual check és synthetic Gmail operator mobile proof sikeres; offline Windows backup copy sikeres; offline chatbot mobile workflow kihagyott. Ezek nem teszik zölddé a teljes CI-t.

A Codex célzottan reprodukálta az egyetlen hibát: a visszavonás-felismerő a „lemondási feltételek” iránti tájékoztatáskérést is szolgáltatás-visszavonásnak vette. A hibás service_request besorolás miatt a korábbi intenthez kötött UI-jóváhagyási ellenőrzés kimaradhatott. A javítás pontos visszavonás-felismerést és önálló fail-closed szolgáltatási jóváhagyásgátat alkalmaz; az eredeti CI-regresszió elvárása változatlan marad. Végső javítás és új CI még folyamatban.

A javítás célzott eredménye: 43 PASS / 0 FAIL / 0 SKIP (30 case-ui + 13 tub-linked-service teszt), az eredeti hibás CI-próba változatlan elvárásával. A kézzel kapcsolt szolgáltatás is megtartja a serviceOnly jelzőt, ezért az override sem kerülheti meg a külön jóváhagyási tiltást. Módosult: tub-request, booking-cases, index.html és a két érintett teszt. Következő: az új javítócommit teljes CI-je és pontos teszttelepítésének ellenőrzése; új felhős írási próba nem szükséges az ettől függetlenül már sikeres dézsa-followup útvonalhoz.

## Végső igazolt állapot

Javító kódcommit: **3570934f9e7bc393c61e7783a4b7e5573b5a2dd2**. Teljes CI: **1575 PASS / 0 FAIL / 0 SKIP**. Run: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38891485291 ; job: 116941776915. A teljes naplóból pontos DEPLOY SYNC PASS: expected és deployed egyaránt 3570934f9e7bc393c61e7783a4b7e5573b5a2dd2. Capacity regression run38891485239 és synthetic Gmail operator mobile proof run38891485381 szintén sikeres. Az offline Windows mentésmásolási job116941777111 sikeres. Élő Previo-lépés továbbra szándékosan kihagyott, nem teszt-SKIP. Valódi iPhone-főképernyős próba ebből nem következik.

A fenti piros CI történeti eredmény; az ok javítva, az eredeti teszt változatlan elvárással sikeres. A felhős v3→v4 és Reader-próba az integrációs 908a751-en történt; a javítócommit pontos teszttelepítését a CI igazolta. Az ettől függetlenül már sikeres felhős írást nem ismételtük. A régi mentés-/restore-, Gmail OAuth- és incomingfordítás-próbákat sem futtattuk újra. Fizetős AI-providerkérés nem történt ebben a fejlesztési körben.

Hátralévő V1-kapuk: bizonytalan ügyek emberi rendezésének teljes szerveres kezelői útja; hiteles, konkrét házhoz és teljes bérlési időszakhoz kötött dézsaelérhetőségi bizonyíték; külön auditált szolgáltatás-jóváhagyás. Ezek hiányában a szolgáltatás megerősítése továbbra tiltott. A korábbi helyi válaszfordítási fejlesztés külön megőrzött, még nem publikált munka. Jelen fejlesztéshez emberi belépés vagy új jóváhagyás nem kellett; a valós szolgáltatás visszaigazolása előtt hiteles ellenőrzés és emberi döntés kell.

Production/main, valódi vendégadat, e-mail/Pushover-küldés és Previo-írás/lekérdezés nem megengedett. Auth, tenant/RLS/CAS/audit és emberi jóváhagyás megőrzendő. Nincs második válaszmotor, jogosultsági rendszer vagy automatikus küldés. Meglévő mentések változatlanok.

V2/V3 érték: a szolgáltatásigény a meglévő ügyhöz és közös kommunikációs adapterhez kapcsolódik, elkülönített bizonyítékkal; ez nem automatikus foglalási/küldési képesség. Bizonyítékkorlát: a helyi mock/DOM/PostgreSQL és CI eredmény nem helyettesíti a tényleges Gmail→felhő→Reader hitelesített működés igazolását.

Takarékosság: célzott fájlok és helyi ellenőrzések, majd a módosult commit egyszeri kötelező CI-je. Korábbi Gmail OAuth-, restore- és incomingfordítás-próbák nem ismétlődnek.
