# Sárberki V1 – aktuális állapot (legfeljebb 40 sor; minden feladat a saját commitjában frissíti)

Utolsó frissítés: 2026-11-02 12:20 CET. Részletes előzmény (archív): `docs/V1-FOLYTATASI-PONT.md`, `docs/V1-AUTOMATION-STATUS-2026-11-01.md`.

## Kész, igazolt – ne ismételd
| Terület | Bizonyíték |
|---|---|
| Gmail → közös AI → mentés → független jóváhagyás (iPhone, élő) | `a4eb189` |
| Létszámkijelzés, duplikált mentés tiltása, Re: tiltás, alkalmazásváltás (iPhone) | `312b9ad`, `c0f8f4d`, `71c84c9`, `3b63e50` |
| Elutasítás → új tervezet → újranyitás (L11–L12), élő | `0f7cb51`; audit-SQL `d1bb91a` |
| Jogosultság, függetlenség, CSRF, tenant, kijelentkezés, 30 perces tétlenség (élő) | `47aed48`, `b081d45` |
| Írásmentes élő próbaszkript (`scripts/live-test-readonly-smoke.mjs`) | `a44f1c8`, 20/20 PASS |
| #8 napi kezelő, türkiz feliratos ikon, iPhone-on is | `e531a04`, kiadás `32052fc`, `31ce41c` |
| Napi mentés + elkülönített visszaállítás (GitHub-úton) | napi `[backup-v2-cloud-bridge-run]`, utolsó 41410412064 |
| Previo TEST csak olvasó felmérés (V2-előkészítés) | `9553d9d`, `3d2cae9`, engedély `b6bcb39` |

TEST-oldal: `leafy-chimera-2403e5`, telepített `32052fc`. Teljes `npm test`: 2500/2500 (2026-11-02).

## Nyitott feladatok
| ID | Felelős | Állapot | Teendő |
|---|---|---|---|
| DRIVE-SECRET | Tulajdonos (útmutató: Work) | BLOKKOLT | `SARBERKI_V2_DRIVE_OAUTH_JSON` secret, majd `[backup-v2-drive-restore]` és visszaolvasás (Claude) |
| SCHEDULE-ENV | Tulajdonos, számítógépről | BLOKKOLT | Óránkénti feladat környezete: Sarberki TEST E2E |
| V1-RC-CHECK | Claude | Drive után | Kiadásra jelölési ellenőrzés a fenti bizonyítékokból |
| LIVE-MAILBOX-PLAN | Work | SZABAD | info@sarberki.hu csak olvasó bekötésének terve (hozzáférés, kockázat, lépések); megvalósítás tulajdonosi engedéllyel |
| PREVIO-READ-PLAN | Work | V1 után | Csak olvasó kapacitás/ár bekötésének feltételei (API-kulcs, mellékhatás-kapu) |

## Akadályok
- Gmail OAuth élő újrapróbája és a fizikai iPhone-lépések emberi lépést igényelnek.
- Previo: saját API-hozzáférés és éles honlap → Previo kapcsolat nem igazolt; Previo-írás műveletenkénti tulajdonosi engedéllyel.
