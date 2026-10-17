# A tényleges iPhone/Safari/PWA rövid elfogadási próbája

Tesztoldal: https://leafy-chimera-2403e5.netlify.app/ . Kizárólag a meglévő tesztfiókok és már mentett, zárt szintetikus ügyek. Jelszót, tokent, vendéglevelet vagy személyes adatot ne küldjön a chatbe.

## Ami már automatizált

A manifest/start URL/ikon/MIME/no-store; 390px Reader/Writer/approver UI; szereptiltások és szimulált háttér/visszatérési események; késői válasz, lejárt/visszavont munkamenet és soros cookie-kérések. Ezek nem valódi iPhone-hardver, iOS háttérfolyamat, telepített PWA vagy Safari/PWA sütimegőrzés bizonyítékai. A munkakörnyezet nem tudja a tulajdonos iPhone-ját vezérelni.

## Elengedhetetlen első készülékpróba – körülbelül 3 perc

1. **Safari:** a tesztoldalt Safariban nyissa meg, majd Megosztás → Hozzáadás a főképernyőhöz. A kezelőt a tesztoldal neve és URL-je alapján azonosítsa; ne a WordPress-honlapot telepítse.
2. **Főképernyős kezelő:** az ikonnal indítsa. Ha kéri, a meglévő Reader-tesztfiókkal lépjen be a védett űrlapon. Ügylista → egy már létező szintetikus ügy → mentett előnézet. Nem kell új Gmail-levelet olvasni, új ügyet menteni vagy jóváhagyni.
3. **Háttér/visszatérés:** váltson másik alkalmazásra, majd térjen vissza. A régi felhős előnézetnek és jóváhagyási megerősítésnek törlődnie kell; az új session-ellenőrzés után az ügylista újra kérhető. Visszavont/lejárt vagy nem ellenőrizhető belépésnél ne legyen jóváhagyás vagy hamis siker.

Minimális visszajelzés: „települt / beengedett / ügylista és előnézet működik / háttérből visszatérve működik”, vagy a hibás lépés száma és a látható hiba szövege. Képernyőkép és titok nem szükséges.

## Későbbi, célzott eszköz-elfogadási pontok

| Pont | Elvárt viselkedés |
| --- | --- |
| Safari és főképernyős kezelő külön megnyitása | Nem ígérünk közös belépést; szükség esetén normál új login mindkét környezetben |
| Writer / külön approver mobilfelület | Meglévő szintetikus ügy kiválasztható, tervezet olvasható; művelet csak a saját DB-jogával és aktuális feltételekkel |
| Jóváhagyó háttérbe küldése bejelölt megerősítés után | Tervezet és checkbox törlődik; visszatérés önmagában nem küld approval POST-ot |
| Rövid hálózatvesztés / visszatérés | Nincs bizonyítatlan siker vagy automatikus írásismétlés; új ellenőrzés szükséges. A hálózatváltás tényleges iOS-viselkedése még nincs mérve |
| Kijelentkezés, majd visszalépés/back | Felhős előnézet üres; védett olvasás/jóváhagyás tiltott új hitelesítésig |
| Mobil olvashatóság | Nincs vízszintes túllógás, gombok elérhetők, billentyűzet nem zárja el tartósan a belépést |

Az első három lépés sikere nem jelenti a teljes táblázat vagy a Previo-integráció lezárását. A teljes pozitív felhős dézsajóváhagyás továbbra is hiteles ház-/időszak-/naptárbizonyítékot igényel; hiányában nem szabad véglegesíteni.
