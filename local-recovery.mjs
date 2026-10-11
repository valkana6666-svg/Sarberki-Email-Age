// Browser-only, portable local-state backup. No network or authentication data.
const MAGIC='SARBERKI_LOCAL_AESGCM_V1', ITERATIONS=600000, MAX=64*1024*1024;
const enc=new TextEncoder(), dec=new TextDecoder('utf-8',{fatal:true});
const fixed=new Set(['sarberki.gmail.read-message-ids.v1','sarberki.gmail.pushover-message-ids.v1']);
export const isRecoveryKey=k=>fixed.has(k)||/^[a-z][a-z0-9-]{1,63}-booking-cases-v2$/.test(k);
const fail=()=>{throw Error('A mentés vagy a jelmondat nem ellenőrizhető.');};
function password(p){if(typeof p!=='string'||p.length<16||p.length>1024)throw Error('Legalább 16 karakteres, külön megőrzött jelmondat szükséges.');}
function b64(bytes){let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);}
function unb64(s){if(typeof s!=='string'||s.length>MAX*2||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s))fail();return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
function validate(s){
 if(!s||s.version!==1||typeof s.origin!=='string'||!Array.isArray(s.entries)||s.entries.length>100)fail();
 const keys=new Set();
 for(const e of s.entries){if(!e||!isRecoveryKey(e.key)||typeof e.value!=='string'||e.value.length>MAX||keys.has(e.key))fail();keys.add(e.key);}
 return s;
}
export function snapshotLocalState(storage,origin){
 const entries=[];
 for(let i=0;i<storage.length;i++){const key=storage.key(i);if(isRecoveryKey(key)){const value=storage.getItem(key);if(value===null)throw Error('A helyi állapot közben megváltozott; próbáld újra.');entries.push({key,value});}}
 entries.sort((a,b)=>a.key.localeCompare(b.key));
 const s=validate({version:1,origin,createdAt:new Date().toISOString(),entries});
 if(enc.encode(JSON.stringify(s)).length>MAX)throw Error('A helyi mentés túl nagy.');
 return s;
}
async function key(p,salt,usage){password(p);const base=await crypto.subtle.importKey('raw',enc.encode(p),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:ITERATIONS},base,{name:'AES-GCM',length:256},false,[usage]);}
export async function encryptLocalState(s,p){
 validate(s);const raw=enc.encode(JSON.stringify(s));if(raw.length>MAX)fail();
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(MAGIC),tagLength:128},await key(p,salt,'encrypt'),raw);
 return JSON.stringify({format:MAGIC,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,salt:b64(salt),iv:b64(iv),ciphertext:b64(new Uint8Array(cipher))});
}
export async function decryptLocalState(text,p){
 try{
  if(typeof text!=='string'||text.length>MAX*2)fail();const o=JSON.parse(text);
  if(o.format!==MAGIC||o.kdf!=='PBKDF2-SHA256'||o.iterations!==ITERATIONS)fail();
  const salt=unb64(o.salt),iv=unb64(o.iv),cipher=unb64(o.ciphertext);
  if(salt.length!==16||iv.length!==12||cipher.length>MAX+16||cipher.length<16)fail();
  const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:enc.encode(MAGIC),tagLength:128},await key(p,salt,'decrypt'),cipher);
  return validate(JSON.parse(dec.decode(raw)));
 }catch{fail();}
}
export async function verifyLocalExport(storage,origin,p){
 const before=snapshotLocalState(storage,origin),encrypted=await encryptLocalState(before,p),after=await decryptLocalState(encrypted,p);
 if(JSON.stringify(before)!==JSON.stringify(after))fail();
 if(JSON.stringify(before.entries)!==JSON.stringify(snapshotLocalState(storage,origin).entries))throw Error('A helyi adatok közben megváltoztak; készíts új mentést.');
 return {encrypted,keyCount:before.entries.length,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(encrypted))),b=>b.toString(16).padStart(2,'0')).join('')};
}
// Only a new empty destination is accepted; never overwrites source or conflicts.
export function restoreIntoEmptyStore(s,storage,{targetOrigin,confirmedEmptyTarget=false}={}){
 validate(s);if(!confirmedEmptyTarget||!targetOrigin||targetOrigin===s.origin||storage.length!==0)throw Error('Külön, üres helyreállítási cél szükséges.');
 const added=[];
 try{
  for(const e of s.entries){storage.setItem(e.key,e.value);added.push(e.key);if(storage.getItem(e.key)!==e.value)fail();}
 }catch(error){for(const k of added)storage.removeItem(k);throw error;}
 return added.length;
}
