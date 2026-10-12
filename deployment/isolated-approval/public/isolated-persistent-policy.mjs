// Browser eligibility only. Server Auth/RLS remains authoritative.
export function isTrustedIsolatedShell(location,config){
 if(config?.enabled!==true||config.syntheticOnly!==true||config.target!=='https://isolated-approval.supabase.co')return false;
 if(location.protocol!=='https:'||config.deploymentMode!=='persistent-isolated'||config.operatorOrigin!==location.origin)return false;
 try{
  const u=new URL(config.operatorOrigin),labels=u.hostname.split('.');
  return u.origin===config.operatorOrigin&&!u.port&&!u.username&&!u.password&&
   !u.hostname.includes('mojnqizbcaczstguikpv')&&!u.hostname.includes('leafy-chimera-2403e5')&&
   !labels.some(l=>/^(production|prod|main)(-|$)/.test(l))&&labels.some(l=>l==='isolated'||l.startsWith('isolated-'));
 }catch{return false;}
}
