# V1 Gmail olvasási audit – 2026-10-15

## Ellenőrzött kód (gmail-test-subject-allowlist)
- `gmail-policy.mjs`: csak `sarberkiprojecttest@gmail.com` engedélyezett, `INBOX` címke és 2026-09-25 utáni belső dátum szükséges.
- `gmail-readonly.js`: `gmail.readonly` scope, profillekérés és `assertTestGmailAccount` a levéllistázás előtt; a levéllista `isTestInquiry` szűrővel kerül feldolgozásra.
- `gmail-policy.test.mjs`: a hibás Google-fiókot és a profil ellenőrzésének sorrendjét teszteli, valamint a tetszőleges tárgy/feladó fogadását.

## Lényeges különbség
A `gmail-subject.mjs` és `gmail-filter.test.mjs` tárgyszűrő logikája a repositoryban még létezik, de a jelenlegi Gmail olvasási útvonal a `gmail-policy.mjs` alapján **nem szűr tárgyra vagy feladóra**. A korábbi tárgytesztek megléte nem bizonyítja, hogy a tényleges beolvasás tárgy-allowlistet használ. Ez szándékos viselkedés lehet; a Work vizsgálja meg a régi modul hivatkozásait és jelölje a státuszt, mielőtt bármelyik modult törölné vagy módosítaná.

## Nem igazolt
- Élő Google OAuth tesztfiók-belépés és tényleges Gmail → mentett ügy → Reader előnézet E2E eredmény.
- A legfrissebb teljes CI/tesztfutás: az aktuális dokumentációs commit GitHub status listája üres, a lekért PR-triggerelt workflow-run lista üres; ez nem bizonyít sem sikert, sem hibát.

## Következő biztonságos teendők
1. Work: ellenőrizze az aktuális branch commitját és a releváns workflow-kat; ne tekintse a dokumentációs commiton hiányzó státuszt hibának.
2. Az elkülönített tesztoldalon a kezelő szükség esetén végezze el a Google-fiókválasztást; csak `sarberkiprojecttest@gmail.com`, `gmail.readonly`.
3. Szintetikus tesztlevélből bizonyítsa a Gmail → Writer → Reader → emberi jóváhagyás láncot. Nincs automatikus e-mail-küldés vagy Previo-írás.
4. A Previo élő árlekérési kapuja maradjon zárva, amíg a rövid életű zárolás hiánya nem bizonyított.

Ez dokumentációs audit, nem új tesztfutás vagy éles integráció igazolása.
