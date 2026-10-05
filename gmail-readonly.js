/* Browser-only Gmail bridge. Access token stays in memory and is never stored. */
(async () => {
  'use strict';
  const { cabinFromText, guestCountFromText, adultCountFromText, childCountFromText, dateRangeFromText, phoneFromText, childAgesFromText, pierPreferenceFromText, languageFromText, buildReplyDraft, specialRequestsFromText, requestedUnitsFromText, activeMessageText, requestFlagsFromText } = await import('./sarberki-core.mjs?v=20261005-theme1');
  const { BUSINESS } = await import('./business-config.mjs?v=20261005-stress1');
  const { fishingQuestion } = await import('./fishing-rules.mjs?v=20261005-stress1');
  const { INBOX_QUERY, TEST_GMAIL_ACCOUNT, assertTestGmailAccount, isTestInquiry } = await import('./gmail-policy.mjs');

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
  let pushoverWatchTimer = null;

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
    if (!currentToken) return;
    try {
      const freshMessages = await readWithToken(currentToken);
      const notified = pushoverNotifiedIds();
      const newMessages = freshMessages
        .filter(message => !notified.has(message.id))
        .sort((a,b) => Number(a.internalDate) - Number(b.internalDate));
      for (const message of newMessages) {
        await sendPushoverForMessage(message);
        notified.add(message.id);
        savePushoverNotifiedIds(notified);
      }
      currentMessages = freshMessages;
      renderPicker(currentMessages);
      pushoverWatchSay(newMessages.length
        ? `Pushover figyelés aktív · ${newMessages.length} új Inbox-levélről értesítés elküldve.`
        : 'Pushover figyelés aktív · minden új Inbox-levél · ellenőrzés kb. percenként.');
    } catch (error) {
      pushoverWatchSay(error.message || 'A Pushover Gmail-figyelés hibát jelzett.', false);
    }
  }
  function startPushoverWatch(messages) {
    const notified = pushoverNotifiedIds();
    for (const message of messages) notified.add(message.id);
    savePushoverNotifiedIds(notified);
    if (pushoverWatchTimer) clearInterval(pushoverWatchTimer);
    pushoverWatchTimer = setInterval(pollPushoverWatch, PUSHOVER_WATCH_INTERVAL_MS);
    pushoverWatchSay('Pushover figyelés aktív · minden új Inbox-levél · ellenőrzés kb. percenként.');
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
  function displayMessage(message) {
    const record = transform(message);
    displayGmailRecord(record);
    markRead(message.id);
    renderPicker(currentMessages);
    const left = unreadCount();
    say(left
      ? `Beolvasva. Még ${left} olvasatlan érdeklődés van. Bármelyik korábban olvasott levél újra megnyitható a listából.`
      : 'Beolvasva. Nincs több olvasatlan érdeklődés; a listából bármelyik korábbi levél újra megnyitható.');
  }
  function openSelected(nextUnreadOnly=false) {
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
    displayMessage(message);
  }
  function decoded(data) {
    if (!data) return '';
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), ch => ch.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  }
  function plainText(part) {
    if (part?.mimeType === 'text/plain' && part.body?.data) return decoded(part.body.data);
    for (const child of part?.parts || []) { const value = plainText(child); if (value) return value; }
    return '';
  }
  function htmlToText(html='') {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return (doc.body?.textContent || '')
      .replace(/\u00a0/gu, ' ')
      .replace(/[ \t]+\n/gu, '\n')
      .replace(/\n{3,}/gu, '\n\n')
      .trim();
  }
  function htmlText(part) {
    if (part?.mimeType === 'text/html' && part.body?.data) return htmlToText(decoded(part.body.data));
    for (const child of part?.parts || []) { const value = htmlText(child); if (value) return value; }
    return '';
  }
  function readableBody(part) {
    return plainText(part) || htmlText(part);
  }
  const cabinFromGuestText = cabinFromText;

  function transform(message) {
    const headers = headerMap(message);
    const rawOriginal = readableBody(message.payload).trim();
    const original = activeMessageText(rawOriginal);
    if (!original) throw Error('A levélnek nincs olvasható szöveges része; emberi ellenőrzés szükséges.');
    const received = new Date(Number(message.internalDate));
    const normalizedDate = dateRangeFromText(original, new Date(), BUSINESS.timezone);
    const count = guestCountFromText(original) || ({ketten:2,hárman:3,négyen:4,öten:5,hatan:6}[original.match(/\b(ketten|hárman|négyen|öten|hatan)\b/iu)?.[1]?.toLowerCase()] || null);
    const adultCount = adultCountFromText(original);
    const childCount = childCountFromText(original);
    const childAges = childAgesFromText(original);
    const phone = phoneFromText(original);
    const name = original.match(/(?:^|\n)\s*(?:üdv\.?|üdvözlettel|tisztelettel)\s*[:.,-]*\s*([A-ZÁÉÍÓÖŐÚÜŰ][\p{L}-]+\s+[A-ZÁÉÍÓÖŐÚÜŰ][\p{L}-]+)\s*$/imu)?.[1] || original.match(/(?:^|\n)\s*([A-ZÁÉÍÓÖŐÚÜŰ][\p{L}-]+\s+[A-ZÁÉÍÓÖŐÚÜŰ][\p{L}-]+)\s*$/mu)?.[1];
    const flags = requestFlagsFromText(original);
    const hotTub = flags.hotTubRequested, dog = flags.petRequested, pier = pierPreferenceFromText(original), availability = /(?:szabad\s+hely|availab|verfügbar|prosto|razpolož)/iu.test(original);
    const specialRequests = specialRequestsFromText(original);
    const requestedUnits = requestedUnitsFromText(original);
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
    const cabinMissing = cabinFromGuestText(original).startsWith('?');
    const capacityRecommendationReady = Boolean(normalizedDate && count);
    if (cabinMissing && !capacityRecommendationReady) missing.push('Kívánt háztípus (VIP, Családi, Deluxe vagy Osztott) – pontosítandó');
    if (normalizedDate) extracted.push({label:normalizedDate.inferredYear ? 'Időszak, következtetett évvel' : 'Időszak',value:`${normalizedDate.arrival} – ${normalizedDate.departure}`,evidence:'levélszöveg'});
    if (!normalizedDate) missing.push('Pontos érkezési és távozási dátum');
    if (normalizedDate?.inferredYear && !inferred.some(x => x.label === 'Év')) inferred.push({label:'Év',value:`${normalizedDate.arrival.slice(0,4)}, a feldolgozás napja alapján következtetve; emberi ellenőrzés szükséges`});
    if (!count) missing.push('Vendégek száma');
    if (adultCount==null) missing.push('Felnőttek száma');
    if (childCount==null) missing.push('Érkezik-e gyermek; ha igen, hányan és milyen életkorúak');
    if (childCount && childAges.length < childCount) missing.push('Gyermek életkora');
    if (!phone) missing.push('Telefonszám');
    const reviewYear = normalizedDate?.inferredYear ? Number(normalizedDate.arrival.slice(0,4)) : null;
    const humanReview = [];
    if (reviewYear) humanReview.push(`A ${reviewYear}-os év következtetését hagyja jóvá a kezelő`);
    if (cabinMissing && !capacityRecommendationReady) humanReview.push('A vendég háztípust nem választott; a választást pontosítani kell');
    if (count && adultCount!=null && childCount!=null && adultCount+childCount!==count) humanReview.push(`Ellentmondó létszámadat: összesen ${count} fő, de ${adultCount} felnőtt + ${childCount} gyermek = ${adultCount+childCount} fő`);
    const priceQuestion=/(?:mennyi|mennyibe|ár|ára|árat|price|cost|kosten|preis|cena)/iu.test(original);
    if (availability || priceQuestion) humanReview.push('A szabad kapacitás és/vagy ár hiteles ellenőrzése szükséges');
    const language = languageFromText(original);
    const fishingInfo = fishingQuestion(original,language);
    const replyDraft = buildReplyDraft({language,name,original,arrival:normalizedDate?.arrival,departure:normalizedDate?.departure,guests:count,adults:adultCount,children:childCount,childAges,phone,cabin:cabinFromGuestText(original),pier,hotTub,dog,intent:'booking_request',brandName:BUSINESS.brandName,bookingRules:BUSINESS.bookingRules,operationalRules:BUSINESS.operationalRules,pricingRules:BUSINESS.pricingRules,knowledgeLines:fishingInfo?[fishingInfo.answer]:[]});
    return {source:{provider:'gmail',message_id:message.id,thread_id:message.threadId,subject:headers.subject || '',from:headers.from || '',from_email:emailAddress(headers.from || ''),to:headers.to || '',received_at:received.toISOString()},original_message:rawOriginal,normalized:{language,cabin:cabinFromGuestText(original),dates:normalizedDate,guests:count,adults:adultCount,children:childCount,child_ages:childAges,phone,nights:normalizedDate?(Date.parse(normalizedDate.departure)-Date.parse(normalizedDate.arrival))/86400000:null,special_requests:specialRequests,fishing_question:Boolean(fishingInfo),parking_question:/(?:parkol|parking|parkplatz|parkplätze|parkiriš|parkiris)/iu.test(original),units_requested:requestedUnits.count||null,units_open:requestedUnits.open,pier_requested:pier,hot_tub_requested:hotTub,pet_requested:dog},extracted,inferred,missing,human_review:humanReview,reply_draft:replyDraft};
  }
  async function readWithToken(token) {
    const headers = {Authorization:`Bearer ${token}`};
    const profileResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {headers,cache:'no-store'});
    if (!profileResponse.ok) throw Error(`A Gmail tesztfiók nem ellenőrizhető (${profileResponse.status}).`);
    assertTestGmailAccount(await profileResponse.json());
    const candidates = [];
    let pageToken;
    do {
      const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
      url.searchParams.set('q', INBOX_QUERY);
      url.searchParams.set('maxResults', '100');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const list = await fetch(url, {headers,cache:'no-store'});
      if (!list.ok) throw Error(`Gmail-keresési hiba (${list.status}). Ellenőrizze a fiókot és a jogosultságot.`);
      const page = await list.json();
      candidates.push(...(page.messages || []));
      pageToken = page.nextPageToken;
    } while (pageToken);
    if (!candidates.length) throw Error('Nem található a tesztfeltételnek megfelelő beérkezett levél.');
    const messages = await Promise.all(candidates.map(async ({id}) => {
      const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`, {headers,cache:'no-store'});
      if (!response.ok) throw Error(`Gmail-olvasási hiba (${response.status}).`);
      return response.json();
    }));
    const matching = messages.filter(isTestInquiry);
    if (!matching.length) throw Error('2026.09.25. után nem található beérkezett Gmail-üzenet a tesztfiók inboxában.');
    matching.sort((a, b) => Number(b.internalDate) - Number(a.internalDate) || b.id.localeCompare(a.id));
    return matching;
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
        startPushoverWatch(currentMessages);
        const nextUnread = currentMessages.find(message => !isLocallyRead(message.id));
        if (nextUnread) {
          displayMessage(nextUnread);
        } else {
          say(`Összesen ${currentMessages.length} érdeklődés található, és mindegyik már be lett olvasva. A listából bármelyik újra megnyitható.`);
        }
      } catch (error) { say(error.message); } finally { button.disabled = false; }
    },error_callback:error => { say(`A Google-belépés megszakadt: ${error.type || 'ismeretlen hiba'}`); button.disabled=false; }});
    client.requestAccessToken({prompt:'consent'});
  });
  window.sarberkiGmailTransform = transform; // Local test harness only; no token exposure.
})();
