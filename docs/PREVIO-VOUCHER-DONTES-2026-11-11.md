# Previo-voucher a vendégnek – vizsgálat és választott út (Claude, 2026-11-11)
Feladat: #9 6792247803 (ChatGPT/Work → Claude). Csak dokumentáció- és kódvizsgálat. Previo-írás, sablonmentés és küldés nem történt.

## 1. Támogatott Previo-út a voucher-PDF-hez? – NINCS
- A hivatalos REST- és XML-API-gyűjteményben (rest.apidocs.previo.app, xml.apidocs.previo.app; 11-11-én teljesen átnézve: voucher/pdf/document/send/email/confirmation/print kulcsszavak) **nincs** foglalási voucher-PDF lekérés és natív visszaigazoló küldés.
- PDF csak számlához van: `GET rest/billing/documents/print` (jog: `Hotel.getDocuments`, ez nincs meg) – ez számla, nem voucher.
- A PMS nyomtatási URL bejelentkezett böngésző-munkamenetet igényel, ez nem szerveres API (Work vizuális bizonyítéka: Voucher_20260003 PDF). Erre nem építünk.

## 2. Azonosítók kapcsolata (igazolva)
| Érték | Mi ez | Hol |
|---|---|---|
| `SC-` + 16 hex | determinisztikus ügy→foglalás kulcs (`voucherFor`), **a Previo „voucher” mezőjébe küldjük** | a Previo ezt tárolja és ezt adja vissza a keresésben (R2 resId 118088637 → SC-17CAFC194331890A; V2-UI resId 118089895 → SC-FBC991EC82A9269E) → a Previo saját voucherén is ez a szám áll |
| `V2-<resId>` | belső Previo-foglalásazonosító nálunk (`booking.previo.reference`) | csak kezelői adat |
| 2026xxxx | a Previo saját számsora (Voucher-beállítás) | csak a kézzel, PMS-ben rögzített foglalásoknál (V1) |
Az idempotencia nem változott; eltérő vendégoldali szám nem keletkezik.

## 3. Összevetés
| Út | Megvalósítható most? | Csatorna | Dupla küldés elleni védelem |
|---|---|---|---|
| **A) Saját visszaigazoló levél (HU/DE/EN/SI) + Previo-foglalási szám a szövegben** | **igen** (kész lánc: tervezet → jóváhagyás hash-kötéssel → küldési napló) | 1 (meglévő Gmail-küldés, tesztpár) | meglévő `send-ledger` |
| B) Previo-PDF letöltése + csatolás a Gmail-küldéshez | nem: nincs támogatott PDF-API | – | – |
| C) Natív Previo-küldés a saját kezelőből | nem: nincs API | – | – |

## 4. Döntés (legkisebb igazoltan megfelelő út)
**A)**: a V2-foglalás visszaigazoló levele tartalmazza a Previo-foglalási számot (`Foglalási szám: SC-…`; DE/EN/SI megfelelője). A jóváhagyás a teljes szövegre (benne a számra) vonatkozik, módosuláskor új jóváhagyás kell; bizonytalan küldési eredménynél nincs automatikus újraküldés (meglévő szabályok). Kód: `booking-confirmation-draft.mjs` (`bookingNumber`), `server-test-mailbox-confirm.mjs` (csak V2-foglalásnál). Tesztek PASS.
**Átmeneti kezelői megoldás, ha a vendég kifejezetten Previo-PDF-et kér:** a kezelő a PMS-ben a foglalásnál kinyomtatja vagy elküldi (kézi, nem automatikus; ugyanaz a szám áll rajta).
**Később, csak ha szükséges:** a Previótól a voucher-PDF API-elérhetőségének megkérdezése (tulajdonosi döntés: minimális Previo-kommunikáció).
