const test=globalThis.test??require('node:test').test;
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const M=require('../dist/state.js');
const {applyCommand,fillTemplate,email}=require('../server/service.cjs');
const {passwordHash,verify}=require('../server/auth.cjs');
const {templates}=require('../scripts/database.cjs');
const user={id:'test-hr',name:'Junye Shen',role:'HR_MANAGER'};
function setup(){return {...M.seed(),templates:templates(),systemNotifications:[],mailLogs:[],currentUser:user};}
function run(db,cmd,p,u=user){const next=M.clone(db);const result=applyCommand(next,cmd,p,u);return {db:next,result};}

test('interview criteria retain their own scores without replacing the manual overall rating or recommendation',()=>{
  const db=setup(),a=db.applications[0];a.stage='Interview';
  db.interviews=[{id:'assessment-meeting',applicationId:a.id,date:M.day(-2),time:'10:00',duration:45,format:'Video',location:'Test meeting',interviewer:user.name,status:'Scheduled',feedback:null}];
  const assessment=JSON.stringify([{label:'System design',rating:5},{label:'Communication',rating:4}]);
  const saved=run(db,'feedback',{applicationId:a.id,interviewId:'assessment-meeting',rating:2,recommendation:'Hold',notes:'Explicit human assessment.',assessment}).db;
  assert.deepEqual(saved.interviews[0].feedback.assessment,[{label:'System design',rating:5},{label:'Communication',rating:4}]);
  assert.equal(saved.applications[0].feedback.rating,2);
  assert.equal(saved.applications[0].feedback.recommendation,'Hold');
});

test('invalid or duplicate assessment criteria fail before changing the application',()=>{
  for(const assessment of ['not JSON','{}',JSON.stringify([{label:'Communication',rating:4},{label:' communication ',rating:2}]),JSON.stringify([{label:'Skill',rating:6}]),JSON.stringify([{label:'',rating:3}])]){
    const db=setup(),a=db.applications[0];a.stage='Interview';
    db.interviews=[{id:'assessment-meeting',applicationId:a.id,date:M.day(-2),time:'10:00',duration:45,status:'Scheduled',feedback:null}];
    const previous=JSON.stringify(db);
    assert.throws(()=>applyCommand(db,'feedback',{applicationId:a.id,interviewId:'assessment-meeting',rating:4,recommendation:'Proceed',notes:'Explicit human assessment.',assessment},user));
    assert.equal(JSON.stringify(db),previous);
  }
});

test('direct backend job updates enforce requirements and preserve the complete list atomically',()=>{
  const criteria=[...M.requirements.forTitle('Software Developer'),'Ability to review pull requests and explain maintainability trade-offs.','Practical knowledge of diagnosing production errors and implementing recovery fixes.'];
  const payload=(d,requirements)=>({...d.jobs[0],skills:d.jobs[0].skills.join(', '),requirements});
  for(const count of [8,12]){
    const d=setup(),expected=criteria.slice(0,count);
    applyCommand(d,'job-save',payload(d,expected.map((x,i)=>(i+1)+'. '+x).join('\n')),user);
    assert.deepEqual(d.jobs[0].requirements,expected);
  }
  const invalid=[criteria.slice(0,7).join('\n'),[...criteria,'Ability to document and communicate operational fixes.'].join('\n'),[...criteria.slice(0,7),criteria[0].toUpperCase()].join('\n')];
  for(const value of invalid){
    const d=setup(),before=JSON.stringify(d);
    assert.throws(()=>applyCommand(d,'job-save',payload(d,value),user),e=>e.status===422);
    assert.equal(JSON.stringify(d),before,'The API cannot save invalid criteria or an audit event');
  }
});

const currentYear=Number(M.day().slice(0,4));
const oldGraduation=String(currentYear-2)+'-06-15';
function candidateFields(c,extra={}){return {id:c.id,name:c.name,email:c.email,phone:c.phone,location:c.location,experience:c.experience,education:c.education,skills:c.skills.join(', '),...extra};}
function setQualified(c,j){Object.assign(c,{educationLevel:'Bachelor degree',educationMajor:'Computer Science',graduationDate:oldGraduation,graduateStatus:'Experienced'});Object.assign(j,{minimumEducationLevel:'Bachelor degree',acceptedMajors:['Computer Science']});}

