/* Browser-only Gmail bridge. Access token stays in memory and is never stored. */
(async () => {
  'use strict';
  const { cabinFromText, guestCountFromText, childCountFromText, dateRangeFromText, languageFromText, replyQuestions } = await import('./gmail-normalize.mjs');
  // V1 live-read mode: broad inbox read, then conservative local inquiry classification.
  // No sender restriction, no exact subject allowlist, no send/modify permission.
  const INBOX_QUERY = 'in:inbox newer_than:30d -category:promotions -category:social';
  const ALLOWED_SUBJECTS = new Set(['érdeklődés a szállásról', 'érdeklődés a szallasrol', 'érdeklődés szállásról']);
  function headerMap(message) {
    return Object.fromEntries((message.payload?.headers || []).map(h => [h.name.toLowerCase(), h.value]));
  }
  function emailAddress(value='') {
    return value.match(/<([^<>]+)>\s*$/u)?.[1] || value.trim();
  }
  function looksLikeInquiry(message) {
    const headers = headerMap(message);
    const subject = (headers.subject || '').trim().toLocaleLowerCase('hu-HU');
    return message.labelIds?.includes('INBOX')
      && Number.isFinite(Number(message.internalDate))
      && Number(message.internalDate) > 0
      && ALLOWED_SUBJECTS.has(subject);
  }
  const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
  const button = document.getElementById('read_gmail');
  const status = document.getElementById('gmail_auth_status');
  const clientId = document.querySelector('meta[name="google-oauth-client-id"]')?.content?.trim();
  const say = message => { status.textContent = message; };
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
    const normalizedDate = dateRangeFromText(original);
    const count = guestCountFromText(original) || ({ketten:2,hárman:3,négyen:4,öten:5,hatan:6}[original.match(/\b(ketten|hárman|négyen|öten|hatan)\b/iu)?.[1]?.toLowerCase()] || null);
    const childCount = childCountFromText(original);
    const name = original.match(/(?:^|\n)\s*([A-ZÁÉÍÓÖŐÚÜŰ][\p{L}-]+\s+[A-ZÁÉÍÓÖŐÚÜŰ][\p{L}-]+)\s*$/mu)?.[1];
    const hotTub = /(?:dézs|hot\s*tub|whirlpool|badefass|vroč\w*\s*kad|masaž\w*\s*kad)/iu.test(original), dog = /(?:kuty|dog|hund|pes|psa)/iu.test(original), availability = /(?:szabad\s+hely|availab|verfügbar|prosto|razpolož)/iu.test(original);
    const extracted = [];
    if (name) extracted.push({label:'Vendég neve',value:name,evidence:'aláírás'});
    if (count) extracted.push({label:'Létszám',value:`${count} fő${childCount ? `, ebből ${childCount} gyermek` : ''}`,evidence:original.match(/[^\n.]*?(?:fő|négyen|hárman|ketten|öten|hatan)[^\n.]*/iu)?.[0]?.trim() || 'levélszöveg'});
    if (hotTub || dog) extracted.push({label:'Igények',value:[hotTub?'dézsa / hot tub':null,dog?'kutya / dog':null].filter(Boolean).join(', '),evidence:'levélszöveg'});
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
    if (!/\+?\d[\d\s/-]{7,}/u.test(original)) missing.push('Telefonszám');
    missing.push('Kapacitás és ár csak külön, hiteles ellenőrzéssel állapítható meg');
    const reviewYear = normalizedDate?.inferredYear ? Number(normalizedDate.arrival.slice(0,4)) : null;
    const humanReview = [reviewYear ? `A ${reviewYear}-os év következtetését hagyja jóvá a kezelő` : 'A dátumot ellenőrizni kell'];
    if (cabinFromGuestText(original).startsWith('?')) humanReview.push('A vendég háztípust nem választott; létszámból nem szabad kiválasztani');
    humanReview.push('Szabad hely és ár nincs igazolva');
    const language = languageFromText(original);
    const first = name?.split(' ')[1] || null;
    const time = normalizedDate ? `${normalizedDate.arrival} és ${normalizedDate.departure} között` : 'a jelzett időpontban';
    const summary = [count ? `összesen ${count} fővel${childCount ? `, köztük ${childCount} gyermekkel` : ''}` : null,hotTub?'dézsás faházat keresnek':null,dog?'kutyát is hoznának':null].filter(Boolean).join('; ');
    const questions = replyQuestions(language,{needPhone:!/\\+?\\d[\\d\\s/-]{7,}/u.test(original),needCabin:cabinFromGuestText(original).startsWith('?'),needChildAge:Boolean(childCount && !/\\d+\\s*(?:éves|years? old|jahre alt|let)/iu.test(original))});
    const greetings={hu:first?`Kedves ${first}!`:'Kedves Vendégünk!',de:first?`Guten Tag ${first}!`:'Guten Tag!',en:first?`Dear ${first},`:'Dear Guest,',si:first?`Pozdravljeni ${first}!`:'Pozdravljeni!'};
    const intros={hu:'Köszönjük érdeklődését.',de:'Vielen Dank für Ihre Anfrage.',en:'Thank you for your inquiry.',si:'Hvala za vaše povpraševanje.'};
    const checks={hu:'A szabad kapacitást és az árat külön ellenőriznünk kell; ezekről egyelőre nem tudunk biztos tájékoztatást adni.',de:'Verfügbarkeit und Preis müssen wir separat prüfen; dazu können wir derzeit noch keine verbindliche Auskunft geben.',en:'We need to check availability and price separately; we cannot confirm either yet.',si:'Razpoložljivost in ceno moramo preveriti posebej; trenutno ju še ne moremo potrditi.'};
    const closings={hu:'Üdvözlettel:',de:'Mit freundlichen Grüßen',en:'Kind regards,',si:'Lep pozdrav,'};
    const lang = language==='unknown' ? 'hu' : language;
    const replyDraft = `${greetings[lang]}\n\n${intros[lang]}\n\n${questions.join(' ')}${questions.length?'\n\n':''}${checks[lang]}\n\n${closings[lang]}\nSárberki Horgásztó`;
    return {source:{provider:'gmail',message_id:message.id,thread_id:message.threadId,subject:headers.subject || '',from:headers.from || '',from_email:emailAddress(headers.from || ''),to:headers.to || '',received_at:received.toISOString()},original_message:original,normalized:{language,cabin:cabinFromGuestText(original),dates:normalizedDate,guests:count,children:childCount,hot_tub:hotTub,dog},extracted,inferred,missing,human_review:humanReview,reply_draft:replyDraft};
  }
  async function readWithToken(token) {
    const headers = {Authorization:`Bearer ${token}`};
    // Gmail's list response contains IDs only; inspect every page before comparing internalDate.
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
    return transform(matching[0]);
  }
  button.addEventListener('click', () => {
    if (!clientId) { say('A Google OAuth kliensazonosító még nincs beállítva ehhez a webhelyhez.'); return; }
    if (!window.google?.accounts?.oauth2) { say('A Google belépési szolgáltatása még nem töltődött be. Próbálja újra.'); return; }
    button.disabled = true;
    say('Google-olvasási engedély kérése…');
    const client = google.accounts.oauth2.initTokenClient({client_id:clientId,scope:SCOPE,callback:async result => {
      try {
        if (!result.access_token) throw Error(result.error || 'A hozzáférés nem jött létre.');
        say('A levél beolvasása és feldolgozása…');
        const record = await readWithToken(result.access_token);
        displayGmailRecord(record);
        say('A legfrissebb felismert érdeklődés bekerült a kezelőfelületre; küldés vagy foglalásmódosítás nem történt.');
      } catch (error) { say(error.message); } finally { button.disabled = false; }
    },error_callback:error => { say(`A Google-belépés megszakadt: ${error.type || 'ismeretlen hiba'}`); button.disabled=false; }});
    client.requestAccessToken({prompt:'consent'});
  });
  window.sarberkiGmailTransform = transform; // Local test harness only; no token exposure.
})();
