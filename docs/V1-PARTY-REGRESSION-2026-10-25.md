# Gyermeklétszám – V1 regresszió, 2026-10-25

Javítás: 00954c29d5405d480fa8d653dd9baf314870e6e1. Sárberki adult-only alapérték: business-config.mjs; közös partyCountsFromText és helyi UI használja. Ár, házkapacitás és Previo adapter változatlan.

Teljes helyi regresszió a javításon: 1908 PASS / 0 FAIL / 0 SKIP. Nem hosted CI vagy új készülékes próba. Később hozzáadott elfogadási mátrix: a tests/gmail-party-parity.test.mjs hat tesztje 6 PASS / 0 FAIL / 0 SKIP. A számok átfednek, nem összeadandók.

Mátrix: 2 és 8 felnőtt → 0 gyermek; 4 felnőtt + 2 gyermek → 6 fő; 3 felnőtt + ismeretlen számú gyermek → gyermek és összlétszám ismeretlen; általános 2 fő → életkori megoszlás ismeretlen; ellentmondó összlétszám → emberi ellenőrzés, kapacitáskapu tiltott. HU/EN/DE/SI szintetikus esetek.

Netlify-deploy nem történt. A javítás készülékes megjelenése nem igazolt; a korábbi Gmail-eredet és Safari-elfogadás változatlanul lezárt. Következő lépés a nyitott üzleti/Previo-bizonyítékok tételes lezárása, külső művelet nélkül.
