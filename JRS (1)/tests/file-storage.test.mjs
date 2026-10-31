import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {createFileStore,storageSettings} from '../server/file-storage.mjs';
const secret='sb_secret_fixture_only_123456789',env={JRS_STORAGE_PROVIDER:'supabase',SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SECRET_KEY:secret,SUPABASE_BUCKET:'jrs-files'},key='a'.repeat(64),bytes=Buffer.from('%PDF-fixture');
test('cloud storage sends credentials only to the configured HTTPS project and preserves private file bytes',async()=>{
 const calls=[];let deleted=false;const store=createFileStore(env,{fetchImpl:async(url,options)=>{calls.push({url,options});assert.equal(new URL(url).origin,env.SUPABASE_URL);assert.equal(options.redirect,'error');assert.equal(options.headers.apikey,secret);assert.equal(options.headers.Authorization,undefined);
  if(url.includes('/bucket/'))return Response.json({id:'jrs-files',public:false});
  if(options.method==='POST'){assert.deepEqual(options.body,bytes);assert.equal(options.headers['x-upsert'],'false');return Response.json({Key:key});}
  if(options.method==='DELETE'){assert.deepEqual(JSON.parse(options.body),{prefixes:[key]});deleted=true;return Response.json([]);}
  return deleted?Response.json({statusCode:'404',error:'not_found'},{status:400}):new Response(bytes);
 }});
 await store.check();await store.check();assert.equal(calls.length,1);
 await store.put(key,bytes,{contentType:'application/pdf'});assert.deepEqual(await store.get(key),bytes);await store.remove(key);await assert.rejects(store.get(key),{code:'STORAGE_NOT_FOUND',status:404});
});
test('storage rejects traversal, wrong hosts, public keys and accidental public buckets',async()=>{
 for(const patch of [{SUPABASE_URL:'http://fixture.supabase.co'},{SUPABASE_URL:'https://fixture.supabase.co.evil.test'},{SUPABASE_URL:'https://fixture.supabase.co/redirect'},{SUPABASE_SECRET_KEY:'sb_publishable_fixture'},{JRS_STORAGE_PROVIDER:'unknown'}])assert.throws(()=>storageSettings({...env,...patch}));
 assert.throws(()=>storageSettings({NODE_ENV:'production',RENDER:'true'}),/persistent object storage/);
 let calls=0;const store=createFileStore(env,{fetchImpl:async()=>{calls++;return Response.json({id:'jrs-files',public:true});}});
 for(const method of ['get','remove'])await assert.rejects(store[method]('../secret'),{status:404});await assert.rejects(store.put('../secret',bytes),{status:404});assert.equal(calls,0);await assert.rejects(store.check(),{status:503});
});
test('provider failures and oversized downloads fail safely without exposing credentials',async()=>{
 const offline=createFileStore(env,{fetchImpl:async()=>{throw new Error('Provider request included '+secret);}});await assert.rejects(offline.get(key),error=>error.status===503&&!error.message.includes(secret));
 const large=createFileStore(env,{fetchImpl:async()=>new Response('too big',{headers:{'content-length':String(6*1024*1024)}})});await assert.rejects(large.get(key),{status:503});
});
test('local development storage preserves create-only behavior and cleanup',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'jrs-storage-'));const store=createFileStore({uploadDir:directory});try{await store.put(key,bytes);await assert.rejects(store.put(key,bytes),{code:'EEXIST'});await store.put(key,bytes,{allowExisting:true});assert.deepEqual(await store.get(key),bytes);await store.remove(key);await store.remove(key);await assert.rejects(store.get(key),{status:404});}finally{await fs.rm(directory,{recursive:true,force:true});}
});
