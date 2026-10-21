# Előlegszabályok egységesítése – 2026-10-21

Kiindulás: `c9b349b14096f0391dd861b5963a62156a532491`, kizárólag a tesztág. Külső kérés, foglalás, e-mail, cloud-adatmódosítás vagy telepítés e részfeladatban nem történt.

## Forrás és döntési határ

A tulajdonos 2026-10-21-i munkautasítása egyértelműen jóváhagyja: 15 fő alatt 50%, **legalább 15 főnél 80%** előleg; 14 napnál több idő esetén 7 nap, 14 napnál kevesebb idő esetén 24 óra a fizetési ablak. Ez felülírja a korábbi tesztági 15 főig 50% szabályt, a konfiguráció hibás második 50%-át és az általános 10 napot.

Pontosan 14 nap: a korábbi `reports/v1-final-acceptance-2026-10-17/REPORT.md` legfeljebb 14 napra 24 órát ír, míg a mostani utasítás kifejezetten a határ ellenőrzését és ellentmondásnál zárolást kéri. A jelen módosítás **nem dönt új üzleti szabályról**: pontosan 14 naptári nap esetén `manual_review`, nincs számított határidő. A naptári napok közötti különbség meglévő alapja megmaradt; az offsetes időpont foglalási napját a szálláshely Europe/Budapest időzónájába normalizáljuk, nem a szerver vagy a feladó időzónája alapján választjuk. A 24/168 órás beérkezési határidő offsettel ellátott foglalási időpontból, eltelt órával számolódik. A fizetési ablak számítása nem pénzbeérkezési bizonyíték.

Lemondás: a régi létszámhoz rendelt 14/30 napos konfigurációt adatként megőriztük, de `cancellationAutomaticPolicyVerified=false` miatt ebből a Sárberki konfigurációval nem készül automatikus lemondási ígéret. A 14 napos rövid határ lemondási megítélése is emberi ellenőrzésre kerül. Más esetek korábbi, eleve tulajdonosi jóváhagyáshoz és hiteles előlegbeérkezéshez kötött auditfolyamata megmaradt; automatikus törlés vagy fizetés nincs.

## Javított útvonalak

- `business-config.mjs`: 50/80%, kontextusfüggő 168/24 óra, pontos14 és lemondás felülvizsgálati kapcsolók; nincs általános10nap.
- `sarberki-core.mjs`: meglévő közös előlegszámító most a központi konfigurációból dolgozik, egy megosztott százalékválasztóval. Pontos14 nem jut át számított fizetési határidőként. Négy nyelvű tájékoztatás és megerősített fizetési kontextus is jelzi a vitatott határt.
- `booking-confirmation.mjs`: a szimuláció is ugyanazt a százalékválasztót használja; nem állít valódi véglegesítést.
- `shared-core/reply-context.mjs`: a jóváhagyott tenant-konfiguráció új kapcsolói átjutnak a meglévő DTO-vetítésen.
- `case-state.mjs`: a közeli érkezés figyelmeztetése a kontextusfüggő14napos határra támaszkodik, nem a megszüntetett általános10napra. A konkrét összeg, számítási alap, határidő és lemondás külön emberi ellenőrzése megmarad.
- `guest-reply/public-answer-data.mjs` és renderer: a publikált üzleti szabályadat ugyanaz a konfiguráció; nincs régi10napos vagy általános lemondási ígéret.
- `price-check.js`: a korábbi külön megjelenítési útból töröltük a hiányzó konfigurációt kitalált50/80/10nap/14–30nap értékekkel pótló fallbacket. Nincs igazolt foglalási időpont, ezért a konkrét fizetési határidőt és lemondást külön felülvizsgálatra adja.
- `chatbot-v1.mjs`, publikált régi `index 2.html` és `szabalyok.txt`: a fennmaradt elavult10napos kijelentések eltávolítva; a dokumentált korábbi jelentéseket nem írtuk át.

Az általános renderer továbbra is képes más, kifejezetten átadott tenant-szabályok megjelenítésére; a Sárberki aktuális szabályai a központi konfigurációból származnak. Nem épült második üzleti motor, ügytár vagy jogosultsági rendszer. Kapacitási/elhelyezési algoritmus nem változott.

## Ellenőrzés

1. Érintett előleg-/konfiguráció-/core-/paritás-/stressz-/public-reply regresszió: **548 PASS / 0 FAIL / 0 SKIP**, 1,445 másodperc.
2. Az utólag felfedezett chatbot és legacy árút javítása után célzott további csomag: **68 PASS / 0 FAIL / 0 SKIP**, 0,506 másodperc. Ebben van átfedés az első csomaggal; az eredmények nem adhatók össze független tesztek számaként.
3. Új egységes előlegteszt: 14/15/16 fős határ; 13/14/15 napos lead time; 24/168 órás offsetes beérkezés; hiányzó és hibás adat; pontos14 blokkolása jóváhagyott fizetési kontextus mellett is; négy nyelvű public/core szövegek; chatbot; közeli érkezés kritikus állapota.
4. A legacy árút hiányzó konfigurációval sem talál ki előlegszázalékot vagy határidőt. Szintetikus böngésző-VM próba; a statikus build modulbezártsága is PASS.
5. Az utolsó időzóna- és hibás-időpont védelem után friss célzott csomag: **133 PASS / 0 FAIL / 0 SKIP**, 0,211 másodperc; a február30-i foglalási időpont is elutasított. Ezek is átfednek az előző tesztekkel.

A korábbi történeti teszt- és CI-jelentések változatlanok. Nem futott újra a teljes1831tesztes készlet. A jelen eredmény helyi szintetikus igazolás, nem friss felhős vagy valódi iPhone-elfogadási bizonyíték.
