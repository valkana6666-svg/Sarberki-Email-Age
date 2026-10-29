/* Browser-only Gmail bridge. Access token stays in memory and is never stored. */
(async () => {
  'use strict';
  const { cabinFromText, cabinClarificationRequired, partyCountsFromText, dateRangeFromText, phoneFromText, childAgesFromText, pierPreferenceFromText, languageFromText, buildReplyDraft, specialRequestsFromText, requestedUnitsFromText, activeMessageText, requestFlagsFromText } = await import('./sarberki-core.mjs?v=20261007-e2e1');
  const { BUSINESS } = await import('./business-config.mjs?v=20261007-e2e1');
  const { splitRequestFromText } = await import('./split-units.mjs?v=20261007-e2e1');
  const { fishingQuestion } = await import('./fishing-rules.mjs?v=20261005-stress1');
  const { TEST_GMAIL_ACCOUNT, readTestGmailInbox, gmailReadableBody:readableBody } = await import('./gmail-policy.mjs');

  function headerMap(message) {
    return Object.fromEntries((message.payload?.headers || []).map(h => [h.name.toLowerCase(), h.value]));
  }
  function emailAddress(value='') {
    return value.match(/<([^<>]+)>\s*$/u)?.[1] || value.trim();
  }
  const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
  const button = document.getElementById('read_gmail');
  const status = document.getElementById('gmail_auth_status');
  const clientId = document.querySelector('meta[name="google-oauth-client-id"]')?.content?.trim();
  const READ_STORAGE_KEY = 'sarberki.gmail.read-message-ids.v1';
  const PUSHOVER_WATCH_STORAGE_KEY = 'sarberki.gmail.pushover-message-ids.v1';
  const PUSHOVER_WATCH_INTERVAL_MS = 60000;
  let currentToken = null;
  let currentMessages = [];
  // Session-only observation, never server-verified evidence or a permission.
  const apiMessages = new WeakMap(), apiRecords = new WeakMap();
  window.SarberkiGmailReadOrigin = Object.freeze({consume(record) {
    const proof = apiRecords.get(record) || null;
    apiRecords.delete(record);
    return proof;
  }});
  function rememberApiRead(messages) {
    const proof = Object.freeze({channel:'gmail_readonly_api',evidence:'browser_observed',serverVerified:false,readAt:new Date().toISOString()});
    for (const message of messages) apiMessages.set(message, proof);
    return messages;
  }
  let pushoverWatchTimer = null;
  let lastGmailCheck = null;
  let lastPushoverSend = null;
  let watchBusy = false;
  function watchStatus(){
    const stamp=value=>value?new Date(value).toLocaleString('hu-HU'):'ebben a munkamenetben még nincs igazolva';
    return 'Gmail figyelés konfigurálva · csak megnyitott oldalon, érvényes Gmail-belépéssel · tervezett ellenőrzés kb. percenként. Utolsó sikeres Gmail-ellenőrzés: '+stamp(lastGmailCheck)+'. Utolsó sikeres Pushover-küldés (API-visszaigazolás): '+stamp(lastPushoverSend)+'. A telefonos kézbesítés külön ellenőrizendő.';
  }

  const say = message => { status.textContent = message; };
  function readIds() {
    try { return new Set(JSON.parse(localStorage.getItem(READ_STORAGE_KEY) || '[]')); }
    catch { return new Set(); }
  }
  function markRead(id) {
    const ids = readIds();
    ids.add(id);
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...ids].slice(-500)));
  }
  function isLocallyRead(id) { return readIds().has(id); }
  function pushoverNotifiedIds() {
    try { return new Set(JSON.parse(localStorage.getItem(PUSHOVER_WATCH_STORAGE_KEY) || '[]')); }
    catch { return new Set(); }
  }
  function savePushoverNotifiedIds(ids) {
    localStorage.setItem(PUSHOVER_WATCH_STORAGE_KEY, JSON.stringify([...ids].slice(-1000)));
  }
  function ensurePushoverWatchStatus() {
    let el = document.getElementById('gmail_pushover_watch_status');
    if (el) return el;
    el = document.createElement('p');
    el.id = 'gmail_pushover_watch_status';
    el.className = 'muted';
    el.setAttribute('role','status');
    el.setAttribute('aria-live','polite');
    status.insertAdjacentElement('afterend', el);
    return el;
  }
  function pushoverWatchSay(message, ok=true) {
    const el = ensurePushoverWatchStatus();
    el.className = ok ? 'ok' : 'warning';
    el.textContent = message;
  }
  async function sendPushoverForMessage(message) {
    if (!currentToken) throw Error('A Gmail-hozzáférés lejárt; jelentkezz be újra a figyelés folytatásához.');
    const response = await fetch('/api/pushover-gmail', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({event:'gmail-new-message',messageId:message.id})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      const errors = {
        GMAIL_AUTH_REQUIRED: 'A Gmail-hozzáférés lejárt; jelentkezz be újra.',
        WRONG_GMAIL_ACCOUNT: 'Nem a Sárberki teszt Gmail-fiók van megnyitva.',
        MESSAGE_NOT_IN_INBOX: 'Az új üzenet már nincs az Inboxban.',
        MISSING_CONFIGURATION: 'A Pushover nincs teljesen beállítva a Netlify tesztkörnyezetben.',
        PUSHOVER_REJECTED: 'A Pushover elutasította az értesítést.',
        PUSHOVER_UNAVAILABLE: 'A Pushover átmenetileg nem érhető el.'
      };
      throw Error(errors[data.code] || 'Az új Gmail-levél Pushover értesítése sikertelen.');
    }
  }
  async function pollPushoverWatch() {
    if (!currentToken || watchBusy) return;
    watchBusy = true;
    try {
      const freshMessages = await readWithToken(currentToken);
      lastGmailCheck = new Date().toISOString();
      const notified = pushoverNotifiedIds();
      const newMessages = freshMessages
        .filter(message => !notified.has(message.id))
        .sort((a,b) => Number(a.internalDate) - Number(b.internalDate));
      for (const message of newMessages) {
        await sendPushoverForMessage(message);
        lastPushoverSend = new Date().toISOString();
        notified.add(message.id);
        savePushoverNotifiedIds(notified);
      }
      currentMessages = freshMessages;
      renderPicker(currentMessages);
      pushoverWatchSay(watchStatus());
    } catch (error) {
      pushoverWatchSay(watchStatus()+' Hiba: '+(error.message || 'A Pushover Gmail-figyelés hibát jelzett.'), false);
    } finally { watchBusy = false; }
  }
  function startPushoverWatch(messages) {
    const notified = pushoverNotifiedIds();
    for (const message of messages) notified.add(message.id);
    savePushoverNotifiedIds(notified);
    if (pushoverWatchTimer) clearInterval(pushoverWatchTimer);
    pushoverWatchTimer = setInterval(pollPushoverWatch, PUSHOVER_WATCH_INTERVAL_MS);
    lastGmailCheck = new Date().toISOString();
    pushoverWatchSay(watchStatus());
  }
  function messageLabel(message) {
    const headers = headerMap(message);
    const when = new Date(Number(message.internalDate));
    const stamp = Number.isFinite(when.getTime()) ? when.toLocaleString('hu-HU') : '';
    return `${isLocallyRead(message.id) ? '✓ OLVASOTT' : '● ÚJ'} — ${headers.subject || '(nincs tárgy)'}${stamp ? ` — ${stamp}` : ''}`;
  }
  function ensurePicker() {
    let wrap = document.getElementById('gmail_message_picker_wrap');
    if (wrap) return wrap;
    wrap = document.createElement('div');
    wrap.id = 'gmail_message_picker_wrap';
    wrap.style.marginTop = '12px';
    wrap.innerHTML = `
      <label for="gmail_message_picker" style="display:block;font-weight:700;margin-bottom:6px">Beérkezett érdeklődések</label>
      <select id="gmail_message_picker" style="width:100%;max-width:760px;padding:10px"></select>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        <button type="button" id="gmail_open_selected">Kiválasztott megnyitása</button>
        <button type="button" id="gmail_open_next_unread">Következő olvasatlan</button>
      </div>`;
    status.insertAdjacentElement('afterend', wrap);
    wrap.querySelector('#gmail_open_selected').addEventListener('click', () => openSelected(false));
    wrap.querySelector('#gmail_open_next_unread').addEventListener('click', () => openSelected(true));
    wrap.querySelector('#gmail_message_picker').addEventListener('change', () => openSelected(false));
    return wrap;
  }
  function renderPicker(messages) {
    const wrap = ensurePicker();
    const select = wrap.querySelector('#gmail_message_picker');
    const previous = select.value;
    select.innerHTML = '';
    messages.forEach(message => {
      const option = document.createElement('option');
      option.value = message.id;
      option.textContent = messageLabel(message);
      select.appendChild(option);
    });
    if (messages.some(m => m.id === previous)) select.value = previous;
    else {
      const nextUnread = messages.find(m => !isLocallyRead(m.id));
      if (nextUnread) select.value = nextUnread.id;
    }
  }
  function unreadCount(messages=currentMessages) {
    return messages.filter(m => !isLocallyRead(m.id)).length;
  }
  async function displayMessage(message) {
    const record = transform(message);
    if (apiMessages.has(message)) apiRecords.set(record, apiMessages.get(message));
    try{if(await displayGmailRecord(record)===false){say('A levél központi feldolgozása nem sikerült; nem jelöltük helyileg olvasottnak.');return false;}}catch(error){say('A levél feldolgozása sikertelen: '+error.message);return false;}
    markRead(message.id);
    renderPicker(currentMessages);
    const left = unreadCount();
    say(left
      ? `Beolvasva. Még ${left} olvasatlan érdeklődés van. Bármelyik korábban olvasott levél újra megnyitható a listából.`
      : 'Beolvasva. Nincs több olvasatlan érdeklődés; a listából bármelyik korábbi levél újra megnyitható.');
  }
  async function openSelected(nextUnreadOnly=false) {
    if (!currentMessages.length) { say('Előbb töltse be a Gmail-leveleket.'); return; }
    let message;
    if (nextUnreadOnly) message = currentMessages.find(m => !isLocallyRead(m.id));
    else {
      const id = document.getElementById('gmail_message_picker')?.value;
      message = currentMessages.find(m => m.id === id);
    }
    if (!message) {
      say(nextUnreadOnly ? 'Nincs több olvasatlan érdeklődés.' : 'Nem található a kiválasztott levél.');
      return;
    }
    await displayMessage(message);
  }
  const cabinFromGuestText = cabinFromText;

  function transform(message) {
    const headers = headerMap(message);
    const rawOriginal = readableBody(message.payload).trim();
    const original = activeMessageText(rawOriginal);
    if (!original) throw Error('A levélnek nincs olvasható szöveges része; emberi ellenőrzés szükséges.');
    const received = new Date(Number(message.internalDate));
    const normalizedDate = dateRangeFromText(original, new Date(), BUSINESS.timezone);
    const {guests:count,adults:adultCount,children:childCount} = partyCountsFromText(original);
    const childAges = childAgesFromText(original);
    const phone = phoneFromText(original);
    const name = original.match(/(?:^|\n)\s*(?:üdv\.?|üdvözlettel|tisztelettel)\s*[:.,-]*\s*([A-ZÁÉÍÓÖŐÚÜŰ][\p{L}-]+\s+[A-ZÁÉÍÓÖŐÚÜŰ][\p{L}-]+)\s*$/imu)?.[1] || original.match(/(?:^|\n)\s*([A-ZÁÉÍÓÖŐÚÜŰ][\p{L}-]+\s+[A-ZÁÉÍÓÖŐÚÜŰ][\p{L}-]+)\s*$/mu)?.[1];
    const flags = requestFlagsFromText(original);
    const hotTub = flags.hotTubRequested, dog = flags.petRequested, pier = pierPreferenceFromText(original), availability = /(?:szabad\s+hely|availab|verfügbar|prosto|razpolož)/iu.test(original);
    const specialRequests = specialRequestsFromText(original);
    const requestedUnits = requestedUnitsFromText(original);
    const splitRequest = splitRequestFromText(original);
    const cabin = cabinFromGuestText(original);
    const extracted = [];
    if (specialRequests.length) extracted.push({label:'Külön kérés',value:specialRequests.join('; '),evidence:'levélszöveg'});
    if (name) extracted.push({label:'Vendég neve',value:name,evidence:'aláírás'});
    if (count) extracted.push({label:'Létszám',value:`${count} fő${childCount ? `, ebből ${childCount} gyermek` : ''}`,evidence:original.match(/[^\n.]*?(?:fő|négyen|hárman|ketten|öten|hatan)[^\n.]*/iu)?.[0]?.trim() || 'levélszöveg'});
    if (childAges.length) extracted.push({label:'Gyermekkorok',value:childAges.join(', ')+' éves',evidence:'levélszöveg'});
    if (phone) extracted.push({label:'Kapcsolat / telefon',value:phone,evidence:'levélszöveg'});
    if (hotTub || dog || pier) extracted.push({label:'Igények',value:[hotTub?'dézsa / hot tub':null,dog?'kutya / dog':null,pier?'saját / külön stég':null].filter(Boolean).join(', '),evidence:'levélszöveg'});
    if (availability) extracted.push({label:'Kérdés',value:'szabad kapacitás',evidence:'levélszöveg'});
    const inferred = [];
    if (adultCount!=null) extracted.push({label:'Felnőttek',value:`${adultCount} fő`,evidence:'levélszöveg'});
    else if (count && childCount) inferred.push({label:'Felnőttek',value:`valószínűleg ${count-childCount}, ha a fennmaradó ${count-childCount} fő felnőtt`});
    const missing = [];
    const cabinMissing = cabin.startsWith('?');
    const mustClarifyCabin = cabinMissing && cabinClarificationRequired(original,count);
    const capacityRecommendationReady = Boolean(normalizedDate && count && !mustClarifyCabin);
    if (cabinMissing && !capacityRecommendationReady) {
      missing.push(Number(count)===2
        ? 'Kívánt háztípus (VIP, Családi, Deluxe, Osztott vagy Különálló 2 fős) – pontosítandó'
        : 'Kívánt háztípus (VIP, Családi, Deluxe vagy Osztott) – pontosítandó');
    }
    if (normalizedDate) extracted.push({label:normalizedDate.inferredYear ? 'Időszak, következtetett évvel' : 'Időszak',value:`${normalizedDate.arrival} – ${normalizedDate.departure}`,evidence:'levélszöveg'});
    if (!normalizedDate) missing.push('Pontos érkezési és távozási dátum');
    if (normalizedDate?.inferredYear && !inferred.some(x => x.label === 'Év')) inferred.push({label:'Év',value:`${normalizedDate.arrival.slice(0,4)}, a feldolgozás napja alapján következtetve; emberi ellenőrzés szükséges`});
    if (!count) missing.push('Vendégek száma');
    if (adultCount==null) missing.push('Felnőttek száma');
    if (childCount==null && adultCount==null) missing.push('Érkezik-e gyermek; ha igen, hányan és milyen életkorúak');
    if (childCount && childAges.length < childCount) missing.push('Gyermek életkora');
    if (!phone) missing.push('Telefonszám');
    const reviewYear = normalizedDate?.inferredYear ? Number(normalizedDate.arrival.slice(0,4)) : null;
    const humanReview = [];
    if (reviewYear) humanReview.push(`A ${reviewYear}-os év következtetését hagyja jóvá a kezelő`);
    if (cabinMissing && !capacityRecommendationReady) humanReview.push(mustClarifyCabin
      ? 'A 2 vagy 4 fős igény önmagában nem határozza meg a háztípust; vissza kell kérdezni.'
      : 'A vendég háztípust nem választott; a választást pontosítani kell');
    if (count && adultCount!=null && childCount!=null && adultCount+childCount!==count) humanReview.push(`Ellentmondó létszámadat: összesen ${count} fő, de ${adultCount} felnőtt + ${childCount} gyermek = ${adultCount+childCount} fő`);
    const priceQuestion=/(?:mennyi|mennyibe|ár|ára|árat|price|cost|kosten|preis|cena)/iu.test(original);
    if (availability || priceQuestion) humanReview.push('A szabad kapacitás és/vagy ár hiteles ellenőrzése szükséges');
    const language = languageFromText(original);
    const fishingInfo = fishingQuestion(original,language);
    const replyDraft = buildReplyDraft({language,name,original,arrival:normalizedDate?.arrival,departure:normalizedDate?.departure,guests:count,adults:adultCount,children:childCount,childAges,phone,cabin,pier,hotTub,dog,intent:'booking_request',brandName:BUSINESS.brandName,bookingRules:BUSINESS.bookingRules,operationalRules:BUSINESS.operationalRules,pricingRules:BUSINESS.pricingRules,knowledgeLines:fishingInfo?[fishingInfo.answer]:[]});
    return {source:{provider:'gmail',message_id:message.id,thread_id:message.threadId,rfc_message_id:headers['message-id']||null,in_reply_to:headers['in-reply-to']||null,references:(headers.references||'').match(/<[^>]+>/g)||[],subject:headers.subject || '',from:headers.from || '',from_email:emailAddress(headers.from || ''),to:headers.to || '',received_at:received.toISOString()},original_message:rawOriginal,normalized:{language,cabin,dates:normalizedDate,guests:count,adults:adultCount,children:childCount,child_ages:childAges,phone,nights:normalizedDate?(Date.parse(normalizedDate.departure)-Date.parse(normalizedDate.arrival))/86400000:null,special_requests:specialRequests,fishing_question:Boolean(fishingInfo),parking_question:/(?:parkol|parking|parkplatz|parkplätze|parkiriš|parkiris)/iu.test(original),units_requested:requestedUnits.count||null,units_open:requestedUnits.open,split_request:splitRequest,pier_requested:pier,hot_tub_requested:hotTub,pet_requested:dog},extracted,inferred,missing,human_review:humanReview,reply_draft:replyDraft};
  }
  async function readWithToken(token){
    return rememberApiRead(await readTestGmailInbox(token,{fetchImpl:fetch,search:window.location?.search||'',setTimeoutImpl:setTimeout,clearTimeoutImpl:clearTimeout}));
  }
  button.addEventListener('click', () => {
    if (!clientId) { say('A Google OAuth kliensazonosító még nincs beállítva ehhez a webhelyhez.'); return; }
    if (!window.google?.accounts?.oauth2) { say('A Google belépési szolgáltatása még nem töltődött be. Próbálja újra.'); return; }
    button.disabled = true;
    say('Google-olvasási engedély kérése…');
    const client = google.accounts.oauth2.initTokenClient({client_id:clientId,scope:SCOPE,hint:TEST_GMAIL_ACCOUNT,include_granted_scopes:false,callback:async result => {
      try {
        if (!result.access_token) throw Error(result.error || 'A hozzáférés nem jött létre.');
        say('A levelek betöltése…');
        currentToken = result.access_token;
        currentMessages = await readWithToken(currentToken);
        renderPicker(currentMessages);
        // V1: Gmail-olvasás nem indíthat automatikus Pushover-küldést. A figyelés külön engedélyt igényel.
        const nextUnread = currentMessages.find(message => !isLocallyRead(message.id));
        if (nextUnread) {
          await displayMessage(nextUnread);
        } else {
          say(`Összesen ${currentMessages.length} érdeklődés található, és mindegyik már be lett olvasva. A listából bármelyik újra megnyitható.`);
        }
      } catch (error) { say(error.message); } finally { button.disabled = false; }
    },error_callback:error => { say(`A Google-belépés megszakadt: ${error.type || 'ismeretlen hiba'}`); button.disabled=false; }});
    client.requestAccessToken({prompt:'consent'});
  });
  window.sarberkiGmailTransform = transform; // Local test harness only; no token exposure.
})();