test('HR decisions work with missing, differing and current-year education across the entire workflow',()=>{
  const cases=[{graduationDate:currentYear+'-01-01'},{graduationDate:String(currentYear+1)+'-01-01'},{graduationDate:null},{educationLevel:'Secondary school'},{educationMajor:'Accounting'},{educationLevel:'Not recorded',educationMajor:'',graduationDate:null}];
  for(const facts of cases)for(const command of ['move-interview','schedule','offer','approve-offer','offer-message','accept-offer']){
    const d=setup(),a=d.applications[0],c=d.candidates.find(c=>c.id===a.candidateId),j=d.jobs.find(j=>j.id===a.jobId);
    Object.assign(c,facts);j.minimumEducationLevel='Not configured';
    a.stage=command==='move-interview'?'Pending Review':command==='schedule'?'Interview':command==='offer'?'Interview Results':'Offer';
    a.feedback={rating:4,recommendation:'Proceed',notes:'HR reviewed the resume',recordedAt:new Date().toISOString()};
    a.offer=['move-interview','schedule','offer'].includes(command)?null:{salary:5000,startDate:M.day(30),expiry:M.day(10),terms:'Terms',approval:command==='approve-offer'?'Awaiting approval':'Approved',status:'Draft'};
    const originalFacts=JSON.stringify(c),payload={applicationId:a.id,notify:true,salary:5000,startDate:M.day(30),expiry:M.day(10),terms:'Terms',date:M.day(2),time:'10:00',duration:45,format:'Video',location:'Meeting',interviewer:'HR',notes:'Candidate confirmed by phone'};
    const result=applyCommand(d,command,payload,user);
    assert.equal(JSON.stringify(c),originalFacts,'A hiring decision cannot rewrite applicant facts');
    if(command==='move-interview')assert.equal(a.stage,'Interview');
    if(command==='schedule')assert.equal(result.interview.applicationId,a.id);
    if(command==='offer')assert.equal(a.stage,'Offer');
    if(command==='approve-offer')assert.equal(a.offer.approval,'Approved');
    if(command==='offer-message')assert.ok(d.notifications.some(n=>n.applicationId===a.id&&n.kind==='Offer'&&n.status==='Draft'));
    if(command==='accept-offer')assert.equal(a.stage,'Hired');
  }
});

test('contact edits preserve applicant education and accept unchanged fields from older clients',()=>{
  const d=setup(),c=d.candidates[0],j=d.jobs.find(j=>j.id===d.applications[0].jobId);setQualified(c,j);
  const fields=candidateFields(c,{phone:'+65 8222 3344',experience:0}),updated=run(d,'candidate-save',fields).db.candidates[0];
  assert.equal(updated.phone,'+65 8222 3344');assert.equal(updated.experience,0);
  const educationFields=['education','educationLevel','educationMajor','graduationDate','graduateStatus'];
  for(const field of educationFields)assert.equal(updated[field],c[field]);
  const legacyPayload=Object.fromEntries(educationFields.map(field=>[field,'  '+c[field]+'  ']));
  const roundTrip=run(d,'candidate-save',{...fields,...legacyPayload}).db.candidates[0];
  for(const field of educationFields)assert.equal(roundTrip[field],c[field],'Equivalent input must preserve the original '+field);
  assert.equal(M.screening.assess(updated,j).allowed,true,'Changing contact details or experience does not change recorded screening facts');
  assert.equal(run(d,'move-interview',{applicationId:d.applications[0].id}).db.applications[0].stage,'Interview');
});

test('HR profile updates cannot alter applicant education or graduate status, even through a direct request',()=>{
  const d=setup(),c=d.candidates[0],j=d.jobs.find(j=>j.id===d.applications[0].jobId);setQualified(c,j);
  const changes=[{educationLevel:'Doctorate'},{educationMajor:'Accounting'},{graduationDate:currentYear+'-01-01'},{education:'Doctorate in Computing'},{graduateStatus:'Fresh graduate'},{education:''},{graduationDate:null},{educationLevel:'University-ish'},{graduationDate:'2026-02-30'}];
  for(const changed of changes){
    const before=JSON.stringify(d);
    assert.throws(()=>applyCommand(d,'candidate-save',candidateFields(c,{phone:'99999999',...changed}),user),e=>e.status===422&&/supplied with the application.*read-only/i.test(e.message));
    assert.equal(JSON.stringify(d),before,'A blocked education edit cannot save contact, screening facts or audit changes');
  }
});

