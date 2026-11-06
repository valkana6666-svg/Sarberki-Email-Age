# Tulajdonosi teendők – csak kézi beállítások (előkészítve: Claude, 2026-11-06)

Minden más elő van készítve. A sorrend a fontosság. Titkot (jelszót, kulcsot) **sehol ne írj chatbe vagy ide** – csak a megadott felületre.

## 1. GitHub: telefonról jóváhagyható adatbázis-telepítés (kb. 10 perc) – ezzel Work fő feladata megszűnik
1. github.com → `valkana6666-svg/Sarberki-Email-Age` → **Settings → Environments → New environment** → név: `test-db-install` → **Configure environment**.
2. **Required reviewers** bepipálva → add hozzá: `valkana6666-svg` → **Save protection rules**.
3. Ugyanitt **Environment secrets → Add environment secret**:
   - Name: `SARBERKI_TEST_DB_INSTALL_URL`
   - Value: Supabase → a **TEST** projekt (`mojnqizbcaczstguikpv`) → **Connect** (vagy Project Settings → Database) → **Session pooler** URI, a `[YOUR-PASSWORD]` helyére az adatbázis jelszava.
4. Szólj Claude-nak: „Kész a GitHub-környezet.” → Claude egy **csak olvasó próbafutást** indít (`deployment/test-db-install/healthcheck.sql`, semmit nem módosít); te a GitHub-alkalmazásban **Approve**. Utána jöhetnek a valódi telepítések, mindegyik a te jóváhagyásoddal.

## 2. Netlify: a küldési napló kapcsolója – MOST MÁR MEHET (Work 11-06 12:31: telepítés PASS)
1. app.netlify.com → `leafy-chimera-2403e5` → **Site configuration → Environment variables → Add a variable**: `CASE_TEST_MAILBOX_SEND_LEDGER` = `required`.
2. Írd Claude-nak: „Engedélyezem a TEST-kiadást” → Claude kiadja és élőben ellenőrzi.
- Visszavonás: a változó törlése + TEST-kiadás.

## 3. Döntés: Netlify-kulcs Claude-nak (nem kötelező)
- Haszon: a Netlify-kapcsolókat (mint a 2. pont) Claude állítaná, nem kellene neked.
- Kockázat: a kulcs a Netlify-fiók minden oldalához hozzáfér; Claude csak a TEST-oldalnál használná (AGENTS.md-be rögzítve).
- Ha kéred: Netlify → User settings → Applications → **Personal access tokens → New access token** (lejárat: 90 nap) → majd szólj Claude-nak, és a kulcsot a megjelenő **biztonságos űrlapba** írod (nem a chatbe).

## 4. Previo: levél a meglévő ügyre (previohu#63899) – másold be, küldd el te
Magyarul:
> Tisztelt Previo Ügyfélszolgálat!
> A #63899 ügyhöz kapcsolódóan két kérésünk van:
> 1. Kérjük a REST API **olvasási** kulcsot az API TESZT szálláshelyhez (73521), kizárólag a `Booking.getFreeCapacity` és `Hotel.getRates` / `Hotel.getObjectKinds` jogosultsággal, írási jog nélkül.
> 2. Kérjük **írásos megerősítésüket**, hogy a `GET /rest/calendar/availability` hívás semmilyen foglalást, ideiglenes zárolást (hold) vagy egyéb módosítást nem hoz létre a szálláshelyen.
> Köszönettel: Kovács László, Sárberki Horgásztó

A kulcsot ne küldd el senkinek: ha megjött, szólj Claude-nak, és a biztonságos űrlapon adod meg.

## 5. Tesztlevelek (ha van 15 perced): `TESZTLEVELEK-2026-11.md` – 7 kész szöveg a sarberkito@gmail.com-ról

## 5b. Facebook (ha a húgod megadta a jogot)
Csatlakozás a Sárberki-oldallal az „Angeln in Österreich” csoporthoz; az üzenet- és poszttervek a „Sárberki Austria 2027” táblázat „Új levelek DE-HU” lapjának 7–10. sorában.

## 6. Később, amikor lesz kb. 1–1,5 órád: teljes újraépítési próba (részletek: `UJRAEPITESI-PROBA.md`)
Te: új, ingyenes Supabase-projekt és egy új Netlify-oldal létrehozása (Claude lépésenként vezet). Claude: visszaállítás a Drive-mentésből, beállítás, ellenőrzés. Cél: ≤ 4 óra alatt helyreállítható rendszer.

## Nem most (tájékoztatás)
- **info@sarberkito.hu**: csak a teljes TEST-próba (Previóval, a sarberkito@gmail.com tesztlevelekkel) után, édesapád hozzájárulásával és frissített adatkezelési tájékoztatóval.
- Éles adatbázis/oldal: külön engedéllyel, a fentiek után.
