# Tesztlevél-ügyek – tulajdonosi élesítési ellenőrzőlista (csak TEST)

Hatókör: kizárólag a `mojnqizbcaczstguikpv` TEST-projekt és a `leafy-chimera-2403e5` tesztoldal, `sarberki-test` tenant, kitalált tartalmú „Sárberki élő teszt” levelek. Nincs vendéglevél-küldés, foglalás, Previo-írás, Pushover. Minden lépés külön tulajdonosi döntés; ez a dokumentum nem engedély. Titok, token, kulcs nem kerülhet ide, naplóba vagy GitHubra.

Kiinduló kód: `gmail-test-subject-allowlist`, legalább `a09c9d4` (szintetikus bizonyíték: `docs/V1-FOLYTATASI-PONT.md`).

Jelölés: minden sor eredménye **PASS / FAIL / NEM IGAZOLT**, bizonyítékkal (CI-futás linkje, commit SHA, időpont). FAIL esetén megállás és a sor visszaállítási lépése.

## 0. Előfeltételek (változtatás nélkül ellenőrizhető)
| # | Ellenőrzés | Elvárt | Eredmény |
|---|---|---|---|
| 0.1 | A tesztág CI-je a kiinduló commitra | Sarberki test branch checks zöld | NEM IGAZOLT |
| 0.2 | A tesztoldalon futó build | `/api/health` `deployedCommit` = ismert commit (`gmail-readonly-targeted-20261024.yml`, `verify_deployed:true`) | NEM IGAZOLT |
| 0.3 | Meglévő cloud-approval beállítás él | `CASE_APPROVAL_ENABLED`, `ISOLATED_APPROVAL_ATTESTATION_KEY` a tesztoldalon, `sc_cloud_approval_binding` és `sc_isolated_approval_key` a TEST-projektben (lásd `deployment/cloud-approval/README.md`) | NEM IGAZOLT |
| 0.4 | Szerepek | legalább egy Writer és egy tőle **független** Approver-tagság a `sarberki-test` tenantban (`sc_memberships`); a Writer nem lehet a jóváhagyó | NEM IGAZOLT |

## 1. Friss mentés és visszaállíthatóság
| # | Lépés | Elvárt | Eredmény |
|---|---|---|---|
| 1.1 | Friss titkosított mentés a meglévő folyamattal (`docs/BACKUP-V2-*.md`) | mentés SHA-256 rögzítve (csak az ellenőrzőkód, a mentés nem) | **PASS (2026-11-01 07:28Z)** – Backup V2 run [41284787609](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/41284787609), forráskód `676ee69` (kérés: `30cece8`); titkosított staging-artifact 13075230160, zip-digest `54b3578868dbfa1534f991e7111e941f076870639038a808fe9c58be6ff50dc8`; proof-artifact 13074905792; a readback a `mojnqizbcaczstguikpv` eredetet ellenőrzi |
| 1.2 | Elkülönített visszaállítási próba | sikeres, bizonyítékkal | **PASS (2026-11-01 07:28Z)** – ugyanaz a futás: pontos azonosítójú GitHub-visszaolvasás + hash PASS; forrás-hitelesítő nélküli SQL-visszaállítás: `full_restore PASS`, `case_manifest PASS`, 50 tábla összevetve. A Drive-ág ebben a futásban kimaradt (külön ellenőrizhető). |

Megjegyzés a 2.2-höz: a `sarberki.tm_backup_sha256` értékét a tulajdonos választja a fenti futás bizonyítékai közül (pl. a proof-artifactban rögzített helyreállítási csomag SHA-256-ja); ezt a dokumentum nem dönti el. A mentés a migráció előtt legyen friss; ha közben a TEST-adatbázis változik, új mentés szükséges.

