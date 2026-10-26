# Sárberki V1 – átadás előtti lezárási nyilvántartás

Dátum: 2026-10-26, Europe/Vienna. Audit kezdete 04:37, a napi 08:00/10:00 feladatok előtt.
Vizsgált HEAD: d88c67cc9c55cfd08213a546b3677c5970eb200a.
Utolsó alkalmazáskód: c85dab08180350f2f72565045e6c899991bf58fd.
Ág kizárólag gmail-test-subject-allowlist.

## A nyilvántartás szabálya

LEZÁRVA = a megnevezett, szűk hatókörre tényleges bizonyíték van. RÉSZLEGES = kód/teszt létezik, de a teljes terület üzemi bizonyítéka hiányos. BLOKKOLT = következő lépéshez külső hozzáférés, döntés vagy későbbi futási időpont kell. A blokkolás nem feltétlenül programhiba.

Ez bizonyíték-audit, nem új teljes tesztfuttatás, új penetrációs vizsgálat vagy production-engedély. A régi dokumentumok dátumozott megfigyeléseit megőrizzük; a már felülírt OPEN sorok nem indítanak újra lezárt feladatot.

## Fő területek – összesített státusz

| Terület | Állapot | Mi igazolt? | Pontosan mi hiányzik / következő kapu? |
|---|---|---|---|
| Gmail-beolvasás | RÉSZLEGES | Egy engedélyezett szintetikus receipt tényleges readonly megnyitása, normál Writer dedup és azonos felhős ügy/audit; iPhone böngészős eredetjelzés elfogadva | A friss forrásjavítások telepítése külön kiadási kapu. A böngészős forrásmegfigyelés nem általános szerveroldali Gmail-hitelesítés és nem folyamatos szerverfigyelés |
| Ügyösszerendelés | RÉSZLEGES | Feladó, explicit szálkülönbség, mailbox/tenant, alakvalidáció, ütközés, duplikáció és atomi helyi tárolás regressziói; legutóbbi teljes CI 2158 PASS | A legújabb javítások az engedélyezett ágon, nem az új telepített összevont változatban bizonyítottak. Kétoldalt scope nélküli legacy adat nem teljes tenant-hitelesítés |
| HU/DE/EN/SL tervezetek | RÉSZLEGES | Négy nyelv parser/renderer/paritás és korábbi fordítási részpróbák; SI a szlovén belső kód | Nem minden lehetséges levél vagy mind a négy nyelv teljes, azonos új hosted folyamatának bizonyítéka. Csak a kiadást érintő hiányt kell később ellenőrizni |
| Árazás, elhelyezési és foglalási szabályok | RÉSZLEGES | Közös döntési mag, osztott C 4/5/6, házalapú ár, hiányos/stale bizonyíték tiltása, egységes 14 napos szabály és előlegablak tesztelt | Aktuális szolgáltatói ár/kapacitás, bizonytalan pótdíjak/gyermekkorhatárok és 2027-es ár nem található ki; hiteles előzmény nélkül nincs törzsvendégkedvezmény |
| Previo hivatalos readonly kapcsolat | BLOKKOLT | Offline preflight/adapter és alapból zárt kapuk; történeti összevetések megmaradnak | API-család/verzió, szálláshelyi jogosultság, sandbox és konkrét kapacitás-/árműveletek mellékhatásmentessége; 23 egység hiteles fizikai mappingje. Nincs élő kérés vagy foglalás |
| Dézsa | RÉSZLEGES | 11 rögzített erőforrás, más háznál lakó vendég lehetősége, teljes időszakos ütközés, hiányos jegyzet UNKNOWN, külön szolgáltatásjóváhagyás; friss numerikus parserhibák javítva | Valódi, teljes és friss erőforrás-naptár/forráskötés; a jegyzet hiánya nem szabad kapacitás. A fizikai szolgáltatói bizonyíték hozzáférésfüggő |
| Emberi jóváhagyás és audit | LEZÁRVA a dokumentált szintetikus körben | Tárolt jóváhagyás, külön approver, verzió/hash/CAS/RLS és audit; v3 internally_approved iPhone újrabelépés után visszaolvasható | Nem küldési vagy foglalási engedély. A javított hibaszöveg kiadása külön nyitott, nem a korábbi jóváhagyás elvesztése |
| Safari-kijelentkezés és tulajdonosi iPhone-próba | LEZÁRVA a konkrét elfogadási körben | Kijelentkezés, vissza/előre, frissítés, közvetlen megnyitás, kézi újrabelépés és audit megőrzése | Nem ismétlendő újra. Egy későbbi új UI-kiadás célzott ellenőrzése nem teljes Safari-próba újranyitása |
| Üzemi Pushover | BLOKKOLT | Offline végpont–ledger–RPC, atomikus claim, PostgreSQL 17 12 kapcsolat/1 nyertes, bizonytalan eredmény után nincs retry, identitás/terminal trigger és két tiltókapcsoló | A felhős tábla/RPC-k most is hiányoznak; migráció/rollback- és kulcskezelési biztosítékok, külön konkrét valódi küldési engedély és kézbesítési bizonyíték szükséges |
| Titkosított DB-mentés és tárolás | LEZÁRVA az október 25-i snapshot körére | Pontos GitHub artifact proof, 49 táblás restore, pontos Drive-ID bájt-/SHA256-egyezés | Nem a mai napi automatizálás és nem teljes platform-restore. Mai új bájttesztet ebben az auditban nem ismételtünk |
| Napi automatikus teljes mentési lánc | BLOKKOLT az esedékes időpontig | Két engedélyezett meglévő napi feladat, utasítás-visszaolvasás és változatlan ütemezés dokumentált | A 08:00/10:00 utáni valódi aznapi run/attempt/export-restore/artifact/Drive/hash és külön Drive-SQL bizonyíték. Nincs előrehozott indítás |
| Teljes platform-helyreállítás | BLOKKOLT | SQL-/gitforrás, korábbi izolált Auth/REST és DB/RLS részpróbák, helyreállítási eljárás | Független tulajdonosi kulcspróba, szolgáltatói konfigurációk/hozzáférések és új elkülönített HTTPS/Auth/Edge/alkalmazáslánc bizonyítása |
| Friss összevont tesztkiadás | BLOKKOLT | Forrás és tesztcsomag átadható; korábbi c8750e jelölt dokumentált | Jelenleg deploytilalom. A korábbi egyszeri c8750e engedély nem terjed ki automatikusan minden későbbi Pushover/SQL/Gmail változásra. HEAD nem tekinthető automatikusan jóváhagyott release-csomagnak |

