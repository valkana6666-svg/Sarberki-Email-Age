// Offline preparation only. Never starts containers or contacts any service.
import {randomBytes,createHmac} from 'node:crypto';
import {mkdirSync,writeFileSync,realpathSync,existsSync,statSync} from 'node:fs';
import {isAbsolute,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateIsolatedPersistentConfig} from '../../shared-core/isolated-persistent-config.mjs';

export function prepareIsolatedDeployment({origin,outputDirectory}){
 const config={enabled:true,operatorOrigin:origin,expectedOperatorOrigin:origin,
  databaseHost:'isolated-postgres',databaseName:'sc_approval_test',syntheticOnly:true,
  emailSendingEnabled:false,pushoverSendingEnabled:false,realBookingsEnabled:false,
  attestationKey:randomBytes(32).toString('hex')};
 if(!validateIsolatedPersistentConfig(config).ok)throw Error('ISOLATED_CONFIG_REJECTED');
 const repository=realpathSync(fileURLToPath(new URL('../..',import.meta.url)));
 if(typeof outputDirectory!=='string'||!isAbsolute(outputDirectory)||!/^\/[A-Za-z0-9/._-]+$/.test(outputDirectory)||existsSync(outputDirectory))throw Error('NEW_ABSOLUTE_PRIVATE_DIRECTORY_REQUIRED');
 const parent=realpathSync(resolve(outputDirectory,'..'));
 const target=resolve(parent,outputDirectory.slice(outputDirectory.lastIndexOf('/')+1));
 const rel=relative(repository,target);
 if(!(rel==='..'||rel.startsWith('../'))||isAbsolute(rel))throw Error('PRIVATE_OUTPUT_MUST_BE_OUTSIDE_REPOSITORY');
 mkdirSync(target,{mode:0o700});
 const write=(name,text)=>writeFileSync(resolve(target,name),text,{mode:0o600,flag:'wx'});
 const secret=randomBytes(32).toString('hex');
 const ownerPassword=randomBytes(32).toString('hex'),authPassword=randomBytes(32).toString('hex'),restPassword=randomBytes(32).toString('hex');
 const sign=claims=>{const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');const payload=Buffer.from(JSON.stringify(claims)).toString('base64url');return header+'.'+payload+'.'+createHmac('sha256',secret).update(header+'.'+payload).digest('base64url');};
 const now=Math.floor(Date.now()/1000);
 const anon=sign({role:'anon',iss:'supabase',iat:now,exp:now+31536000});
 write('database-owner-password',ownerPassword+'\n');
 write('operator-config.json',JSON.stringify(config,null,2)+'\n');
 write('anon-jwt',anon+'\n');
 write('runtime.json',JSON.stringify({allowedOperatorEmails:['approval-operator@synthetic.invalid','approval-writer@synthetic.invalid','approval-foreign@synthetic.invalid'],trustedProxyAddresses:['172.29.86.2']},null,2)+'\n');
 write('auth.env',Object.entries({GOTRUE_API_HOST:'0.0.0.0',GOTRUE_API_PORT:'9999',API_EXTERNAL_URL:origin+'/isolated-auth',GOTRUE_SITE_URL:origin,GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_DATABASE_URL:`postgres://supabase_auth_admin:${authPassword}@isolated-postgres:5432/sc_approval_test?search_path=auth`,GOTRUE_DB_NAMESPACE:'auth',GOTRUE_JWT_SECRET:secret,GOTRUE_JWT_EXP:'900',GOTRUE_JWT_AUD:'authenticated',GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_JWT_ADMIN_ROLES:'service_role',GOTRUE_EXTERNAL_EMAIL_ENABLED:'true',GOTRUE_MAILER_AUTOCONFIRM:'true',GOTRUE_DISABLE_SIGNUP:'true',GOTRUE_LOG_LEVEL:'warn'}).map(([k,v])=>k+'='+v).join('\n')+'\n');
 write('rest.env',Object.entries({PGRST_DB_URI:`postgres://isolated_authenticator:${restPassword}@isolated-postgres:5432/sc_approval_test`,PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:secret,PGRST_DB_EXTRA_SEARCH_PATH:'public',PGRST_LOG_LEVEL:'crit'}).map(([k,v])=>k+'='+v).join('\n')+'\n');
 write('bootstrap-roles.sql',`\\set ON_ERROR_STOP on\nbegin;\ndo $$ begin if current_database()<>'sc_approval_test' then raise exception 'isolated database required';end if;end $$;\ncreate role anon nologin;\ncreate role authenticated nologin;\ncreate role service_role nologin bypassrls;\ncreate role postgres nologin;\ncreate role supabase_auth_admin login password '${authPassword}';\ngrant create on database sc_approval_test to supabase_auth_admin;\ncreate extension if not exists pgcrypto;\ncreate extension if not exists "uuid-ossp";\ncreate schema auth authorization supabase_auth_admin;\ngrant usage on schema auth to anon,authenticated;\ncreate role isolated_authenticator login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password '${restPassword}';\ngrant anon,authenticated to isolated_authenticator;\ncommit;\n`);
 write('install-attestation.sql',`\\set ON_ERROR_STOP on\nbegin;\ndo $$ begin if current_database()<>'sc_approval_test' then raise exception 'isolated database required';end if;end $$;\ninsert into public.sc_isolated_approval_key(key_hex) values('${config.attestationKey}');\ncommit;\n`);
 write('deployment.env',`ISOLATED_PRIVATE_DIR=${target}\nISOLATED_OPERATOR_HOSTNAME=${new URL(origin).hostname}\n`);
 if((statSync(target).mode&0o777)!==0o700)throw Error('PRIVATE_DIRECTORY_MODE_REQUIRED');
 return Object.freeze({prepared:true,deployed:false,origin,secretsGenerated:true,database:'sc_approval_test',outboundServicesEnabled:false});
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const args=process.argv.slice(2);
  if(args.length!==2)throw Error('USAGE');
  console.log(JSON.stringify(prepareIsolatedDeployment({origin:args[0],outputDirectory:args[1]})));
 }catch{console.error('ISOLATED_PREPARATION_FAILED');process.exitCode=1;}
}
