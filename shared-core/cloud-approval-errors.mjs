const codes=new Set(['FORBIDDEN','CASE_STORE_DISABLED','SERVICE_UNAVAILABLE',
 'AUTH_REQUIRED','SESSION_SETUP_REQUIRED','SESSION_SERVICE_UNAVAILABLE',
 'SESSION_CHANGED','CASE_CONFLICT','CASE_NOT_FOUND','INVALID_INPUT',
 'INVALID_DRAFT','REVIEW_CHANGED','REVIEW_NOT_READY','SYNTHETIC_FIXTURE_UNVERIFIED']);
const stages={
 'case-id':'Ügyazonosító ellenőrzése',
 list:'Ügylista lekérése',
 'review-draft':'Teszttervezet mentése',
 'approval-state':'Jóváhagyás és audit visszaolvasása',
 login:'Bejelentkezés',logout:'Kijelentkezés'
};
// Render only fixed diagnostic labels/codes, never server descriptions,
// credentials, stack traces, request data or arbitrary exception messages.
export function formatCloudApprovalFailure(error,stage){
 const code=codes.has(error?.message)?error.message:'ELLENORZES_SZUKSEGES';
 return (Object.hasOwn(stages,stage)?stages[stage]:'Ellenőrzés')+' nem igazolt. Hibakód: '+code+'.';
}