test('contact edits never infer missing legacy facts or convert unknown education into recorded facts',()=>{
  const d=setup(),c=d.candidates[0],j=d.jobs.find(j=>j.id===d.applications[0].jobId);
  for(const key of ['educationLevel','educationMajor','graduationDate','graduateStatus'])delete c[key];
  c.education='Master of Computer Science';
  const updated=run(d,'candidate-save',candidateFields(c,{location:'New office'})).db.candidates[0];
  assert.equal(updated.location,'New office');assert.equal(updated.education,c.education);
  for(const key of ['educationLevel','educationMajor','graduationDate','graduateStatus'])assert.equal(Object.hasOwn(updated,key),false,'An unrelated contact save cannot backfill '+key);
  assert.equal(M.screening.assess(updated,j).status,'Information required');
  const equivalent=run(d,'candidate-save',candidateFields(c,{educationLevel:'Not recorded',educationMajor:'',graduationDate:'',graduateStatus:'Not recorded'})).db.candidates[0];
  assert.deepEqual(equivalent,c,'Equivalent unknown values cannot create or change saved education fields');
  for(const changed of [{educationLevel:'Master degree'},{educationMajor:'Computer Science'},{graduationDate:oldGraduation},{graduateStatus:'Experienced'},{educationLevel:false},{graduationDate:0}])assert.throws(()=>run(d,'candidate-save',candidateFields(c,changed)),e=>e.status===422&&/read-only/i.test(e.message));
});

test('a new applicant needs no academic form fields to be reviewed and moved to interview',()=>{
  const d=setup(),received=run(d,'application-create',{jobId:d.jobs[0].id,candidate:{name:'Resume Review Applicant',email:'resume-review@example.com',phone:'123456789',location:'Singapore',experience:2,skills:'SQL'}});
  const a=received.result.application,c=received.db.candidates.find(c=>c.id===a.candidateId);
  assert.equal(c.educationLevel,'Not recorded');assert.equal(c.graduationDate,null);
  assert.equal(run(received.db,'move-interview',{applicationId:a.id}).db.applications.find(x=>x.id===a.id).stage,'Interview');
});

test('written job requirements suffice while legacy academic metadata remains compatible',()=>{
  const d=setup(),j=d.jobs[0],payload={...j,skills:j.skills.join(', '),requirements:j.requirements.join('\n')};
  delete payload.minimumEducationLevel;delete payload.acceptedMajors;
  const edited=run(d,'job-save',payload).db.jobs[0];
  assert.equal(edited.minimumEducationLevel,j.minimumEducationLevel);assert.deepEqual(edited.acceptedMajors,j.acceptedMajors);
  for(const invalid of [{minimumEducationLevel:'College-ish'},{acceptedMajors:{value:'IT'}},{acceptedMajors:false},{acceptedMajors:42}])assert.throws(()=>run(d,'job-save',{...payload,...invalid}),e=>e.status===422);
  const fresh={...payload};delete fresh.id;
  const written=run(d,'job-save',fresh).db.jobs.at(-1);assert.deepEqual(written.requirements,j.requirements);assert.equal(written.minimumEducationLevel,'Not configured');
  const created=run(d,'job-save',{...fresh,minimumEducationLevel:'Any qualification',acceptedMajors:[]}).db.jobs.at(-1);
  assert.equal(created.minimumEducationLevel,'Any qualification');assert.deepEqual(created.acceptedMajors,[]);
});

test('stage-appropriate templates work without academic screening but retain workflow restrictions',()=>{
  for(const kind of ['Offer Letter','Interview Invite']){
    const d=setup(),a=d.applications[0],c=d.candidates[0];Object.assign(c,{educationLevel:'Not recorded',educationMajor:'Accounting',graduationDate:null});
    a.stage=kind==='Offer Letter'?'Offer':'Interview';a.offer={approval:'Approved',expiry:M.day(7)};
    const t=d.templates.find(t=>t.kind===kind),payload={applicationId:a.id,templateId:t.id,subject:'Test',body:'Test'};
    assert.equal(run(d,'message',payload).result.notification.subject,'Test');
    a.stage='Pending Review';a.offer=null;const before=JSON.stringify(d);
    assert.throws(()=>applyCommand(d,'message',payload,user),e=>e.status===422);assert.equal(JSON.stringify(d),before);
  }
});

