# V3 – Retell tesztagent bekötése a saját motorra (TEST)

Tulajdonosi kérés: „Kösd rá” (#9 7170471506). A végpont kódja kész: `netlify/functions/voice-turn.mjs` és `shared-core/voice-turn.mjs`. Alapból KI; csak TEST-kiadás után él.

## Hogyan működik
- **Retell:** beszédfelismerés, beszéd, hívás.
- **Válasz:** mindig a mi motorunk adja:
  - közös chatmotor;
  - ellenőrzött ajánlat (Previo TEST, csak olvasás);
  - tényhez kötött AI-válasz szabad kérdésre.
- Minden hívói megszólalás után a Retell-agent meghívja a `sarberki_reply` egyéni függvényt, és a visszakapott `reply` szöveget mondja el.
- **Állapotmentes:** a végpont a hívás eddigi hívói mondatait minden körben újra lejátssza; nem tárol semmit.
- **Nem tud:**
  - foglalni;
  - igényt leadni;
  - levelet küldeni;
  - Previóba írni.

## Netlify (TEST) – tulajdonos vagy Work, titok csak itt
| Változó | Érték |
|---|---|
| `VOICE_TURN` | `test-only` |
| `VOICE_TURN_KEY` | legalább 32 karakteres véletlen titok. Csak a Netlify-ban és a Retell-tool fejlécében szerepel; chatbe és GitHubra nem kerülhet. |
| `RETELL_API_KEY` (ajánlott) | a Retell API-kulcs. Ha be van állítva, a végpont a Retell aláírását (`x-retell-signature`) is ellenőrzi. |

Az ajánlathoz a meglévő kapcsolók kellenek: `INTAKE_CHAT_ENABLED=test-only`, `PREVIO_READ_API_ENABLED=sandbox-73521-only`. Ezek már be vannak állítva.

## Retell dashboard – tesztagent (Work)
1. **Agent:** Single Prompt, a Retell beépített LLM-jével. Nyelv: magyar (később multilingual).
2. **Custom Function** („Add tool → Custom function”):
   - Name: `sarberki_reply`
   - URL: `https://leafy-chimera-2403e5.netlify.app/.netlify/functions/voice-turn`
   - Method: `POST`
   - Headers: `x-sarberki-voice-key: <VOICE_TURN_KEY>`
   - Parameters (JSON Schema):
     ```json
     {"type":"object","properties":{
       "caller_messages":{"type":"array","items":{"type":"string"},"description":"A hívó EDDIGI ÖSSZES mondata szó szerint, időrendben (a legutóbbi is)."},
       "language":{"type":"string","enum":["hu","de","en","si"],"description":"A hívó nyelve, ha egyértelmű."}},
      "required":["caller_messages"]}
     ```
   - Speak after execution: **be**. Speak during execution: **ki**. Timeout: 8000 ms.
3. **Prompt** (Global Prompt):
   > Te a Sárberki Horgásztó telefonos asszisztense vagy. A hívó minden megszólalása után hívd meg a `sarberki_reply` függvényt: adj át minden eddigi hívói mondatot szó szerint, időrendben. Ezután a válasz `reply` mezőjét mondd el szó szerint, saját kiegészítés és átfogalmazás nélkül. Árat, szabad helyet, szabályt vagy feltételt soha ne mondj a függvény nélkül. Ha a `reply` üres, vagy a függvény nem válaszol, mondd: „Elnézést, ezt most nem tudom ellenőrizni – kollégánk visszahívja.”
4. **Teszt:** a dashboard böngészős próbahívása (web call), telefonszám vásárlása nélkül. Csak kitalált adattal, például: „Deluxe házat szeretnénk 2027. június 10-től 13-ig, két felnőtt.”

## Mit kell igazolni (Work → #9)
- A próbahívásban a válasz a mi szövegünk. Például szabad ház esetén: „Jó hír: a Deluxe ház … szabad. Ár: … Ft.”
- Árkérdésre a végpont ad árat, nem a Retell LLM-je.
- Nyelvváltás.
- A Retell call-log szerint a függvényhívás HTTP 200-zal válaszolt.

Fizetés, telefonszám-vásárlás és éles aktiválás tilos.

## Nyitott, NEM IGAZOLT
- Küldi-e a Retell a hívás átiratát (`call.transcript_object`) a függvénynek? Ha igen, a végpont azt használja; ha nem, a `caller_messages` argumentumot.
- Késleltetés.
- Négynyelvű hangminőség.
- Emberhez átadás (a saját LLM-es útnál a warm transfer a Retellnél korlátozott; a jelenlegi custom function úton a Retell LLM-je vezeti a hívást).
