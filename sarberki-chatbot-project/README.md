# Sárberki Chatbot Project

**Állapot:** V1 fejlesztés, csak teszt. **Éles telepítés:** nincs.

## Cél
Négy nyelvű (HU, DE, EN, SI) tájékoztató chatbot a Sárberki Horgásztó vendégeinek. A chatbot a Sárberki AI-agent közös üzleti szabályait használhatja, de önálló fejlesztési és tesztelési egység.

## Jelenlegi modulok
- `../chatbot-v1.mjs` – biztonságos, csak tájékoztató válaszmotor.
- `../tests/chatbot-v1.test.mjs` – négy nyelv és biztonsági korlátok tesztje.

## V1 határok
- Nem küld e-mailt, nem hoz létre foglalást, nem módosít Previo-adatot.
- Nem állíthat szabad kapacitást teljes időszakra szóló, igazolt lekérdezés nélkül.
- Ismeretlen információra nem talál ki választ.
- Az árak és az előleg pontos összege csak ellenőrzött, jóváhagyott ajánlatból kerülhet vendég elé.
- A dézsa külön bérelhető, külön díj ellenében.
- A fejlesztés kizárólag a `gmail-test-subject-allowlist` ágon történhet; main/production érintetlen.

## Közös választervező és beszélgetési teszt

A helyi `index.html` a `chat-session.mjs` adaptert használja, amely a már megadott adatokat memóriában megőrzi. Az „Új tesztbeszélgetés” törli a munkamenetet. Az `inquiry-preview.mjs` is a közös döntési modulból dolgozik. A közös e-mail/chat adapterek és korlátok: [CENTRAL-INQUIRY-PLANNER.md](../docs/CENTRAL-INQUIRY-PLANNER.md).

## Következő feladatok
1. Tartós, hitelesített HTTPS tesztfelület és valódi böngészős ellenőrzés. A helyi felület nem igazol publikus vagy iPhone-os használhatóságot.
2. Közös tudásforrás és pontos kérdés-válasz szándékfelismerés bővítése.
3. Külön tesztadatokkal végponttól végpontig történő ellenőrzés.
4. Csak később: kapacitáslekérdezés biztonságos integrációja, kezelői jóváhagyás, éles bevezetés.

**Megjegyzés:** Ez külön elnevezett projektterület a meglévő repóban, nem külön GitHub-repozitórium.