test('authenticated actor owns the audit and status notifications omit internal notes',()=>{
  const d=setup(),id=d.applications[0].id;const {db,result}=run(d,'move-interview',{applicationId:id,notes:'PRIVATE REVIEW',notify:true});
  assert.equal(result.activity.actor,user.name);assert.equal(result.activity.actorId,user.id);assert.equal(db.applications[0].notes[0].actor,user.name);
  assert.equal(db.systemNotifications.length,1);assert.ok(!JSON.stringify(db.systemNotifications).includes('PRIVATE REVIEW'));
  assert.ok(result.notification.body.includes(user.name));assert.ok(!result.notification.body.includes('PRIVATE REVIEW'));
});
test('manager approval cannot be forged by a staff payload',()=>{
  const d=setup(),a=d.applications.find(a=>a.stage==='Offer'&&a.offer.approval!=='Approved');
  assert.throws(()=>run(d,'approve-offer',{applicationId:a.id,role:'HR_MANAGER'},{...user,role:'HR_STAFF'}),/HR Manager/);
  assert.equal(a.offer.approval,'Awaiting approval');
});
test('receiving an application creates candidate, application and one internal update',()=>{
  const d=setup(),payload={jobId:d.jobs[0].id,candidate:{name:'Test Applicant',email:'test@jrs.local',phone:'+65 8000 1111',location:'Singapore',experience:3,education:'Diploma',skills:'SQL, JavaScript'}};
  const {db,result}=run(d,'application-create',payload);assert.equal(db.applications.length,116);assert.equal(db.candidates.length,116);assert.equal(result.application.stage,'Pending Review');assert.equal(db.systemNotifications.length,1);
  assert.throws(()=>run(db,'application-create',payload),/email already exists/);
  assert.throws(()=>run(db,'application-create',{jobId:d.jobs[0].id,candidateId:result.application.candidateId}),/already has an application/);
});
test('invalid candidate fields and multiple recipients cannot enter the database',()=>{
  for(const address of ['a,b@jrs.local','a@jrs.local\r\nBcc:evil@test.local','a(comment)@jrs.local','a@jrs.local,b@test.local'])assert.throws(()=>email(address));
  const d=setup();assert.throws(()=>run(d,'candidate-save',{id:d.candidates[0].id,name:'X',email:'x@jrs.local',phone:'1',location:'SG',experience:-1,education:'Degree',skills:'SQL'}),/Experience/);
});
test('templates validate variables, keep snapshots and respect workflow stage',()=>{
  const d=setup(),a=d.applications[0],t=d.templates.find(t=>t.kind==='In Progress');
  const filled=fillTemplate(d,a,user,t);assert.ok(filled.body.includes(d.candidates[0].name));assert.ok(!filled.body.includes('{{'));
  assert.throws(()=>run(d,'template-save',{name:'Unsafe',kind:'In Progress',subject:'Test',body:'{{internalNotes}}'}),/Unknown template variable/);
  const offer=d.templates.find(t=>t.kind==='Offer Letter');assert.throws(()=>run(d,'message',{applicationId:a.id,templateId:offer.id,subject:'Offer',body:'Terms'}),/Approve a valid offer/);
  const {db,result}=run(d,'message',{applicationId:a.id,templateId:t.id,subject:filled.subject,body:filled.body+'\nAdditional details'});
  const snapshot=result.notification.body;run(db,'template-save',{...t,body:'Updated wording'});assert.equal(db.notifications[0].body,snapshot);assert.ok(snapshot.endsWith('Additional details'));
});
test('template permissions and archive preserve existing draft references',()=>{
  const d=setup(),t=d.templates[0];assert.throws(()=>run(d,'template-delete',{id:t.id},{...user,role:'HR_STAFF'}),/HR Manager/);
  const {db}=run(d,'template-delete',{id:t.id});assert.equal(db.templates[0].active,false);assert.throws(()=>run(db,'message',{applicationId:d.applications[0].id,templateId:t.id}),/archived/);
});
test('feedback waits until the meeting ends, not just its start',()=>{
  let d=setup(),a=d.applications[0];d=run(d,'move-interview',{applicationId:a.id}).db;
  const sg=new Date(Date.now()+8*3600000-60000),date=sg.toISOString().slice(0,10),time=sg.toISOString().slice(11,16);
  d.interviews.push({id:'ongoing',applicationId:a.id,date,time,duration:60,format:'Video',location:'Link',interviewer:'HR',notes:'',status:'Scheduled',feedback:null});
  assert.throws(()=>run(d,'feedback',{applicationId:a.id,interviewId:'ongoing',rating:4,recommendation:'Proceed',notes:'Good'}),/after the interview ends/);
});
test('sending locks related workflow changes; sent drafts cannot be edited',()=>{
  let d=setup(),a=d.applications[0];d=run(d,'move-interview',{applicationId:a.id,notify:true}).db;d.notifications[0].status='Sending';
  assert.throws(()=>run(d,'reject',{applicationId:a.id,reason:'Mismatch'}),/being sent/);
  d.notifications[0].status='Sent';assert.throws(()=>run(d,'message',{applicationId:a.id,notificationId:d.notifications[0].id,subject:'Changed',body:'Changed'}));
});
test('strict values reject string notification flags, object text and fractional cents',()=>{
  const d=setup();assert.throws(()=>run(d,'move-interview',{applicationId:d.applications[0].id,notify:'false'}),/true or false/);
  assert.throws(()=>run(d,'reject',{applicationId:d.applications[0].id,reason:{value:'x'}}),/Invalid reason/);
  const a=d.applications.find(a=>a.stage==='Interview Results');assert.throws(()=>run(d,'offer',{applicationId:a.id,salary:5000.999,startDate:M.day(30),expiry:M.day(7),terms:'Terms'}),/two decimal places/);
});
test('passwords use random salts and verify without storing plaintext',async()=>{
  const password='Test-password-12345',a=await passwordHash(password),b=await passwordHash(password);assert.notEqual(a,b);assert.ok(!a.includes(password));assert.ok(await verify(password,a));assert.equal(await verify('Wrong-password',a),false);await assert.rejects(passwordHash('short'));
});
test('new HR routes escape candidate, template and profile data',()=>{
  const context={console,Blob,HRModel:M,window:{}};context.window=context;vm.createContext(context);
  for(const f of ['icons.js','resume.js','views.js','review.js','hr-extra.js'])vm.runInContext(fs.readFileSync(require.resolve('../dist/'+f),'utf8'),context);
  const d=setup();d.currentUser={...user,name:'<script>alert(1)</script>',email:'hr@jrs.local'};d.templates[0].name='<script>alert(1)</script>';d.templates[0].subject='<script>alert(1)</script>';d.templates[0].body='<script>alert(1)</script>';
  const ui={q:'',noticeTab:'all',from:'',to:''};
  for(const route of ['notifications','outbox','templates','mail-log','hr-profile']){const html=context.HRViews.render([route],d,ui);assert.ok(html.length>100);assert.ok(!html.includes('<script>'));}
  assert.ok(context.HRViews.render(['templates'],d,ui).includes('&lt;script&gt;'));
});


test('structured education facts can be saved without requiring duplicate free-text education',()=>{
  const d=setup(),j=d.jobs[0];Object.assign(j,{minimumEducationLevel:'Bachelor degree',acceptedMajors:['Computer Science']});
  const received=run(d,'application-create',{jobId:j.id,candidate:{name:'Structured Education Applicant',email:'structured@example.com',phone:'123456789',location:'Singapore',experience:0,education:'',educationLevel:'Bachelor degree',educationMajor:'Computer Science',graduationDate:oldGraduation,skills:'JavaScript, SQL'}});
  const c=received.db.candidates.find(c=>c.id===received.result.application.candidateId);assert.equal(M.screening.assess(c,j).allowed,true);assert.equal(c.educationLevel,'Bachelor degree');assert.equal(c.educationMajor,'Computer Science');assert.equal(c.graduationDate,oldGraduation);
  const fields=candidateFields(c);delete fields.education;
  const edited=run(received.db,'candidate-save',fields).db.candidates.find(x=>x.id===c.id);
  for(const field of ['educationLevel','educationMajor','graduationDate'])assert.equal(edited[field],c[field]);assert.equal(M.screening.assess(edited,j).allowed,true);
});
