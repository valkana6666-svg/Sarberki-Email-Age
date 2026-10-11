// Static preparation only: this validator neither activates a runtime nor proves
// a remote database's identity. Deployment must independently verify that DB.
const fields=['enabled','operatorOrigin','expectedOperatorOrigin','databaseHost',
 'databaseName','syntheticOnly','emailSendingEnabled','pushoverSendingEnabled',
 'realBookingsEnabled','attestationKey'];
const reject=()=>Object.freeze({ok:false,
 errors:Object.freeze(['ISOLATED_PERSISTENT_CONFIG_REJECTED'])});
const isolatedHost=host=>{
 if(typeof host!=='string'||host.length>253||
  !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(host))return false;
 const labels=host.split('.');
 if(labels.some(label=>!label||label.length>63||label.startsWith('-')||label.endsWith('-')))return false;
 if(host.includes('mojnqizbcaczstguikpv')||host.includes('leafy-chimera-2403e5')||
  labels.some(label=>/^(?:production|prod|main)(?:-|$)/.test(label)))return false;
 return labels.some(label=>label==='isolated'||label.startsWith('isolated-'));
};
const validOrigin=value=>{
 if(typeof value!=='string')return false;
 try{
  const url=new URL(value);
  return url.protocol==='https:'&&url.origin===value&&url.port===''&&
   !url.username&&!url.password&&!url.search&&!url.hash&&isolatedHost(url.hostname);
 }catch{return false;}
};

// Required schema: all boolean gates are explicit, both origins are identical
// canonical HTTPS origins, databaseHost is a dedicated isolated DNS/service name,
// databaseName is sc_approval_test, attestationKey is server-only lowercase64hex.
export function validateIsolatedPersistentConfig(config){
 if(!config||typeof config!=='object'||Array.isArray(config)||
  Object.keys(config).length!==fields.length||
  Object.keys(config).some(key=>!fields.includes(key))||
  fields.some(key=>!Object.hasOwn(config,key)))return reject();
 if(config.enabled!==true||config.syntheticOnly!==true||
  config.emailSendingEnabled!==false||config.pushoverSendingEnabled!==false||
  config.realBookingsEnabled!==false||config.databaseName!=='sc_approval_test'||
  !validOrigin(config.operatorOrigin)||config.operatorOrigin!==config.expectedOperatorOrigin||
  !isolatedHost(config.databaseHost)||typeof config.attestationKey!=='string'||
  !/^[a-f0-9]{64}$/.test(config.attestationKey))return reject();
 // Review/report-safe output deliberately excludes all secret values.
 return Object.freeze({ok:true,errors:Object.freeze([]),validated:true,enabled:true,operatorOrigin:config.operatorOrigin,
  databaseHost:config.databaseHost,databaseName:config.databaseName,syntheticOnly:true,
  emailSendingEnabled:false,pushoverSendingEnabled:false,realBookingsEnabled:false,
  attestationKeyConfigured:true});
}