## Lezárt részeredmények elsődleges hivatkozásai

- Aktuális alkalmazáskód teljes CI: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/40263671745 – 2158 PASS / 0 FAIL / 0 SKIP; kapacitás: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/40263671823 – SUCCESS. Ezeket visszaolvastuk, nem futtattuk újra.
- Gmail tényleges szintetikus receipt és felhős dedup/audit: reports/gmail-exact-cloud-chain-2026-10-17/REPORT.md; iPhone: docs/GMAIL-IPHONE-EVIDENCE-2026-10-25.md, docs/GMAIL-ORIGIN-ACCEPTANCE-2026-10-24.md.
- Safari és tárolt audit: docs/V1-CLOUD-SAFARI-CLOSURE-2026-10-25.md. A benne lévő régi Gmail-próba-teendőt a későbbi Gmail-elfogadás lezárta; a LOW hibaszöveg forrásban már javított, kiadása vár.
- Négy nyelv és árhatárok: tests/multilingual-booking-parity-v1.test.mjs; tests/pricing-channel-matrix-p01-p15-20261012.test.mjs; tests/physical-capacity-price-base-20261012.test.mjs; tests/cancellation-owner-boundary-20261022.test.mjs; tests/deposit-policy-unified-20261021.test.mjs.
- Az október 22-i tulajdonosi szabály érvényes: minden csoportnál 14 napos lemondási határ; 15 fő alatt 50%, legalább 15 főnél 80% előleg; legfeljebb 14 napos érkezési távolságnál 24 óra, azon túl 7 nap. Nincs 30 napos csoportszabály. A business-config.mjs értékeit csak olvastuk, nem módosítottuk.
- Dézsa: docs/tub-fixed-resource-previo-notes-v1.md, docs/V1-TUB-NOTE-DURATION-2026-10-25.md, docs/V1-TUB-NOTE-HOUSE-IDENTITY-2026-10-25.md; a 106-os helyi csomag átfed a teljes CI-vel, nem összeadandó.
- Pushover új trigger valódi PostgreSQL-próba: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/40220199846; preflight: docs/V1-PUSHOVER-CLOUD-PREFLIGHT-2026-10-25.md.

