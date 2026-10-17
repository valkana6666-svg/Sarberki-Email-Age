# Sárberki V1 – szolgáltatási SQL és tényleges Auth a helyreállított tesztadatbázison

2026-10-17. Kizárólag `gmail-test-subject-allowlist`. Kiindulás: `e4125d9ce22342d2b3fb72b63f088def6acb189b`. A fejlesztést és ellenőrzést közvetlenül Codex végezte, párhuzamos agent nélkül.

## Eredmény

A már elkészült október 17-i titkosított mentésből eldobható PostgreSQL 17 környezet épült. Az új szolgáltatási RPC-k ténylegesen működnek a visszaállított sémán. Külön GoTrue és PostgREST szolgáltatással valódi tesztbelépés, az alkalmazás szerveroldali feldolgozója, jogosultságvizsgálata, repositoryja és SQL-mentése is sikeres; újraindítás után új belépéssel az ügy és a tervezet változatlanul visszaolvasható.

Nem készült új forrásexport, és ez a próba nem nyitott kapcsolatot a forrás-Supabase-hez. A mentés és a korábbi mobil/Gmail-bizonyíték nem változott. A meglévő mentés újbóli visszaállítása az új RPC-/Auth-próba szükséges környezetépítése volt.

- Mentés: run `39027707428`, snapshot commit `a76d3bc5c3657808e022f7874cf78295ff6b1ff4`.
- Első tesztcommit: `8ff2c5294ece784599bc48539d551581d490f4db`.
- Végleges ellenőrzött tesztkód: **`0f09633fc4cc23aa0cf91b667508a46f09d5ac23`**.
- [Helyreállítási run 39031412013](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39031412013), job `117392447009`: **SUCCESS**, szolgáltatások és DB végül leállítva/törölve.
- [Teljes CI 39031411958](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39031411958), job `117392447156`: **1789 PASS / 0 FAIL / 0 SKIP**. Exact deploy expected = deployed = a fenti teljes SHA. PWA static smoke, session/ügytár kapuk, MNB/árreferencia és offline Windows másolás SUCCESS. Élő Previo szándékosan nem futott.

A [gépileg olvasható bizonyíték](EVIDENCE.json) a CI naplójának ellenőrzött, titok- és vendégadatmentes JSON-összesítéseit őrzi. Nem tartalmaz tokent, jelszót, SQL-adatot vagy kulcsot.

## Új fejlesztések

1. A restore-verifier csak a korábban igazolt október 17-i run/commit és három pontos ciphertext SHA256 alapján fogadja az új archivált bemenetet. Tetszőleges mentési útvonal/run/hash továbbra sem választható. Az előző snapshot-azonosítók megmaradtak.
2. Új, rollbackkel záruló SQL-fixture teszteli a visszaállított `sc_resolve_service_link` és `sc_approve_tub_service` függvényeket. A szintetikus proof aláírása SQL-en belül marad; a visszaállított kulcsot nem adja vissza és nem naplózza.
3. A fixture runner csak `sc_restore` adatbázist fogad a már meglévő szigorú disposable célkapu mellett; előtte és utána összeveti a recovery manifestet.
4. Új célzott workflow meglévő, pontosan kötött artifactból épít tesztkörnyezetet; nincs forráshitelesítése. A GoTrue/PostgREST inicializálása a korábbi, verziózott helyreállítási eljárást használja újra.
5. A régi runtime-fixture dátuma helyett 30/32 nappal későbbi szintetikus érkezést/távozást használ, és külön ellenőrzi a kinyert dátumokat. A PASS-jelölés már csak az adott részteszt összes assertionje után történik.

Érintett kódfájlok: `scripts/verify-isolated-restore.py`, `scripts/test_isolated_restore.py`, `scripts/restored-service-rollback.sql`, `scripts/verify-restored-service-rollback.py`, `scripts/isolated-fresh-runtime-chain.mjs`, `tests/restored-service-rollback.test.mjs`, `.github/workflows/sarberki-v1-recovery-proof.yml`. Alkalmazási jogosultság, üzleti szabály, production-schema vagy külső végrehajtás nem változott.

## Bizonyítékszintek

