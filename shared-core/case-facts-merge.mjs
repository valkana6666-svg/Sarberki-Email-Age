// Pure helper for joining already-identified correspondence in one case.
// Identity verification must happen before this function is called.
export function combineCaseFacts(previous={},reply={},sameCase=false){
 if(!sameCase)return {status:'UNMATCHED',values:{...previous},updates:{},conflicts:[]};
 const values={...previous},updates={},conflicts=[];
 const allowed=['arrival','departure','guests','adults','children','child_ages','phone','unit','units_requested','cars'];
 for(const key of allowed){
  const incoming=reply[key];
  if(incoming===undefined||incoming===null||String(incoming).trim()==='')continue;
  const old=previous[key];
  if(old!==undefined&&old!==null&&String(old).trim()!==''&&String(old).trim()!==String(incoming).trim()){
   conflicts.push({field:key,oldValue:old,newValue:incoming});
  }else if(old===undefined||old===null||String(old).trim()===''){
   values[key]=incoming;updates[key]=incoming;
  }
 }
 return {status:conflicts.length?'REVIEW_REQUIRED':'MERGED',values,updates,conflicts};
}