## Friss, nem módosító adatbázis-leltár

Kizárólag sarberki-test/mojnqizbcaczstguikpv projektben SELECT: sc_pushover_delivery_claims nem létezik; négy Pushover célfüggvény listája üres; storage.buckets=0, storage.objects=0. Titkos vagy vendégértéket nem olvastunk. Ez a mai üres Storage-t igazolja, nem jövőbeli objektumok mentését. Nincs migráció vagy DML.

## Helyreállítási készenlét – forrás és hiány

| Összetevő | Meglévő bizonyíték | Nyitott követelmény |
|---|---|---|
| Titkosított DB | 40172605691, stage 12590478636/proof 12590413782, 49 táblás exact-GitHub restore | A Drive-példány új, elkülönített SQL-próbája külön; nem futott most |
| Drive | 1ZMFd9AKqC3XFGSQ2fdvCetNUQo62tMia, 3365494 bájt; SHA256 2318f15062a770c37aadf034bb04a6f421aef0aa42bb40ea4eada105c37ef9f7; lejárat 2027-01-23T07:23:48Z a GitHub artifactoknál | Nem bizonyított napi automatikus end-to-end; Drive-megőrzés nem korlátlan garancia |
| Kulcs | V2-kulcs runnerben feloldható; tulajdonosi külön megőrzés megerősítve | A tulajdonosi külön példány független használhatósága nem igazolt. Régi és V2-jelmondat nem felcserélhető |
| Git | Aktuális kizárólagos tesztág és teljes SHA elérhető; régi mentés forrása történeti | A mentéskori commit és a mai alkalmazásforrás külön verzió. Régi snapshot nem tartalmazhat automatikusan későbbi javításokat; kiválasztott release-hez kell rögzített forrásleltár |
| Netlify | netlify.toml, Functions, build- és kreditvédelmi kód; docs/RECOVERY-OWNER-ACTIONS-2026-10-21.md és CONFIGURATION-PLAN | Nem teljes site/team/context titokhelyreállítási bizonyíték; új elkülönített HTTPS-próba nem futott. Most nincs login/deploy-újrapróbálás |
| Supabase DB | Sémák, adatok, RLS/grant/függvények és audit összevetése | Role-jelszavak újraprovisionálása és valódi cél Auth/API belépés külön szükséges |
| Auth/Edge | Korábbi izolált Auth/REST részpróba; Edge v9 forrás és zárt 410 handler | Managed Site URL/redirect, SMTP/MFA/OAuth/session/JWT, gateway és célkörnyezetes integráció nem áll helyre pusztán SQL-ből |
| Storage/Vault | Storage ma 0/0; történeti Vault-leltár 0, titokérték nélkül | Jövőbeli objektumbájtok, jogosultság és platformtitkosítás külön kezelendő; történeti 0 nem általános helyreállítási bizonyíték |
| Hozzáférések | Szolgáltatói azonosítók és biztonságos eljárások dokumentáltak | Tulajdonosi admin/MFA-helyreállítás és titkok újralétrehozhatósága nem következik a DB SQL-hozzáférésből |

Az október 24-i 40125387830 Drive SQL-restore lezárt történeti eredmény. Nem nevezzük a mai/október 25-i példány új visszaállításának. A korábbi staging JSON NOT_YET mezői időpillanatot tükröznek; a későbbi bizonyítékot külön nyugták igazolják. Nem írjuk át a proofot.

### Biztonságos későbbi helyreállítási sorrend

