// Jest provides globalThis.test. When this file is run directly with
// `node --test`, fall back to Node's built-in test function.
const test=globalThis.test??require('node:test').test;
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const M=require('../dist/state.js');
function memory(){const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};}
function setup(){const storage=memory(),s=M.createStore(storage);return {s,storage,id:s.db.applications[0].id};}
const schedule=(id,extra={})=>({applicationId:id,date:M.day(2),time:'10:00',duration:60,format:'Video',location:'Meeting link provided separately',interviewer:'Sarah Mitchell',notify:true,...extra});

test('initial counts match the workflow design and all references are valid',()=>{const d=M.seed();assert.ok(M.validate(d));assert.equal(d.applications.length,115);assert.deepEqual(Object.fromEntries(['Offer','Pending Review','Rejected','Interview Results'].map(s=>[s,d.applications.filter(a=>a.stage===s).length])),{Offer:18,'Pending Review':42,Rejected:31,'Interview Results':24});});
test('one review confirmation schedules the interview, changes stage and prepares one accurate unsent draft',()=>{const {s,storage,id}=setup();const result=s.commit('move-interview',schedule(id,{notes:'Review API design'}));assert.equal(s.db.applications[0].stage,'Interview');assert.equal(result.interview.status,'Scheduled');assert.equal(result.interview.applicationId,id);assert.equal(result.interview.location,'Meeting link provided separately');assert.equal(s.db.notifications[0].status,'Draft');assert.equal(s.db.notifications[0].kind,'Interview schedule');assert.equal(s.db.notifications.length,1);assert.match(s.db.notifications[0].body,/10:00 \(Singapore time/);assert.ok(!s.db.notifications[0].body.includes('follow up with the schedule'));assert.equal(result.activity.notes,'Review API design');assert.equal(s.db.activity.length,1);assert.equal(result.activity.from,'Pending Review');assert.equal(result.activity.to,'Interview');assert.equal(result.activity.notificationId,result.notification.id);const reloaded=M.createStore(storage).db;assert.equal(reloaded.applications[0].stage,'Interview');assert.equal(reloaded.interviews.find(i=>i.applicationId===id).id,result.interview.id);});
test('invalid combined booking never partially moves a review or modifies drafts, timeline or revision',()=>{
  const invalid=[{}, {date:'2026-02-30'},{date:M.day(-1)},{time:'24:00'},{duration:20},{location:'  '},{interviewer:''},{format:'Unknown'},{notes:'x'.repeat(501)},{notify:'true'}];
  for(const fields of invalid){const db=M.seed(),id=db.applications[0].id,before=JSON.stringify(db),payload=Object.keys(fields).length?schedule(id,fields):{applicationId:id};assert.throws(()=>M.apply(db,'move-interview',payload));assert.equal(JSON.stringify(db),before,'Direct model validation must precede every mutation');}
});
test('repeated transitions are rejected without changing saved state',()=>{const {s,id}=setup();s.commit('move-interview',schedule(id));const snapshot=JSON.stringify(s.db);assert.throws(()=>s.commit('move-interview',schedule(id)),/not available/);assert.equal(JSON.stringify(s.db),snapshot);});
test('blank rejection reason is blocked and does not partially mutate data',()=>{const {s,id}=setup();const before=JSON.stringify(s.db);assert.throws(()=>s.commit('reject',{applicationId:id,reason:'  '}),/required/);assert.equal(JSON.stringify(s.db),before);});
test('rejection cancels scheduled interviews; internal notes do not leak into email',()=>{const {s,id}=setup();s.commit('move-interview',schedule(id));s.commit('reject',{applicationId:id,reason:'Skills gap',notes:'INTERNAL-PRIVATE',notify:true});assert.equal(s.db.applications[0].stage,'Rejected');assert.equal(s.db.interviews.find(i=>i.applicationId===id).status,'Cancelled');assert.ok(!s.db.notifications[0].body.includes('INTERNAL-PRIVATE'));});
test('notification-off saves no email draft',()=>{const {s,id}=setup();s.commit('reject',{applicationId:id,reason:'Skills gap',notify:false});assert.equal(s.db.notifications.length,0);});
test('scheduling before interview stage and past dates are blocked',()=>{const {s,id}=setup();assert.throws(()=>s.commit('schedule',schedule(id)),/Interview/);const r=s.commit('move-interview',schedule(id));assert.throws(()=>s.commit('schedule',schedule(id,{interviewId:r.interview.id,date:M.day(-1)})),/future/);});
test('combined moves block interviewer, room and candidate overlaps atomically; adjacent appointments work',()=>{const {s,id}=setup();const second=s.db.applications.find(a=>a.stage==='Pending Review'&&a.id!==id).id;s.commit('move-interview',schedule(id,{format:'On-site',location:'Room A'}));const before=JSON.stringify(s.db);assert.throws(()=>s.commit('move-interview',schedule(second,{time:'10:30'})),/overlaps/);assert.equal(JSON.stringify(s.db),before);assert.throws(()=>s.commit('move-interview',schedule(second,{time:'10:30',format:'On-site',location:'Room A',interviewer:'Another reviewer'})),/overlaps/);assert.equal(JSON.stringify(s.db),before);const samePerson=M.clone(s.db);samePerson.applications.find(a=>a.id===second).candidateId=samePerson.applications[0].candidateId;const snapshot=JSON.stringify(samePerson);assert.throws(()=>M.apply(samePerson,'move-interview',schedule(second,{time:'10:30',location:'Room B',interviewer:'Another reviewer'})),/overlaps/);assert.equal(JSON.stringify(samePerson),snapshot);assert.doesNotThrow(()=>s.commit('move-interview',schedule(second,{time:'11:00'})));});
test('reschedule updates the combined booking and supersedes its old draft without another transition',()=>{const {s,id}=setup();const r=s.commit('move-interview',schedule(id));const oldNotice=s.db.notifications[0].id;s.commit('schedule',schedule(id,{interviewId:r.interview.id,time:'12:00'}));assert.equal(s.db.interviews.filter(i=>i.applicationId===id).length,1);assert.equal(s.db.interviews.find(i=>i.applicationId===id).time,'12:00');assert.equal(s.db.notifications.find(n=>n.id===oldNotice).status,'Superseded');assert.equal(s.db.activity.filter(x=>x.from&&x.to).length,1);});
test('legacy unscheduled Interview applications can still be booked without changing their stage',()=>{const {s,id}=setup();const legacy=M.clone(s.db);legacy.applications[0].stage='Interview';s.restore(legacy);const r=s.commit('schedule',schedule(id));assert.equal(r.interview.status,'Scheduled');assert.equal(s.db.applications[0].stage,'Interview');assert.equal(s.db.activity.filter(x=>x.from&&x.to).length,0);});
test('combined confirmation without notification still saves a scheduled interview',()=>{const {s,id}=setup();const r=s.commit('move-interview',schedule(id,{notify:false}));assert.equal(r.interview.status,'Scheduled');assert.equal(s.db.applications[0].stage,'Interview');assert.equal(s.db.notifications.length,0);});
test('completed feedback moves a past interview into results',()=>{const {s,id}=setup();const r=s.commit('move-interview',schedule(id));const data=M.clone(s.db);data.interviews.find(i=>i.id===r.interview.id).date=M.day(-1);s.restore(data);s.commit('feedback',{applicationId:id,interviewId:r.interview.id,rating:4,recommendation:'Proceed',notes:'Strong technical skills'});assert.equal(s.db.applications[0].stage,'Interview Results');assert.equal(s.db.interviews.find(i=>i.id===r.interview.id).status,'Completed');});
test('future interview feedback is blocked',()=>{const {s,id}=setup();const r=s.commit('move-interview',schedule(id));assert.throws(()=>s.commit('feedback',{applicationId:id,interviewId:r.interview.id,rating:4,recommendation:'Proceed',notes:'Feedback'}),/after/);});
test('offer requires results, valid salary and coherent dates',()=>{const {s,id}=setup();assert.throws(()=>s.commit('offer',{applicationId:id}),/results/);const resultId=s.db.applications.find(a=>a.stage==='Interview Results').id;assert.throws(()=>s.commit('offer',{applicationId:resultId,salary:-1,startDate:M.day(30),expiry:M.day(7),terms:'Terms'}),/salary/);assert.throws(()=>s.commit('offer',{applicationId:resultId,salary:5000,startDate:M.day(2),expiry:M.day(7),terms:'Terms'}),/start date/);});
test('offer approval, notification and acceptance form a coherent flow',()=>{const {s}=setup();const id=s.db.applications.find(a=>a.stage==='Interview Results').id;s.commit('offer',{applicationId:id,salary:5500,startDate:M.day(30),expiry:M.day(7),terms:'Standard benefits'});assert.throws(()=>s.commit('offer-message',{applicationId:id}),/Approve/);s.commit('approve-offer',{applicationId:id});s.commit('offer-message',{applicationId:id});assert.throws(()=>s.commit('offer-message',{applicationId:id}),/already/);s.commit('accept-offer',{applicationId:id,notes:'Candidate confirmed by phone'});assert.equal(s.db.applications.find(a=>a.id===id).stage,'Hired');});
test('closed job blocks progression and rescheduling but preserves applicants',()=>{const {s,id}=setup();const jobId=s.db.applications[0].jobId;s.commit('job-status',{id:jobId,status:'Closed'});assert.equal(s.db.applications.length,115);assert.throws(()=>s.commit('move-interview',schedule(id)),/Activate/);s.commit('job-status',{id:jobId,status:'Active'});const r=s.commit('move-interview',schedule(id));s.commit('job-status',{id:jobId,status:'Closed'});assert.throws(()=>s.commit('schedule',schedule(id,{interviewId:r.interview.id})),/active/);});

function jobPayload(db,requirements,id=db.jobs[0].id){const j=db.jobs[0];return {...j,id,skills:j.skills.join(', '),requirements};}
function jobCriteria(count){return [...M.requirements.forTitle('Software Developer'),'Ability to review pull requests and explain maintainability trade-offs.','Practical knowledge of diagnosing production errors and implementing recovery fixes.'].slice(0,count);}

test('job requirements normalize bullets and numbering without changing the actual criteria',()=>{
  const lines=['  1. Build and maintain tested web application features.  ','','2) Diagnose and fix application defects with reproducible evidence.',' - Explain implementation choices clearly to colleagues.','• Use Git branches and resolve merge conflicts collaboratively.'];
  assert.deepEqual(M.requirements.parse(lines.join('\n')),['Build and maintain tested web application features.','Diagnose and fix application defects with reproducible evidence.','Explain implementation choices clearly to colleagues.','Use Git branches and resolve merge conflicts collaboratively.']);
});

test('every supported role template has ten substantive criteria and unknown roles remain blank',()=>{
  const seen=new Set();
  for(const j of M.seed().jobs){
    const criteria=M.requirements.forTitle(j.title);assert.equal(criteria.length,10,j.title);
    assert.equal(new Set(criteria.map(x=>x.toLowerCase())).size,10,j.title);
    assert.ok(criteria.every(x=>x.trim().split(/\s+/).length>=4),j.title+' must describe a hiring criterion');
    assert.ok(criteria.every(x=>!/^\s*(?:location|department|employment type|work arrangement)\s*:/i.test(x)),j.title+' must not contain job metadata filler');
    assert.deepEqual(M.requirements.validate(criteria.join('\n')),criteria);
    seen.add(criteria.join('\n'));assert.deepEqual(j.requirements,criteria,j.title+' demo requirements should be complete');
  }
  assert.equal(seen.size,M.seed().jobs.length,'Each role needs its own requirements rather than one generic list');
  assert.deepEqual(M.requirements.forTitle('Unlisted specialist role'),[]);
});

test('job-save accepts eight and twelve numbered criteria and preserves every item on create and update',()=>{
  for(const count of [8,12]){
    const {s,storage}=setup(),criteria=jobCriteria(count),numbered=criteria.map((x,i)=>(i+1)+'. '+x).join('\n');
    s.commit('job-save',jobPayload(s.db,numbered));assert.deepEqual(s.db.jobs[0].requirements,criteria);
    assert.deepEqual(M.createStore(storage).db.jobs[0].requirements,criteria);
    // Explicitly omit the id to exercise creation as well as editing an existing job.
    const fresh=jobPayload(s.db,numbered);delete fresh.id;s.commit('job-save',fresh);
    assert.deepEqual(s.db.jobs.at(-1).requirements,criteria);
  }
});

test('invalid job requirement counts, duplicates and excessive text fail before model state is changed',()=>{
  const criteria=jobCriteria(12),invalid=[
    '',criteria.slice(0,1).join('\n'),criteria.slice(0,7).join('\n'),[...criteria,'Ability to maintain useful operational documentation for the team.'].join('\n'),
    [...criteria.slice(0,7),criteria[0].toUpperCase()].map((x,i)=>(i+1)+') '+x).join('\n'),
    ['x'.repeat(351),...criteria.slice(0,7)].join('\n'),
    Array.from({length:10},(_,i)=>'Criterion '+i+' '+('x'.repeat(300))).join('\n')
  ];
  for(const requirements of invalid){
    const db=M.seed(),before=JSON.stringify(db);
    assert.throws(()=>M.apply(db,'job-save',jobPayload(db,requirements)));
    assert.equal(JSON.stringify(db),before,'Invalid requirements cannot partially change the job or audit history');
  }
});
test('task completion is recorded and cannot be duplicated',()=>{const {s,id}=setup();s.commit('task',{applicationId:id,title:'Prepare questions',assignee:'Sarah',due:M.day(1)});const t=s.db.tasks[0];s.commit('complete-task',{id:t.id});assert.equal(s.db.tasks[0].status,'Completed');assert.throws(()=>s.commit('complete-task',{id:t.id}),/already/);});
test('storage failure does not report unsaved changes as committed',()=>{const {s,storage,id}=setup();storage.setItem=()=>{throw Error('Quota exceeded');};assert.throws(()=>s.commit('move-interview',schedule(id)),/not saved/);assert.equal(s.db.applications[0].stage,'Pending Review');assert.ok(!s.db.interviews.some(i=>i.applicationId===id));});
test('concurrent-tab edits are detected instead of overwriting them',()=>{const {s,storage,id}=setup();const other=M.createStore(storage);other.commit('move-interview',schedule(id));assert.throws(()=>s.commit('reject',{applicationId:id,reason:'Skills gap'}),/another tab/);});
test('corrupt backups and foreign references are rejected',()=>{const {s,storage}=setup();const value=M.clone(s.db);value.applications[0].jobId='missing';assert.throws(()=>s.restore(value),/not found/);storage.setItem(M.KEY,'not-json');const broken=M.createStore(storage);assert.ok(broken.error);assert.equal(broken.raw,'not-json');assert.throws(()=>broken.commit('read-all'),/Saved data/);});
test('all page templates render from shared data and escape imported/user text',()=>{
  const context={console,Blob,HRModel:M,window:{}};context.window=context;vm.createContext(context);for(const f of ['icons.js','resume.js','views.js','review.js'])vm.runInContext(fs.readFileSync(require.resolve('../dist/'+f),'utf8'),context);
  const d=M.seed(),a=d.applications[0],ui={page:1,q:'',job:'',stage:'',priority:'',from:'',to:'',full:false,period:'today',resumePage:1,zoom:90,jobStatus:'',interviewStatus:'',interviewDate:'',noticeTab:'all'};
  for(const route of [['dashboard'],['applications'],['review',a.id],['candidates'],['candidate',a.candidateId],['jobs'],['interviews'],['reports'],['notifications']])assert.ok(context.HRViews.render(route,d,{...ui}).length>100,route.join('/'));
  const update=M.apply(d,'move-interview',schedule(a.id,{notes:'Review API knowledge'}));assert.equal(update.activity.notificationId,update.notification.id);assert.equal(update.interview.status,'Scheduled');assert.ok(context.HRViews.button('close','Cancel').includes('type="button"'));
  d.candidates[0].name='<script>alert(1)</script>';const html=context.HRViews.render(['candidate',a.candidateId],d,{...ui});assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));
});
