import {publicReplyInput} from './public-reply-input.mjs';
import {composeGuestReply} from './public-answer-renderer.mjs';

const el=id=>document.getElementById(id);
const requiredFields=['language','name','arrival','departure','nights','guests','adults','children','child_ages','phone','unit','units_requested'];
const button=el('public_reply_generate');
if(button){
  button.addEventListener('click',()=>{
    const status=el('public_reply_status'),preview=el('public_reply_preview');
    if(el('results')?.classList.contains('hidden')){
      status.textContent='Először dolgozz fel egy vendégüzenetet. A régi tervezet változatlan.';
      return;
    }
    try{
      const fields={};
      for(const key of requiredFields)fields[key]=el('f_'+key)?.value??'';
      const message=el('message')?.value??'';
      const payload=publicReplyInput({fields,message});
      preview.value=composeGuestReply(payload);
      status.textContent='Elkülönített próba elkészült. Nincs e-mail-küldés. A régi választervezet érintetlen; jóváhagyott ár és ellenőrzött szabadhely még nincs átadva az új magnak.';
    }catch(error){
      preview.value='';
      status.textContent='Nem készült publikus tervezet: '+(error?.message||'ismeretlen hiba')+'. A régi tervezet érintetlen.';
    }
  });
  // Bármely vendégadat-változás érvényteleníti a korábbi előnézetet.
  el('fields')?.addEventListener('input',()=>{
    el('public_reply_preview').value='';
    el('public_reply_status').textContent='A foglalási adatok változtak. Generálj új előnézetet.';
  });
  el('message')?.addEventListener('input',()=>{
    el('public_reply_preview').value='';
    el('public_reply_status').textContent='A vendégüzenet változott. Generálj új előnézetet.';
  });
}
