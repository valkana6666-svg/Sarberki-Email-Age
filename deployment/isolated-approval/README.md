# Elkülönített tartós kezelői teszt – előkészített csomag

Állapot: **PREPARED_NOT_DEPLOYED**. A csomag nem indít szolgáltatást. A Compose minden
szolgáltatásához az `approved-deployment` profil kell; annak bekapcsolása előtt külön
jóváhagyott, kizárólagos teszthost, DNS és admin-hozzáférés szükséges. Az eredeti
Supabase-projekt, Netlify és production nem telepítési cél. Nincs SMTP, Gmail,
Pushover vagy Previo kapcsolat. Az alkalmazás kizárólag szintetikus kapacitással dolgozik.

A külön shell címe `/isolated-persistent.html`. A csomag a meglévő jóváhagyási panelt,
ügytárklienst, Auth/RLS/CAS/audit függvényeket és közös tervezőt használja; a korábbi
`isolated-approval.html/session/panel` fájlokat nem módosítja. A shell saját, kizárólag
HTTPS-re és pontos originre engedélyezett belépési kódja a `public/` alkönyvtárban van.

## Határok és követelmények

- PostgreSQL 17, kizárólag `sc_approval_test`, saját tartós named volume.
- Saját GoTrue Auth, signup tiltott, nincs SMTP-konfiguráció, 900 másodperces JWT.
- PostgREST nem superuser: `isolated_authenticator` csak anon/authenticated szerepre
  válthat. A service_role csak saját Auth admin-provisionáláshoz létezik; az app nem kapja.
- A DB/Auth/REST/app hálózata Docker `internal: true`; nincs publikált port.
- Csak Caddy 80/443 publikált. Külön belső proxyhálózat: Caddy `172.29.86.2`, app
  `172.29.86.3`; a szerver csak a tényleges proxy socketcímének hisz. Ellenőrizni kell,
  hogy ez a subnet nem ütközik meglévő hálózattal. A Caddy nem tagja a DB-hálózatnak.
- Caddy publikus egress csak tanúsítvány/DNS célra szükséges. A Compose ezt hálózati
  útvonalként biztosítja, célonkénti host-tűzfal korlátozást még az adminnak kell igazolnia.
- Érvényes HTTPS DNS-név kötelező, `isolated` címkével; megadott név rögzített.
- Az app nem-root UID1000, read-only fájlrendszer, secret mountok. Nincs szervernapló
  Docker logging driveren; az audit az adatbázisban marad. Állapotmonitorozás külön feladat.
- A taggel rögzített image-ek nem digest-rögzítettek. Telepítés előtt a konkrét image
  digesteket, a sérülékenységi ellenőrzést és az update/rollback módját rögzíteni kell.

## Offline előkészítés

Csak olyan új abszolút magánkönyvtár adható meg, amely a repositoryn kívül van:

```sh
node deployment/isolated-approval/prepare.mjs https://isolated-operator.example.org /srv/sarberki-isolated-private
```

Ez helyben generál véletlen jelszavakat, JWT-secretet, anon JWT-t és attesztációs kulcsot,
0700 könyvtárban, 0600 fájlokban. Semmilyen értéket nem ír stdout/stderr-re, nincs
hálózati kérés. Már létező célkönyvtárat nem ír felül. A `.env`/SQL secretfájlok
nem kerülhetnek gitbe, Actions-artifactba, nyilvános ZIP-be vagy build contextbe.

A Compose `env_file` titkai a host/Docker admin számára olvashatók: a csomag nem
állítja, hogy az `inspect` ellen is védettek. A hostot kizárólagos adminnal kell kezelni.
A három alkalmazássecret (`operator-config.json`, `anon-jwt`, `runtime.json`) tulajdonosa
telepítéskor UID1000 legyen, módjuk maradjon 0600. A környező magánkönyvtár 0700 marad.
Ne állíts széles olvasási jogosultságot az egész könyvtárra. A Dockerfile allowlist
kizárja a repository `.env`, backup, node_modules és recovery tartalmát.
A PostgreSQL image inicializáló felhasználója UID999: a `bootstrap-roles.sql`
tulajdonosának ezt kell beállítani, a 0600 mód megtartásával. A privát SQL-jelszavak
nem válhatnak általánosan olvashatóvá. A CI ezt csak saját eldobható fájlokon állítja.

## Jóváhagyás utáni bootstrap sorrend – jelenleg nem végrehajtott

