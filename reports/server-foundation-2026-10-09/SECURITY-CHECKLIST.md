# Biztonsági ellenőrzési lista

## Elvégzett és igazolt

- [x] Csak gmail-test-subject-allowlist; kiinduló working tree tiszta.
- [x] Main/production nem módosított; nincs új élő Previo vagy vendéglevélküldés.
- [x] API alapból 503; anonymous és idegen tenant fail closed.
- [x] Hiteles személyazonosság remote Auth-ból, jogosultság DB-tagságból; kliens claims ignorálva.
- [x] Service role nem kerül a kódba vagy böngészőbe; ezen az útvonalon nem használt.
- [x] Security definer RPC explicit auth.uid/tagságellenőrzés.
- [x] RLS mind az 5 táblán; membership/case/audit írás nem engedélyezett közvetlenül.
- [x] Atomikus CAS, tenant/case és tenant/mailbox/message összetett kulcs.
- [x] Audit és üzenetkulcs írás ugyanabban a tranzakcióban; hiba esetén rollback.
- [x] Üzenet/draft append-only sorrendellenőrzés; verzióhoz tartozó SHA-256 audit.
- [x] Külön read/write/approve; kézi case link approve ellenőrzést kap.
- [x] Ár/kapacitás-bizonyíték és végleges jóváhagyás feltöltése ezen az útvonalon tiltott.
- [x] Régi levél nem ír felül új tényt; új tény a meglévő motorban invalidálja a régi árat/kapacitást.
- [x] Állítólagos vendég-email kizárva .invalid feladóval; mező-/méretkorlátok.
- [x] Külső hibák nem kerülnek válaszba secretet tartalmazó részletekkel.
- [x] Helyi PostgreSQL policy és helyi mentés/restore teszt; nem csak Map mock.
- [x] Nincs implicit localStorage-migráció; export-előnézet helyben készül.
- [x] Titkos érték nélküli env minta; env/dump/bundle gitignore.

## Nyitott – aktiválás előtt kötelező

- [ ] Tulajdonosi Supabase session és egyértelmű Free/EU projekt.
- [ ] Valódi Supabase Auth lejárat/revokáció próba (jelenleg upstream 401 szimulálva).
- [ ] Valós felhős RLS, két session, két tenant, DB konkurencia és Netlify E2E.
- [ ] Felhős DB mentés, titkosított off-site tárolás és restore dokumentálása.
- [ ] DPA, alfeldolgozók, Netlify actual plan és futtatási régió ellenőrzése.
- [ ] Valódi Gmail-forrás azonosítójának szerveres származtatása; a teszt API mezői nem Gmail-hiteles bizonyítékok.
- [ ] Auth UI és tokenfrissítés; jelenlegi felület nem váltott át.
- [ ] Teljes operátori, auditált export/import/rollback.
- [ ] Ár/kapacitás forrásellenőrzött szerveres csatlakozása és végleges human-approval útvonal.
- [ ] API rate limit, kvótafigyelés, security monitoring és riasztás. Most a szűk synthetic opt-in kapu + input/méretkorlát véd; publikus többtenant üzemre nem elegendő.
- [ ] Retention/törlés végrehajtó, backup lejárat és tulajdonosi adatkezelési döntés.

## Nyitott műszaki korlátok

A listázás paginált; a többoldalas olvasás nem egyetlen PostgreSQL snapshot. Erős konkurencia vagy sok ügy esetén szerveroldali message lookup/snapshot RPC szükséges. A 10 000 feletti lista biztonságosan hibázik. Új, egyidejű külön üzenetek ügyösszekapcsolása nem kerül vak automatikus retry-ba. A migrációs preview alapvető sémaellenőrzés, nem teljes GDPR- vagy mezőszintű importvalidáció.

Az audit az adatbázis-kezelő ellen nem tamper-proof. Az Auth token ellenőrzése szolgáltatói hálózatot igényel; hiba esetén nincs anonymous fallback. `.invalid` cím ellenére a szabad szöveg lehet személyes: ezért csak kitalált tesztadat adható. A visszaállított helyi DB teszt nem felhős backupbizonyíték.
