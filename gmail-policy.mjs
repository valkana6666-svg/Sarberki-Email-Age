export const TEST_GMAIL_ACCOUNT = 'sarberkiprojecttest@gmail.com';
export const INBOX_QUERY = 'in:inbox after:2026/09/25';
// Gmail after: uses Pacific midnight; repeat that same boundary locally.
const AFTER = Date.parse('2026-09-25T00:00:00-07:00');

export function assertTestGmailAccount(profile) {
  if (profile?.emailAddress?.trim().toLowerCase() !== TEST_GMAIL_ACCOUNT)
    throw Error(`Csak a ${TEST_GMAIL_ACCOUNT} tesztfiók olvasható. Válaszd ezt a Google-fiókot.`);
}

export function isTestInquiry(message) {
  return message?.labelIds?.includes('INBOX') === true
    && Number.isFinite(Number(message.internalDate))
    && Number(message.internalDate) > AFTER;
}

// Optional narrow read for an operator-preidentified synthetic message.
// An invalid/empty/duplicate selector must never fall back to the inbox query.
export function syntheticMessageIdFromSearch(search='') {
  const ids=new URLSearchParams(search).getAll('syntheticGmailMessageId');
  if(!ids.length)return null;
  if(ids.length!==1||! /^[a-f0-9]{12,32}$/.test(ids[0]))
    throw Error('Érvénytelen szintetikus Gmail-üzenetazonosító; az Inbox nem kerül beolvasásra.');
  return ids[0];
}

// Shared readonly transport for both operator surfaces. No persistence or notifications.
export async function readTestGmailInbox(token,{fetchImpl=globalThis.fetch,search='',setTimeoutImpl=globalThis.setTimeout,clearTimeoutImpl=globalThis.clearTimeout}={}){
  async function fetchGmailJson(url, options) {
    const controller = new AbortController();
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeoutImpl(() => {
        controller.abort();
        reject(Error('A Gmail-olvasás időkorlátja lejárt; indítsa újra kézzel. Automatikus újrapróbálkozás nem történt.'));
      }, 15000);
    });
    const operation = async () => {
      const response = await fetchImpl(url, {...options, signal:controller.signal});
      // Preserve status handling without reading provider error bodies.
      if (!response.ok) return response;
      const body = await response.json();
      return {ok:response.ok, status:response.status, json:async () => body};
    };
    try { return await Promise.race([operation(), deadline]); }
    catch (error) {
      if (controller.signal.aborted) throw Error('A Gmail-olvasás időkorlátja lejárt; indítsa újra kézzel. Automatikus újrapróbálkozás nem történt.');
      throw Error('A Gmail-olvasás hálózati vagy válaszfeldolgozási hibával leállt; indítsa újra kézzel.');
    } finally { clearTimeoutImpl(timer); }
  }
  function assertGmailResponse(response, failure) {
    if (response.status === 429) throw Error('A Gmail átmenetileg korlátozta az olvasást (429). Várjon néhány percet, majd indítsa újra kézzel. Automatikus újrapróbálkozás és felhős mentés nem történt.');
    if (!response.ok) throw Error(failure);
  }
  async function readWithToken(token) {
    const exactId=syntheticMessageIdFromSearch(search);
    const headers = {Authorization:`Bearer ${token}`};
    const profileResponse = await fetchGmailJson('https://gmail.googleapis.com/gmail/v1/users/me/profile', {headers,cache:'no-store'});
    assertGmailResponse(profileResponse, `A Gmail tesztfiók nem ellenőrizhető (${profileResponse.status}).`);
    assertTestGmailAccount(await profileResponse.json());
    if(exactId){
      const response=await fetchGmailJson(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(exactId)}?format=full`,{headers,cache:'no-store'});
      assertGmailResponse(response, `A kijelölt szintetikus Gmail-levél nem olvasható (${response.status}).`);
      const message=await response.json();
      if(message?.id!==exactId||!isTestInquiry(message))throw Error('A kijelölt szintetikus levél azonossága vagy Inbox-státusza nem igazolt.');
      return [message];
    }
    const candidates = [];
    let pageToken;
    const seenPages = new Set(), seenMessages = new Set();
    const MAX_LIST_PAGES = 10, MAX_MESSAGES = 1000;
    do {
      if (seenPages.has(pageToken) || seenPages.size >= MAX_LIST_PAGES) {
        throw Error('A Gmail-listázás ismétlődő vagy túl hosszú lapozást adott; a beolvasás leállt. Szűkítse a keresést vagy válasszon kijelölt szintetikus levelet.');
      }
      seenPages.add(pageToken);
      const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
      url.searchParams.set('q', INBOX_QUERY);
      url.searchParams.set('maxResults', '100');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const list = await fetchGmailJson(url, {headers,cache:'no-store'});
      assertGmailResponse(list, `Gmail-keresési hiba (${list.status}). Ellenőrizze a fiókot és a jogosultságot.`);
      const page = await list.json();
      if (!page || typeof page !== 'object' || Array.isArray(page) ||
          (page.messages !== undefined && !Array.isArray(page.messages)) ||
          (page.nextPageToken !== undefined && (typeof page.nextPageToken !== 'string' || !page.nextPageToken.trim()))) {
        throw Error('A Gmail-lista formátuma nem igazolt; a beolvasás leállt.');
      }
      for (const entry of page.messages || []) {
        if (!entry || typeof entry.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(entry.id)) {
          throw Error('A Gmail-levélazonosító nem igazolt; a beolvasás leállt.');
        }
        if (!seenMessages.has(entry.id)) {
          seenMessages.add(entry.id);
          candidates.push({id:entry.id});
        }
      }
      if (candidates.length > MAX_MESSAGES) throw Error('A Gmail-találatok száma túl nagy; szűkítse a keresést.');
      pageToken = page.nextPageToken;
    } while (pageToken);
    if (!candidates.length) throw Error('Nem található a tesztfeltételnek megfelelő beérkezett levél.');
    // Read sequentially: an inbox must not fan out into concurrent full-body requests.
    // Stop on the first failure; never automatically replay a rate-limited read.
    const messages = [];
    for (const {id} of candidates) {
      const response = await fetchGmailJson(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`, {headers,cache:'no-store'});
      assertGmailResponse(response, `Gmail-olvasási hiba (${response.status}).`);
      const message = await response.json();
      if (!message || message.id !== id) throw Error('A Gmail-válasz levélazonossága nem igazolt; a beolvasás leállt.');
      messages.push(message);
    }
    const matching = messages.filter(isTestInquiry);
    if (!matching.length) throw Error('2026.09.25. után nem található beérkezett Gmail-üzenet a tesztfiók inboxában.');
    matching.sort((a, b) => Number(b.internalDate) - Number(a.internalDate) || b.id.localeCompare(a.id));
    return matching;
  }
  return readWithToken(token);
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
  export function gmailReadableBody(part) {
    return plainText(part) || htmlText(part);
  }
