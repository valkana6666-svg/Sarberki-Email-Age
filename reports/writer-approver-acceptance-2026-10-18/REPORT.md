# Writer és külön jóváhagyó – 2026-10-18

## Igazolt tényleges felhős UI-próba

- Kiinduló tesztág HEAD: ecdb3c79945a63ec39ad1158fed15b2ff4132905.
- Kizárólag szintetikus ügy: `982fc2fa-1e79-478b-8241-2a59f73027b8`.
- Kezdő visszaolvasás: revision 1, approval pending, serverApproval null, audit [].
- A tulajdonos védett credential-űrlapon jelentkezett be a Writer-próbához; jelszó nem került kódba, jelentésbe vagy chatbe.
- Egyetlen normál Writer review-draft mentés sikerült: revision 2. Nem történt automatikus ismétlés.
- Külön GET-visszaolvasás: revision 2, approval pending, serverApproval null, audit []. Ez a jóváhagyási audit ürességét bizonyítja, nem az összes adatbázis-audit hiányát.
- Tárolt angol tervezet és magyar ellenőrző szöveg frissen betöltött: 2026-10-23–25, 2 fő, Deluxe, hiányzó telefonszám pontosítása; nem visszaigazolt foglalás.
- Kijelentkezéskor a tervezet/verzió törlődött és a munkaterület letiltott.
- Külön jóváhagyóként kért új, védett bejelentkezés után a v2 újra betöltött. A bejelentkezés és olvasás igazolt; az adott fiók jóváhagyási jogosultsága még nem, mert nem történt jóváhagyási művelet.
- Az emberi elolvasás/jóváhagyás checkbox nincs bejelölve; belső jóváhagyás nem történt. Következő: tulajdonosi ellenőrzés a megnyitott felületen, majd friss állapot/audit visszaolvasása. Bizonytalan kimenetelnél jóváhagyást ismételni tilos.

## Hatókör és nyitott kapuk

Ez tényleges cloud Chrome-próba; nem fizikai iPhone Writer/approver-elfogadás. A korábban lezárt iPhone Reader-visszatérési próbát nem ismételtük. Kitalált, rögzített tesztár és tesztkapacitás; élő Previo-hitelességet nem bizonyít. Nem történt e-mail/Pushover-küldés, valós foglalás, Previo-kérés, production/main módosítás vagy jogosultságbővítés.

Alkalmazáskód és séma változatlan. Új CI/mentés nem indokolt. A legutóbbi kódellenőrzés változatlan: 8f038b8e217cbe9bf0022215f1c1add1fffb6068, CI 39067208971: 1812 PASS / 0 FAIL / 0 SKIP; mobil 39067209026: 40 PASS / 0 FAIL, emulált Chromium/WebKit. A jelen munkamenet nem új automata tesztfuttatás. V1 becslés marad körülbelül 93%; teljes elfogadás továbbra sem igazolt.

## Tulajdonosi jogosultságbővítés – 2026-10-18 07:22 után

A tulajdonos kifejezetten kérte, hogy a `reader@sarberki-test.invalid` fiók olvashasson, írhasson és minden belső tesztműveletet elvégezhessen. A hitelesített `sarberki-test` projektben kizárólag e meglévő felhasználó `sarberki-test` tagságának can_write és can_approve jelzője lett false→true, can_read true maradt. A módosítás tranzakcióban, pontos felhasználó-/e-mail-/tenant- és test_only=true feltétellel történt; az elvárt egyetlen sor eltérése hibát és visszagörgetést okozott volna. Nincs séma-, RLS-, jelszó-, admin- vagy más tenant-jogosultság változás.

Utólagos valós PostgreSQL-próba authenticated szereppel és a célfelhasználó auth.uid()-jával: test_read/test_write/test_approve=true; sarberki-production read/write/approve=false; csak egy saját tagság látható. E próba tranzakciója rollbackkel zárult, nem írt ügyet. Ez nem új böngészős E2E-jóváhagyás; az emberi jóváhagyási kapu és auditpróba továbbra is nyitott. Az API a DB-tagságot kérésenként olvassa; a módosítás nem támaszkodik új JWT-role claimre.

A fiók neve továbbra is reader, de ettől az időponttól NEM csak olvasó. A korábbi készülékképeken igazolt Reader-tiltás a jogosultságbővítés előtti állapotra érvényes. E fiókkal a csak olvasó negatív tesztet a jövőben nem szabad sikeresnek minősíteni; külön csak olvasó tesztfiók szükséges. Tesztjog nem jelent valós e-mail/Pushover-küldési, Previo-, production- vagy automatikus foglalásvéglegesítési jogot.

## Emberi jóváhagyás elmentve – 2026-10-18 07:27:40 Budapest

A tulajdonos visszajelzése után a felület: „Izolált szintetikus jóváhagyás mentve; új verzió: 3. Nem foglalás és nem elküldött levél.” A jóváhagyási műveletet az asszisztens nem ismételte meg.

Külön, célzott, csak olvasási Supabase-ellenőrzés a rögzített szintetikus ügyön: revision 3, approval internally_approved, serverApproval.reviewedRevision=2. A serverApproval actor és időpont megegyezik a revision 3 approve_isolated_synthetic auditesemény actorával és időpontjával. A Writer v2-mentés és a v3-jóváhagyás külön actorhoz tartozik. Jóváhagyás ideje 2026-10-18T05:27:40.506021Z. Draft hash: d4ba253c4ea9c03c82ed89c7887ed8160410f5e51540d0842906067e8295c4e6. Egyetlen revision 3 jóváhagyási auditesemény látható; a korábbi v1 insert/v2 update megmaradt.

A felületi approval-state GET viszont AUTH_REQUIRED hibát adott. Az adatbázisban való megőrzés/audit igazolt, a bejelentkezett böngészőből történő audit-visszaolvasás ebben a munkamenetben NEM PASS. Egyetlen, írásmentes oldalfrissítéssel ellenőriztük a session-helyreállítást; kezdetben letiltott munkaterület jelent meg. A hiba oka nem bizonyított, nem állítunk biztos cookie-lejáratot vagy revokációt. Következő: érvényes munkamenettel kizárólag approval-state GET, jóváhagyás/Writer-újraírás nélkül.

Ez cloud Chrome bizonyíték, nem fizikai iPhone-jóváhagyási próba. A V1 továbbra kb. 93%, a session-/készülékes és külső kapuk miatt nem véglegesen elfogadott. Alkalmazáskód változatlan; új CI/mentés nem készült.
