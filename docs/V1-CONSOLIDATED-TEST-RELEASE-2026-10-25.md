# V1 összevont tesztkiadás – előkészítés, 2026-10-25

Állapot: ELŐKÉSZÍTVE, NEM TELEPÍTVE. Az általános folytatási „y” nem külön Netlify-deploy-jóváhagyás.

## Pontos kiadási jelölt
Alkalmazáskód: c8750e0787a4309698b6c4ade23103be5db54e0e.
Kizárólag gmail-test-subject-allowlist; cél leafy-chimera-2403e5. A production oldal és PR #7 tiltott.
Utolsó korábban igazolt telepített alkalmazás: 75c2469f88589375310334f78b9b85708f38542b. A jelenlegi távoli deploy-állapotot ebben a körben nem olvastuk újra; telepítés előtt ellenőrizendő.

## Összegyűjtött alkalmazásváltozások
- business-config.mjs: Sárberki adult-only gyermekalapérték 0.
- sarberki-core.mjs: a közös létszámprojekció ezt a konfigurációt használja.
- index.html: adult-only gyermekadat a közös normalizálóból; ismeretlen gyermeklétszám mellett nem talál ki teljes létszámot.
- isolated-approval-panel.mjs: sikertelen betöltés nem állítja, hogy korábbi tárolt jóváhagyás nincs.

Kapacitásérték, ár, Previo-transzport, jogosultság és jóváhagyási API nem változott a kiadási diffben. A további különbségek tesztek és dokumentáció. A GitHub összehasonlítás 14 fájlt mutat, ebből 4 alkalmazásfájl.

## Meglévő ellenőrzési bizonyíték
Teljes helyi npm test: 1910 PASS / 0 FAIL / 0 SKIP, 25.5 másodperc. A létszámjavítás miatt indokolt teljes regresszió; nem új Safari-, Google-, élő Previo- vagy készülékes próba. A tesztek helyi munkapéldányon futottak; a kiadás előtt tiszta, pontos jelöltből reprodukálás szükséges. A jelölt commitra hosted CI-futás nincs, mert skip ci / skip netlify üzeneteket használtunk.

## Telepítés előtti kapuk
1. Külön tulajdonosi engedély egyetlen tesztkiadásra.
2. A tesztoldal pontos azonosítása és automatikus build-stop megőrzése.
3. Tiszta, rögzített kiadási jelöltből build; helyi párhuzamos módosítás nem csomagolható bele.
4. Egyetlen ellenőrzött tesztdeploy; utána a deployedCommit pontos egyezése.
5. Hiba esetén ugyanennek a tesztoldalnak a korábbi igazolt deployja állítható vissza. Nem kell új export, séma- vagy production-változtatás.

## Legkisebb későbbi készülékes ellenőrzés
Kizárólag az új létszámjavítás: meglévő szintetikus 8 felnőttes levél összesítője 0 gyermeket mutat; ismeretlen számú gyermeknél nincs kitalált összlétszám. A már lezárt teljes Safari- és Gmail-eredetpróbát nem ismételjük. Az új UI-szöveg és létszámjavítás készülékes eredménye egyelőre NEM IGAZOLT.

A mentés változatlan. Ebben a körben workflow, deploy, export és infrastruktúra-módosítás nem történt.
