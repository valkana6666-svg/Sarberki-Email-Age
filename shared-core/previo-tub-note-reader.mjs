// Read-only source boundary. Never infers full calendar coverage from Previo notes.
import {parseOffsetInstant} from './server-tub-availability.mjs';
const validId=x=>typeof x==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,255}$/.test(x);
const validInstant=x=>Number.isFinite(parseOffsetInstant(x));
const freeze=Object.freeze;
export function createPrevioTubNoteReader({fetchNotes=null,sourceId='previo-notes-unverified'}={}){
 const enabled=typeof fetchNotes==='function'&&validId(sourceId);
 return freeze({sourceId,async read({tenantId,resourceId,start,end}={}){
  if(!validId(tenantId)||!validId(resourceId)||!validInstant(start)||!validInstant(end)||Date.parse(end)<=Date.parse(start))return freeze({status:'UNKNOWN',reason:'INVALID_QUERY',complete:false,notes:[]});
  if(!enabled)return freeze({status:'UNKNOWN',reason:'READ_SOURCE_UNAVAILABLE',complete:false,notes:[]});
  try{
   const result=await fetchNotes(freeze({tenantId,resourceId,start,end}));
   if(!result||!Array.isArray(result.notes)||result.notes.length>1000||new Set(result.notes.map(n=>n?.id)).size!==result.notes.length||result.notes.some(n=>typeof n!=='object'||n===null||!validId(n.id)||typeof n.text!=='string'||n.text.length>4000))return freeze({status:'UNKNOWN',reason:'INVALID_SOURCE_DATA',complete:false,notes:[]});
   return freeze({status:'CANDIDATES_ONLY',reason:'CALENDAR_COVERAGE_UNVERIFIED',sourceId,complete:false,notes:result.notes.map(n=>freeze({id:n.id,text:n.text}))});
  }catch{return freeze({status:'UNKNOWN',reason:'READ_FAILED',complete:false,notes:[]});}
 }});
}
