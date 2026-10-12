# Sárberki Chatbot – állandó kezelői tesztlink

Stabil cím: https://leafy-chimera-2403e5.netlify.app/sarberki-chatbot-project/index.html

Safariban Megosztás → Hozzáadás a főképernyőhöz → Sárberki Chatbot → Hozzáadás.
A manifest standalone nézetet, változatlan start_url/scope/id értéket és PNG-ikonokat
ad; az Apple touch ikon 180×180. Az ikon a meglévő Sárberki SVG arculatból készül.
Nincs GitHub-belépés a helyi chatbot használatához. A működés szintetikus tesztüzem.

## Frissítés

Az alkalmazás nem regisztrál service workert, nem tárol offline ügyadatot.
A Netlify meglévő no-store fejlécei a manifestre, ikonokra és modulokra is érvényesek.
A futó build SHA-ját a build-info modul rögzíti. Külön no-store, credentials:omit
lekérdezés ellenőrzi a legfrissebb telepítést. bfcache-visszatéréskor és újra
láthatóvá váláskor újraellenőriz. Új SHA esetén régi futó verzióra figyelmeztet,
a Frissítés gomb újratölti az oldalt. Offline vagy hibás metaadat nem igazol friss verziót.
Újratöltés/kijelentkezés törli a memóriában tartott Auth-tokent és a tesztbeszélgetést.

## Adatforrások és hitelesítés

- A nyilvánosan elérhető tesztchat meglévő közös döntési/FAQ-modulokat használ.
  Szintetikus helyi kérésből nem lesz igazolt élő kapacitás vagy vendégár.
- A külön operátori panel explicit bejelentkezés után csak GET ügyolvasást és
  GET szerveres közös-tervező előnézetet használ. Nem ment, hagy jóvá vagy küld.
- A konfigurációs API kizárólag leafy teszthoston, synthetic-only kapcsolóval,
  pontos sarberki-test Supabase URL és publikus anon/publishable kulcs mellett
  ad biztonságos bejelentkezési metaadatot. service_role/secret/DB-jelszó tiltott.
- Az Auth-token kizárólag memóriában marad. A Supabase Auth, DB-tagság és RLS
  a meglévő szerveres útvonalon ellenőrzi a hozzáférést; kliens-JWT-ellenőrzés
  csak korai hibaellenőrzés. A megadott ügyazonosító, tenant és verzió pontosan kötött.
- Az ügyolvasás külön source/checkedAt/revision adatot ad. Ez nem kapacitásbizonyíték.
  A panel kapacitáshoz és árhoz saját, pontosan kötött, legfeljebb 120 másodperces
  szintetikus forrásbizonyítékot igényel. Hiányzó/stale/future/foreign adat tiltott.
- A sarberki-test adatok szintetikusak, nem jelenhetnek meg valódi foglaltságként.
  Élő Previo-hozzáférés nem lett aktiválva; a read-only mellékhatásmentesség és
  kapacitásforrás megbízhatósága külön igazolást igényel.

## Tényleges aktiválási határ

A korábbi ellenőrzéskor a Netlify ügy-API CASE_STORE_DISABLED volt. Ha ez nem változott,
a chatbot konfigurációs végpontja 503 TEST_DATA_UNAVAILABLE, és a panel nem küld
bejelentkezési jelszót Supabase-nek. A kapcsolat kódjának megléte nem jelent aktív
felhős adatkapcsolatot. A telepítési ellenőrzésben külön kell rögzíteni a pontos SHA-t
és a konfiguráció/ügy-API aktuális eredményét.

A jelenlegi saját read-only preview nem végez Previo-kapacitás- vagy árlekérdezést.
Az ismert ügyadat visszaolvasható a hitelesített tesztügytárból, de kapacitás/ár
igazolásához megfelelő szerveroldali bizonyítékforrás kell; jelenleg UNKNOWN a biztonságos
eredmény. A frissített frontend nem lazítja az API, RLS, CAS vagy audit védelmét.

Valódi iPhone-főképernyős telepítés és saját eszközpróba kizárólag tényleges végrehajtás
után jelölhető igazoltnak; WebKit emuláció önmagában nem elég.
