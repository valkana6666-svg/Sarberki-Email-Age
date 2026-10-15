// Only fixed public codes/messages cross the server/client translation boundary.
const messages=Object.freeze({
 TRANSLATION_DISABLED:'A fordítószolgáltatás nincs bekapcsolva vagy beállítva. Az eredeti szöveg változatlan.',
 AUTH_REQUIRED:'A fordításhoz érvényes kezelői belépés szükséges. Jelentkezz be újra.',
 FORBIDDEN:'A fordítás indításához Writer-jogosultság szükséges; a szerver elutasította a hozzáférést.',
 INVALID_INPUT:'A fordítás jelenleg csak a három engedélyezett zárt tesztlevélhez kérhető. Az eredeti szöveg változatlan.',
 TRANSLATION_UNVERIFIED:'A fordítás válasza vagy számai nem ellenőrizhetők, ezért nem jeleníthető meg. Az eredeti szöveg változatlan.',
 TRANSLATION_KEY_REJECTED:'A fordítószolgáltató elutasította a szerveren beállított API-kulcsot. A kulcsértéket ne másold a chatbe.',
 TRANSLATION_ACCESS_DENIED:'A fordítószolgáltató megtagadta az API-hozzáférést. A szolgáltatói projekt jogosultságait ellenőrizni kell.',
 TRANSLATION_MODEL_UNAVAILABLE:'A beállított fordítómodell nem érhető el a szolgáltatónál. A szerver modellbeállítását ellenőrizni kell.',
 TRANSLATION_QUOTA_EXHAUSTED:'A fordítószolgáltatás API-kerete vagy egyenlege elfogyott. Az API-számlázást ellenőrizni kell.',
 TRANSLATION_RATE_LIMITED:'A fordítószolgáltató átmeneti kéréskorlátot jelzett. Automatikus újrapróbálás nem történt.',
 TRANSLATION_UNAVAILABLE:'A fordítás átmenetileg nem érhető el. Az eredeti szöveg változatlan, küldés nem történt.'
});
export function translationErrorCode(code){return Object.hasOwn(messages,code)?code:'TRANSLATION_UNAVAILABLE';}
export function translationErrorMessage(code){return messages[translationErrorCode(code)];}
