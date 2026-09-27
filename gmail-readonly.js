/* Browser-only Gmail bridge. Access token stays in memory and is never stored. */
(() => {
  'use strict';
  const TEST_QUERY = 'in:inbox from:valkana6666@gmail.com after:2026/09/25';
  const ALLOWED_SUBJECTS = new Set([
    'Érdeklődés a szállásról',
    'Érdeklődés a szallasrol',
    'Érdeklődés szállásról'
  ]);
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
    return '';
  }
  function transform(message) {
    const headers = Object.fromEntries((message.payload?.headers || []).map(h => [h.name.toLowerCase(), h.value]));
    const original = plain(message.payload).trim();
    if (!original) throw Error('A levélnek nincs olvasható szöveges része; emberi ellenőrzés szükséges.');
    const received = new Date(Number(message.internalDate));
    const dateText = original.match(/(január|február|március|április|május|június|július|augusztus|szeptember|október|november|december)[^\n.]*?\b(\d{1,2})\s*(?:[-–]\s*|(?:-től|-tól)\s*)(\d{1,2})\s*(?:-ig|\.)/iu);
    const months = ['január','február','március','április','május','június','július','augusztus','szeptember','október','november','december'];
    const monthIndex = dateText ? months.indexOf(dateText[1].toLowerCase()) : -1;
    const localDay = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const [currentYear,currentMonth,currentDay] = localDay.split('-').map(Number);
    const inferredYear = monthIndex >= 0 ? currentYear + (monthIndex + 1 < currentMonth || (monthIndex + 1 === currentMonth && Number(dateText[3]) < currentDay) ? 1 : 0) : null;
    const count = original.match(/\b(\d+)\s*fő\b/iu)?.[1] || ({ketten:2,hárman:3,négyen:4,öten:5,hatan:6}[original.match(/\b(ketten|hárman|négyen|öten|hatan)\b/iu)?.[1]?.toLowerCase()] || null);
    const child = original.match(/\b(\d+|egy|kettő|két)\s*gyerek\w*|\b(\d+|egy|kettő|két)\s*gyermek\w*/iu);
    const childCount = child ? ({egy:1,kettő:2,két:2}[child[1] || child[2]] || Number(child[1] || child[2])) : null;
    const name = original.match(/(?:^|\n)\s*([A-ZÁÉÍÓÖŐÚÜŰ][\p{L}-]+\s+[A-ZÁÉÍÓÖŐÚÜŰ][\p{L}-]+)\s*$/mu)?.[1];
    const hotTub = /dézs/iu.test(original), dog = /kuty/iu.test(original), availability = /szabad\s+hely/iu.test(original);
    const extracted = [];
    if (name) extracted.push({label:'Vendég neve',value:name,evidence:'aláírás'});
    if (dateText) extracted.push({label:'Időszak, év nélkül',value:`${dateText[1]} ${dateText[2]}–${dateText[3]}.`,evidence:dateText[0]});
    if (count) extracted.push({label:'Létszám',value:`${count} fő${childCount ? `, ebből ${childCount} gyermek` : ''}`,evidence:original.match(/[^\n.]*?(?:fő|négyen|hárman|ketten|öten|hatan)[^\n.]*/iu)?.[0]?.trim() || 'levélszöveg'});
    if (hotTub || dog) extracted.push({label:'Igények',value:[hotTub?'dézsás faház':null,dog?(/kisebb\s+kuty/iu.test(original)?'kisebb kutya':'kutya'):null].filter(Boolean).join(', '),evidence:'levélszöveg'});
    if (availability) extracted.push({label:'Kérdés',value:'szabad kapacitás',evidence:'levélszöveg'});
    const inferred = [];
    if (inferredYear) inferred.push({label:'Év',value:`${inferredYear}, a feldolgozás napja alapján következtetve; emberi ellenőrzés szükséges`});
    if (count && childCount) inferred.push({label:'Felnőttek',value:`valószínűleg ${count-childCount}, ha a fennmaradó ${count-childCount} fő felnőtt`});
    const missing = [];
    if (cabinFromGuestText(original).startsWith('?')) missing.push('Konkrét faház vagy háztípus: ? – emberi döntésre vár');
    if (!dateText) missing.push('Pontos érkezési és távozási dátum');
    if (!count) missing.push('Vendégek száma');
    if (childCount && !/\d+\s*éves/iu.test(original)) missing.push('Gyermek életkora');
    if (!/\+?\d[\d\s/-]{7,}/u.test(original)) missing.push('Telefonszám');
    missing.push('Kapacitás és ár csak külön, hiteles ellenőrzéssel állapítható meg');
    const humanReview = [inferredYear ? `A ${inferredYear}-os év következtetését hagyja jóvá a kezelő` : 'A dátumot ellenőrizni kell'];
    if (cabinFromGuestText(original).startsWith('?')) humanReview.push('A vendég háztípust nem választott; létszámból nem szabad kiválasztani');
    humanReview.push('Szabad hely és ár nincs igazolva');
    const first = name?.split(' ')[1] || 'Vendégünk';
    const time = dateText ? `${dateText[1]} ${dateText[2]}–${dateText[3]}. között` : 'a jelzett időpontban';
    const summary = [count ? `összesen ${count} fővel${childCount ? `, köztük ${childCount} gyermekkel` : ''}` : null,hotTub?'dézsás faházat keresnek':null,dog?'kutyát is hoznának':null].filter(Boolean).join('; ');
    const replyDraft = `Kedves ${first}!\n\nKöszönjük érdeklődését. Úgy értettük, hogy ${time} érkeznének${summary ? `; ${summary}` : ''}.\n\n${childCount ? 'Megírná a gyermek életkorát és ' : 'Megírná '}egy telefonszámot, amelyen elérhetjük? ${cabinFromGuestText(original).startsWith('?') ? 'Van konkrét faházra vagy háztípusra vonatkozó igényük?\n\n' : '\n\n'}${dog ? 'Kutyát térítés ellenében lehet hozni. ' : ''}A szabad kapacitást és az árat külön ellenőriznünk kell; ezekről egyelőre nem tudunk biztos tájékoztatást adni.\n\nÜdvözlettel:\nSárberki Horgásztó`;
    return {source:{provider:'gmail',message_id:message.id,thread_id:message.threadId,subject:headers.subject || '',received_at:received.toISOString()},original_message:original,extracted,inferred,missing,human_review:humanReview,reply_draft:replyDraft};
  }
  async function readWithToken(token) {
    const headers = {Authorization:`Bearer ${token}`};
    const list = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(TEST_QUERY)}&maxResults=20`, {headers,cache:'no-store'});
    if (!list.ok) throw Error(`Gmail-keresési hiba (${list.status}). Ellenőrizze a fiókot és a jogosultságot.`);
    const candidates = (await list.json()).messages || [];
    if (!candidates.length) throw Error('Nem található a tesztfeltételnek megfelelő beérkezett levél.');
    const messages = await Promise.all(candidates.map(async ({id}) => {
      const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`, {headers,cache:'no-store'});
      if (!response.ok) throw Error(`Gmail-olvasási hiba (${response.status}).`);
      return response.json();
    }));
    const matching = messages.filter(message => {
      const values = Object.fromEntries((message.payload?.headers || []).map(h => [h.name.toLowerCase(), h.value]));
      return /(?:^|[<\s])valkana6666@gmail\.com(?:[>\s]|$)/i.test(values.from || '')
        && ALLOWED_SUBJECTS.has((values.subject || '').trim())
        && message.labelIds?.includes('INBOX');
    });
    if (!matching.length) throw Error('Nincs pontosan ellenőrzött beérkezett tesztlevél.');
    matching.sort((a, b) => Number(b.internalDate) - Number(a.internalDate));
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
        say('A Gmail-levélből előállított rekord megjelent, kézi JSON-beillesztés nélkül.');
      } catch (error) { say(error.message); } finally { button.disabled = false; }
    },error_callback:error => { say(`A Google-belépés megszakadt: ${error.type || 'ismeretlen hiba'}`); button.disabled=false; }});
    client.requestAccessToken({prompt:'consent'});
  });
  window.sarberkiGmailTransform = transform; // Local test harness only; no token exposure.
})();