1. Az admin igazolja: a host/Docker daemon külön tesztcél, nincsenek source/production
   hitelesítőadatok vagy volume mountok, nincs ilyen hálózati csatolás. A subnet, DNS,
   tűzfal, erőforráskorlátok és secret ownership ellenőrzendő.
2. Csak a DB/Auth szolgáltatás indítható először, a megfelelő explicit profillal.
   Üres DB-volume első indításakor a privát `bootstrap-roles.sql` készíti a szerepeket.
   A szerepbootstrap nem fut újra a megtartott volume újraindításakor.
3. A GoTrue egészséges állapotát, `auth.users` és `auth.sessions` tényleges létét
   ellenőrizni kell. A forrás nélküli új DB tulajdonosával csak ezután telepítendő:

   ```sql
   create or replace function auth.uid() returns uuid language sql stable as
   $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
   grant execute on function auth.uid() to authenticated,anon;
   ```

4. Ugyanebbe az új DB-be, helyben, sorrendben: meglévő
   `supabase/migrations/202610090001_case_store.sql`,
   `recovery/sql/isolated-approval.sql`,
   `recovery/sql/isolated-persistent-identity.sql`, majd a privát
   `install-attestation.sql`. Az utolsó egyszeri, nem idempotens kulcsbeillesztés.
   Ezután kizárólag test_only tenantok és szintetikus felhasználók készülhetnek.
5. A saját Auth admin felületén, **belső hálózaton** provisionálandó a `.invalid`
   operátor. Saját DB `sc_memberships` adja a jogosultságot; JWT/user_metadata nem.
   Külön writer/foreign negatív fixture későbbi célzott teszthez hozható létre.
   Nincs publikus signup/admin route, SMTP vagy jelszóreset-küldés.
6. Csak az identity-fingerprint RPC sikeres, megfelelő válasza és a titokmentes
   előellenőrzés után indítható REST/app, végül HTTPS. Nem megfelelő DB állapotnál
   a szerver nem válhat üzemkésszé. A fennmaradó bootstrap automatizálása új feladat.
7. Mobil Safari/WebKit próbában: HTTPS/login, olvasás, explicit review, jogosulatlan/
   lejárt token, CAS, ismeretlen kapacitás, auditrollback és friss login utáni visszaolvasás.
   Chromium mobil viewport önmagában nem bizonyít valódi iPhone/Safari működést.

Ne használd a `docker compose config` teljes kimenetét jelentésként: az env_file miatt
titkokat jeleníthet meg. Validáláskor csak `config --quiet` használható. A parancsok
indítási engedélyt nem helyettesítenek; ez a dokumentum nem igazolt távoli telepítés.

## Tartósság és helyreállítás

A named volume fennmarad `stop` és `restart` után; `down -v` megsemmisíti, ezért tiltott
rutinkarbantartáskor. Named volume önmagában **nem mentés**. Külön titkosított pg_dump,
Auth+public tartalom, szerepleltár, secret-helyreállítás és TLS-volume/leltár szükséges.
Új, külön restore-volume/stack és új hostname kell; az eredeti volume vagy eredeti
Supabase-projekt soha nem restore-cél. Ellenőrizendő Auth új belépés, RLS, revíziók,
jóváhagyási hash, audit és attesztációs kulcs egyezése. A kulcs elvesztése esetén a korábbi
audit tovább olvasható, új jóváhagyás nem működhet ellenőrzés nélkül.

Költség: a csomag nem aktivál előfizetést. Saját szabad host esetén új szoftver-előfizetés
nélkül futtatható; host, domain és mentési tárolás tényleges költsége még nem igazolt.
A GitHub Actions futtató időleges, nem tartós HTTPS hoszt. A meglévő Netlify nem futtat
ezen Compose PostgreSQL/Auth szolgáltatásokat. Ez nem teljes Supabase-stack, hanem a
már bizonyított négykomponensű jóváhagyási tesztlánc tartós csomagolása.

2026-10-11-én ellenőrzött hivatalos háttér:
- https://supabase.com/docs/guides/self-hosting/docker
- https://caddyserver.com/docs/caddyfile/directives/reverse_proxy

Az adott GoTrue/PostgREST verzió a korábbi izolált Actions-láncban igazolt; ennek a
Compose csomagnak a tényleges indítása, HTTPS-tanúsítványa és távoli restore-ja még nem.
