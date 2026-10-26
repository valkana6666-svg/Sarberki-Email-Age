# Felhős vendégszöveg szerkesztése – 2026-10-26

Alap: 064561f5a325cde73510ac757791c84550b1c4cb. Csak gmail-test-subject-allowlist. Nincs telepítés vagy felhős ügyírás.

## Megvalósítás

A külön Writer szerkesztőmező a tárolt szöveget kapja. A szerver canEditDraft jelzése megjelenítési képesség, nem jogosultság: minden mentés újra ellenőrzi az Auth-, CSRF-, Writer-, szűk ügykapu-, revízió- és korábbi szöveghash-feltételeket. Reader nem kap szerkesztési képességet.

A sc_write_case append-only tervezetet, új ügyrevíziót és atomi update auditot ír. A szöveg pontosan megmarad. A szerver rögzíti a szerkesztőt, az aktuális és eredeti generált szöveg SHA256-értékét. A korábbi magyar ellenőrző szöveget nem mutatja igazolt fordításként a módosított szöveghez.

Csak függő, aktív serverApproval nélküli ügy szerkeszthető. Jóváhagyott ügy nem nyitható újra. Gépelés, mentés, hiba, ügy- vagy munkamenetváltás törli a hozzájárulást. A független jóváhagyó külön betölti az aktuális szöveget. A szerver elutasítja a szerkesztő saját jóváhagyását, újraellenőrzi az eredeti generált szöveg és a friss szintetikus bizonyíték egyezését, majd a meglévő HMAC a módosított szöveghashhez és revízióhoz kötődik. Nincs új SQL-jog vagy service-role: a meglévő user-token/RLS/tagság/CAS/audit útvonal marad.

Az exact Gmail és a kétüzenetes HU ügy továbbra sem szerkeszthető vagy jóváhagyható. Az olvasási kapu nem engedélyez írást.

## Ellenőrzés

Célzott tesztek: Writer mentés, pontos Reader-visszaolvasás, revízió/hash/audit, elavult mentés, hibás hash, idegen mező, azonos szereplő tiltása és külön jóváhagyó valódi PostgreSQL-motoron; mentési hibák, ügy-/munkamenetváltás, párhuzamos kattintás és késői válasz a felületi tesztekben. HU és exact Gmail negatív szerkesztési teszt is készült.

A CI előbb a három célzott fájlt, majd siker után egyszer a teljes npm test csomagot futtatja. A teljes Node/PostgreSQL bizonyítékot GitHub Actions adja; a helyi shell nem indítható. Végleges eredmény a zárójelentésben.

## Work átvétel – egyetlen külön tesztkiadás

1. Előfeltétel: már létező, registryhez tartozó, együzenetes, függő szintetikus ügy. Történeti jóváhagyott ügyet teszteléshez visszaállítani vagy módosítani tilos. Ha nincs ilyen ügy, hiányzó tesztadatként kell rögzíteni, a kapu nem bővíthető általánosan.
2. Writer betöltés, szerkesztés, korábbi hozzájárulás törlésének ellenőrzése, mentés. Rögzítendő: ügyazonosító, revízió, SHA256 és update audit metaadat.
3. Teljes újratöltés után pontos szövegvisszaolvasás Writerrel és Readerrel; Reader nem szerkeszthet.
4. Külön jóváhagyó friss bejelentkezéssel betölti és elolvassa az aktuális szöveget, külön hozzájárul, majd jóváhagy. Újratöltés és audit-visszaolvasás. Azonos szerkesztő/jóváhagyó elutasítva.
5. Elavult revízió, hibás hash, CSRF, idegen ügy/tenant, védett Gmail/HU írás elutasítva; hiba után nincs aktív hozzájárulás. A lezárt pozitív HU/Gmail átvételt nem kell ismételni.

Nincs küldés, foglalás, Previo-hívás, ár-, mentési-, main- vagy production-módosítás. Hosted működés a külön átvételig NEM IGAZOLT. A 85%-os becslés nem változik automatikusan.

## Felhős tesztadat előfeltétel

A 2026-10-26-i kizárólag olvasási SQL-ellenőrzés hat regisztrált feladóból származó tárolt sort talált. Az egyetlen függő, együzenetes jelölt a 0febcd75-d954-49cf-a5e8-70e7d8ce14dd v2 service_link_review / manual_review_required ügy; ez nem jogosult zárt booking-review ügy. Nincs igazolt, megfelelő függő hosted szerkesztési tesztügy. A már elfogadott ügyekhez nem nyúltam. A Work átvétel előtt külön, pontosan meghatározott új szintetikus fixture engedélyezése szükséges; általános jogosultságbővítés nem megoldás.
