// A queued operation belongs to the UI session that requested it. Never replay
// an old approval after logout or after another operator has signed in.
export function createEpochRequestQueue({getEpoch,isAuthenticated,prepare,execute}){
 let queue=Promise.resolve();
 return (...args)=>{
  const epoch=getEpoch();
  const current=()=>{if(getEpoch()!==epoch||!isAuthenticated())throw Error('SESSION_CHANGED');};
  const run=queue.then(async()=>{
   current();const context=await prepare();current();
   const result=await execute(context,...args);current();return result;
  });
  queue=run.catch(()=>{});return run;
 };
}
