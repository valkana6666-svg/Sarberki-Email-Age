import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {createPersistentRuntime} from '../shared-core/isolated-persistent-runtime.mjs';
// Private files are provisioned separately; no environment/platform credentials.
try{
 const config=JSON.parse(readFileSync('/run/secrets/operator-config.json','utf8'));
 const runtime=JSON.parse(readFileSync('/run/secrets/runtime.json','utf8'));
 const anonymousKey=readFileSync('/run/secrets/anon-jwt','utf8').trim();
 const names=['isolated-persistent.html','isolated-persistent.css','isolated-persistent-session.mjs','isolated-approval-panel.mjs','isolated-persistent-policy.mjs','shared-core/case-store-client.mjs','shared-core/isolated-approval-review.mjs','shared-core/isolated-review-case-id.mjs'];
 const assets=new Map(names.map(p=>['/'+p,readFileSync(p.startsWith('isolated-persistent')?'deployment/isolated-approval/public/'+p:p)]));
 const handler=await createPersistentRuntime({config,runtime,anonymousKey,assets});
 const server=createServer(handler);server.requestTimeout=15000;server.headersTimeout=10000;
 server.maxHeadersCount=32;server.listen(8080,'0.0.0.0');
 const close=()=>server.close(()=>process.exit(0));process.on('SIGTERM',close);process.on('SIGINT',close);
}catch{console.error('ISOLATED_RUNTIME_NOT_READY');process.exitCode=1;}