| Terület | Eredmény és korlát |
| --- | --- |
| AES256 feloldás, teljes SQL-restore, recovery manifest | PASS; 49 tábla összevetése sikeres, az új szolgáltatási sémákkal |
| Szolgáltatási összerendelés | Tényleges visszaállított SQL RPC: döntés és audit; stale ismétlés tiltott |
| Külön dézsajóváhagyás | Tényleges SQL RPC, read+approve/write nélkül; egy append-only döntés; case/target verzió és szállásjóváhagyás változatlan |
| Hibás MAC, replay, Writer-only, Reader közvetlen DML, cross-tenant, anon | Tényleges visszaállított SQL-tiltások PASS; JWT-claims itt szimulált |
| Rollback | Teljes ügy-/szolgáltatásmanifest változatlan. Identitásszekvenciák lefoglalt értékei nem tranzakciósak; a teljes céladatbázist a job végén eldobja |
| Auth és REST indulás, új tesztidentitások létrehozása, jelszavas login | Valódi GoTrue/PostgREST HTTP a helyreállított DB-n; nem mock |
| Bejövő szintetikus levél → értelmezés → ügy → tervezet | Tényleges szerver/runtime/repository/SQL út, fixture ár- és kapacitásforrással; nem Gmail OAuth |
| Reader listázás és mentett tervezet | PASS, valódi Auth és DB-tagság/RLS |
| Reader create/update/approve, közvetlen RPC-írás, Writer approve | Tiltott; az ügy és a tervezet változatlan |
| Külön approver és más tenant | Valódi Auth/DB-jog ellenőrizve; cross-tenant tiltott |
| Deduplikáció | Ismételt levél ugyanaz az ügy; új beszúrás nélkül |
| Auth/REST újraindítása → új login → ugyanaz az ügy/tervezet | PASS |

Az izolált Auth-admin token kizárólag az új, kitalált tesztfiókok provisionálásához kellett. Az alkalmazás ügyútvonala valódi Writer/Reader/approver felhasználói tokennel és DB-tagsággal futott, service role nélkül. A három új tesztfiók új véletlen jelszót kapott kizárólag az eldobható környezetben. Az eredeti felhasználók jelszavas belépését nem állítjuk igazoltnak.

A runtime 14/14 névvel jelölt részlépése PASS, a szolgáltatási rollback-fixture külön PASS. Ezek nem összegezendők az 1789 npm-teszttel. A célzott helyi új PGlite-fixture 1 PASS / 0 FAIL / 0 SKIP; offline Python restore-boundary suite 11/11 PASS. A teljes npm-regressziót helyben nem ismételtük; CI futtatta.

## Első sikertelen futás és korrekció

[39031293779](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39031293779): teljes SQL-restore, új szolgáltatási fixture és tényleges Auth-login már sikeres, de a régi runtime 2026-10-16-i érkezési mintájának elvárt tervezetstátusza nem teljesült. A dátum az aktuális időhöz képest múltbeli volt; a közös mag ezt tiltó ellentmondásként kezeli. A régi részlépés-jelölés az assertion előtt már PASS-t írt, noha a teljes run helyesen sikertelen lett. Mindkét tesztprobléma javítva; a végleges új run teljesen zöld. Éles alkalmazáshibát vagy adatvesztést nem észleltünk.

## Megőrzés és nyitott kapuk

Az eredeti titkosított mentési csomag külön megőrzött és visszaolvasott példánya változatlanul érvényes; új feloldó jelszó vagy megosztás nem készült. E próba artifactja `12100447833`, SHA256 `dfd71f13ec6654be28808e26825fa33aa7bb0fd433c31275ddba41656ebbb50b`; lejárata **2026-10-24 12:10:22 UTC / 14:10:22 Budapest**. A jelen jelentés és EVIDENCE.json a gitben is megőrzi az összesített bizonyítékot.

Ez nem teljes külső infrastruktúra-klón. A meglévő Netlify/Google/Supabase adminbeállítások, eredeti fiókok tényleges újrabelépése, OAuth és objektumtárfájlok külön helyreállítási hatókör. A szolgáltatási SQL-próba szimulált claims-e nem azonos az Auth-runtime tényleges loginjával. A runtime nem hajtott végre teljes UI-jóváhagyási átmenetet vagy élő szolgáltatásfoglalást. Ár/kapacitás a runtime-ban kizárólag szintetikus bizonyíték; éles ajánlatot nem igazol.

V1-becslés: **93%**, mérnöki becslés, nem tesztarány vagy élesítési engedély. A 92%-hoz képest a friss snapshot új szolgáltatási SQL-működése és a tényleges izolált Auth/REST-runtime kapuja lezárult. Marad a tényleges iPhone/Safari/PWA-próba (1–2 óra), külső recovery-konfiguráció/fiókellenőrzés (kb. 0,5–1,5 óra), a hozzáférés és mellékhatásmentesség igazolása után Previo tesztadapter-bekötés (3–6 óra), hiteles ház-/dézsaforrásos felhős szintetikus jóváhagyási E2E (2–4 óra), valamint tulajdonosi üzletiszabály-határok és elfogadás (2–4 óra). Körülbelül **9–18 aktív munkaóra**, külső várakozás nélkül.

Következő konkrét lépés: tényleges iPhone/Safari és főképernyős PWA-elfogadás. A Previo-hozzáférésig az élő integráció tiltva marad. Nincs új Gmail-olvasás, e-mail/Pushover, Previo-hívás/írás vagy valódi foglalás; main és production érintetlen.

V2/V3-érték: a közös döntési mag és külön read/write/approve, tenant/RLS/CAS/audit határok visszaállítás utáni működése is ellenőrizhető, új válasz- vagy jogosultsági rendszer nélkül.
