# Valódi Supabase Auth-, RLS-, CAS- és auditpróba
Dátum: 2026-10-10 (Europe/Budapest)

## ELVÉGEZVE / TESZTELVE
- Projekt: sarberki-test / mojnqizbcaczstguikpv. Kizárólag szintetikus adatok.
- Teszthely: leafy-chimera-2403e5. Tesztág: gmail-test-subject-allowlist.
- Kiinduló helyi HEAD és publikált forrás: d77b5a0826c3cfaa2bc768f5823d1fb0680e85c8. Munkakönyvtárban csak a korábban előkészített, titokmentes scripts/supabase-owner-reset-reader.py volt untracked.
- A tulajdonos saját Windows gépén futtatott segéd ELVÉGEZVE eredményét jelentette. A reader Auth-rekord updated_at értéke ténylegesen 2026-10-09 21:54:50 UTC-re módosult; az alábbi sikeres valódi belépés megerősíti az új hitelesítő adat használhatóságát.
- A tulajdonos a képen megjelent régi admin kulcsokat visszavonta saját dashboardján; ez tulajdonosi közlés, nem független kulcsleltár. Új ideiglenes admin kulcs esetleges fennmaradása külön tulajdonosi ellenőrzést igényel.
- Az ideiglenes Auth-kapu újranyitását a tulajdonos kifejezetten jóváhagyta. SUPABASE_AUTH_TEST_UNTIL=2026-10-09T23:02:12.824Z (2026-10-10 01:02:12 Budapest). A Function ezen időpont után automatikusan zár.
- Netlify újratelepítés ténylegesen sikeres: 6ac964cb2c7a13db83c83dac, forrás d77b5a0, tesztág; 9 Functions, 13 másodperc telepítés. A production üzleti webhelyhez nem nyúltunk.
- Az első éjszakai secure browserAuth próbán a writer első belépése invalid_credentials / HTTP 400 hibával megállt (2026-10-09T22:06:24Z). A tulajdonos kérte az új jelszóbekérést.
- A második secure browserAuth próba eredménye: 25 PASS, 0 FAIL. A jelszavakat a biztonságos hitelesítési felület kezelte; a modell nem olvasta ki vagy tárolta őket.

## A 25 tényleges felhős ellenőrzés
1. Négy valódi Auth-munkamenet, két külön writer token.
2. Elkülönített read/write/approve jogosultságok.
3. Hiányzó Auth token elutasítása.
4. Hamis Auth token elutasítása.
5. Writer új szintetikus ügyet ír.
6. Reader ügyet olvas.
7. Hamisított kliensszerepkör nem ad írásjogot.
8. Végleges jóváhagyás tiltva.
9. Reader RPC-írás tiltva.
10. Második tenant nem olvashatja az első ügyét.
11. Második tenant nem írhat az elsőbe.
12. Közvetlen táblaírás tiltva.
13. Önkiszolgáló tagságmódosítás tiltva.
14. Két valódi writer munkamenet párhuzamos CAS-próbájában pontosan egy siker.
15. CAS után revision=2.
16. Korábbi üzenet felülírása tiltva.
17. Mailbox/message duplikáció elutasítva.
18. Hibás tranzakció rollbackje.
19. Két helyes sarberki auditbejegyzés.
20. Második tenant saját ügyet ír.
21. Első tenant nem olvashatja a második ügyét.
22–25. Mind a négy tesztmunkamenet refresh-token visszavonása sikeres. A már kiadott access JWT a lejáratig érvényes maradhat; nem került a böngészőbe.

Független tulajdonosi SQL utóellenőrzés: a tesztben sarberki-test alatt 1 ügy, revision=2; demo-test alatt 1 ügy, revision=1. Audit: sarberki insert=1, update=1; demo insert=1. Mindkét ügy kizárólag kitalált .invalid feladót és szintetikus szöveget tartalmaz. A rekordokat a későbbi mentéspróbához megőriztük.

## BLOKKOLVA / MÉG NEM KÉSZ
- Titkosított, GitHubtól független teljes adatbázismentés és külön izolált restore nem történt. A környezetben pg_dump és Docker nem található; GnuPG van, biztonságos tulajdonosi DB-kapcsolat és restore-környezet nincs. A meglévő BACKUP-RESTORE.md terv továbbra alkalmazandó; nem rendeltünk fizetős szolgáltatást.
- CASE_STORE_ENABLED=disabled. A sikeres Auth-próba nem aktiválja a booking-cases végpontot.
- A 25 ellenőrzés a Netlify ideiglenes Function → Supabase Auth → adapter/ügykezelő → PostgreSQL/audit útvonalra vonatkozik. A booking-cases végpont teljes szintetikus E2E-tesztje továbbra 0.
- Lejárt valódi token külön próbája, tervezetverziók felülírástiltása, két mailbox és teljes server-booking-runtime ügyfeldolgozás még nincs e futásban igazolva.
- Automatikus regresszió most nem ismételve: nincs forráskódváltozás. Legutóbbi friss teljes regresszió 821 PASS, a korábbi jelentésben rögzített forráson.
- A sikeres eredményoldal accessibility állapota mind a 25 PASS sort visszaadta. A későbbi képernyőkép mentését a böngésző natív hitelesítési védelme blokkolta; a dokumentált biztonságos navigációs helyreállítás sem sikerült. Nem került sor credential kiolvasásra vagy védelemkerülésre.
- Valódi vendégadat, e-mail, Gmail-import, Previo-művelet, végleges jóváhagyás, localStorage-migráció, main módosítás nem történt.
