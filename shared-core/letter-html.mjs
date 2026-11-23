// Pure. Owner 2026-11-23 („levélformázási gondok”): the guest letter is plain text; on a phone the voucher's ━━━
// rules and long "Label: value" rows wrap badly. The SAME text is also sent as a simple HTML part (multipart/
// alternative): paragraphs, bold section titles, and the voucher as a framed table. Nothing is added or reworded –
// every character of the text is escaped and kept; the plain-text part stays the reference (send ledger, hashes).
// Escaped, and an amount never breaks across lines ("3 300 Ft", "184 800 HUF").
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
 .replace(/(\d) (?=\d{3}(?!\d))/g,'$1&nbsp;').replace(/(\d) (Ft|HUF|EUR)(?![\p{L}])/gu,'$1&nbsp;$2');
const RULE=/^[━─=_-]{3,}$/;
const FONT="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";

// A section title: a short first line without sentence punctuation, followed by more lines ("Foglalás", "Ár", …).
const isTitle=(line,rest)=>rest>0&&line.length<=32&&!/[.!?:,;]$/.test(line)&&!/\d{4}/.test(line);

function voucherHtml(title,rows,footer){
 const cells=rows.map(r=>{const i=r.indexOf(': ');
  return i>0&&i<=40
   ?`<tr><td style="padding:4px 12px 4px 0;color:#555;vertical-align:top;white-space:nowrap">${esc(r.slice(0,i))}</td><td style="padding:4px 0;vertical-align:top">${esc(r.slice(i+2))}</td></tr>`
   :`<tr><td colspan="2" style="padding:4px 0">${esc(r)}</td></tr>`;}).join('');
 return `<div style="border:2px solid #1f3a8a;border-radius:10px;padding:14px 16px;margin:20px 0">`+
  `<div style="font-weight:700;letter-spacing:2px;color:#1f3a8a;margin-bottom:8px">${esc(title)}</div>`+
  `<table role="presentation" style="border-collapse:collapse;font-size:15px;line-height:1.4">${cells}</table></div>`+
  (footer.length?`<p style="margin:0 0 14px">${footer.map(esc).join('<br>')}</p>`:'');
}

export function letterHtml(text){
 const lines=String(text??'').replace(/\r\n?/g,'\n').split('\n');
 const out=[];let i=0;
 const paragraph=block=>{
  if(!block.length)return;
  if(isTitle(block[0],block.length-1))out.push(`<p style="margin:0 0 14px"><strong>${esc(block[0])}</strong><br>${block.slice(1).map(esc).join('<br>')}</p>`);
  else out.push(`<p style="margin:0 0 14px">${block.map(esc).join('<br>')}</p>`);
 };
 let block=[];
 while(i<lines.length){
  const line=lines[i].trim();
  // Voucher: RULE, title, RULE, rows…, RULE, footer lines up to the next blank line.
  if(RULE.test(line)&&RULE.test((lines[i+2]||'').trim())&&lines[i+1]?.trim()){
   paragraph(block);block=[];
   const title=lines[i+1].trim();i+=3;const rows=[];
   while(i<lines.length&&!RULE.test(lines[i].trim())){if(lines[i].trim())rows.push(lines[i].trim());i++;}
   i++;const footer=[];
   while(i<lines.length&&lines[i].trim()){footer.push(lines[i].trim());i++;}
   out.push(voucherHtml(title,rows,footer));continue;
  }
  if(!line){paragraph(block);block=[];}
  else if(!RULE.test(line))block.push(line);
  i++;
 }
 paragraph(block);
 return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>`+
  `<body style="margin:0;padding:0"><div style="${FONT};font-size:16px;line-height:1.5;color:#1a1a1a;max-width:560px;padding:8px">${out.join('')}</div></body></html>`;
}

// Inverse check used by the tests: the visible text of the HTML keeps every word of the plain text.
export function htmlVisibleText(html){
 return String(html).replace(/<br>/g,'\n').replace(/<\/(p|tr|div)>/g,'\n').replace(/<\/td>/g,' ').replace(/<[^>]+>/g,'')
  .replace(/&nbsp;/g,' ').replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
}
