# Chatbot – nyitott kérdések a tulajdonosnak

A chatbot csak jóváhagyott tényből válaszol. Az alábbiakra nincs jóváhagyott adat, ezért most „munkatársunk segít” a válasz.
A tulajdonos válasza után a tény bekerül a tudásbázisba (`shared-core/chat-assist.mjs`), és a kérdéssor újrafut
(`node scripts/chat-question-battery.mjs --live`).

Forrás: kérdéssor 2026-11-15 (102 kérdés) és 2026-11-16 (+40 nehezebb kérdés), célzott foglalási forgatókönyvek (26/26 jó).

## Szállás, felszereltség
1. ✅ **Van wifi.** (tulajdonos 11-18)
2. ✅ **Van TV és légkondi.** (tulajdonos 11-18)
3. ✅ **Van konyha, lehet főzni, mikró is van.** (tulajdonos 11-18; hűtő/kávéfőző nem megerősítve)
4. ✅ **Van ágynemű és törölköző, nem kell külön fizetni.** (tulajdonos 11-18)
5. ✅ **Van külön kialakított grillezési lehetőség.** (tulajdonos 11-18)
6. ✅ **Gyerekágy és etetőszék nincs.** (tulajdonos 11-18)
7. ✅ **Későbbi kijelentkezés: egyedi elbírálás, foglaltságtól függ.** (tulajdonos 11-18)

## Árak, fizetés
8. Lehet kártyával fizetni a helyszínen? SZÉP-kártyát elfogadtok (melyik zseb)?
9. Pótágy ára (felnőtt / gyermek)? (A régi listaár ellentmondásos – friss megerősítés kell.)
10. Hány éves kortól fizet a gyermek a szállásért? (A régi lista: 0–3 ingyenes, 3–8 kedvezményes – megerősítendő.)
11. Lehet-e foglalás dátumát módosítani, és milyen feltétellel?

## Horgászat
12. ✅ **Lehet éjszaka horgászni.** (tulajdonos 11-18)
13. ✅ **2 bottal.** (tulajdonos 11-18)
14. ✅ **Csónakból nem; etetőhajóval (robothajó) lehet etetni.** (tulajdonos 11-18)
15. Hol lehet horgászjegyet venni (recepción, online)?
16. ✅ **A rekord tóba nagyobb méretű halakat telepítettek; ebben különbözik a normál tótól.** (tulajdonos 11-18)
17. ⚠️ Tulajdonos 11-18: „gyerek horgászjegy nem kell” – **ellentmond** a jóváhagyott gyermekjegy-áraknak (fishing-rules.mjs: gyermek 12 órás/24 órás/heti jegy) → pontosítás kell, addig nem módosítva.
18. ✅ **Nem szállóvendég is vehet napijegyet.** (tulajdonos 11-18)

## Környék, egyéb
19. ✅ **Büfé és étterem van a területen.** (tulajdonos 11-18)
20. ✅ **1 km-en belül bevásárlóközpont (Penny, SPAR).** (tulajdonos 11-18)
21. Van játszótér?
22. Lehet fürödni a tóban? Van strand / fürdő a közelben (pl. Lenti termál)?
23. Milyen programokat ajánlotok a környéken?

## Ellenőrizendő (a modell következtetett)
24. Macskát is lehet hozni? (A „háziállat hozható” szabályból következtette.)
25. Késői érkezés: a voucheren „bejelentkezés 14:00–2:00” áll – ez minden vendégre érvényes?

---
Állapot: a válaszokat a tulajdonos napi összefoglalóban adja meg; minden válasz után a tényt beírjuk és a kérdéssor újrafut.
