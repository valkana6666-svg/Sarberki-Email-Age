# A tényleges iPhone/Safari/PWA rövid elfogadási próbája

Tesztoldal: https://leafy-chimera-2403e5.netlify.app/ . Kizárólag a meglévő tesztfiókok és már mentett, zárt szintetikus ügyek. Jelszót, tokent, vendéglevelet vagy személyes adatot ne küldjön a chatbe.

## Ami már automatizált

A manifest/start URL/ikon/MIME/no-store; 390px Reader/Writer/approver UI; szereptiltások és szimulált háttér/visszatérési események; késői válasz, lejárt/visszavont munkamenet és soros cookie-kérések. Ezek nem valódi iPhone-hardver, iOS háttérfolyamat, telepített PWA vagy Safari/PWA sütimegőrzés bizonyítékai. A munkakörnyezet nem tudja a tulajdonos iPhone-ját vezérelni.

## Már lezárt készülékes részpróba – nem ismétlendő

A tulajdonosi 2026-10-18 képek igazolják a főképernyős Reader-folyamat konkrét láncát: előnézet → másik alkalmazás → régi előnézet törlése, aktív olvasási session → kifejezett kérésre új előnézet. Ezt nem kell ismételni. A korábbi Reader-fiók `reader@sarberki-test.invalid` tulajdonosi kérésre azóta read/write/approve tesztjogot kapott; már nem használható csak olvasó szerepkör negatív próbájára.

A cloud Chrome Writer v2 → külön emberi jóváhagyó v3 → új belépés után audit-visszaolvasás lánca is lezárt. A `982fc2fa-1e79-478b-8241-2a59f73027b8` ügy már jóváhagyott: nem írható újra és nem hagyható újra jóvá tesztismétlés céljából.

## Következő fizikai iPhone-próba – 2–3 perc, csak olvasás

1. Safariban nyissa meg: https://leafy-chimera-2403e5.netlify.app/cloud-approval.html . Szükség esetén a meglévő tesztfiókkal lépjen be az oldal védett űrlapján. A jelszó nem küldhető chatbe.
2. Ügyazonosító: `982fc2fa-1e79-478b-8241-2a59f73027b8`. Csak **Tárolt állapot és audit visszaolvasása**: v3 / internally_approved és egy v3-as approve_isolated_synthetic auditesemény az elvárt. Sem Writer-mentést, sem jóváhagyást ne indítson.
3. Az iPhone Vezérlőközpontjában kapcsolja ki a mobiladatot és a Wi-Fit, majd ugyanazt az olvasógombot egyszer nyomja meg. Hiba/nem igazolt eredmény elvárt, új siker vagy ismételt jóváhagyás nem. Ezután kapcsolja vissza a kapcsolatot.
4. Ugyanazt az olvasógombot egyszer nyomja meg: azonos v3 és egyetlen jóváhagyási auditesemény jelenjen meg. Ha a session új belépést kér, jelentkezzen be, majd kizárólag olvassa vissza. AUTH_REQUIRED esetén a munkaterület lezárása és új belépési jelzés az elvárt.

Elég a visszajelzés: „offline hibát jelzett, visszakapcsolva v3 és egy jóváhagyás látszik”, vagy a látható hiba szövege. Nem kell érzékeny képernyőkép. Ez a Safari olvasás/hálózati helyreállás részpróbája; nem igazolja a fizikai iPhone Writer-írást, új emberi jóváhagyást vagy a teljes PWA-mátrixot.

## Későbbi, célzott eszköz-elfogadási pontok

| Pont | Elvárt viselkedés |
| --- | --- |
| Safari és főképernyős kezelő külön megnyitása | Nem ígérünk közös belépést; szükség esetén normál új login mindkét környezetben |
| Writer / külön approver mobilfelület | Meglévő szintetikus ügy kiválasztható, tervezet olvasható; művelet csak a saját DB-jogával és aktuális feltételekkel |
| Jóváhagyó háttérbe küldése bejelölt megerősítés után | Tervezet és checkbox törlődik; visszatérés önmagában nem küld approval POST-ot |
| Rövid hálózatvesztés / visszatérés | Nincs bizonyítatlan siker vagy automatikus írásismétlés; új ellenőrzés szükséges. A hálózatváltás tényleges iOS-viselkedése még nincs mérve |
| Kijelentkezés, majd visszalépés/back | Felhős előnézet üres; védett olvasás/jóváhagyás tiltott új hitelesítésig |
| Mobil olvashatóság | Nincs vízszintes túllógás, gombok elérhetők, billentyűzet nem zárja el tartósan a belépést |

A fenti részpróbák sikere nem jelenti a teljes táblázat vagy a Previo-integráció lezárását. A teljes pozitív felhős dézsajóváhagyás továbbra is hiteles ház-/időszak-/naptárbizonyítékot igényel; hiányában nem szabad véglegesíteni.
