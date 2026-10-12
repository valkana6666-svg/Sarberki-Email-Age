# Célzott integrációs leltár – 2026-10-11

Kiinduló tesztági HEAD: `4440edacfc4f612cb2637c398317fb34742cebea`.
Ez a csomag az onnan származó meglévő ügykezelő/planner/approval modulokat importálja.
Nincs másolat az üzleti döntésből, új cloud URL, source adatbáziskapcsolat vagy kimenő
vendégszolgáltatás. A meglévő rehearsal shell nem változott.

**17 új/célzott PASS, 0 FAIL**:
- 4 offline csomag/secret-generálás teszt: valós fájlok 0700/0600 és értékmentes output.
- 7 HTTP-adapter teszt: valós loopback HTTP-socketek, proxy/origin/meta/tenant/JSON/body
  tiltok, rátakorlát, token továbbítás, csak engedélyezett auditmezők. Auth és API itt
  injektált teszttransport; nem új valódi Auth/E2E bizonyíték.
- 3 runtime-gate teszt: rögzített belső endpoint, DB/synthetic/RPC/HMAC-fingerprint
  mismatch tiltás, service_role credential elutasítás hálózat előtt.
- 2 saját shell-policy teszt: csak HTTPS+pontos isolated origin, memóriabeli tokenek.
- 1 valódi PGlite SQL-motor teszt: az installer alap DB-nevet elutasítja; anon csak
  fingerprintet kaphat, secret table nem olvasható; authenticated nem hívhatja;
  idegen tenant/nem `.invalid` adat synthetic=false. PGlite kötött DB-neve miatt a
  pozitív SQL-ág DB-név-kifejezése tesztben helyettesített, ez nem Docker-bootstrap.

Compose YAML szerkezeti ellenőrzés PASS: 5 szolgáltatás, belső DB/Auth/REST/app,
kizárólag HTTPS proxy host portok. Docker/Compose futtató helyben nem volt elérhető;
image build/pull/start, publikus TLS/DNS, tényleges persistent-volume restart és
teljes Auth/RLS/CAS/audit/restore lánc ezen a csomagon **NEM IGAZOLT**.
Mobil CSS előkészítve, saját persistent shell valódi iPhone/WebKit próbája még nem.

Parancsok:

```sh
node --test tests/isolated-persistent-runtime.test.mjs tests/isolated-persistent-http.test.mjs tests/isolated-persistent-policy.test.mjs deployment/isolated-approval/package.test.mjs
node --test tests/isolated-persistent-identity.test.mjs
```

Nincs commit/push/telepítés ebben az ellenőrzésben. A későbbi coordinator ellenőrizze
a közben érkezett változásokat és a saját források teljes importláncát, majd csak a
tesztágra publikáljon. A következő konkrét feladat: az új csomag image/Compose
bootstrapját jóváhagyott, üres izolált Actions-futtatóban bizonyítani; tartós hoszt
indítása előtt a külön admin-hozzáférés és esetleges költség jóváhagyása szükséges.
