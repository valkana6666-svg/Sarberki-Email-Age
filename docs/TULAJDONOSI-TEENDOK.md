# Tulajdonosi teendők – csak kézi beállítások (előkészítve: Claude, 2026-11-06)

Minden más elő van készítve. A sorrend a fontosság. Titkot (jelszót, kulcsot) **sehol ne írj chatbe vagy ide** – csak a megadott felületre.

## 00. Hozzáférések Claude-nak – a Work minimalizálása (tulajdonosi döntés 2026-11-09; Claude emlékeztet)
1. **GitHub-környezet `test-db-install`** (10 perc): lásd 1. pont. Utána az adatbázis-telepítést Claude indítja, te a GitHub-alkalmazásban jóváhagyod – Work nélkül.
2. **Netlify-kulcs Claude-nak** (5 perc): Netlify → User settings → Applications → Personal access tokens → New access token (lejárat 90 nap) → Claude-nak szólsz, és a **biztonságos űrlapon** adod meg (nem chatben). Claude csak a TEST-oldalon (`leafy-chimera-2403e5`) használja.
3. **Previo írási API-kulcs** – később, a 2. szintnél (Previótól kérjük).
Szándékosan NEM: Supabase management token, saját jelszavaid. Work marad: Facebook, Previo webes beállítások, ChatGPT-fájltár.

## 0. Később, ha lesz időd – élő tesztek a telefonon (Claude nem tudja helyetted: a Gmail-belépés a te telefonodon van)
1. **Név a megszólításban** (kiadva 11-07, `8f85b58`): új levél a sarberkito@gmail.com-ról a sarberkiprojecttest@gmail.com-ra, pl. „Jó napot! 2027. július 8-tól 11-ig jönnénk 4 felnőtt, a Családi faházba. Mennyibe kerül? Üdv: Teszt Péter” → beolvasás → mentés → elvárt: „Kedves Péter!”, olvasható időpont, „FOGLALÁS ÁTTEKINTÉSE”, a magyar tervezet egyszer.
2. **Véglegesítés** (Kis Anna-foglalás): Previo-hivatkozás `TESZT-1` → Véglegesítés → levél (94 500 Ft foglaló, „Kedves Kis Anna!”) → jóváhagyás → küldés → „Foglaló beérkezett”.
3. **Levéllista-címkék**: [Új] / [Folytatás] / [Már beolvasva] látszik-e a levelek mellett.
4. Színek jelentése a Previo-naptárban (apu): szürke, zöld, kék, narancs („-3”), „R”, „B.”.
5. **NTAK-értékek az éles Previóból** (Beállítások → Hotel → Szoba, 6 típus): a teszt most ideiglenesen Üdülőház / Apartman; utána a tesztet az élőhöz igazítjuk.

## 1. GitHub: telefonról jóváhagyható adatbázis-telepítés (kb. 10 perc) – ezzel Work fő feladata megszűnik
1. github.com → `valkana6666-svg/Sarberki-Email-Age` → **Settings → Environments → New environment** → név: `test-db-install` → **Configure environment**.
2. **Required reviewers** bepipálva → add hozzá: `valkana6666-svg` → **Save protection rules**.
3. Ugyanitt **Environment secrets → Add environment secret**:
   - Name: `SARBERKI_TEST_DB_INSTALL_URL`
   - Value: Supabase → a **TEST** projekt (`mojnqizbcaczstguikpv`) → **Connect** (vagy Project Settings → Database) → **Session pooler** URI, a `[YOUR-PASSWORD]` helyére az adatbázis jelszava.
4. Szólj Claude-nak: „Kész a GitHub-környezet.” (Telepítésre vár: `deployment/test-mailbox/booking-status.sql` – foglalás véglegesítése és foglaló beérkezése.) → Claude egy **csak olvasó próbafutást** indít (`deployment/test-db-install/healthcheck.sql`, semmit nem módosít); te a GitHub-alkalmazásban **Approve**. Utána jöhetnek a valódi telepítések, mindegyik a te jóváhagyásoddal.

## 2. Netlify: a küldési napló kapcsolója – MOST MÁR MEHET (Work 11-06 12:31: telepítés PASS)
1. app.netlify.com → `leafy-chimera-2403e5` → **Site configuration → Environment variables → Add a variable**: `CASE_TEST_MAILBOX_SEND_LEDGER` = `required`.
2. Írd Claude-nak: „Engedélyezem a TEST-kiadást” → Claude kiadja és élőben ellenőrzi.
- Visszavonás: a változó törlése + TEST-kiadás.

## 3. Döntés: Netlify-kulcs Claude-nak (nem kötelező)
- Haszon: a Netlify-kapcsolókat (mint a 2. pont) Claude állítaná, nem kellene neked.
- Kockázat: a kulcs a Netlify-fiók minden oldalához hozzáfér; Claude csak a TEST-oldalnál használná (AGENTS.md-be rögzítve).
- Ha kéred: Netlify → User settings → Applications → **Personal access tokens → New access token** (lejárat: 90 nap) → majd szólj Claude-nak, és a kulcsot a megjelenő **biztonságos űrlapba** írod (nem a chatbe).

## 4. Previo: szerkezet-másolás kérése a 73521-es tesztbe – másold be, küldd el te
A kulcs megjött és működik (11-06). A levél szövege: [`PREVIO-TEST-23-EGYSEG-2026-11-06.md`](PREVIO-TEST-23-EGYSEG-2026-11-06.md) 4. pont (a #63899-es ügyre válaszként).

## 5. Tesztlevelek (ha van 15 perced): `TESZTLEVELEK-2026-11.md` – 7 kész szöveg a sarberkito@gmail.com-ról

## 5b. Facebook (ha a húgod megadta a jogot)
Csatlakozás a Sárberki-oldallal az „Angeln in Österreich” csoporthoz; az üzenet- és poszttervek a „Sárberki Austria 2027” táblázat „Új levelek DE-HU” lapjának 7–10. sorában.

## 6. Később, amikor lesz kb. 1–1,5 órád: teljes újraépítési próba (részletek: `UJRAEPITESI-PROBA.md`)
Te: új, ingyenes Supabase-projekt és egy új Netlify-oldal létrehozása (Claude lépésenként vezet). Claude: visszaállítás a Drive-mentésből, beállítás, ellenőrzés. Cél: ≤ 4 óra alatt helyreállítható rendszer.

## Nem most (tájékoztatás)
- **info@sarberkito.hu**: csak a teljes TEST-próba (Previóval, a sarberkito@gmail.com tesztlevelekkel) után, édesapád hozzájárulásával és frissített adatkezelési tájékoztatóval.
- Éles adatbázis/oldal: külön engedéllyel, a fentiek után.
- **Később (tulajdonosi terv, 11-07):** ha a TEST-rendszer működik és apunak tetszik → Work olvasási hozzáférést kap az éles Previóhoz (753011), feltérképezi a funkciókat/beállításokat, és átteszi a 73521-es tesztbe. Feltételek: külön, csak olvasó Previo-felhasználó (nem apu fiókja), csak beállítási oldalak, vendég-/pénzügyi adat nem kerül ki, apu hozzájárulása, előzetes rögzített engedély; az átvezetés a tesztbe külön engedély.
