# Tartós fejlesztési alapelv – 2026. október 8.

A Sárberki Horgásztó a későbbi AI-vállalkozás első alkalmazása. Az elsődleges cél a jelenlegi rendszer megbízható működése; a több vállalkozást kiszolgáló alapok fokozatosan, a stabilitás megtartásával készülnek. Most nem építünk teljes SaaS-t, chatbotot vagy telefonos AI-t.

Kötelező értékek: megbízhatóság, adatbiztonság, ügyféladatok elkülönítése, ellenőrizhetőség, modularitás, bővíthetőség és automatikus tesztelhetőség. Kizárólag tesztág és tesztoldal; main és production változatlan; nincs automatikus e-mail vagy PMS-írás.

## Modulhatárok

| Modul | Feladat |
|---|---|
| `tenant-config.mjs` | Saját vállalkozási azonosító, szabályok, név, nyelvek, 23 egység, adapter és kommunikációs politika |
| `business-config.mjs` | Megőrzött Sárberki üzleti tudás és korábbi kompatibilitás |
| `shared-core/availability-model.mjs` | AVAILABLE/UNAVAILABLE/UNKNOWN, forrás, időszak, időbélyeg, érvényesség és hiba |
| `shared-core/pms-adapter.mjs` | Csak olvasási adapter és egységes bizonyíték |
| `price-source/previo-adapter.mjs` | Previo-specifikus csatlakozás |
| `shared-core/reply-context.mjs` | Engedélyezett adatok kivetítése, tenant- és ügyazonosság, forráslista |
| `central-reply.mjs` | A meglévő központi választervező csatlakozása az ellenőrzött adatréteghez |
| `shared-core/communication.mjs` | Csatornafüggetlen, szűrt üzenetboríték |
| `shared-core/verified-pricing.mjs` | Ellenőrzött fix egységár és külön árösszetevők modellje |
| `shared-core/engine.mjs` | Befecskendezett parser/renderer/adapter; újrahasznosítható keret, nem külön döntéshozó AI |

## Biztonság és korlátok

Az elkülönítés jelenleg logikai. A böngészőben megadott tenant ID nem hitelesítés és nem szerveroldali jogosultság. Több ügyfél éles kiszolgálása előtt hitelesített szerveroldali tenant-hozzárendelés, közös ügytár és hozzáférés-ellenőrzés szükséges.

A konfigurációt, adaptert és válaszforrásokat megbízható alkalmazáskód adja át; vendéglevélből nem készíthető jóváhagyási jelölés. A válaszrenderelő szűrt tényeket kap, nem titkos kulcsot, teljes konfigurációt vagy más ügy leveleit. A vendégszöveg nem megbízható bemenet. A forráslista belső ellenőrzési adat; a renderer nem önálló tényhitelesítő, és a metadata önmagában nem kriptográfiai bizonyíték.

Az élő Previo-kapacitás és ár végpont alapértelmezetten tiltott. A teszthost és a `PREVIO_READ_SAFETY_VERIFIED=true` szerveroldali beállítás együttesen szükséges. Ezt csak a használt műveletek mellékhatásainak dokumentált kizárása után szabad beállítani. A fejlesztés során ezt nem kapcsoltuk be. Az új adaptermetódus normalizál, önmagában nem bizonyítja a szolgáltatói lekérdezés mellékhatás-mentességét.

A meglévő értelmező és árkezelő még tartalmaz Sárberki-specifikus elemeket; fokozatos kivonásuk külön feladat. A generikus ármodell bevezetése nem írja át a meglévő árjóváhagyást. Az egyedi egység- vagy szomszédságbizonyíték hiányát továbbra sem pótolja típusszintű készlet.
