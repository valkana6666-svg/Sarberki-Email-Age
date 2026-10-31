# Sárberki – engedélyezett Netlify TESZT-kiadás: iPhone-visszatérési javítás (2026-10-31)

Tulajdonosi engedély: a 2026-10-31-i projektbeszélgetésben e javítás kizárólagos TESZT-telepítésére kifejezetten megadva.

Kizárólagos cél: `leafy-chimera-2403e5` Netlify TESZT-oldal, `gmail-test-subject-allowlist` ág.

Funkcionális kiadási alap: `a91f3c1e1d85f2712238e48a9c5ca6c768c6e582` (napi kezelő: visszatéréskor átmeneti hálózati hiba már nem töröl; csak jogosultsági hiba zár; iOS lap-újratöltés felismerése csak időbélyeggel). A kiadási commit csak ezt a dokumentumot adja hozzá; alkalmazáskódot, üzleti szabályt, AI-motort, jóváhagyási vagy Gmail-korlátot nem változtat.

Bizonyíték az alapcommitra: CI `41196044805` PASS; kapacitás `41196044806` PASS; napi Chromium+WebKit mobilpróba `41196048311` PASS. A hosztolt build SHA a kiadás után `/api/health` `deployedCommit` alapján ellenőrzendő. Fizikai iPhone-alkalmazásváltás NEM IGAZOLT.

Tiltások: production/main módosítása, valódi vendéglevél küldése, Previo-hívás/-írás, éles foglalás és titkok közzététele.
