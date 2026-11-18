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
8. ✅ **SZÉP-kártya elfogadott** (tulajdonos 11-18 + 2027-es hivatalos árlista). ❓ Bankkártya a helyszínen: nincs rá hivatalos adat.
9. ✅ **Hivatalos 2027-es árlista:** alaplétszám felett +10 000 Ft/fő/éj, főszezonban +11 000 Ft/fő/éj, a férőhelyig.
10. ✅ **Hivatalos 2027-es döntés (2026-10-26):** 0–3 év ingyenes; 4–8 év 5 000 Ft/fő/éj az alaplétszám felett; 9 évtől felnőtt. (A tulajdonos 11-18-i „3 évtől fizet” válasza helyett a hivatalos leírás érvényes, a tulajdonos utasítása szerint.)
11. Lehet-e foglalás dátumát módosítani, és milyen feltétellel?

## Horgászat
12. ✅ **Lehet éjszaka horgászni.** (tulajdonos 11-18)
13. ✅ **2 bottal.** (tulajdonos 11-18)
14. ✅ **Csónakból nem; etetőhajóval (robothajó) lehet etetni.** (tulajdonos 11-18)
15. ✅ **A recepción.** (tulajdonos 11-18)
16. ✅ **A rekord tóba nagyobb méretű halakat telepítettek; ebben különbözik a normál tótól.** (tulajdonos 11-18)
17. ✅ **A hivatalos gyermekjegy-árak maradnak** (fishing-rules.mjs); a tulajdonos 11-18-án jelezte, hogy a „nem kell” válasz téves volt.
18. ✅ **Nem szállóvendég is vehet napijegyet.** (tulajdonos 11-18)

## Környék, egyéb
19. ✅ **Büfé és étterem van a területen.** (tulajdonos 11-18)
20. ✅ **1 km-en belül bevásárlóközpont (Penny, SPAR).** (tulajdonos 11-18)
21. ✅ **Játszótér van.** (tulajdonos 11-18)
22. ✅ **A tóban nem lehet fürödni; 1 km-re városi strand és termálfürdő.** (tulajdonos 11-18)
23. ✅ **Hétvégén halászlé- és lángossütés; külön vendégprogram nincs.** (tulajdonos 11-18)

## Ellenőrizendő (a modell következtetett)
24. ✅ **Macska is hozható.** (tulajdonos 11-18)
25. ✅ **Hivatalos forrás szerint igen:** a Previo-voucher 14:00–2:00 bejelentkezést ír, a recepció 24 órás (szabalyok.txt 2.2a). Nincs ellentmondás, nem kérdezzük újra.

---
Állapot: a válaszokat a tulajdonos napi összefoglalóban adja meg; minden válasz után a tényt beírjuk és a kérdéssor újrafut.
