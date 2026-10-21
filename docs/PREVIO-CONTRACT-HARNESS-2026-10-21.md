# Previo – szintetikus adapter-szerződés

Az új `server-previo-contract-adapter.mjs` a meglévő előkészítő ellenőrzésre és PMS olvasói felületére épülő, kizárólag helyi fixture-transzporttal futó szerződéspróba. Nincs HTTP-kód, végpont, hitelesítő adat, alapértelmezett szolgáltató vagy bekapcsolt foglalásírás. Az alkalmazásba és a kapacitásmotorba nincs bekötve.

A bemeneti és kimeneti szerkezet **belső szintetikus szerződés**, nem állítás a Previo hivatalos API-formátumáról. A tényleges API-családot, hitelesítést, mellékhatásmentes műveleteket, árösszetevőket és foglalási/véglegesítési szemantikát a hivatalos hozzáférés után kell dokumentálni és külön adapterré alakítani. A fixture transzportot a tesztkód adja át; a transzport nem végezhet hálózati műveletet.

Ellenőrzések: teszt-tenant/property, 23 egyedi helyi egység előzetes megfeleltetése, a kiválasztott egységek pontos roomId értéke, teljes dátumintervallum, rate plan, pénznem, ügyverzió és tervezethash/jóváhagyásból származó intent. A válasz tenant/property/dátum/fingerprint, időbélyeg, referencia és egyedi fizikai egység szerint kötött. A `verified:true` jelző nem elfogadott bizonyíték.

A sikeres eredmény csak `SYNTHETIC_CONTRACT_ACCEPTED`, `valid=false`, `liveVerified=false`. A közös PMS `getVerifiedAvailability` hívása mindig UNKNOWN. Ezért a fixture nem ajánlható vendégnek valódi szabad kapacitásként vagy hiteles árként. Hitelesítés állapota NOT_CONNECTED. A create/finalize függvény minden bemenetet WRITE_DISABLED állapottal zár, a fixture-t sem hívja meg.

Időkorlát és abort, egyetlen próbálkozás, szűrt hibakód és azonos párhuzamos olvasás összefogása tesztelt. A folyamaton belüli összefogás nem tartós idempotencia. Az auditCandidate csak a meglévő ügytár tranzakciós auditjába mentendő jelölt; nem mentett audit. Valódi dispatch előtt tartós egyedi műveletfoglalás, CAS, aktuális ügy/jogosultság, szolgáltatói visszakeresés, ismeretlen írási eredmény egyeztetése és külön tulajdonosi aktiválás kell. Nem épült második ügytár vagy auditmotor.

V2/V3 érték: megőrzi az olvasó/író képességek külön határát, és a későbbi transzport szerződését szintetikusan lehet ellenőrizni. Bizonyíték korlátja: kizárólag offline fixture; nem élő Previo-, hálózati Auth-, PostgreSQL-, mobil- vagy felhasználói elfogadási próba.
