import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';import request from 'supertest';
import {readPersonalProfile,submittedPersonalProfile,candidateDetailsRouter} from '../server/candidate-profile-details.mjs';
test('current personal details project all profile sections without account or storage credentials',async()=>{
 const calls=[],db={query:async(sql,args)=>{calls.push({sql,args});if(sql.includes('FROM CANDIDATE WHERE'))return [[{full_name:'Current Name',email:'person@example.test',country_code:'+65',contact_number:'81234567',home_location:'Singapore',personal_summary:'Current summary',password_hash:'must-not-leak'}]];
 if(sql.includes('FROM CAREER_HISTORY'))return [[{job_title:'Developer',company_name:'Example',start_month_year:'2024-01',end_month_year:null,is_current_role:1,description:'Work details'}]];
 if(sql.includes('FROM EDUCATION'))return [[{qualification:'Bachelor',institution:'Academy',finished_year:'2026',is_current_study:0,description:'Study details'}]];
 if(sql.includes('FROM CERTIFICATION'))return [[{cert_name:'Certificate',issuing_org:'Issuer',issue_month_year:'2025-02',no_expiry:1}]];
 if(sql.includes('FROM SKILL'))return [[{skill_name:'SQL'}]];if(sql.includes('FROM LANGUAGE'))return [[{language_name:'English',can_read:1,can_write:0}]];throw Error('Unexpected read');}};
 const p=await readPersonalProfile(db,7);assert.equal(p.summary,'Current summary');assert.equal(p.phone,'+6581234567');assert.equal(p.career[0].current,true);assert.equal(p.education[0].finishedYear,'2026');assert.equal(p.certifications[0].noExpiry,true);assert.deepEqual(p.skills,['SQL']);assert.equal(p.languages[0].writing,false);assert.equal(p.password_hash,undefined);assert.equal(p.account_id,undefined);assert.ok(calls.every(c=>c.args[0]===7));
});
test('full submitted profiles remain independent and older snapshots never fabricate missing current fields',()=>{
 const saved={profileDetails:{name:'Submitted Name',summary:'Saved summary',skills:['SQL'],certifications:[{name:'Old certificate'}]}};const display=submittedPersonalProfile(saved);display.skills.push('Changed');assert.deepEqual(saved.profileDetails.skills,['SQL']);
 const legacy=submittedPersonalProfile({fullName:'Old Name',phone:'+6581234567',location:'Singapore',experiences:[{jobTitle:'Old role',companyName:'Old company',startDate:'2024-01',currentRole:true}],education:[],languages:[]});assert.equal(legacy.name,'Old Name');assert.equal(legacy.summary,null);assert.equal(legacy.certifications,null);assert.equal(legacy.skills,null);assert.equal(legacy.legacy,true);assert.equal(legacy.career[0].title,'Old role');
});
test('candidate details authenticate only their own GET route without intercepting other candidate endpoints',async()=>{
 let authReads=0;const app=express();app.use('/candidates',candidateDetailsRouter({pool:{getConnection:()=>assert.fail('Unauthorized read')},requireUser:(req,res)=>{authReads++;res.sendStatus(403);}}));app.get('/candidates/:id/resume',(req,res)=>res.sendStatus(204));await request(app).get('/candidates/a/profile').expect(403);await request(app).get('/candidates/a/resume').expect(204);assert.equal(authReads,1);
});
