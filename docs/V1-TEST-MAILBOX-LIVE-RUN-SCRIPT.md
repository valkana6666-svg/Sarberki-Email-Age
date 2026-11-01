# Élő TEST-próba – lépésenkénti forgatókönyv (iPhone, Safari)

Cél: az ellenőrzőlista 5.1–5.12 egyetlen körben, ismétlés nélkül. Csak kitalált tartalom. Nincs küldés, foglalás, Previo. Az elvárt szövegek a telepített kódból (`7e9a4fa`) származnak.
Rögzítés: minden sorhoz PASS / FAIL + időpont (képernyőkép opcionális, valódi adat nélkül). FAIL esetén megállás; vészleállítás: `sc_test_mailbox_config.enabled=false`.

Előfeltétel: két külön kezelői fiók – **W** (Writer, nincs approve joga) és **A** (Approver, nem azonos W-vel). Kitalált tesztlevél a sarberkiprojecttest@gmail.com fiókba, tárgy pontosan így kezdődik: `Sárberki élő teszt` (nem „Re:”/„Fwd:”), szöveg pl. „Jó napot! Deluxe faházat szeretnénk 2027-05-14 és 2027-05-16 között 2 felnőttnek.”

| # | Ki | Művelet (https://leafy-chimera-2403e5.netlify.app/napi-kezelo/) | Elvárt eredmény |
|---|---|---|---|
| L1 | W | Belépés → „E-mailek beolvasása” → Google-ablakban sarberkiprojecttest@gmail.com, olvasási engedély | levéllista; a tesztlevél megnyílik (5.1, OAuth+olvasás) |
| L2 | W | „AI-válaszjavaslat kérése” | szerkeszthető javaslat; „Kapacitás: nem igazolt”, „Ár: nem igazolt”, „Emberi jóváhagyás szükséges” (központi AI) |
| L3 | W | „Ügyként mentés” (ha Google újra kér engedélyt: ugyanaz a fiók) | „Ügy mentése a szerveren…” → „Ügyként mentve (tm-…). Független jóváhagyásra vár; nincs küldés vagy foglalás.”; az ügy megnyílik, státusz „Független jóváhagyásra vár.” (5.2) |
| L4 | W | Ugyanannál a levélnél újra „Ügyként mentés” | „A mentés nem sikerült, vagy ez a levél már ügyként szerepel.” – nincs második ügy (5.3, duplikáció) |
| L5 | W | Egy „Re: Sárberki élő teszt” levél kiválasztása | „Ügyként mentés” gomb szürke (5.4) |
| L6 | W | Ügyadatlap: „Válasz jóváhagyása” / „Elutasítás” | nem nyomható (szürke) (5.6) |
| L7 | W | Tervezet módosítása → „Módosítás mentése” | „Új tervezet mentve és visszaolvasva. Független jóváhagyásra vár.” (5.5) |
| L8 | A | Kijelentkezés W-ből, belépés A-val → „Jóváhagyásra vár” → „Tesztügy …” → Megnyitás | szerkesztő szürke; „Visszaküldés javításra”, „Elutasítás”, jelölőnégyzet aktív |
| L9 | A | Indoklás: „Kitalált javítási kérés” → „Visszaküldés javításra” | „Visszaküldés mentve és visszaolvasva. Writer új tervezetet menthet.”; Döntések: „visszaküldve javításra … – Kitalált javítási kérés” (5.7) |
| L10 | W | Belépés W-vel → „Folyamatban” → ügy → új tervezet → „Módosítás mentése” | „Új tervezet mentve és visszaolvasva…” |
| L11 | A | Belépés A-val → ügy → „Elutasítás” | „Elutasítás mentve és visszaolvasva. Az ügy nyitva marad.” (5.8) |
| L12 | W | Ügy („Folyamatban”) → státusz „Elutasítva; …újranyithatja.” → új tervezet → mentés | „Új tervezet mentve…”, ügy újra „Jóváhagyásra vár” |
| L13 | A | Ügy → jelölőnégyzet → „Válasz jóváhagyása” | „Belső jóváhagyás mentve és visszaolvasva (test-mailbox-v1). Nincs levélküldés vagy foglalás.” (5.9) |
| L14 | A | Alkalmazásváltás (másik app, vissza) az ügy nyitva tartásával | tartalom újra látható, belépés megmarad (5.11) |
| L15 | Work (SQL, csak olvasás) | `sc_audit` az ügyre | sorrend: tm_create, tm_redraft, tm_return, tm_redraft, tm_reject, tm_redraft, tm_approve (5.10) |
| L16 | Tulajdonos | Gmail „Elküldött” mappa és Previo | nincs új elküldött levél, nincs foglalásváltozás (5.12) |

Hibakódok gyors értelmezése: „nincs jogosultság, vagy a funkció nincs bekapcsolva” → szerep vagy valamelyik kapcsoló; „A Google-olvasási engedély szükséges.” → OAuth; „A levél tárgya nem jelölt tesztlevél.” → tárgy; „A mentés eredménye nem igazolt, vagy az ügy közben megváltozott” → revízióütközés, töltse be újra (nincs automatikus ismétlés).
