# V1 folytatás – 2026-10-25

Az általános motor fejlesztése szünetel; a V1 elsődleges.

## Új javítás
isolated-approval-panel.mjs: sikertelen tervezetbetöltésnél nem állítja, hogy nincs korábbi jóváhagyás. Szöveg: „Ezzel a betöltéssel nem történt új jóváhagyás. A korábban tárolt állapotot az audit visszaolvasásával ellenőrizheted.” Jogosultság, ügyállapot, audit és API változatlan. A UI-hiba forrásban javítva; kiadás NEM történt, a telepített oldal még a korábbi szöveget használhatja.

Célzott helyi Node-tesztek: isolated-approval-panel, isolated-approval-review, isolated-approval-uuid: 20 PASS / 0 FAIL / 0 SKIP. Mock/injektált transport, nem új élő Auth/iPhone próba. Korábbi teljes CI: 1908 PASS; nem futtattuk újra. Ez a commit szándékosan skip ci/skip netlify, új hosted CI nincs állítva.

## Tízterületes lezárási mérleg
Egyenlő súlyú, területenként 0–1 szakértői munkabecslés; nem tesztlefedettség és nem production-engedély.
Gmail 0.90; feldolgozás/ügyazonosítás 0.95; négy nyelv 0.95; Previo 0.50; kapacitás/ár/szabály 0.80; dézsa 0.85; emberi jóváhagyás 0.95; Pushover 0.60; mentés/helyreállítás 0.85; teszt/dokumentáció 0.90. Összesen 8.25/10 = 82.5%, kerekítve 83%. A korábbi 85–90% más, informális becslés volt; ez módszertani pontosítás, nem bizonyított regresszió.

## Lezárt és fennmaradó bizonyíték
Safari logout, back/refresh/direct open és kézi re-login/audit: konkrét tulajdonosi folyamat PASS, nem újranyitva. V3 internally_approved megmaradt.
Gmail: parser/policy/dedupe és korábbi szintetikus cloud lánc kész; új böngészős eredetjelzés készülékes elfogadása nyitott.
Négy nyelv: meglévő szintetikus paritás és fordításbizonyíték; nem minden lehetséges vendéglevél garanciája.
Previo: élő readonly mellékhatásmentességi és hozzáférési kapu nyitott; nem kapcsoltuk be. A típusszintű készlet nem bizonyít fizikai egységpárost.
Dézsa: külön service-approval és bizonytalan összerendelési kapuk meglévők; valós ház/időszak szolgáltatói bizonyíték nem helyettesíthető fixture-rel.
Pushover: korábbi készülékjelzés és tesztek; új küldés nem történt, háttérböngészős figyelés nem állandó szerveres scheduler.
Mentés: docs/BACKUP-V2-CLOUD-CONTROL.md és CLOUD-ALTERNATIVE.md olvasva, kapcsoló változatlan. Snapshot 2026-10-25 08:24 Europe/Vienna, run 40172605691, commit 817212439d3ac426ca4ce1b1005015054701e832, artifact 12590478636/12590413782, lejárat 2027-01-23T07:23:48Z. Korábban igazolt GitHub SQL-restore 49 tábla és Drive raw-byte SHA256 PASS. Mai Drive-bájtokból új SQL-restore nincs. Nem indult új export vagy restore.

## A lezárás feltétlen kapui, sorrend
1. Előkészített, egy meglévő szintetikus levélre szűkített készülékes Gmail-eredetigazolás; nincs új levélküldés vagy deploy.
2. A hiányzó üzleti határértékek és a Previo mellékhatásmentes olvasási szerződés bizonyítása. Hozzáférés vagy bizonyíték nélkül ismeretlen kapacitás/ár marad; nem állítunk teljes funkcionális lezárást.
3. Dézsa tényleges forráskötése és külön jóváhagyási szolgáltatói bizonyíték a kívánt V1-scope szerint.
4. Üzemi értesítés megbízható futási és kézbesítési határának elfogadása; új küldéshez külön konkrét próba szükséges.
5. Független owner kulcspróba, teljes Auth/config/platform helyreállítás és régi backup OAuth-secret visszavonási bizonyíték. Teljes helyreállíthatóságot nem állítunk.
6. A szükséges, összegyűjtött javítások külön engedélyezett tesztkiadása és pontos SHA ellenőrzése. Netlify-deploy most tilos, nem történt.

Main, production, PR #7 és más ág nem módosult. Nincs valódi vendéglevél, Previo-írás, új fizetős szolgáltatás, secretkiolvasás vagy önálló V2-fejlesztés.
