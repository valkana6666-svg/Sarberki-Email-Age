# Külső beállítások és helyreállítási korlátok – 2026-10-11

A fejlesztés kizárólag a gmail-test-subject-allowlist ágban történt. A teljes
böngészős jóváhagyási próba új, egyszer használatos PostgreSQL/Auth/PostgREST
környezetet használ, szintetikus .invalid adatokkal. Az eredeti adatbázis és a
laptop böngészős ügytára nem része ennek a próbának.

A meglévő docs/RESTORE-GAPS-2026-10-11.md részletes hiánylistája továbbra is
érvényes. A következő elemek tényleges konfigurációjának megőrzése nincs igazolva:

- Gmail OAuth: Google Cloud projekt/tulajdonosi hozzáférés, consent screen,
  alkalmazás státusza, tesztfelhasználók, kliens beállításai és engedélyezett
  originek. Új gépen bejelentkezés és Gmail-olvasási hozzájárulás szükséges.
- Previo: hozzáférés és szolgáltatói konfiguráció; a kapacitásolvasás
  mellékhatásmentességének igazolása és a zárt olvasási kapuk engedélyezése.
  A jelenlegi tesztkapacitás kizárólag szintetikus fixture.
- Pushover: fiók és szerveroldali beállítások. Nem küldtünk tesztüzenetet.
- Netlify/GitHub/Supabase: tulajdonosi hozzáférések, környezeti konfiguráció,
  Auth/provider/SMTP/redirect beállítások és külső automatizációk teljes leltára.
- Laptop: a tényleges helyi ügytár és Gmail-feldolgozási/értesítési előzmények
  hiteles exportja. Ezeket nem helyettesíti a szintetikus felhős adatbázis.
- DB-mentés: a GPG-jelmondat külön biztonságos megőrzése szükséges; nincs a ZIP-ben.

Az új aláírókulcs kizárólag az egyszer használatos tesztben jön létre, memóriában
és az izolált DB privát táblájában. Nincs a forrásban, a böngészőben vagy a
mentésben. Az eredeti Supabase-projektre az izolált SQL nem telepíthető:
a telepítő és az RPC kizárólag sc_approval_test DB-t enged. Tartós, elkülönített
kezelői szolgáltatáshoz külön cél, saját Auth-konfiguráció, titoktárolás és
telepítési ellenőrzés szükséges. A normál alkalmazás nem aktiválja ezt a kaput.

A SQL-módosítás szerveres kapacitásigazolást követel: az operátor jogosultsága
önmagában nem elég. A friss bizonyíték aláírása az ügyazonosítót, tenantot,
tárolt verziót, a felülvizsgált szöveg hashét és a kapacitásadatokat is köti.
Az aláírás nem foglalási zár; tényleges külső foglalás létrehozása nincs engedélyezve.

Hivatalos Auth-referencia: https://supabase.com/docs/reference/javascript/auth-getuser
Auth változásjegyzék: https://github.com/supabase/auth/blob/master/CHANGELOG.md
