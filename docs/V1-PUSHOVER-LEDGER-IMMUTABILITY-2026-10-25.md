# Pushover – tartós értesítési azonosító és állapot védelme

Dátum: 2026-10-25. Kiindulási HEAD: 46dd0ec0b329b0b1807fe636cd4312a203179b93.

## Bizonyított hiba

A még nem alkalmazott SQL-migráció service_role szerepkörének közvetlen UPDATE joga az RPC-k saját állapotfeltételeit megkerülhette. Azonosítóátírás után az eredeti Gmail-üzenet új foglalást kaphatott volna; lezárt állapot is módosítható volt. A külön Codex-vizsgálat hat negatív tesztje az eredeti migráción elbukott, mert az elutasítás helyett a módosítás sikerült. Ez izolált, szintetikus SQL-bizonyíték, nem felhős incidens.

## Javítás

A meglévő, felhőben még nem alkalmazott migráció SECURITY INVOKER triggerrel védi az értesítési kulcsot, claim UUID-t és létrehozási időt. A megengedett állapotváltás sending → sent vagy outcome_unknown. A lezárt sor átírása tiltott. Új szerepkör, SECURITY DEFINER jogosultság és RLS-kivétel nincs.

A trigger az alkalmazásszerepkör hibás közvetlen UPDATE művelete ellen véd. Az adatbázis tulajdonosa/superuser továbbra is módosíthatja a sémát és letilthatja a triggert: ezt nem tekintjük támadhatatlan naplónak. Service-role hozzáférés nem kerülhet böngészőbe, ügytári adapterbe vagy naplóba.

## Teszthatár

Az új PGlite-tesztek a teljes migrációt és service_role szerepet használják. Az izolált PostgreSQL 17 CI-próba kiegészül azonosító- és végállapot-módosítási kísérletekkel, valamint sikeres RPC-nyugtázással. A workflow a migráció későbbi változásakor is elindul. Valós szolgáltatói küldés nincs; a PGlite és a valódi PostgreSQL eredményét külön kell jelenteni.

## Felhős alkalmazási kapu és rollback

A sarberki-test szerepkörei katalógusból olvasva: anon/authenticated nem BYPASSRLS, service_role BYPASSRLS, egyik sem superuser. A korábbi csak olvasási vizsgálat szerint az értesítési tábla és három RPC még nincs a felhőben. A mostani munka nem alkalmaz migrációt.

Alkalmazás előtt: kizárólagos projektazonosság; objektum- és migrációsnév-ütközés ellenőrzése; új DDL pontos felülvizsgálata; RLS/grant/függvényjogok utóellenőrzése; működő visszaállítási hozzáférés; mindkét értesítési kapcsoló tiltva. A meglévő mentés nem igazolja automatikusan az új tábla későbbi helyreállíthatóságát.

Hiba esetén először az értesítést kell kikapcsolni. Kiadás visszaállításakor a ledger-sorokat és triggert meg kell őrizni. Régebbi mentésből visszaállítva a mentés után létrejött claim-ek hiányozhatnak: ezért a küldés nem kapcsolható vissza automatikusan; a történeti értesítési azonosítókat előbb egyeztetni kell. Nincs automatikus DROP TABLE, claim-törlés vagy terminal állapot újranyitás.

Netlify-deploy, Supabase-felhőmódosítás, valódi Gmail-/Pushover-művelet: 0. A V1 többi lezárási kapuja és a teljes platform-restore bizonyítékhiánya változatlan.

Helyi ellenőrzés: 11 PASS / 0 FAIL / 0 SKIP az új hat immutability és a meglévő privilege/ledger teszteken. A koordinátor külön is lefuttatta és ellenőrizte ugyanezt a csomagot; a két futtatás nem 22 külön teszt. PostgreSQL 17 eredményét a commit CI-je külön szolgáltatja.