## 2. Hosztolt migráció (`deployment/test-mailbox/install.sql`)
| # | Lépés | Elvárt | Eredmény |
|---|---|---|---|
| 2.1 | Projekt-metaadat ellenőrzése a célzott munkamenetben | `mojnqizbcaczstguikpv` | **PASS 2026-11-01** – API: sarberki-test, ACTIVE_HEALTHY; telepítő DB-kötése helyes |
| 2.2 | Ugyanabban a munkamenetben: `sarberki.tm_install_project_ref` és `sarberki.tm_backup_sha256` (1.1) beállítása, majd `install.sql` | a telepítő máskülönben szándékosan megszakad | **PASS** – migráció 20261101082048_wp3_test_mailbox_owner_approved_20261101; projekt és friss mentéshash SET LOCAL ugyanabban a tranzakcióban |
| 2.3 | Visszaolvasás | `sc_test_mailbox_config.enabled=false`; `sc_tm_create/redraft/decide` létezik; meglévő függvények, RLS és jogok változatlanok | **PASS** – 2 RLS-tábla, 4 pontos függvénytörzs, enabled=false; jogosultságmátrix és meglévő objektumok egyezése; tiltópróba PASS |

Visszaállítás: `deployment/test-mailbox/rollback.sql` (ugyanazzal a projekt-hivatkozással). Kikapcsolja a kapcsolót és törli a négy új függvényt; ügyek, audit, üzenetkulcsok, nyilvántartás megmaradnak.

## 3. Kapcsolók (külön döntés, két független kapcsoló)
| # | Lépés | Elvárt | Eredmény |
|---|---|---|---|
| 3.1 | Netlify, csak a tesztoldalon: `CASE_TEST_MAILBOX_INGEST_ENABLED=sarberki-test-fictional-only` | más érték = tiltva | NEM IGAZOLT |
| 3.2 | TEST-adatbázis: `update public.sc_test_mailbox_config set enabled=true where singleton` | csak tulajdonosi SQL; kliens nem módosíthatja | NEM IGAZOLT |

Visszaállítás: 3.2 → `enabled=false`; 3.1 → változó törlése, majd új tesztoldali build. Bármelyik kikapcsolása önmagában letiltja a mentést és a döntést.

## 4. TEST-telepítés
| # | Lépés | Elvárt | Eredmény |
|---|---|---|---|
| 4.1 | Kiadási commit a tesztágon, üzenet eleje `[netlify-test-release]` (`scripts/netlify-test-build-gate.cjs`) | csak a `leafy-chimera-2403e5` épül | NEM IGAZOLT |
| 4.2 | `gmail-readonly-targeted-20261024.yml` futtatása `verify_deployed:true` értékkel | futó build = kiadási commit | NEM IGAZOLT |

Visszaállítás: az előző igazolt commit újbóli kiadása ugyanezzel a jelöléssel, majd 4.2.

## 5. Élő próba kitalált tesztlevéllel (iPhone és asztali böngésző külön jelölve)
| # | Lépés | Elvárt | Eredmény |
|---|---|---|---|
| 5.1 | Kitalált levél a tesztpostafiókba, tárgy eleje „Sárberki élő teszt” | csak kitalált adat | NEM IGAZOLT |
| 5.2 | Writer: napi kezelő → E-mailek beolvasása → levél → „Ügyként mentés” | „Ügyként mentve (tm-…)”, ügy a Jóváhagyásra vár részben | NEM IGAZOLT |
| 5.3 | Ugyanaz a levél újra | elutasítva, nincs második ügy | NEM IGAZOLT |
| 5.4 | „Re:” kezdetű levél | a mentés gomb tiltott | NEM IGAZOLT |
| 5.5 | Writer: új tervezet mentése | visszaolvasva, függő állapot | NEM IGAZOLT |
| 5.6 | Writer jóváhagyási kísérlete | nem lehetséges (gomb tiltva; szerver 403) | NEM IGAZOLT |
| 5.7 | Független Approver: visszaküldés indoklással | „Visszaküldve javításra”, előzményben látszik | NEM IGAZOLT |
| 5.8 | Writer: javított tervezet → Approver: elutasítás → Writer: újranyitás új tervezettel | az ügy nyitva marad, előzmények megmaradnak | NEM IGAZOLT |
| 5.9 | Approver: megerősítés + jóváhagyás | „Belső jóváhagyás mentve (test-mailbox-v1)”; kapacitás/ár nem igazolt; nincs küldés/foglalás | NEM IGAZOLT |
| 5.10 | Audit visszaolvasása | `tm_create`, `tm_redraft`, `tm_return`, `tm_reject`, `tm_approve` sorok | NEM IGAZOLT |
| 5.11 | Fizikai iPhone: 5.2–5.9 legalább egy köre, alkalmazásváltással | ugyanaz az eredmény | NEM IGAZOLT |
| 5.12 | Ellenőrzés: nem ment ki levél, nincs foglalás, nincs Previo-írás | Gmail „Elküldött” üres a próbára; Previo változatlan | NEM IGAZOLT |

