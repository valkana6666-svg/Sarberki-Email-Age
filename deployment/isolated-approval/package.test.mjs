import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,statSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHmac} from 'node:crypto';
import {prepareIsolatedDeployment} from './prepare.mjs';
import {validateIsolatedPersistentConfig} from '../../shared-core/isolated-persistent-config.mjs';
const fixture=fn=>{const parent=mkdtempSync(join(tmpdir(),'isolated-package-'));try{return fn(join(parent,'private'));}finally{rmSync(parent,{recursive:true,force:true});}};
const read=(directory,name)=>readFileSync(join(directory,name),'utf8');

test('offline package makes private files outside repo without exposing secrets',()=>fixture(directory=>{
 const result=prepareIsolatedDeployment({origin:'https://isolated-operator.example.org',outputDirectory:directory});
 assert.equal(result.deployed,false);
 assert.equal(statSync(directory).mode&0o777,0o700);
 for(const name of readdirSync(directory))assert.equal(statSync(join(directory,name)).mode&0o777,0o600);
 const config=JSON.parse(read(directory,'operator-config.json'));
 assert.equal(validateIsolatedPersistentConfig(config).ok,true);
 assert.equal(JSON.stringify(result).includes(config.attestationKey),false);
 assert.equal(config.databaseHost,'isolated-postgres');
 assert.equal(read(directory,'auth.env').includes('GOTRUE_DISABLE_SIGNUP=true'),true);
 assert.equal(read(directory,'auth.env').includes('GOTRUE_JWT_EXP=900'),true);
 assert.equal(/SMTP|gmail|pushover|previo|mojnqizbcaczstguikpv/i.test(read(directory,'auth.env')),false);
 const bootstrap=read(directory,'bootstrap-roles.sql');
 assert.match(bootstrap,/isolated_authenticator login noinherit nosuperuser.*nobypassrls/);
 assert.match(bootstrap,/grant anon,authenticated to isolated_authenticator/);
 assert.doesNotMatch(bootstrap,/grant .*service_role .*isolated_authenticator/);
 assert.match(read(directory,'rest.env'),/postgres:\/\/isolated_authenticator:/);
 const secret=read(directory,'auth.env').match(/^GOTRUE_JWT_SECRET=(.+)$/m)[1];
 const token=read(directory,'anon-jwt').trim(),parts=token.split('.');
 assert.equal(JSON.parse(Buffer.from(parts[1],'base64url')).role,'anon');
 assert.equal(parts[2],createHmac('sha256',secret).update(parts[0]+'.'+parts[1]).digest('base64url'));
 assert.throws(()=>prepareIsolatedDeployment({origin:config.operatorOrigin,outputDirectory:directory}));
}));

test('preparation rejects existing, repository, unsafe path and nonisolated origins',()=>{
 for(const origin of ['https://example.org','http://isolated.example.org','https://main-isolated.example.org','https://leafy-chimera-2403e5.netlify.app'])fixture(directory=>assert.throws(()=>prepareIsolatedDeployment({origin,outputDirectory:directory})));
 assert.throws(()=>prepareIsolatedDeployment({origin:'https://isolated.example.org',outputDirectory:'./private'}));
 assert.throws(()=>prepareIsolatedDeployment({origin:'https://isolated.example.org',outputDirectory:'/tmp/unsafe\npath'}));
 const repository=new URL('../..',import.meta.url).pathname;
 assert.throws(()=>prepareIsolatedDeployment({origin:'https://isolated.example.org',outputDirectory:join(repository,'..secret-output')}));
});

test('preparation CLI output contains only safe evidence and no generated secrets',()=>fixture(directory=>{
 const stdout=execFileSync(process.execPath,[new URL('./prepare.mjs',import.meta.url).pathname,'https://isolated-operator.example.org',directory],{encoding:'utf8'});
 assert.equal(JSON.parse(stdout).prepared,true);
 const config=JSON.parse(read(directory,'operator-config.json'));
 assert.equal(stdout.includes(config.attestationKey),false);
 assert.equal(stdout.includes(read(directory,'database-owner-password').trim()),false);
 assert.equal(stdout.includes(read(directory,'anon-jwt').trim()),false);
}));

test('package public ports, network and build context are explicit',()=>{
 const compose=readFileSync(new URL('./compose.yml',import.meta.url),'utf8');
 assert.equal((compose.match(/ports:/g)||[]).length,1);
 assert.match(compose,/ports: \['80:80', '443:443'\]/);
 assert.match(compose,/isolated_backend: \{internal: true\}/);
 assert.match(compose,/ipv4_address: 172\.29\.86\.2/);
 assert.equal((compose.match(/profiles: \[approved-deployment\]/g)||[]).length,5);
 assert.doesNotMatch(compose,/network_mode:|docker\.sock|privileged:|5432:|9999:|3000:/);
 const dockerfile=readFileSync(new URL('./Dockerfile',import.meta.url),'utf8');
 assert.match(dockerfile,/USER node/);assert.doesNotMatch(dockerfile,/^COPY \. |^RUN .*npm (?:install|ci)/m);
 const ignore=readFileSync(new URL('./Dockerfile.dockerignore',import.meta.url),'utf8');
 assert.equal(ignore.startsWith('**\n'),true);
 assert.doesNotMatch(ignore,/!.*(?:secret|\.env|backup|recovery|node_modules)/i);
});
test('Dockerfile covers the actual server dependency closure including shared planner transport imports',()=>{
 const root=fileURLToPath(new URL('../..',import.meta.url));
 const dockerfile=readFileSync(new URL('./Dockerfile',import.meta.url),'utf8');
 const patterns=[...dockerfile.matchAll(/^COPY (\S+) /gm)].map(m=>m[1]);
 const copied=path=>patterns.some(pattern=>{
  if(pattern.endsWith('/'))return path.startsWith(pattern);
  const escaped=pattern.split('*').map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('[^/]*');
  return new RegExp('^'+escaped+'$').test(path);
 });
 const todo=[resolve(root,'scripts/isolated-persistent-server.mjs')],seen=new Set();
 while(todo.length){
  const path=todo.pop();if(seen.has(path))continue;seen.add(path);
  const source=readFileSync(path,'utf8');assert.equal(copied(relative(root,path)),true,'Unpackaged server module: '+relative(root,path));
  for(const match of source.matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/g)){
   const specifier=match[1].split('?')[0].split('#')[0];
   if(specifier.startsWith('.'))todo.push(resolve(dirname(path),specifier));
  }
 }
 assert.ok(seen.size>20);
});
