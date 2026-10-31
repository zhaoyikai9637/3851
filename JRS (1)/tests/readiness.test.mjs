import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import {mountReadiness} from '../server/readiness.mjs';
test('readiness needs the expected database schema and a usable upload directory without leaking errors',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'jrs-ready-'));
 let version=12,failed=false;
 const pool={query:async()=>{if(failed)throw new Error('private password and database host');return [[{version}]];}};
 const app=express();mountReadiness(app,{pool,uploadDir:directory});
 try{
  assert.equal((await request(app).get('/health/live')).status,200);
  assert.equal((await request(app).get('/health/ready')).status,200);
  version=10;assert.equal((await request(app).get('/health/ready')).status,503);
  failed=true;const outage=await request(app).get('/health/ready');
  assert.equal(outage.status,503);assert.deepEqual(outage.body,{status:'not-ready'});
  assert.equal((await request(app).get('/health/live')).status,200);
  failed=false;version=12;await fs.rm(directory,{recursive:true});
  assert.equal((await request(app).get('/health/ready')).status,503);
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
