# Sárberki többnyelvű e-mail stílus audit — 2026-10-05

## Cél
A vendégnek készülő HU/DE/EN/SL választervezetek legyenek természetesebbek, rövidebbek és nyelvspecifikusabbak úgy, hogy az üzleti szabályok, árlogika, Previo-logika és biztonsági korlátok ne változzanak.

A nyilvános forrásokból nem másolunk teljes minta-e-maileket. A regressziós levelek saját, Sárberki-specifikus, parafrazeált tesztminták.

## Források és alkalmazott tanulságok

### Magyar
Forrás: MTA helyesírási tanácsadó portál
- https://helyesiras.mta.hu/
- https://helyesiras.mta.hu/helyesiras/default/hqa

Alkalmazás:
- udvarias, tömör megszólítás és lezárás;
- egyértelmű dátum, létszám és kérés;
- a válasz ne legyen hivataloskodó vagy gépies;
- magyar névsorrendnél a két szóból álló névből a megszólításhoz a keresztnévként kezelt utolsó elem használata.

### Német
Forrás: Goethe-Institut üzleti e-mail oktatóanyagok
- https://www.goethe.de/

Alkalmazás:
- udvarias kérésnél természetes Konjunktiv-II szerkezetek, pl. „Könnten Sie …?”;
- kerülni a több egymás utáni „Bitte teilen Sie uns …” mondatot;
- „Mit freundlichen Grüßen” zárás;
- a Sárberki belső magyar háztípusneveit vendégnyelven megjeleníteni, ahol ez nem okoz azonosítási bizonytalanságot.

### Angol
Forrás: British Council LearnEnglish és IELTS
- https://learnenglish.britishcouncil.org/free-resources/writing/a1/email-book-hotel
- https://takeielts.britishcouncil.org/blog/how-to-write-the-date-in-english-for-ielts-a-guide

Alkalmazás:
- szálláslevélben a dátum, szállástípus és külön kérések legyenek egyértelműek;
- udvarias kérés: „Could you please …?”;
- nemzetközi vendégnél a kizárólag számos dátum helyett kiírt hónap: „16 October 2026”;
- következetes brit angol vendéglátós stílus („enquiry”).

### Szlovén
Forrás: Fran / Jezikovna svetovalnica
- https://www.fran.si/iskanje?AllNoHeadword=dopisi&FilteredDictionaryIds=151&Query=dopisi&View=2

Alkalmazás:
- a „Lep pozdrav” zárás után nem teszünk angol mintájú vesszőt;
- javított felnőtt/gyermek számnévi alakok: pl. „2 odrasli osebi”, „2 otroka”;
- gyermekéletkoroknál egyszerű, stabil szerkezetet használunk: „starost otrok: … let”.

## Beépített kódváltozások
- Angol dátumok: kiírt hónap.
- Német és angol visszakérdezések: természetesebb udvariassági szerkezetek.
- Nyelvspecifikus megszólítás névből.
- Szlovén számnévi alakok és lezárási írásjel javítása.
- Idegen nyelvű válaszokban lokalizált háztípus-megjelenítés.
- Négy új, saját készítésű realisztikus HU/DE/EN/SL hospitality fixture.

## Nem változott
- Previo-lekérdezés és PMS-logika.
- Árképzési és foglalási szabályok.
- Gmail csak olvasási elv.
- Automatikus vendéglevélküldés tiltása.
- Main és production.
