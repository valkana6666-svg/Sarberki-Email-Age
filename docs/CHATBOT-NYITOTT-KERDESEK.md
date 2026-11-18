# Chatbot – nyitott kérdések a tulajdonosnak

A chatbot csak jóváhagyott tényből válaszol. Az alábbiakra nincs jóváhagyott adat, ezért most „munkatársunk segít” a válasz.
A tulajdonos válasza után a tény bekerül a tudásbázisba (`shared-core/chat-assist.mjs`), és a kérdéssor újrafut
(`node scripts/chat-question-battery.mjs --live`).

Forrás: kérdéssor 2026-11-15 (102 kérdés) és 2026-11-16 (+40 nehezebb kérdés), célzott foglalási forgatókönyvek (26/26 jó).

## Szállás, felszereltség
1. ✅ **Van wifi.** (tulajdonos 11-18)
2. ✅ **Van TV és légkondi.** (tulajdonos 11-18)
3. ✅ **Van konyha, lehet főzni, mikró is van.** (tulajdonos 11-18; hűtő/kávéfőző nem megerősítve)
4. Van ágynemű és törölköző? (Ha nem: kérhető-e, mennyiért?)
5. Van grillezési lehetőség (saját grill / közös)?
6. Van gyerekágy (kiságy), etetőszék?
7. Van-e késői kijelentkezés (late check-out)? Feltétel/díj?

## Árak, fizetés
8. Lehet kártyával fizetni a helyszínen? SZÉP-kártyát elfogadtok (melyik zseb)?
9. Pótágy ára (felnőtt / gyermek)? (A régi listaár ellentmondásos – friss megerősítés kell.)
10. Hány éves kortól fizet a gyermek a szállásért? (A régi lista: 0–3 ingyenes, 3–8 kedvezményes – megerősítendő.)
11. Lehet-e foglalás dátumát módosítani, és milyen feltétellel?

## Horgászat
12. Lehet éjszaka horgászni?
13. Hány bottal lehet horgászni?
14. Lehet csónakból horgászni / van csónak?
15. Hol lehet horgászjegyet venni (recepción, online)?
16. Mi a különbség a normál és a rekord tó között (halállomány, méret, szabály)?
17. Kell-e gyereknek horgászjegy, és hány éves kortól?
18. Van-e nem szállóvendégeknek külön belépő / napijegy?

## Környék, egyéb
19. Van étterem / büfé a területen vagy a közelben?
20. Van bolt a közelben (milyen messze)?
21. Van játszótér?
22. Lehet fürödni a tóban? Van strand / fürdő a közelben (pl. Lenti termál)?
23. Milyen programokat ajánlotok a környéken?

## Ellenőrizendő (a modell következtetett)
24. Macskát is lehet hozni? (A „háziállat hozható” szabályból következtette.)
25. Késői érkezés: a voucheren „bejelentkezés 14:00–2:00” áll – ez minden vendégre érvényes?

---
Állapot: a válaszokat a tulajdonos napi összefoglalóban adja meg; minden válasz után a tényt beírjuk és a kérdéssor újrafut.
