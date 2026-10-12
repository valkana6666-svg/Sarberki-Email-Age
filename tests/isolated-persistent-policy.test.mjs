import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isTrustedIsolatedShell} from '../deployment/isolated-approval/public/isolated-persistent-policy.mjs';
test('dedicated persistent shell accepts only exact pinned isolated HTTPS config',()=>{
 const origin='https://operator.isolated.example.org',location=new URL(origin);
 const config={enabled:true,syntheticOnly:true,target:'https://isolated-approval.supabase.co',deploymentMode:'persistent-isolated',operatorOrigin:origin};
 assert.equal(isTrustedIsolatedShell(location,config),true);
 for(const c of [{...config,enabled:false},{...config,syntheticOnly:false},{...config,deploymentMode:'loopback'},{...config,operatorOrigin:'https://another.isolated.example.org'},{...config,target:'https://mojnqizbcaczstguikpv.supabase.co'}])assert.equal(isTrustedIsolatedShell(location,c),false);
 assert.equal(isTrustedIsolatedShell(new URL('http://127.0.0.1'),config),false);
 for(const host of ['main-isolated.example.org','leafy-chimera-2403e5.netlify.app','example.org'])assert.equal(isTrustedIsolatedShell(new URL('https://'+host),{...config,operatorOrigin:'https://'+host}),false);
});
test('dedicated shell scripts keep tokens in memory and reference only packaged assets',()=>{
 const page=readFileSync(new URL('../deployment/isolated-approval/public/isolated-persistent.html',import.meta.url),'utf8');
 const session=readFileSync(new URL('../deployment/isolated-approval/public/isolated-persistent-session.mjs',import.meta.url),'utf8');
 assert.match(page,/isolated-persistent\.css/);assert.match(page,/isolated-persistent-session\.mjs/);
 assert.match(session,/initIsolatedApprovalPanel/);assert.doesNotMatch(session,/localStorage|sessionStorage|refresh_token|innerHTML/);
 assert.match(session,/location\.protocol!=='https:'/);
});
