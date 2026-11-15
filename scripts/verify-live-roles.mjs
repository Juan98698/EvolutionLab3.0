import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { randomBytes, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const env = Object.assign({}, ...['.env','.env.local'].filter(existsSync).map(file => parseEnv(readFileSync(file,'utf8'))),process.env);
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
assert(url && env.SUPABASE_SERVICE_ROLE_KEY,'Falta configuración privada de Supabase.');
const admin = createClient(url,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const fixtureFile=resolve('scratch/live-role-verification.json');
const checked=result=>{if(result.error)throw Error(`Supabase rechazó la prueba (${result.error.status || result.error.code || 'unknown'}).`);return result.data;};

if(process.argv[2]==='--prepare'){
  assert(!existsSync(fixtureFile),'Limpia primero las cuentas de la comprobación anterior.');
  mkdirSync(resolve('scratch'),{recursive:true});
  const fixture={sourceHost:new URL(url).hostname,createdAt:new Date().toISOString(),accounts:[]};
  writeFileSync(fixtureFile,JSON.stringify(fixture),{flag:'wx',mode:0o600});
  for(const role of ['entrenador','admin']){
    const email=`role-check-${randomUUID()}@example.test`;
    const password=randomBytes(24).toString('base64url');
    const created=checked(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{nombre:`Verificación ${role}`,rol:role==='admin'?'cliente':role}}));
    fixture.accounts.push({role,id:created.user.id,email,password});
    // Persist each returned ID immediately so cleanup can finish after a failure.
    writeFileSync(fixtureFile,JSON.stringify(fixture),{mode:0o600});
    checked(await admin.from('profiles').update({rol:role,...(role==='entrenador'?{suscripcion_plan:'profesional',suscripcion_estado:'activo',suscripcion_expira_at:new Date(Date.now()+86400000).toISOString()}: {})}).eq('id',created.user.id));
  }
  console.log(JSON.stringify({prepared:true,roles:fixture.accounts.map(account=>account.role),credentialsPrinted:false}));
}else if(process.argv[2]==='--cleanup'){
  const fixture=JSON.parse(readFileSync(fixtureFile,'utf8'));
  assert.equal(fixture.sourceHost,new URL(url).hostname,'El archivo de limpieza corresponde a otro proyecto.');
  const accountCount=fixture.accounts.length;
  while(fixture.accounts.length){
    const account=fixture.accounts[0];
    const user=checked(await admin.auth.admin.getUserById(account.id)).user;
    assert.equal(user.email,account.email,'La cuenta ya no coincide con la creada para esta prueba.');
    assert(account.email.startsWith('role-check-')&&account.email.endsWith('@example.test'),'No es una cuenta de esta comprobación.');
    checked(await admin.auth.admin.deleteUser(account.id));
    fixture.accounts.shift();
    writeFileSync(fixtureFile,JSON.stringify(fixture),{mode:0o600});
  }
  unlinkSync(fixtureFile);
  console.log(JSON.stringify({cleaned:true,accounts:accountCount,credentialsPrinted:false}));
}else throw Error('Usa --prepare o --cleanup. Las contraseñas de prueba nunca se imprimen.');