1. Tulajdonosi fiók/MFA és külön kulcspéldány biztonságos elérhetősége; kulcsérték nélkül rögzített próba.
2. Pontos snapshot/run/artifact/Drive/hash és kiválasztott kódverzió rögzítése; új export csak a meglévő napi rendszer szabályai szerint.
3. Külön, engedélyezett DB-cél, minden küldés/Previo/értesítés tiltva; SQL-séma/adat/role/RLS/CAS/audit összevetése.
4. Managed Auth/REST/Edge/Storage és védett környezeti értékek helyreállítása tulajdonosi felületen. A célhoz kötött host/project kapuk auditált migrációja szükséges, nem lazíthatók keresés-cserével.
5. Külön engedélyezett HTTPS tesztkiadás, pontos SHA, Writer/Reader/approver és tenant negatív próbák, audit és újrabelépés. A mostani feladat ezt nem engedélyezi/indítja.
6. Mentés utáni értesítési claim-ek/ügyváltozások egyeztetése. Régi snapshot után semmi nem kapcsolhat automatikusan küldést vissza; bizonytalan külső eredménynél nincs automatikus retry.

## Kiválasztott, most elvégezhető hiány lezárása

A legfontosabb hozzáférésmentes hiány az egységes, aktuális és bizonyítékhatáros átadási nyilvántartás volt: a korábbi fájlok eltérő időpontok készültségét, régi tesztszámokat és azóta lezárt mobilfeladatokat keverhetik. Ez a dokumentum rendezi őket.

Az auditban új, még javítatlan programhibát nem igazoltunk. Emiatt nincs kitalált hibajavítás, új alkalmazáskód, új teszt vagy szükségtelen teljes regresszió. A korábbi identity-shape, tenant/mailbox, időtartam/házazonosító és UI-szöveg javításokat nem készítjük el újra. Nem indult másik fejlesztési projekt.

## Következő kapuk és tényleges tulajdonosi közreműködés

- 08:00 után a napi GitHub-kérés és tényleges export-restore futás; 10:00 után azonos run/attempt/hash Drive-átadás és bájtellenőrzés. Hiányzó futás esetén konkrét ok, nem feltételezett siker. Ebben az auditban a két automatizálás és ütemezés változatlan maradt; indítócommit nincs.
- A Drive-bájtok új SQL-restore-ja csak ténylegesen rendelkezésre álló, engedélyezett izolált útvonalon; az eredmény fájl/hash/run kötése külön kötelező. Nem indul automatikusan pusztán a fájl meglététől.
- Tulajdonos: a már megőrzött V2-kulcs független próbája kizárólag biztonságos felületen; Netlify/Supabase célkörnyezet helyreállítási hozzáférése; dedikált régi backup OAuth-secret letiltási bizonyítéka, ha még nyitott. Jelszót vagy tokent nem kérünk chatben.
- Tulajdonos/szolgáltató: hivatalos mellékhatásmentes Previo olvasási szerződés és hozzáférés, 23 egység és 11 dézsa hiteles forrásmappingje, még nem egyértelmű árhatárok.
- Tulajdonosi kiadási döntés: a pontos következő összevont tartalom és egyszeri tesztdeploy külön engedélye. Most nem kérünk/indítunk deployt. A régi Safari-próbák helyett csak az új kiadás érintett változásainak célzott elfogadása indokolt.

## Átadási döntés és készültség

A forrás és a szintetikus tesztbizonyíték átadható fejlesztési eredmény. Az új, összes friss javítást tartalmazó telepített tesztváltozat és az üzemi/éles átadás NEM lezárt. A jelenlegi scope továbbra ember által ellenőrzött választervezet, nem automatikus vendégküldő/foglaló rendszer.

A korábbi 85%-os V1 munkabecslést megtartjuk. Ez nem tesztarány, nem a fenti tetszőleges részletességű sorok százaléka és nem 100%-os helyreállíthatóság. Az audit nem zárt le új külső elfogadási kaput, ezért nem indokolt a szám emelése.

Új alkalmazáskód/teszt: 0. Új teljes regresszió: 0. Új mentési export/restore: 0. Automatizálás-módosítás: 0. Netlify-deploy: 0. Supabase DDL/DML: 0. Valódi vendégadat/küldés/Previo-művelet: 0. Csak dokumentációs tesztági commit készülhet skip ci / skip netlify jelöléssel; az alkalmazás-CI bizonyítéka a fent hivatkozott c85dab08 commitra vonatkozik.