FAIL esetén: 3.2 kikapcsolása azonnal, majd hibajegy a lépés számával; a próbaügyek és az audit megmaradnak.

## 6. Lezárás
- Eredmények rögzítése a `docs/V1-FOLYTATASI-PONT.md` táblázatában, commit SHA-val és CI-linkkel.
- A kapcsolók a próba után a tulajdonos döntése szerint maradnak vagy kikapcsolódnak (alapértelmezés: kikapcsolás).

## WP3 végrehajtva – 2026-11-01 (legfrissebb kiegészítés)
A feltételes tulajdonosi engedély alapján kizárólag a 2. lépés futott, sikeresen; a 3–5. lépések továbbra is külön döntésre várnak. Részletes napló: [V1-FOLYTATASI-PONT.md](V1-FOLYTATASI-PONT.md), „WP3 feltételes TEST-migráció – végrehajtási bizonyíték”.

Az 1.1–1.2-höz kiegészítő, friss migráció előtti bizonyíték: [run 41288264009](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/41288264009), commit `2d0b2264011e2a462b64ea3c5862bd6a72ef1af0`; exact-ID GitHub readback és izolált restore PASS (50 tábla). Stage 13075424077, proof 13075573868. A telepítéshez használt ciphertext-csomag SHA-256: `b12553febf662bee8b170d16a4980e2d567fbc1cb63d3a7aabc45fecf520f072`. A mentési kör előtti/utáni 51 táblás DML-számlálók és az ellenőrzött sémaazonosítók egyeztek. A korábbi napi mentés történeti bizonyítéka fent megmarad.

Jelen állapot: `sc_test_mailbox_config.enabled=false`, registry=0. Rollback ellenőrizve, végrehajtása nem volt szükséges és nem történt. Nincs Netlify-telepítés, kapcsolóbekapcsolás, levélküldés, foglalás vagy Previo-művelet.

## 4. pont végrehajtva – 2026-11-01 (Claude Code)
| # | Eredmény |
|---|---|
| 4.1 | **PASS** – kiadási commit `6702d1c8c198906f47500518bedd9016b117fddb` (`[netlify-test-release]`), alkalmazás-CI [41291505796](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/41291505796) PASS |
| 4.2 | **PASS** – [41291815208](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/41291815208): `DEPLOY SYNC PASS`, `/api/health` deployedCommit = `6702d1c8c198906f47500518bedd9016b117fddb` |
| 3.1 | **NEM IGAZOLT / nem végrehajtva** – Netlify API, csatlakozó és hitelesítő ebből a környezetből nem érhető el (proxy 403) |
| 3.2 | **NEM IGAZOLT / nem végrehajtva** – Supabase írási/olvasási út innen nem érhető el; utolsó visszaolvasott állapot (Work): `enabled=false` |

Biztonsági sorrend a kapcsolókhoz (változatlan): előbb 3.1 Netlify-változó (+ új TEST-build, hogy a függvények megkapják), utána 3.2 DB-kapcsoló; visszaállítás fordítva: 3.2 false, majd 3.1 törlés. Amíg bármelyik ki van kapcsolva, a tesztlevél-műveletek 403-at adnak.
