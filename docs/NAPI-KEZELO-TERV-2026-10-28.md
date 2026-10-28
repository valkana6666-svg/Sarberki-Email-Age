# Sárberki Napi kezelő – első megvalósítási terv

Ág: `gmail-test-subject-allowlist`; a TESZT-felület külön útvonalon változatlanul megmarad. A teszthely kizárólag szintetikus ügyet fogad; a későbbi valós üzemelés nincs engedélyezve.

## Képernyővázlat

1. Fejléc: eredeti projektlogó, Sárberki Napi kezelő, tesztjelzés.
2. Belépési blokk: meglévő hitelesített operátori munkamenet; jelszó kizárólag a meglévő bejelentkezési végponthoz, a mező azonnal törlődik.
3. Négy nagy gomb: Beérkezett ügyek, Jóváhagyásra vár, Folyamatban, Lezárt ügyek. A választott nézet saját, magyarázó állapotot mutat.
4. Elérhető tesztügyek: a meglévő olvasói ügylista, majd választott ügy esetén a központi döntésből származó, szerver által ellenőrzött olvasói előnézet. A jelenlegi lista nem ad státuszt: az ügyeket nem soroljuk be hamisan a négy menübe.
5. Ügyadatlap: ahol a jelenlegi olvasói előnézet szolgáltat adatot, megjelenítjük. Eredeti üzenet / teljes előzmény / aktuális szerkeszthető tervezet és státusz hiányát jelezzük. Szerkesztés, jóváhagyás és elutasítás új felületen nem áll rendelkezésre, amíg nincs megbízható szerepkör- és ügyéletciklus-bekötés. A meglévő külön ellenőrző felület azonos ügyre vezető hivatkozása biztosítja az elérhető részletes tesztfunkciókat, az eredeti szerveres kapuival.

## Gombmagyarázat

- Négy kategóriagomb: csak a kért kategória magyarázatát választja ki. Ismeretlen státuszt nem nevez üres listának.
- Bejelentkezés / Kijelentkezés: a meglévő cookie-alapú sessiont használja; nincs új jelszókezelő vagy jogosultsági rendszer.
- Ügyek betöltése: olvasói listát kér a meglévő tenant-korlátozott ügy-API-tól. Hiba esetén nem mutat korábbi vagy feltételezett adatot.
- Megnyitás: meglévő, engedélyezett olvasói előnézetet kér az aktuális ügyverzióra. Nincs adatbázisírás.
- Részletes ellenőrzés: a már meglévő TESZT jóváhagyófelületre vezet; nem jelent automatikus jóváhagyást.

## Korlátok és védelem

Cookie, tenant, RLS, szerveres Reader/Writer és audit szabályok változatlanok. Nincs párhuzamos adattár, hamis statisztika, automatikus levél, élő foglalás vagy Previo-lekérdezés. Háttérbe kerülés, kijelentkezés és munkamenethiba törli a megjelenített ügyet; későn érkező válasz nem teheti vissza. A tesztek az elérhető kliens-/szerverhatárokat, azonosítót, újratöltést és a szimulált böngészőt külön jelölik.

Az ikonhoz a korábban jóváhagyott citromsárga forrást kell használni. A repositoryban és az elérhető korábbi fájlkeresésben jelenleg nem sikerült a pontos forrást igazolni. Más emblémából nem állítunk elő megtévesztően 1:1-nek nevezett ikont. A külön útvonal és önálló manifest előkészíthető; az ikon véglegesítése a referencia megtalálása után következik.
