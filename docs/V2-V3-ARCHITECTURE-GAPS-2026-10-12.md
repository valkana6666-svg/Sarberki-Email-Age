# V1 → V2/V3 technikai hiányleltár

Felvétel: 2026-10-12. Ellenőrzött tesztági alap:
`b5910416d69a822670cfdb932939069288248468`, 1305 PASS / 0 FAIL / 0 SKIP,
[CI és pontos tesztdeploy](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38240273780).
Ez a dokumentum kódalapú leltár, nem V2 élesítési engedély.

| Terület | Meglévő implementáció | Bizonyított korlát / következő szükséges lépés |
| --- | --- | --- |
| Business logic | `central-inquiry-decision.mjs`, `booking-filter.mjs`, `split-units.mjs`, `verified-pricing.mjs`: determinisztikus, befecskendezett bizonyíték; nincs hálózat vagy küldés a döntésben | Az új csatorna ugyanezt a döntést kapja. V1-ben a friss, hiteles forráskapcsolat és az elhelyezési feltételek igazolása marad elsődleges. |
| AI orchestration | `engine.mjs` befecskendezett parser/renderer; közös intake és válaszadapterek | A vizsgált közös magban nincs LLM-szolgáltatói orchestration. Később külön, szigorúan validált strukturált kimenetű adapter szükséges; AI nem engedélyezhet műveletet vagy módosíthat ár-/foglalási szabályt. |
| Previo adapter | `pms-adapter.mjs`, `previo-adapter.mjs`: normalizált olvasási interfész, író képességek tiltva | Élő olvasás mellékhatás-mentessége és frissessége külön igazolandó. A kétirányú API és írási jogosultság NEM IGAZOLT. Író interfészt most nem építünk. |
| E-mail adapter | `gmail-normalize.mjs`, `case-thread-identity.mjs`, `server-booking-runtime.mjs`, `inquiry-channel-adapters.mjs`: szálazonosítás és közös tervezet | V2 előtt külön küldési adapter, szűk Gmail-scope és tartós küldési műveletazonosító szükséges. A meglévő bejövő üzenet-deduplikálás nem bizonyít kimenő küldési idempotenciát. |
| Authentication / authorization | Supabase Auth, `supabase-case-repository.mjs`, `server-case-service.mjs`: szerveres user/tagság-ellenőrzés, külön read/write/approve és RLS | A tartós cookie csak hitelesítő adat szállítása; nem új jogosultsági rendszer. A személyes Gmail-címhez jelenleg nincs alkalmazás-Auth-fiók. Új felhasználó vagy jelszócsere csak külön jóváhagyással. |
| Audit logging | A meglévő SQL írás/CAS/jóváhagyás tranzakciós auditja; aktor, verzió és hash | Ez ügyállapot-audit. V2 külső műveleteihez külön tartós műveleti állapot, szolgáltatói eredmény és biztonságos hibakód kell; nincs titok/teljes vendéglevél naplózása. |
| Approval workflow | Tárolt verzióhoz és tervezethashhez kötött izolált jóváhagyás, friss kapacitás-/árvizsgálat | A managed teszt-DB-ben `sc_approve_case` nincs; a meglévő Netlify útvonalon jóváhagyás tiltott. Belső jóváhagyás nem szolgáltatói foglalás és nem küldés. |
| Automation execution | A közös engine `send()` tilt; Previo író képesség tilt; meglévő korlátozott értesítési adapter külön útvonal | Nincs közös tartós külső műveleti queue/outbox, retry-állapot vagy szolgáltatói idempotencia igazolva. Ezek V2 előfeltételek, nem V1-be automatikusan aktiválandó funkciók. |
| Csatornafüggetlen szolgáltatások / több tenant | E-mail és chat közös döntése; közös ügytár és tenant-elkülönítés | A régi `communicationEnvelope` csak email/manual csatornát fogad; a szerveres intake még mailbox-envelopera épül, a tenant-konfiguráció célzott. V3 előtt adapteres voice-intake és hitelesített tenant-konfiguráció szükséges, a mag újraírása nélkül. Most nem bővítjük a csatornaenumot funkció nélkül. |

## Most indokolt módosítás

A meglévő operátori kliens memóriás tokenkezelését a meglévő Auth/RLS szolgáltatás
előtti szerveres munkamenet-adapterre cseréljük. Ez csatornától független
hitelesítési határ; a cookie útvonal csak GET-olvasást enged. A szerversegédet és
a titkosítási kulcsot a statikus build kizárja. A rendszer nem kap küldési,
PMS-írási vagy jóváhagyási képességet ettől a változtatástól.

A V1 befejezési sorrendje: helyes tesztoperátori Auth → tartós munkamenet és
hitelesített friss ügyolvasás → valódi iPhone/Safari/főképernyős próba → friss
titkosított tesztadatbázis-mentés és izolált, teljes helyreállítási bizonyíték.
Csak ezután következzen a jóváhagyott V2 külső műveleti réteg. GitHub #3 mérési
fejlesztés továbbra is halasztott.

## Bizonyíték és működési korlát

- A forráskód és a synthetic teszt nem igazol élő Previo-adatot vagy telefonos működést.
- A cookie/session fejlesztés eredményét a végleges commit CI-jével, deployazonossággal és külön eszközpróbával kell lezárni.
- Auth-cookie csak az adott böngészőtárban tartós. Safari és főképernyős PWA külön tárát, cookie-másolását és refresh-forkját külön kell tesztelni; nem ígérünk igazolatlan, minden kliens között megosztott munkamenetet.
- A main, az éles környezet és az eredeti adatbázis változatlan; nincs valódi levél, foglalás, Pushover-küldés vagy Previo-írás.
