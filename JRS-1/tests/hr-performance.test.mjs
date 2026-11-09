import test from 'node:test';
import assert from 'node:assert/strict';
import {requireRecruitmentUser} from '../server/recruitment-auth.mjs';
import {refreshCanonicalPeople} from '../server/canonical-applicant-profile.mjs';
const active=()=>({account_id:7,account_email:'hr@example.test',account_role:'hr',csrf:'b'.repeat(64),hr_id:4,hr_status:'ACTIVE',hr_role:'HR_MANAGER',hr_name:'Manager',hr_email:'hr@example.test',hr_department:'HR',hr_phone:'',hr_office:'',id:'team-hr-4',name:'Manager',email:'hr@example.test',role:'HR_MANAGER',status:'Active',employee_id:'HR-4',department:'HR',phone:'',office_location:''});
const request=(method='GET')=>({method,headers:{cookie:'jrs_candidate_session='+'a'.repeat(64)}});
test('HR authentication reads current roles in one query without refreshing the workspace',async()=>{
 const calls=[],pool={execute:async(sql,args)=>{calls.push({sql,args});return [[active()]];}};
 const req=request();await requireRecruitmentUser(req,pool,'https://jrs.example');assert.equal(calls.length,1);assert.equal(req.user.id,'team-hr-4');assert.equal(req.user.role,'HR_MANAGER');assert.equal(req.sharedAccount.account_id,7);assert.ok(!calls[0].sql.includes('password_hash'));
});
test('HR authentication rejects forged cookies before querying and never trusts browser roles',async()=>{
 const pool={execute:async()=>{throw Error('unexpected SQL');}};
 await assert.rejects(requireRecruitmentUser({method:'GET',headers:{cookie:'jrs_candidate_session=fake','x-role':'HR_MANAGER'}},pool,'https://jrs.example'),{status:401});
 const candidate={...active(),account_role:'candidate'};
 await assert.rejects(requireRecruitmentUser(request(),{execute:async()=>[[candidate]]},'https://jrs.example'),{status:403});
});
test('revoked sessions, disabled accounts and role mismatches fail immediately',async()=>{
 for(const row of [null,{...active(),hr_status:'DISABLED'},{...active(),status:'Inactive'},{...active(),role:'HR_STAFF'}])await assert.rejects(requireRecruitmentUser(request(),{execute:async()=>[row?[row]:[]]},'https://jrs.example'));
});
test('HR writes retain CSRF and same-origin enforcement before any profile update',async()=>{
 const calls=[],pool={execute:async(sql)=>{calls.push(sql);return [[{...active(),name:'Stale'}]];}};
 await assert.rejects(requireRecruitmentUser(request('POST'),pool,'https://jrs.example'),{status:403});assert.equal(calls.length,1);
 const req=request('POST');req.headers['x-csrf-token']='b'.repeat(64);req.headers.origin='https://evil.example';await assert.rejects(requireRecruitmentUser(req,pool,'https://jrs.example'),{status:403});
});
test('changed canonical HR details update once and expose canonical identity',async()=>{
 const calls=[],pool={execute:async(sql)=>{calls.push(sql);return [[{...active(),name:'Old manager'}]];}};
 const req=request();await requireRecruitmentUser(req,pool,'https://jrs.example');assert.equal(calls.length,2);assert.match(calls[1],/^UPDATE recruiting_user/);assert.equal(req.user.name,'Manager');
});
test('canonical refresh batches reads independently of candidate count and does not rewrite unchanged profiles',async()=>{
 const people=Array.from({length:40},(_,i)=>({candidate_id:i+1,account_id:i+1,full_name:'Person '+i,email:'p'+i+'@example.test',contact_number:'',home_location:'',availability_status:'AVAILABLE'}));
 const stored=people.map((c,i)=>({id:'account-'+c.account_id,name:c.full_name,email:c.email,phone:'',location:'',experience:0,education:'Not recorded',skills:[]}));
 const calls=[],db={beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){},query:async(sql)=>{calls.push(sql);if(sql.includes('UNION ALL'))return [[...people.map(record=>({entity:'people',record})),...stored.map(record=>({entity:'stored',record})),...people.map(c=>({entity:'links',record:{canonical_id:c.candidate_id,recruiting_id:'account-'+c.account_id}}))]];return [[]];}};
 await refreshCanonicalPeople({getConnection:async()=>db});assert.equal(calls.length,2);assert.ok(!calls.some(sql=>/^(UPDATE|INSERT|DELETE)/.test(sql)));
});