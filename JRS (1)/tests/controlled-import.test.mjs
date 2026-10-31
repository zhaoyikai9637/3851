import test from 'node:test';
import assert from 'node:assert/strict';
const {planControlledImport, approveImport}=await import('../server/controlled-import.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const schema={
 CANDIDATE:{key:'candidate_id',columns:['candidate_id','email','full_name','account_id'],foreignKeys:[]},
 APPLICATION:{key:'application_id',columns:['application_id','candidate_id','position_id'],foreignKeys:[{column:'candidate_id',table:'CANDIDATE',target:'candidate_id'},{column:'position_id',table:'JOB_POSITION',target:'position_id'}]},
 JOB_POSITION:{key:'position_id',columns:['position_id','title'],foreignKeys:[]}
};
const existing={CANDIDATE:[{candidate_id:1,email:'existing@example.test',full_name:'Existing',account_id:null}],JOB_POSITION:[{position_id:2,title:'Developer'}],APPLICATION:[]};
test('controlled import plans inserts with explicit ID mappings and resolves application references',()=>{
 assert.equal(typeof planControlledImport,'function','Controlled import planner is missing');
 const batch={rows:{CANDIDATE:[{candidate_id:1,email:'new@example.test',full_name:'New',account_id:null}],APPLICATION:[{application_id:8,candidate_id:1,position_id:2}]},idMap:{CANDIDATE:{1:7}}};
 const plan=planControlledImport(batch,schema,existing);
 assert.deepEqual(plan.conflicts,[]);
 assert.equal(plan.inserts[0].row.candidate_id,7);
 assert.equal(plan.inserts[1].row.candidate_id,7);
 assert.equal(existing.CANDIDATE.length,1);
 assert.equal(approveImport(plan,plan.digest).length,2);
});
test('conflicting IDs or email identities cannot overwrite authoritative rows',()=>{
 const plan=planControlledImport({rows:{CANDIDATE:[{candidate_id:1,email:'new@example.test',full_name:'New'},{candidate_id:9,email:'EXISTING@example.test',full_name:'Other'}]}},schema,existing);
 assert.equal(plan.conflicts.length,2);
 assert.throws(()=>approveImport(plan,plan.digest),/conflicts/);
 assert.equal(existing.CANDIDATE[0].full_name,'Existing');
});
test('an exact existing row is skipped and a changed preview needs fresh approval',()=>{
 const plan=planControlledImport({rows:{CANDIDATE:[existing.CANDIDATE[0]]}},schema,existing);
 assert.equal(plan.skipped.length,1);assert.equal(plan.inserts.length,0);
 assert.throws(()=>approveImport(plan,'stale'),/digest/);
 plan.inserts.push({table:'CANDIDATE',row:{candidate_id:9}});
 assert.throws(()=>approveImport(plan,plan.digest),/changed/);
});
test('credentials, unknown columns, account attachment and missing foreign keys fail closed',()=>{
 for(const rows of [{MODULE_ACCOUNT:[{account_id:3}]},{CANDIDATE:[{candidate_id:3,password:'secret'}]},{CANDIDATE:[{candidate_id:3,email:'new@example.test',account_id:1}]},{APPLICATION:[{application_id:9,candidate_id:999,position_id:2}]}]){
  const plan=planControlledImport({rows},schema,existing);
  assert.ok(plan.conflicts.length);assert.throws(()=>approveImport(plan,plan.digest));
 }
});
