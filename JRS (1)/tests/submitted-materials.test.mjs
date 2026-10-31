import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {addSubmittedMaterials,submittedMaterialsRouter} from '../server/submitted-materials.mjs';
test('application review uses the submission identity and the integrated document route',async()=>{
 const workspace={applications:[{id:'application-1'}],candidates:[{name:'Current name'}]};
 const pool={query:async()=>[[{recruiting_id:'application-1',file_name:'old.pdf',file_type:'application/pdf',applicant_snapshot:JSON.stringify({fullName:'Submitted name',email:'old@example.test',phone:'+6581234567',location:'["SG","",""]',education:[],experiences:[{startDate:'2025-01',endDate:'2025-01',currentRole:false,skills:['REACT']}]})}]]};
 await addSubmittedMaterials(pool,workspace);assert.equal(workspace.applications[0].submission.candidate.name,'Submitted name');
 assert.equal(workspace.applications[0].submission.resumeUrl,'/recruitment/api/hr/applications/application-1/submitted-resume');
 assert.equal(workspace.candidates[0].name,'Current name');
});
test('submitted document route requires HR authorization and rejects unsafe storage keys',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'jrs-materials-')),key='a'.repeat(64);await fs.writeFile(path.join(dir,key),'%PDF-fixture');
 let allowed=false,file={file_name:'submitted.pdf',file_type:'application/pdf',storage_key:key};
 const app=express();app.use('/recruitment/api/hr/applications',submittedMaterialsRouter({pool:{execute:async()=>[[file]]},uploadDir:dir,requireUser:(req,res,next)=>allowed?next():res.sendStatus(401)}));
 app.use((e,req,res,next)=>res.status(e.status||500).json({error:e.message}));
 try{await request(app).get('/recruitment/api/hr/applications/a/submitted-resume').expect(401);allowed=true;
  const result=await request(app).get('/recruitment/api/hr/applications/a/submitted-resume').expect(200);assert.match(result.headers['content-type'],/pdf/);assert.equal(result.headers['cache-control'],'no-store');
  file={...file,storage_key:'../../secret'};await request(app).get('/recruitment/api/hr/applications/a/submitted-resume').expect(404);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
