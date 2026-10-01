/* Browser-only Gmail bridge. Access token stays in memory and is never stored. */
(async () => {
  'use strict';
  const { cabinFromText, guestCountFromText, childCountFromText, dateRangeFromText, phoneFromText, childAgesFromText, pierPreferenceFromText, languageFromText, buildReplyDraft } = await import('./sarberki-core.mjs');
  const { BUSINESS } = await import('./business-config.mjs');
  const { fishingQuestion } = await import('./fishing-rules.mjs');
  const { isApprovedSubject } = await import('./gmail-subject.mjs');
  // V1 live-read mode: broad inbox read, then conservative local inquiry classification.
  // No sender restriction, no exact subject allowlist, no send/modify permission.
  const INBOX_QUERY = 'in:inbox newer_than:30d -category:promotions -category:social';

  function headerMap(message) {
    return Object.fromEntries((message.payload?.headers || []).map(h => [h.name.toLowerCase(), h.value]));
  }
  function emailAddress(value='') {
    return value.match(/<([^<>]+)>\s*$/u)?.[1] || value.trim();
  }
  function looksLikeInquiry(message) {
    const headers = headerMap(message);
    return message.labelIds?.includes('INBOX')
      && Number.isFinite(Number(message.internalDate))
      && Number(message.internalDate) > 0
      && isApprovedSubject(headers.subject);
  }
  const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
  const button = document.getElementById('read_gmail');
  const status = document.getElementById('gmail_auth_status');
  const clientId = document.querySelector('meta[name="google-oauth-client-id"]')?.content?.trim();
  const READ_STORAGE_KEY = 'sarberki.gmail.read-message-ids.v1';
  let currentToken = null;
  let currentMessages = [];

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
  function plain(part) {
    if (part.mimeType === 'text/plain' && part.body?.data) return decoded(part.body.data);
    for (const child of part.parts || []) { const value = plain(child); if (value) return value; }
    return '';  }
  const cabinFromGuestText = cabinFromText;

  function transform(message) {
    const headers = headerMap(message);
    const original = plain(message.payload).trim();
    if (!original) throw Error('A levélnek nincs olvasható szöveges része; emberi ellenőrzés szükséges.');
    const received = new Date(Number(message.internalDate));
    const normalizedDate = dateRangeFromText(original, new Date(), BUSINESS.timezone);
    const count = guestCountFromText(original) || ({ketten:2,hárman:3,négyen:4,öten:5,hatan:6}[original.match(/\b(ketten|hárman|négyen|öten|hatan)\b/iu)?.[1]?.toLowerCase()] || null);
    const childCount = childCountFromText(original);
    const childAges = childAgesFromText(original);
    const phone = phoneFromText(original);
    const name = original.match(/(?:^|\n)\s*([A-ZÁÉÍÓÖŐÚÜŰ][\p{L}-]+\s+[A-ZÁÉÍÓÖŐÚÜŰ][\p{L}-]+)\s*$/mu)?.[1];
    const hotTub = /(?:dézs|hot\s*tub|whirlpool|badefass|vroč\w*\s*kad|masaž\w*\s*kad)/iu.test(original), dog = /(?:kuty|dog|hund|pes|psa)/iu.test(original), pier = pierPreferenceFromText(original), availability = /(?:szabad\s+hely|availab|verfügbar|prosto|razpolož)/iu.test(original);
    const extracted = [];
    if (name) extracted.push({label:'Vendég neve',value:name,evidence:'aláírás'});
    if (count) extracted.push({label:'Létszám',value:`${count} fő${childCount ? `, ebből ${childCount} gyermek` : ''}`,evidence:original.match(/[^\n.]*?(?:fő|négyen|hárman|ketten|öten|hatan)[^\n.]*/iu)?.[0]?.trim() || 'levélszöveg'});
    if (childAges.length) extracted.push({label:'Gyermekkorok',value:childAges.join(', ')+' éves',evidence:'levélszöveg'});
    if (phone) extracted.push({label:'Kapcsolat / telefon',value:phone,evidence:'levélszöveg'});
    if (hotTub || dog || pier) extracted.push({label:'Igények',value:[hotTub?'dézsa / hot tub':null,dog?'kutya / dog':null,pier?'saját / külön stég':null].filter(Boolean).join(', '),evidence:'levélszöveg'});
    if (availability) extracted.push({label:'Kérdés',value:'szabad kapacitás',evidence:'levélszöveg'});
    const inferred = [];
    if (count && childCount) inferred.push({label:'Felnőttek',value:`valószínűleg ${count-childCount}, ha a fennmaradó ${count-childCount} fő felnőtt`});
    const missing = [];
    if (cabinFromGuestText(original).startsWith('?')) missing.push('Kívánt háztípus (VIP, Családi, Deluxe vagy Osztott) – pontosítandó');
    if (normalizedDate) extracted.push({label:normalizedDate.inferredYear ? 'Időszak, következtetett évvel' : 'Időszak',value:`${normalizedDate.arrival} – ${normalizedDate.departure}`,evidence:'levélszöveg'});
    if (!normalizedDate) missing.push('Pontos érkezési és távozási dátum');
    if (normalizedDate?.inferredYear && !inferred.some(x => x.label === 'Év')) inferred.push({label:'Év',value:`${normalizedDate.arrival.slice(0,4)}, a feldolgozás napja alapján következtetve; emberi ellenőrzés szükséges`});
    if (!count) missing.push('Vendégek száma');
    if (childCount && !/\d+\s*(?:éves|years? old|jahre alt|let)/iu.test(original)) missing.push('Gyermek életkora');
    if (!phone) missing.push('Telefonszám');
    missing.push('Kapacitás és ár csak külön, hiteles ellenőrzéssel állapítható meg');
    const reviewYear = normalizedDate?.inferredYear ? Number(normalizedDate.arrival.slice(0,4)) : null;
    const humanReview = [reviewYear ? `A ${reviewYear}-os év következtetését hagyja jóvá a kezelő` : 'A dátumot ellenőrizni kell'];
    if (cabinFromGuestText(original).startsWith('?')) humanReview.push('A vendég háztípust nem választott; létszámból nem szabad kiválasztani');
    humanReview.push('Szabad hely és ár nincs igazolva');
    const language = languageFromText(original);
    const fishingInfo = fishingQuestion(original,language);
    const replyDraft = buildReplyDraft({language,name,original,arrival:normalizedDate?.arrival,departure:normalizedDate?.departure,guests:count,children:childCount,childAges,phone,cabin:cabinFromGuestText(original),pier,hotTub,dog,intent:'booking_request',brandName:BUSINESS.brandName,bookingRules:BUSINESS.bookingRules,operationalRules:BUSINESS.operationalRules,knowledgeLines:fishingInfo?[fishingInfo.answer]:[]});
    return {source:{provider:'gmail',message_id:message.id,thread_id:message.threadId,subject:headers.subject || '',from:headers.from || '',from_email:emailAddress(headers.from || ''),to:headers.to || '',received_at:received.toISOString()},original_message:original,normalized:{language,cabin:cabinFromGuestText(original),dates:normalizedDate,guests:count,children:childCount,child_ages:childAges,phone,hot_tub:hotTub,dog,pier_requested:pier,hot_tub_requested:hotTub,pet_requested:dog},extracted,inferred,missing,human_review:humanReview,reply_draft:replyDraft};
  }
  async function readWithToken(token) {
    const headers = {Authorization:`Bearer ${token}`};
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
    const matching = messages.filter(looksLikeInquiry);
    if (!matching.length) throw Error('Az elmúlt 30 nap beérkező levelei között nem találtunk egyértelmű szállás-/foglalási érdeklődést.');
    matching.sort((a, b) => Number(b.internalDate) - Number(a.internalDate) || b.id.localeCompare(a.id));
    return matching;
  }
  button.addEventListener('click', () => {
    if (!clientId) { say('A Google OAuth kliensazonosító még nincs beállítva ehhez a webhelyhez.'); return; }
    if (!window.google?.accounts?.oauth2) { say('A Google belépési szolgáltatása még nem töltődött be. Próbálja újra.'); return; }
    button.disabled = true;
    say('Google-olvasási engedély kérése…');
    const client = google.accounts.oauth2.initTokenClient({client_id:clientId,scope:SCOPE,callback:async result => {
      try {
        if (!result.access_token) throw Error(result.error || 'A hozzáférés nem jött létre.');
        say('A levelek betöltése…');
        currentToken = result.access_token;
        currentMessages = await readWithToken(currentToken);
        renderPicker(currentMessages);
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
