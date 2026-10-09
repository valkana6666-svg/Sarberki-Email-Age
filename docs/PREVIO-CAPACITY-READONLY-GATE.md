# Sárberki Previo: kizárólag olvasó, titkosított hozzáférésű kapacitásteszt

Állapot: **előkészített, alapértelmezésben zárt** tesztkapu.
A telepített kapu és a böngészős összehasonlítás csak külön ellenőrzés után PASS.

## Biztonsági határok
- Csak `gmail-test-subject-allowlist`, Netlify `leafy-chimera-2403e5`; nem a main/production.
- Csak anonim érkezés/távozás/létszám és Previo nyilvános, csak olvasható háztípus-kapacitás.
- E-mail küldése, valódi foglalás létrehozása vagy módosítása továbbra is tiltott.
- A nyilvános kapacitás típus-pool, nem konkrét szabad ház vagy egyező A/B/C-ház bizonyítéka.

## Biztonságos megnyitás – kizárólag tesztprojekten
1. Netlify **tesztprojekt** (leafy-chimera-2403e5) → Environment variables:
   `PREVIO_CAPACITY_READ_SAFETY_VERIFIED=true`.
2. Ugyanott egy másik, titkos, véletlenszerű, legalább 32 karakteres érték:
   `PREVIO_CAPACITY_TEST_TOKEN`. Csak Function runtime környezetben legyen; ne kerüljön a JavaScript frontendbe, GitHubba, naplóba vagy chatbe.
3. GitHub repo → Settings → Secrets and variables → Actions → New repository secret:
   `PREVIO_CAPACITY_TEST_TOKEN`, **ugyanazzal a titkos értékkel**.
4. Frissítsd a Netlify tesztprojekt telepítését, ellenőrizd a `/api/health` `deployedCommit` értékét.
5. GitHub → Actions → `Sárberki one-time read-only Previo capacity crosscheck` → Run workflow, ág: `gmail-test-subject-allowlist`.
6. Fontos: **NE** állítsd a régi `PREVIO_READ_SAFETY_VERIFIED` kapcsolót true értékre: az a külön árlekérdezési végpontot is megnyitná.

## Összehasonlítás
2026. október 23–25. (4 felnőtt) és 2026. november 9–13. (6 felnőtt).
A manuálisan indított CI kétszer, a közvetlen nyilvános Previo és a hitelesített Netlify teszt-funkció
háztípus-összesítését veti össze. Hibás, hiányzó vagy bizonytalan készlet = nem PASS.
A Previo nyilvános böngészős megjelenítésének **független manuális szemrevételezése**
még külön szükséges. A CI önmagában nem bizonyítja a konkrét fizikai apartmanpárosítást.

## Teszt lezárása
Netlify `PREVIO_CAPACITY_READ_SAFETY_VERIFIED=false`, majd teszttoken törlése/rotálása
Netlify-ban és GitHubban. A kapu zárt állapotban nem küld kérést a Previo felé.
