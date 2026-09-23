const test=globalThis.test??require('node:test').test;
const assert=require('node:assert/strict');
const {once}=require('node:events');
const {randomUUID}=require('node:crypto');
const {createApp}=require('../server/app.cjs');
const {config}=require('../server/config.cjs');
const {memoryRepository}=require('./helpers/memory-repository.cjs');
async function fixture(run){
  const repo=await memoryRepository(),cfg=config({PORT:'3000'}),server=createApp({repo,cfg}).listen(0,'127.0.0.1');await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port;
  const request=async(path,{body,method='GET',cookie,csrf,headers={}}={})=>{
    const r=await fetch(base+path,{method,headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
    const data=await r.json();return {status:r.status,data,headers:r.headers};
  };
  const login=async(email='manager@jrs.local')=>{const r=await request('/api/auth/login',{method:'POST',body:{email,password:'Integration-password-123'}});assert.equal(r.status,200);return {cookie:r.headers.get('set-cookie').split(';')[0],csrf:r.data.csrfToken,user:r.data.user};};
  try{await run({repo,request,login});}finally{await new Promise(resolve=>server.close(resolve));}
}
test('HTTP rejects anonymous HR data, wrong-origin writes and missing CSRF',async()=>fixture(async({request,login})=>{
  assert.equal((await request('/api/hr/workspace')).status,401);
  const session=await login();assert.match(session.cookie,/jrs_session=/);
  const r=await request('/api/hr/workspace',session);assert.equal(r.status,200);assert.equal(r.data.applications.length,115);assert.equal(r.headers.get('cache-control'),'no-store');assert.ok(!JSON.stringify(r.data).includes('password_hash'));
  assert.equal((await request('/api/hr/commands/read-all',{method:'POST',cookie:session.cookie,body:{},headers:{'If-Match':'0','Idempotency-Key':randomUUID()}})).status,403);
  assert.equal((await request('/api/hr/commands/read-all',{...session,method:'POST',body:{},headers:{Origin:'https://other.invalid','If-Match':'0','Idempotency-Key':randomUUID()}})).status,403);
}));
test('HTTP duplicate request returns one saved transition; stale users cannot overwrite',async()=>fixture(async({request,login,repo})=>{
  const s=await login(),id=repo.inspect().applications[0].id,key=randomUUID(),options={...s,method:'POST',body:{applicationId:id,notes:'Private',notify:true},headers:{'If-Match':'0','Idempotency-Key':key}};
  const first=await request('/api/hr/commands/move-interview',options);assert.equal(first.status,200);assert.equal(first.data.result.activity.actor,'Junye Shen');
  const repeat=await request('/api/hr/commands/move-interview',options);assert.equal(repeat.status,200);assert.equal(repeat.data.result.activity.id,first.data.result.activity.id);assert.equal(repo.inspect().notifications.length,1);
  const stale=await request('/api/hr/commands/reject',{...s,method:'POST',body:{applicationId:id,reason:'Mismatch'},headers:{'If-Match':'0','Idempotency-Key':randomUUID()}});assert.equal(stale.status,409);assert.equal(stale.data.error.code,'REVISION_CONFLICT');assert.equal(repo.inspect().applications[0].stage,'Interview');
}));
test('HTTP validates business errors without saving a partial mutation',async()=>fixture(async({request,login,repo})=>{
  const s=await login(),before=JSON.stringify(repo.inspect());const r=await request('/api/hr/commands/reject',{...s,method:'POST',body:{applicationId:repo.inspect().applications[0].id,reason:' '},headers:{'If-Match':'0','Idempotency-Key':randomUUID()}});
  assert.equal(r.status,422);assert.equal(JSON.stringify(repo.inspect()),before);
}));
test('HR profile only changes editable fields, and logout invalidates the session',async()=>fixture(async({request,login})=>{
  const s=await login();const r=await request('/api/hr/commands/profile-save',{...s,method:'POST',body:{phone:'+65 8123 4567',officeLocation:'Singapore Office',role:'HR_STAFF',email:'other@jrs.local'},headers:{'If-Match':'0','Idempotency-Key':randomUUID()}});
  assert.equal(r.status,200);assert.equal(r.data.db.currentUser.phone,'+65 8123 4567');assert.equal(r.data.db.currentUser.role,'HR_MANAGER');assert.equal(r.data.db.currentUser.email,'manager@jrs.local');
  assert.equal((await request('/api/auth/logout',{...s,method:'POST',body:{}})).status,200);assert.equal((await request('/api/hr/workspace',s)).status,401);
}));
test('system notification read status is per user, and staff cannot approve offers',async()=>fixture(async({request,login,repo})=>{
  const m=await login(),s=await login('staff@jrs.local'),d=repo.inspect();
  const moved=await request('/api/hr/commands/move-interview',{...m,method:'POST',body:{applicationId:d.applications[0].id},headers:{'If-Match':'0','Idempotency-Key':randomUUID()}});
  const n=moved.data.db.systemNotifications[0];await request('/api/hr/commands/system-read',{...m,method:'POST',body:{id:n.id},headers:{'If-Match':'1','Idempotency-Key':randomUUID()}});
  assert.equal((await request('/api/hr/workspace',m)).data.systemNotifications[0].read,true);assert.equal((await request('/api/hr/workspace',s)).data.systemNotifications[0].read,false);
  const offer=d.applications.find(a=>a.stage==='Offer'&&a.offer.approval!=='Approved');
  const r=await request('/api/hr/commands/approve-offer',{...s,method:'POST',body:{applicationId:offer.id},headers:{'If-Match':'2','Idempotency-Key':randomUUID()}});assert.equal(r.status,403);
}));
