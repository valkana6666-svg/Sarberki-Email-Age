# V1 – óránkénti automatizálás állapota (2026-11-01, ellenőrizve 06:03Z)

- Régi feladat `trig_011YEiRqmWYVsevFMAbHeeCJ` („SÁRBERKI V1 – Automatikus fejlesztés”, Chat típus): kikapcsolva (`enabled:false`). Oka: repository nélkül indult, a git-proxy a pusht elutasította; repo-hozzárendelés a meglévő feladatban nem támogatott (az ütemezéskezelő csak név/ütemezés/engedélyezés/modell/utasítás mezőt kezel).
- Új feladat `trig_01QxuK1bPxB4pCPmMrpiUEuy` („SÁRBERKI V1 – Automatikus fejlesztés (Code)”): tulajdonos hozta létre a webes Code-űrlapon repository-hozzárendeléssel; ütemezés `18 * * * *`; engedélyezve.
- Bizonyíték: a próbafutás (`cse_01EgatxMpccQNFsNzTMQSU6P`, 05:52Z) a tesztágra pusholta a `b4a32adce7f04c8bb527362eacf1d23dc19a631a` commitot (`docs/AUTOMATION-CODE-ACCESS-PROOF-2026-11-01.md`). A repository-hozzáférés és az írás tehát igazolt; teljes fejlesztési futás még nem.
- Ütközésvédelem: az utasítás szerint, ha az utolsó commit 60 percnél frissebb és nem ütemezett futásból származik, a futás csak ellenőriz és jelent.
