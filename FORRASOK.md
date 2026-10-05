# Sárberki projekt – forrásjegyzék

Frissítve: 2026-10-05

## Használati szabály

Ez a fájl megkülönbözteti:

1. **hivatalos külső dokumentációt** – mit állít a szolgáltató;
2. **projektben ellenőrzött megfigyelést** – mit mértünk / teszteltünk a Sárberki rendszerrel;
3. **belső üzleti szabályt** – mit adott meg a Sárberki üzemeltetés;
4. **következtetést / mintát** – mit veszünk át rendszertervezési elvként.

Egy külső dokumentációban szereplő lehetőség önmagában nem bizonyítja, hogy az a Sárberki konkrét előfizetésében vagy konfigurációjában aktív.

## 1. Daktela / Coworkers.ai – hivatalos dokumentáció

### Dialog és állapot

- Dialogs  
  https://docs.daktela.com/ai-coworkers/instance-admin/dialogs/  
  Relevancia: kisebb újrahasznosítható flow-k, interruption/fallback logika.

- What is $context?  
  https://docs.daktela.com/ai-coworkers/core-concepts/what-is-context/  
  Relevancia: strukturált beszélgetési memória, API-válaszok és entitások használata feltételekben.

### API-integráció

- API Integrations  
  https://docs.daktela.com/ai-coworkers/instance-admin/api-integrations/  
  Relevancia: külső rendszerek külön integrációs rétege.

- Add/Edit Integrations  
  https://docs.daktela.com/ai-coworkers/instance-admin/api-integrations/add-edit-integrations/  
  Relevancia: HTTP metódusok, timeout, pre/post-process, response mapping, context.

- Use Integrations  
  https://docs.daktela.com/ai-coworkers/instance-admin/api-integrations/use-integrations/  
  Relevancia: blocking vs async/await, Success/Failure ágak.

- Inputs for the Agent Module  
  https://docs.daktela.com/ai-coworkers/instance-admin/api-integrations/inputs-for-the-agent-module/  
  Relevancia: kötelező integrációs adatok meglévő contextből vagy az Agent által begyűjtve.

### Human-in-the-loop és válaszforrás

- E-mail Module  
  https://docs.daktela.com/ai-coworkers/instance-admin/dialogs/modules/email-module/  
  Relevancia: Whisper mód – AI-tervezet, emberi send/edit/reject.

- How to test AI bots  
  https://docs.daktela.com/ai-coworkers/manager-s-quick-start-15-min/how-to-test-ai-bots-chatbot-voicebot-emailbot/  
  Relevancia: statikus, dinamikus és integrált válaszok szétválasztása; API-adatból válaszadás.

### Bizonyítási határ

A fenti oldalak Daktela-funkciókat és működési mintákat bizonyítanak. **Nem bizonyítanak konkrét Sárberki vagy Previo ügyfélimplementációt.**

## 2. Previo – hivatalos dokumentáció

- API access  
  https://help.previo.app/en/doc/api-access/  
  Relevancia: a Previo külön fizetős API-hozzáférést kínál; XML/REST/EQC/POS dokumentációt említ.

- Booking of services  
  https://help.previo.app/en/doc/booking-of-services/  
  Relevancia: a Reservation+ felhasználói foglalási folyamat általános leírása.

- Basic settings – Reservation+  
  https://help.previo.app/en/doc/basic-settings-new-r/  
  Relevancia: a publikus foglalómotor beállításainak leírása.

### Fontos korlát

A projekt jelenlegi Previo adaptere nem hivatalos, megvásárolt XML/REST API-hozzáférést használ, hanem a Sárberki publikus Reservation+ foglalójának megfigyelt keresési/árkérési útvonalait. A részletes mellékhatás-biztonsági státusz a `PRICE_SOURCE_STATUS.md` fájlban van.

## 3. Projektben ellenőrzött Previo-források

Elsődleges belső technikai dokumentum:

- `PRICE_SOURCE_STATUS.md`

Ebben külön szerepel:
- mely Reservation+ kéréseket azonosítottuk;
- milyen bemenet ment át;
- milyen válaszmezőket láttunk;
- mely eredményt vetettük össze a hivatalos foglalói UI-val;
- mely pontoknál nincs bizonyított mellékhatásmentesség;
- milyen biztonsági kapu tiltja az élő hívást.

A projektben rögzített fixture-ek **tesztforrások**, nem friss élő árak.

## 4. Sárberki belső üzleti források

Elsődleges összefoglaló:

- `szabalyok.txt`

Kapcsolódó futó konfiguráció:
- `business-config.mjs`
- `business/sarberki/profile.mjs`

Ezek tartalmazzák vagy hivatkozzák többek között:
- előleg és lemondás;
- háztípusok és kapacitások;
- szezon;
- IFA;
- gyermekkezelés;
- üzemeltetési és horgászati válaszszabályok;
- elérhetőség és review-kapuk.

## 5. Forráshierarchia fejlesztéskor

Ha két információ ütközik, ne automatikusan az újabbat vagy a kényelmesebbet válasszuk. Először azonosítani kell a típusát.

Javasolt sorrend:

1. friss, konkrét Sárberki üzleti jóváhagyás;
2. friss, hitelesen ellenőrzött Previo / szolgáltatói adat;
3. hivatalos szolgáltatói dokumentáció;
4. projektben rögzített korábbi fixture / tesztmegfigyelés;
5. belső referencia- vagy fallback-számítás;
6. következtetés.

Ha a bizonyosság nem elég magas, a rendszer ne állítson biztos tényt, hanem kérjen kezelői ellenőrzést.

## 6. Dokumentációs karbantartás

Új fontos külső kutatásnál:
- az eredeti hivatalos link kerüljön ide;
- a belőle levont fejlesztési tanulság a megfelelő döntés- vagy tanulságfájlba kerüljön;
- konkrét Sárberki szabály csak akkor kerüljön a `szabalyok.txt`-be, ha annak üzleti forrása is megvan;
- élő ár/kapacitás eredményt dátummal és bizonyítási státusszal kell rögzíteni.
