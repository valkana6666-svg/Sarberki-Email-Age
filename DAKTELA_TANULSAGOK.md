# Daktela-tanulságok a Sárberki projekthez

Frissítve: 2026-10-05

## Cél

Ez a dokumentum azt rögzíti, hogy a Daktela / Coworkers.ai nyilvánosan dokumentált működéséből milyen rendszertervezési tanulságokat használunk a Sárberki érdeklődéskezelő fejlesztésénél.

**Nem cél a Daktela kódjának, belső konfigurációinak vagy ügyfélspecifikus megoldásainak másolása.** A projekt kizárólag nyilvános dokumentációból megismerhető építészeti mintákat és saját fejlesztésű megoldásokat használ.

## Bizonyított Daktela-minták

### 1. A beszélgetési logika külön folyamat

A Daktela Dialog Flow rendszere kisebb, újrahasznosítható dialógusokra bontható. Külön interruption/fallback útvonalak kezelhetik például a hibákat, timeoutokat és bizonytalan helyzeteket.

**Sárberki-tanulság:** a beolvasás, adatkinyerés, validálás, ár- és kapacitáslekérés, válaszgenerálás és hibakezelés ne egyetlen nagy promptban vagy függvényben legyen.

### 2. A kontextus / állapot explicit adat

A Daktela `$context` néven külön beszélgetési állapotot tart fenn. Ebben API-válaszok, kinyert entitások és kézzel beállított értékek is tárolhatók, majd feltételekhez, válaszokhoz és API-hívásokhoz használhatók.

**Sárberki-tanulság:** a dátum, felnőttszám, gyermekkorok, háztípus, árstátusz, elérhetőség és kezelői ellenőrzés strukturált mezőként éljen, ne csak szabad szövegben.

### 3. Az API-integráció külön réteg

A Daktela dokumentációja külön API Integration réteget használ külső rendszerek, CRM-ek, adatbázisok és más szolgáltatások hívására. Az integrációk a dialog flow-ból aktiválhatók.

**Sárberki-tanulság:** a Previo, Gmail, MNB és későbbi külső rendszerek ne keveredjenek közvetlenül a levélfogalmazással. Mindegyikhez külön adapter és validáció tartozzon.

### 4. Blocking / async és Success / Failure ágak

A Daktela külön blocking és async integrációs mintát dokumentál. A blocking hívás a válasz után Success vagy Failure ágon folytatja a flow-t; az async változat külön Await lépéssel várja be az eredményt.

**Sárberki-tanulság:** külső rendszer hibájánál ne találjunk ki eredményt. Az ár- vagy kapacitáslekérésnek explicit sikeres, sikertelen és ellenőrzést igénylő állapota legyen.

### 5. Az API-válasz vezérelje a dinamikus választ

A Daktela bot-tesztelési leírása külön kezeli a statikus, tudásforrásból származó és API-ból származó válaszokat. Integrált válasznál a botnak a külső rendszer által visszaadott adatra kell támaszkodnia.

**Sárberki-tanulság:** az AI ne találjon ki árat, szabad kapacitást vagy külső rendszerállapotot. Ezek csak hiteles forrásból kerülhetnek a válaszba.

### 6. Human-in-the-loop e-mailnél

A Daktela E-mail Module `Whisper` módja AI által készített tervezetet helyez a kezelő elé. Az ember küldheti el, szerkesztheti vagy elutasíthatja.

**Sárberki-tanulság:** a jelenlegi MVP helyes iránya az, hogy az AI előkészíti a vendégválaszt, de az ár és a küldés emberi jóváhagyási kapun megy át.

### 7. Hiányzó kötelező adatok begyűjtése

A Daktela Agent Module integrációs bemeneteinél megadható, hogy egy szükséges adat a meglévő beszélgetésből származik-e, vagy az Agentnek kell begyűjtenie a felhasználótól.

**Sárberki-tanulság:** a rendszer ne kérdezzen vissza mindent, csak azt, ami a következő biztonságos lépéshez ténylegesen hiányzik.

### 8. AI + szabály + tudás + integráció együtt

A Daktela külön kezeli a Dialog Flow-t, AI Knowledge réteget, API Integrations réteget, contextet és csatorna-specifikus működést.

**Sárberki-tanulság:** az LLM feladata elsősorban nyelvi értelmezés és megfogalmazás. A kritikus üzleti döntéseket tesztelhető szabályok, strukturált adatok és ellenőrzött API-válaszok vezéreljék.

## Mit NEM bizonyítottunk?

- Nem bizonyítottunk kész, név szerint hitelesített Daktela + Previo end-to-end terméket, amely a Sárberkihez hasonló mély helyi szabályokat automatikusan végigviszi.
- Nem férünk hozzá a Daktela belső forráskódjához.
- Nem férünk hozzá nem publikus roadmaphez, belső promptokhoz vagy ügyfélspecifikus konfigurációkhoz.
- Nem állítjuk, hogy a Sárberki megoldás Daktela-kódot használ.
- Nem tekintjük a Daktelát Sárberki üzleti szabályok forrásának.

## Daktela-minta → Sárberki megfelelő

| Daktela-minta | Sárberki megfelelő |
|---|---|
| Dialog Flow | külön feldolgozási és döntési lépések |
| `$context` | strukturált foglalási/adatkinyerési állapot |
| API Integrations | külön Previo, Gmail, MNB adapterek |
| Success / Failure | explicit siker/hiba/review állapot |
| Blocking / Async | külső hívások kontrollált kezelése |
| Agent input collection | csak a ténylegesen hiányzó adatok visszakérdezése |
| Whisper e-mail | ember által jóváhagyott választervezet |
| Knowledge + API | stabil tudás + élő rendszeradat szétválasztása |
| Reusable dialogs | újrahasznosítható modulok és shared-core |

## Projektbeli következtetés

A Daktela-kutatás elsősorban **rendszertervezési referencia**, nem kódforrás. A Sárberki üzleti szabályai, házstruktúrája, ár- és kapacitáslogikája, horgászati szabályai és Previo-mappingje saját projektadat.

A cél nem a Daktela lemásolása, hanem annak megértése, hogy egy érett contact-center / AI rendszer milyen problémákat választ szét, és ezekből mely minták teszik biztonságosabbá és tesztelhetőbbé a Sárberki megoldást.

## Hivatalos Daktela források

- Dialogs: https://docs.daktela.com/ai-coworkers/instance-admin/dialogs/
- What is $context?: https://docs.daktela.com/ai-coworkers/core-concepts/what-is-context/
- API Integrations: https://docs.daktela.com/ai-coworkers/instance-admin/api-integrations/
- Add/Edit Integrations: https://docs.daktela.com/ai-coworkers/instance-admin/api-integrations/add-edit-integrations/
- Use Integrations: https://docs.daktela.com/ai-coworkers/instance-admin/api-integrations/use-integrations/
- Inputs for the Agent Module: https://docs.daktela.com/ai-coworkers/instance-admin/api-integrations/inputs-for-the-agent-module/
- E-mail Module / Whisper: https://docs.daktela.com/ai-coworkers/instance-admin/dialogs/modules/email-module/
- Bot testing / integrated answers: https://docs.daktela.com/ai-coworkers/manager-s-quick-start-15-min/how-to-test-ai-bots-chatbot-voicebot-emailbot/
