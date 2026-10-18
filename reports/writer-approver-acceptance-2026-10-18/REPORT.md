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
