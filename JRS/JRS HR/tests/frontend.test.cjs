const test=globalThis.test??require('node:test').test;
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const M=require('../dist/state.js');

function views(){
  const context={console,Blob,HRModel:M};context.window=context;vm.createContext(context);
  for(const file of ['icons.js','resume.js','views.js','review.js'])vm.runInContext(fs.readFileSync(require.resolve('../dist/'+file),'utf8'),context);
  return context;
}
function state(){return {page:1,q:'',job:'',stage:'',priority:'',from:'',to:'',resumePage:1,zoom:90};}

test('English date inputs accept strict real ISO dates including leap days without calendar rollover',()=>{
  const D=require('../dist/date-input.js');
  for(const iso of ['0001-01-01','2000-02-29','2024-02-29','2026-10-22','9999-12-31']){
    const [year,month,day]=iso.split('-').map(Number);assert.deepEqual(D.parseISO(iso),{year,month,day});
  }
  for(const value of ['',null,undefined,'2026-2-03','22/10/2026','2026-10-22T00:00:00Z','2026-10-22 extra','0000-01-01','10000-01-01','1900-02-29','2026-02-29','2026-04-31','2026-13-01','2026-00-01','2026-01-00','2026-01-32'])assert.equal(D.parseISO(value),null,'Invalid date: '+String(value));
});

test('calendar date limits are inclusive and never treat an empty value as a selected date',()=>{
  const D=require('../dist/date-input.js'),min='2024-02-28',max='2024-03-01';
  for(const iso of [min,'2024-02-29',max])assert.equal(D.isAllowed(iso,min,max),true);
  for(const iso of ['2024-02-27','2024-03-02','2024-02-30',''])assert.equal(D.isAllowed(iso,min,max),false);
  assert.equal(D.isAllowed('2026-10-22'),true);assert.equal(D.isAllowed('2026-10-22','2026-10-22','2026-10-22'),true);
  assert.equal(D.isAllowed('2026-10-21','2026-10-22'),false);assert.equal(D.isAllowed('2026-10-23','','2026-10-22'),false);
});

test('English calendar grids show real month days and disable dates outside the allowed range',()=>{
  const D=require('../dist/date-input.js'),grid=D.monthDays(2024,2,'2024-02-28','2024-03-01'),days=grid.filter(Boolean);
  assert.equal(days.length,29);assert.equal(new Set(days.map(cell=>cell.date)).size,29);
  assert.deepEqual(days.map(cell=>cell.day),Array.from({length:29},(_,i)=>i+1));
  for(const cell of days){assert.equal(cell.date,'2024-02-'+String(cell.day).padStart(2,'0'));assert.equal(cell.disabled,cell.day<28);}
  assert.deepEqual(grid.slice(0,4),[null,null,null,null]);assert.equal(grid[4].date,'2024-02-01','February 2024 begins on Thursday in the Sunday-first calendar');
  for(const [year,expected] of [[1900,28],[2000,29],[2026,28]])assert.equal(D.monthDays(year,2).filter(Boolean).length,expected);
});

test('review status filter, avatar resume links and right-hand actions work across statuses',()=>{
  const {HRViews:V}=views(),db=M.seed(),ui=state();
  const html=V.render(['applications','offer'],db,ui);
  assert.equal(ui.stage,'Offer');assert.ok(html.includes('data-filter="queue"'));
  assert.ok(V.filtered(db,ui).every(a=>a.stage==='Offer'));
  const review=V.render(['applications','pending-review'],db,ui);
  assert.ok(review.includes('class="applicant-resume-link"'));assert.ok(review.includes('Move to Interview'));assert.ok(review.includes('Reject'));assert.ok(review.includes('Details'));
  assert.ok(!review.includes('Applications in this stage.'));
});

test('resume and result pages include the document, job description and complete requirements',()=>{
  const {HRViews:V,HRReview:R}=views(),db=M.seed(),a=db.applications[0],j=db.jobs.find(j=>j.id===a.jobId);
  for(const count of [0,1,8,12,20]){
    j.requirements=Array.from({length:count},(_,i)=>'Saved requirement '+i);
    const rows=R.requirementsRows(j);assert.deepEqual(Array.from(rows),j.requirements);
    const details=R.jobDetails(j),list=(details.match(/<ol class="job-requirements-list">([\s\S]*?)<\/ol>/)||[])[1];
    assert.notEqual(list,undefined);assert.equal((list.match(/<li>/g)||[]).length,count);
    for(const requirement of j.requirements)assert.ok(list.includes(requirement));
    for(const information of [j.location,j.department,j.type,j.mode])assert.ok(!list.includes(information),'Job metadata must not pad the requirements list');
    assert.match(details,/Job Information/i);
    for(const information of [j.location,j.department,j.type,j.mode])assert.ok(details.includes(information));
  }
  const html=V.render(['review',a.id],db,state());
  assert.ok(html.includes('Job Description'));assert.ok(html.includes(j.description));assert.ok(html.includes('Job Requirements'));
  assert.ok(html.includes('resume-pages'));assert.equal((html.match(/class="resume-paper/g)||[]).length,2);
  assert.ok(!html.includes('Resume Review'));assert.ok(!html.includes('data-action="resume-page"'));
  const result=db.applications.find(x=>x.stage==='Interview Results');
  const results=V.render(['results',result.id],db,state());
  assert.ok(results.includes('Scrollable resume'));assert.ok(results.includes('Interview feedback'));assert.ok(results.includes('Prepare Offer'));
  db.candidates.find(c=>c.id===result.candidateId).graduationDate=M.day().slice(0,4)+'-01-01';
  assert.ok(!/data-action="offer-edit"[^>]*disabled/.test(V.render(['results',result.id],db,state())));
});

test('HR reviews resumes against written requirements without academic prompts or blocked decisions',()=>{
  const {HRViews:V}=views(),db=M.seed(),review=db.applications.find(a=>a.stage==='Pending Review'),result=db.applications.find(a=>a.stage==='Interview Results');
  for(const [route,application,action] of [['review',review,'move-interview'],['results',result,'offer-edit']]){
    const applicant=db.candidates.find(c=>c.id===application.candidateId),j=db.jobs.find(j=>j.id===application.jobId);
    Object.assign(applicant,{educationLevel:'Not recorded',educationMajor:'Accounting',graduationDate:null});
    let html=V.render([route,application.id],db,state());
    for(const text of ['screening-status','Awaiting applicant info','Requirements not met','Field of study not accepted','Update education details'])assert.ok(!html.includes(text));
    assert.ok(html.includes('Job Requirements'));assert.ok(!new RegExp('data-action="'+action+'"[^>]*disabled').test(html));
    j.status='Closed';html=V.render([route,application.id],db,state());
    assert.match(html,new RegExp('data-action="'+action+'"[^>]*disabled'),'A closed job still blocks progression');
  }
});

test('review and results keep the resume and decisions without duplicate navigation or activity buttons',()=>{
  const {HRViews:V}=views(),db=M.seed();
  for(const [route,stage,action] of [['review','Pending Review','move-interview'],['results','Interview Results','offer-edit']]){
    const application=db.applications.find(a=>a.stage===stage),html=V.render([route,application.id],db,state());
    assert.ok(html.includes('aria-label="Applicant resume"'));assert.ok(html.includes('data-action="'+action+'"'));
    for(const label of ['Back to list','Previous','Next','Applicant details','Application details','View profile','View activity'])assert.ok(!new RegExp('>'+label+'<','i').test(html),'Remove duplicate action: '+label);
    assert.ok(!html.includes('data-action="activity"'));
    assert.ok(!html.includes('class="heading-actions"'),'Use the existing breadcrumb instead of a second navigation group');
  }
});

test('application lists keep ordinary workflow attention and preserve legacy records without academic holds',()=>{
  const {HRViews:V}=views(),db=M.seed(),pending=db.applications.find(a=>a.stage==='Pending Review'),offer=db.applications.find(a=>a.stage==='Offer');
  db.applications=[pending,offer];for(const c of db.candidates)Object.assign(c,{educationLevel:'Not recorded',educationMajor:'Accounting',graduationDate:null});
  let html=V.render(['applications','pending-review'],db,state());assert.ok(!/data-action="move-interview"[^>]*disabled/.test(html));
  offer.offer.expiry=M.day(-1);const before=JSON.stringify(db);html=V.render(['applications','offer'],db,state());
  assert.ok(html.includes('Offer expired'));assert.ok(html.includes('Review Offer'));
  assert.ok(html.includes('Review terms or close application'));assert.ok(!html.includes('Ready for candidate response'),'Expired offers cannot be presented as awaiting acceptance');
  for(const text of ['Offer on hold','Awaiting applicant info','Field of study not accepted'])assert.ok(!html.includes(text));
  assert.equal(JSON.stringify(db),before,'Rendering cannot rewrite applicant facts or stages');
});

test('intake and contact editing need no academic inputs',async()=>{
  const context=views(),db=M.seed(),V=context.HRViews,applicant=db.candidates[0];let dialog;
  vm.runInContext(fs.readFileSync(require.resolve('../dist/hr-extra.js'),'utf8'),context);
  const extra=context.HRExtra.attach({store:{db},open(title,subtitle,html){dialog={title,subtitle,html};},
    form(command,id,content){return '<form data-command="'+V.e(command)+'" data-id="'+V.e(id)+'">'+content+'</form>';},
    field(label,name,value='',type='text',attributes=''){return '<label>'+label+'<input name="'+V.e(name)+'" type="'+V.e(type)+'" value="'+V.e(value)+'" '+attributes+'></label>';},
    choice(label,name,values,value=''){return '<label>'+label+'<select name="'+V.e(name)+'">'+values.map(option=>{const [id,text]=Array.isArray(option)?option:[option,option];return '<option value="'+V.e(id)+'" '+(id===value?'selected':'')+'>'+V.e(text)+'</option>';}).join('')+'</select></label>';},
    area(){return '';},render(){},go(){},notify(){},close(){}});
  await extra.action('candidate-edit',applicant.id);
  assert.match(dialog.html,/data-command="candidate-save"/);
  for(const name of ['name','email','phone','location'])assert.match(dialog.html,new RegExp('<input[^>]*name="'+name+'"'));
  for(const name of ['educationLevel','educationMajor','graduationDate','education','graduateStatus'])assert.ok(!new RegExp('<(?:input|select|textarea)\\b[^>]*name="'+name+'"').test(dialog.html),'Education must not be editable by HR: '+name);
  await extra.action('application-new');
  assert.match(dialog.html,/data-command="application-create"/);
  for(const name of ['educationLevel','educationMajor','graduationDate','education'])assert.ok(!new RegExp('<(?:input|select|textarea)\\b[^>]*name="'+name+'"').test(dialog.html));
  assert.ok(!/<(?:input|select)\b[^>]*name="graduateStatus"/.test(dialog.html));
});

test('interviews show Applicant and Interview Status columns',()=>{
  const {HRViews:V}=views(),html=V.render(['interviews'],M.seed(),state());
  assert.ok(html.includes('<th>APPLICANT</th>'));assert.ok(html.includes('<th>INTERVIEW STATUS</th>'));assert.ok(!html.includes('<th>POSITION</th>'));
});

test('each application deep link renders only its stage without repeated cards, status filters or workflow column',()=>{
  const {HRViews:V}=views(),db=M.seed();
  for(const [slug,stage] of V.applicationStages){
    const ui=state(),html=V.render(['applications',slug],db,ui);
    assert.equal(ui.stage,stage);
    assert.equal(V.filtered(db,ui).length,db.applications.filter(a=>a.stage===stage).length);
    assert.ok(!html.includes('workflow-card'));
    assert.ok(!html.includes('data-filter="stage"'));
    assert.ok(!html.includes('<th>WORKFLOW</th>'));
    const rows=(html.match(/<tbody>([\s\S]*?)<\/tbody>/)||[])[1]||'';
    for(const app of db.applications.filter(a=>a.stage!==stage))assert.ok(!rows.includes('data-id="'+app.id+'"')&&!rows.includes('href="#/review/'+app.id+'"'));
  }
});

test('All Applications preserves Interview and Hired records and their actions',()=>{
  const {HRViews:V}=views(),db=M.seed();db.applications=db.applications.slice(0,2);
  db.applications[0].stage='Interview';db.applications[1].stage='Hired';
  const html=V.render(['applications'],db,state());
  assert.ok(html.includes('<th>STATUS</th>'));
  assert.ok(html.includes('Schedule Interview'));assert.ok(html.includes('Details'));assert.ok(!/View Profile/i.test(html));
  assert.ok(html.includes('Showing 1–2 of 2 applications'));
});

test('sidebar keeps one active Applications entry on list and detail pages without submenus',()=>{
  const {HRViews:V}=views(),db=M.seed();db.systemNotifications=[];
  for(const route of [['applications'],['applications','offer'],['review',db.applications[0].id],['results',db.applications[0].id],['candidate',db.candidates[0].id]]){
    const html=V.navigation(route,db);
    assert.ok(/href="#\/applications" aria-current="page"/.test(html));
    assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
    assert.ok(!html.includes('application-navigation'));assert.ok(!html.includes('applications-toggle'));assert.ok(!html.includes('nav-child'));
    assert.ok(!html.includes('href="#/candidates"'));
  }
  assert.ok(!/href="#\/applications" aria-current/.test(V.navigation(['dashboard'],db)));
});

test('legacy routes keep working while Pending Review is the canonical queue',()=>{
  const {HRViews:V}=views(),db=M.seed(),app=db.applications[0];
  assert.equal(V.parseRoute('#/candidates').join('/'),'applications');
  assert.equal(V.parseRoute('#/applications/pending-review/').join('/'),'applications/pending-review');
  assert.equal(V.parseRoute('#/applications/applications-review/').join('/'),'applications/pending-review');
  assert.ok(!V.render(['review',app.id],db,state()).includes('href="#/candidate/'+app.candidateId+'/'+app.id+'"'));
  assert.equal(V.activeApplicationStage(['candidate',app.candidateId,app.id],db),app.stage);
  assert.ok(V.render(['review',app.id],db,state()).includes('Job Requirements'));
  const second={...db.applications[1],id:'SECOND-APPLICATION',candidateId:app.candidateId,stage:'Interview Results'};db.applications.push(second);
  const profile=V.render(['candidate',app.candidateId,second.id],db,{...state(),profileApplicationId:second.id});
  assert.ok(profile.includes('href="#/review/'+second.id+'"'));
  assert.equal(V.activeApplicationStage(['candidate',app.candidateId,second.id],db),'Interview Results');
  const applications=V.render(['applications'],db,state());
  assert.ok(applications.includes('href="#/review/'+app.id+'"'));
});

test('top breadcrumbs follow the current application context and provide parent links',()=>{
  const {HRViews:V}=views(),db=M.seed(),app=db.applications.find(a=>a.stage==='Pending Review');
  const queue=V.secondaryNavigation(['applications','pending-review'],db);
  assert.ok(queue.includes('href="#/applications"'));
  assert.ok(queue.includes('aria-current="page">Pending Review</span>'));
  assert.ok(!queue.includes('Interview Results')&&!queue.includes('Offer'));
  const review=V.secondaryNavigation(['review',app.id],db);
  assert.ok(review.includes('href="#/applications/pending-review"'));
  assert.ok(review.includes('aria-current="page">Resume Review</span>'));
  assert.equal((review.match(/aria-current="page"/g)||[]).length,1);
  app.stage='Offer';
  assert.ok(V.secondaryNavigation(['candidate',app.candidateId,app.id],db).includes('href="#/applications/offer"'));
  assert.ok(V.secondaryNavigation(['mail-log'],db).includes('href="#/notifications"'));
  const html=V.render(['applications','pending-review'],db,state());
  assert.ok(!html.includes('class="queue-title"'));
  assert.ok(!html.includes('Applications in this stage.'));
  assert.ok(!html.includes('Review resumes alongside job requirements and record your decision.'));
});

test('unknown or malformed application routes never silently display all records',()=>{
  const {HRViews:V}=views(),db=M.seed();
  assert.ok(V.render(['applications','unknown'],db,state()).includes('Queue not found'));
  assert.ok(V.render(['applications','offer','extra'],db,state()).includes('Queue not found'));
  assert.equal(V.parseRoute('#/applications/%E0%A4%A')[0],'not-found');
});

async function controller(hash,{db=M.seed(),commit}={}){
  const c=views(),elements=new Map(),events=new Map(),windowEvents=new Map(),storage=new Map(),commits=[];
  db.systemNotifications=[];db.currentUser={name:'HR User',role:'HR_MANAGER'};
  const element=selector=>{if(!elements.has(selector))elements.set(selector,{innerHTML:'',textContent:'',hidden:false,open:false,isConnected:true,classList:{toggle(){},remove(){}},showModal(){this.open=true;},close(){this.open=false;},focus(){},setSelectionRange(){},addEventListener(){},insertAdjacentHTML(_where,html){this.innerHTML+=html;}});return elements.get(selector);};
  Object.assign(c,{location:{hash},history:{replaceState(_state,_title,url){c.location.hash=url;}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{querySelector:element,querySelectorAll:()=>[],addEventListener:(name,fn)=>{if(!events.has(name))events.set(name,[]);events.get(name).push(fn);}},HRRemote:{boot:async()=>({db,error:'',async commit(command,payload){commits.push({command,payload});return commit?commit(command,payload,db):{activity:{id:'saved-event'},application:{id:'saved-application'}};}})},HRExtra:{attach:()=>({action:async()=>false,submit:async()=>false})},setTimeout(fn,ms){const timer=setTimeout(fn,ms);timer.unref?.();return timer;},clearTimeout,confirm:()=>true,FormData:class{constructor(form){this.values=Object.entries(form?.values||{});}entries(){return this.values[Symbol.iterator]();}[Symbol.iterator](){return this.entries();}},URL});
  c.addEventListener=(name,fn)=>windowEvents.set(name,fn);c.scrollTo=()=>{};
  await vm.runInContext(fs.readFileSync(require.resolve('../dist/app.js'),'utf8'),c);
  return {c,e:element,storage,db,commits,async search(value){for(const fn of events.get('input')||[])await fn({target:{matches:selector=>selector==='[data-search]',value,selectionStart:value.length}});},async selectQueue(value){for(const fn of events.get('change')||[])await fn({target:{dataset:{filter:'queue'},value}});},navigate(path){c.location.hash=path;windowEvents.get('hashchange')();},async action(name,id){const button={disabled:false,isConnected:false,dataset:{action:name,id},closest:()=>null};const event={target:{closest:selector=>selector==='[data-action]'?button:null},preventDefault(){}};for(const fn of events.get('click')||[])await fn(event);},async submit(command,id,values={},attributes={}){const error={hidden:true,textContent:'',scrollIntoView(){}};const form={dataset:{command,id,...attributes},values,elements:{notify:{checked:!!values.notify}},matches:selector=>selector==='#modal form',reportValidity:()=>true,querySelectorAll:()=>[],querySelector:()=>error};for(const fn of events.get('submit')||[])await fn({target:form,preventDefault(){}});return error;}};
}

test('offer actions depend on approval, expiry and manager permission rather than academic data',async()=>{
  const db=M.seed(),application=db.applications.find(a=>a.stage==='Offer'),applicant=db.candidates.find(c=>c.id===application.candidateId);
  Object.assign(applicant,{educationLevel:'Not recorded',educationMajor:'Accounting',graduationDate:null});application.offer.expiry=M.day(7);
  for(const approval of ['Awaiting approval','Approved']){
    application.offer.approval=approval;const before=JSON.stringify({application,applicant}),page=await controller('#/applications/offer',{db});
    await page.action('application',application.id);const html=page.e('#modal-body').innerHTML;
    assert.equal(page.e('#modal-title').textContent,'Review Offer');assert.ok(!html.includes('Field of study not accepted'));assert.ok(html.includes(application.offer.terms));
    for(const action of ['offer-edit',approval==='Approved'?'offer-message':'offer-approve'])assert.ok(!new RegExp('data-action="'+action+'"[^>]*disabled').test(html));
    assert.equal(JSON.stringify({application,applicant}),before);
  }
  application.offer.expiry=M.day(-1);const expired=await controller('#/applications/offer',{db});await expired.action('application',application.id);
  assert.match(expired.e('#modal-body').innerHTML,/data-action="offer-accept"[^>]*disabled/);
});

test('rejection asks for a reason without a status diagram and opening or cancelling preserves records',async()=>{
  const db=M.seed(),application=db.applications.find(a=>a.stage==='Pending Review'),applicant=db.candidates.find(c=>c.id===application.candidateId);
  Object.assign(applicant,{educationLevel:'Secondary school',graduationDate:null});
  const page=await controller('#/review/'+application.id,{db}),before=JSON.stringify(db);await page.action('reject',application.id);const html=page.e('#modal-body').innerHTML;
  assert.match(html,/<select\b[^>]*name="reason"/);assert.ok(html.includes('Qualifications do not meet the job requirements'));
  assert.ok(!/<input\b[^>]*type="hidden"[^>]*name="reason"/.test(html));assert.equal(application.stage,'Pending Review');
  for(const text of ['Status Change','CURRENT STATUS','NEW STATUS','status-change','status-box'])assert.ok(!html.includes(text),'Remove redundant rejection status diagram: '+text);
  assert.equal(page.commits.length,0);assert.equal(JSON.stringify(db),before);
  await page.action('close');assert.equal(page.e('#modal').open,false);assert.equal(page.commits.length,0);assert.equal(JSON.stringify(db),before);
});

test('new interview forms start with blank date, time, venue and interviewer without changing applicant records',async()=>{
  for(const [action,stage,command] of [['move-interview','Pending Review','move-interview'],['schedule','Interview','schedule']]){
    const db=M.seed(),application=db.applications[0];application.stage=stage;db.interviews=[];db.jobs.find(j=>j.id===application.jobId).status='Active';
    const page=await controller('#/review/'+application.id,{db}),before=JSON.stringify(db);await page.action(action,application.id);
    const html=page.e('#modal-body').innerHTML;assert.ok(html.includes('data-command="'+command+'"'));
    for(const name of ['date','time','location','interviewer']){
      const input=html.match(new RegExp('<input\\b(?=[^>]*\\bname="'+name+'")[^>]*>'))?.[0];
      assert.ok(input,'Booking contains '+name);assert.match(input,/\bvalue=""/,'New '+name+' must be deliberately provided');assert.match(input,/\brequired\b/);
    }
    assert.ok(html.includes('More options'));assert.equal(page.commits.length,0);assert.equal(JSON.stringify(db),before);
    await page.action('close');assert.equal(page.e('#modal').open,false);assert.equal(page.commits.length,0);assert.equal(JSON.stringify(db),before);
  }
});

test('rescheduling preserves saved meeting values rather than using the blank new-interview form',async()=>{
  const db=M.seed(),application=db.applications[0];application.stage='Interview';
  const interview={id:'booking-to-reschedule',applicationId:application.id,date:M.day(5),time:'16:15',duration:90,format:'Phone',location:'+65 12345678',interviewer:'Existing Interviewer',notes:'Keep the saved interview brief.',status:'Scheduled'};db.interviews=[interview];
  const page=await controller('#/applications/interview',{db}),before=JSON.stringify(db);await page.action('interview-reschedule',interview.id);
  const html=page.e('#modal-body').innerHTML;assert.equal(page.e('#modal-title').textContent,'Reschedule Interview');assert.ok(html.includes('data-interview-id="'+interview.id+'"'));
  for(const name of ['date','time','location','interviewer']){
    const input=html.match(new RegExp('<input\\b(?=[^>]*\\bname="'+name+'")[^>]*>'))?.[0];assert.ok(input);assert.ok(input.includes('value="'+interview[name]+'"'),'Reschedule retains '+name);
  }
  for(const [name,value] of [['duration','90'],['format','Phone']]){
    const select=html.match(new RegExp('<select\\b[^>]*name="'+name+'"[^>]*>([\\s\\S]*?)<\\/select>'))?.[1];assert.ok(select);
    assert.match(select,new RegExp('<option\\b(?=[^>]*\\bvalue="'+value+'")[^>]*\\bselected\\b'));
  }
  assert.ok(html.includes(interview.notes));assert.equal(page.commits.length,0);assert.equal(JSON.stringify(db),before);
  await page.action('close');assert.equal(page.e('#modal').open,false);assert.equal(page.commits.length,0);assert.equal(JSON.stringify(db),before);
});

test('Move to Interview collects the booking once and opening or cancelling never changes records',async()=>{
  const db=M.seed(),application=db.applications.find(a=>a.stage==='Pending Review');db.jobs.find(j=>j.id===application.jobId).status='Active';
  const page=await controller('#/review/'+application.id,{db}),afterBoot=JSON.stringify(db);
  await page.action('move-interview',application.id);const html=page.e('#modal-body').innerHTML;
  assert.equal((html.match(/<form\b/g)||[]).length,1);assert.match(html,/data-command="move-interview"/);
  for(const name of ['date','time','location'])assert.match(html,new RegExp('<input\\b(?=[^>]*\\bname="'+name+'")[^>]*\\brequired\\b'),'A confirmed interview must include '+name);
  for(const name of ['duration','format','interviewer','notes','notify'])assert.match(html,new RegExp('<(?:input|select|textarea)\\b[^>]*name="'+name+'"'),'One form includes '+name);
  assert.equal(page.commits.length,0);assert.equal(JSON.stringify(db),afterBoot);
  await page.action('close');assert.equal(page.e('#modal').open,false);assert.equal(page.commits.length,0);assert.equal(JSON.stringify(db),afterBoot);
  assert.equal(application.stage,'Pending Review');
  await page.action('move-interview',application.id);
  const values={date:M.day(2),time:'14:30',duration:'45',format:'On-site',location:'Meeting Room B',interviewer:'HR User',notes:'Bring the role brief',notify:true};
  const error=await page.submit('move-interview',application.id,values);assert.equal(error.hidden,true);
  assert.equal(page.commits.length,1);assert.equal(page.commits[0].command,'move-interview');
  for(const [name,value] of Object.entries(values))assert.equal(page.commits[0].payload[name],value);
  assert.equal(page.commits[0].payload.applicationId,application.id);
  assert.equal(page.e('#modal').open,false);assert.equal(page.c.location.hash,'#/review/'+application.id);
});

test('application and rejection dialogs omit profile and activity detours',async()=>{
  const db=M.seed();db.applications[0].stage='Interview';db.applications[1].stage='Hired';
  for(const stage of ['Interview','Hired','Rejected']){
    const application=db.applications.find(a=>a.stage===stage),page=await controller('#/applications',{db});
    await page.action('application',application.id);const html=page.e('#modal-body').innerHTML;
    assert.ok(!/View profile|View activity|View Candidate Profile/i.test(html));assert.ok(!html.includes('data-action="activity"'));
    assert.ok(!html.includes('href="#/candidate/'));
  }
});

test('Interview actions open an existing booking or schedule a legacy unbooked application directly',async()=>{
  const db=M.seed(),application=db.applications[0],V=views().HRViews;application.stage='Interview';db.applications=[application];db.interviews=[];db.jobs.find(j=>j.id===application.jobId).status='Active';
  let html=V.render(['applications','interview'],db,state());
  assert.match(html,/data-action="schedule"[^>]*data-id="[^"]+"[^>]*>Schedule Interview<\/button>/);assert.ok(!html.includes('>View Interview</button>'));
  let page=await controller('#/applications/interview',{db});await page.action('schedule',application.id);
  assert.equal(page.e('#modal-title').textContent,'Schedule Interview');assert.match(page.e('#modal-body').innerHTML,/data-command="schedule"/);assert.equal(page.commits.length,0);
  page=await controller('#/review/'+application.id,{db});await page.action('application',application.id);
  assert.equal(page.e('#modal-title').textContent,'Schedule Interview','A legacy application link should skip the application-details wrapper');assert.match(page.e('#modal-body').innerHTML,/data-command="schedule"/);
  assert.match(V.render(['review',application.id],db,state()),/data-action="schedule"[^>]*>Schedule Interview<\/button>/);
  const interview={id:'existing-booking',applicationId:application.id,date:M.day(2),time:'14:30',duration:45,format:'On-site',location:'Room B',interviewer:'HR User',notes:'',status:'Scheduled'};db.interviews.push(interview);
  html=V.render(['applications','interview'],db,state());
  const action=html.match(/data-action="([^"]+)"[^>]*data-id="([^"]+)"[^>]*>View Interview<\/button>/);assert.ok(action);assert.ok(!html.includes('>Schedule Interview</button>'));
  page=await controller('#/applications/interview',{db});await page.action(action[1],action[2]);
  assert.equal(page.e('#modal-title').textContent,'Interview details');assert.ok(page.e('#modal-body').innerHTML.includes('Room B'));assert.ok(!page.e('#modal-body').innerHTML.includes('data-command="schedule"'));assert.equal(page.commits.length,0);
  assert.match(V.render(['review',application.id],db,state()),/data-action="interview"[^>]*data-id="existing-booking"[^>]*>View Interview<\/button>/);
});

test('saving recruitment decisions keeps the current workspace instead of jumping to success, results or another module',async()=>{
  const db=M.seed(),pending=db.applications.find(a=>a.stage==='Pending Review'),result=db.applications.find(a=>a.stage==='Interview Results'),offer=db.applications.find(a=>a.stage==='Offer'),interview=db.interviews[0];interview.status='Scheduled';
  const scenarios=[
    ['#/applications/pending-review','move-interview',pending.id,{date:M.day(2),time:'14:00',duration:'60',format:'Video',location:'https://meet.example.test/hr',interviewer:'HR User',notes:'',notify:false},{}],
    ['#/review/'+pending.id,'reject',pending.id,{reason:'Insufficient relevant experience',notes:'',notify:false},{}],
    ['#/results/'+result.id,'offer',result.id,{salary:'5200',startDate:M.day(30),expiry:M.day(7),terms:'Standard benefits'},{}],
    ['#/applications/offer','accept-offer',offer.id,{notes:'Candidate accepted by phone.'},{}],
    ['#/interviews','feedback',interview.applicationId,{rating:'4',recommendation:'Proceed',notes:'Strong technical discussion.'},{interviewId:interview.id}],
    ['#/applications/interview','schedule',interview.applicationId,{date:M.day(2),time:'15:00',duration:'60',format:'Video',location:'https://meet.example.test/hr',interviewer:'HR User',notes:'',notify:false},{interviewId:interview.id}],
    ['#/applications/offer','message',offer.id,{to:'applicant@example.test',subject:'Next steps',body:'Please review the attached details.'},{}]
  ];
  for(const [hash,command,id,values,attributes] of scenarios){
    const page=await controller(hash,{db}),error=await page.submit(command,id,values,attributes);
    assert.equal(error.hidden,true,command+': '+error.textContent);assert.equal(page.commits.length,1,command);
    assert.equal(page.c.location.hash,hash,command+' should stay where the user was working');
    assert.ok(page.e('#toast').textContent,command+' should show save feedback in place');
  }
});

test('receiving a new application opens that applicant directly so existing list filters cannot hide the new record',async()=>{
  const db=M.seed(),page=await controller('#/applications/offer',{db});
  const error=await page.submit('application-create','',{jobId:db.jobs[0].id,name:'Test Applicant',email:'new-applicant@example.test',phone:'12345678',location:'Singapore',experience:'3 years',skills:'JavaScript'});
  assert.equal(error.hidden,true);assert.equal(page.commits.length,1);assert.equal(page.commits[0].command,'application-create');
  assert.equal(page.c.location.hash,'/review/saved-application');
});

test('returning from a resume through Applications restores the originating queue, search, filters and page',async()=>{
  const db=M.seed(),page=await controller('#/applications/pending-review',{db});
  page.c.innerHeight=620;
  await page.search('example.com');
  await page.submit('filters','',{job:db.jobs[0].id,priority:'Normal',from:M.day(-400),to:M.day(1)});
  await page.action('page','2');const before=page.e('#content').innerHTML;
  assert.ok(before.includes('Page 2 of'));
  const application=db.applications.find(a=>a.stage==='Pending Review'&&a.jobId===db.jobs[0].id&&a.priority==='Normal');
  page.navigate('#/review/'+application.id);
  assert.match(page.e('#secondary-navigation').innerHTML,/href="#\/applications\/pending-review"[^>]*>Applications<\/a>/);
  page.navigate('#/applications/pending-review');assert.equal(page.e('#content').innerHTML,before);
});

test('feedback saved from a resume stays on that route and reveals the result without stale review decisions',async()=>{
  const db=M.seed(),interview=db.interviews[0],application=db.applications.find(a=>a.id===interview.applicationId);application.stage='Interview';interview.status='Scheduled';
  const hash='#/review/'+application.id,page=await controller(hash,{db,commit(command,payload){assert.equal(command,'feedback');application.stage='Interview Results';application.feedback={rating:Number(payload.rating),recommendation:payload.recommendation,notes:payload.notes,recordedAt:new Date().toISOString()};interview.status='Completed';return {activity:{id:'saved-feedback'}};}});
  const error=await page.submit('feedback',application.id,{rating:'4',recommendation:'Proceed',notes:'Evidence based feedback.'},{interviewId:interview.id});
  assert.equal(error.hidden,true);assert.equal(page.c.location.hash,hash);
  const html=page.e('#content').innerHTML;assert.ok(html.includes('Interview feedback'));assert.ok(html.includes('Evidence based feedback.'));assert.ok(html.includes('Prepare Offer'));
  assert.ok(!html.includes('data-action="move-interview"'));assert.ok(!html.includes('data-action="schedule"'));
});

test('old success links open the current application detail without recreating a separate next-step screen',async()=>{
  for(const stage of ['Interview','Interview Results']){
    const db=M.seed(),application=db.applications[0];application.stage=stage;db.activity.unshift({id:'legacy-save',applicationId:application.id,to:stage,from:'Pending Review',actor:'HR User',at:new Date().toISOString(),summary:'Old saved event'});
    const page=await controller('#/success/legacy-save',{db});
    assert.equal(page.c.location.hash,'#/'+(stage==='Interview Results'?'results':'review')+'/'+application.id);
    assert.ok(page.e('#content').innerHTML.includes('aria-label="Applicant resume"'));
    assert.ok(!page.e('#content').innerHTML.includes('success-panel'));assert.ok(!page.e('#content').innerHTML.includes('Review next candidate'));
  }
});

test('controller supports direct links, legacy review URLs, Back/Forward and clearing filters without leaving the selected stage',async()=>{
  const page=await controller('#/applications/pending-review');
  assert.ok(page.e('#secondary-navigation').innerHTML.includes('aria-current="page">Pending Review</span>'));
  await page.action('clear-filters');
  assert.ok(page.e('#secondary-navigation').innerHTML.includes('aria-current="page">Pending Review</span>'));
  assert.ok(!page.e('#content').innerHTML.includes('<th>WORKFLOW</th>'));
  page.navigate('#/applications/offer');assert.ok(page.e('#secondary-navigation').innerHTML.includes('aria-current="page">Offer</span>'));
  assert.ok(page.e('#secondary-navigation').innerHTML.includes('aria-current="page">Offer</span>'));
  page.navigate('#/applications/pending-review');assert.ok(page.e('#secondary-navigation').innerHTML.includes('aria-current="page">Pending Review</span>'));
  page.navigate('#/applications/applications-review');assert.equal(page.c.location.hash,'#/applications/pending-review');
  assert.ok(page.e('#secondary-navigation').innerHTML.includes('aria-current="page">Pending Review</span>'));
  page.navigate('#/applications');assert.ok(page.e('#secondary-navigation').innerHTML.includes('aria-current="page">Applications</span>'));
});

test('status selector reaches review, results, rejected, offer and all applications without a sidebar submenu',async()=>{
  const page=await controller('#/applications/offer');
  assert.ok(page.e('#content').innerHTML.includes('data-filter="queue"'));
  for(const [value,path] of [['Pending Review','applications/pending-review'],['Interview Results','applications/interview-results'],['Rejected','applications/rejected'],['Offer','applications/offer'],['','applications']]){
    await page.selectQueue(value);assert.equal(page.c.location.hash,'/'+path);
    page.navigate('#/'+path);assert.ok(page.e('#content').innerHTML.includes('data-filter="queue"'));
    assert.ok(!page.e('#navigation').innerHTML.includes('nav-child'));
  }
});

test('application pagination reaches every result and clamps the last page after filtering',()=>{
  const {HRViews:V}=views(),db=M.seed(),ids=new Set(),ui={...state(),pageSize:4};
  const total=db.applications.filter(a=>a.stage==='Pending Review').length;
  for(let page=1;page<=Math.ceil(total/4);page++){
    ui.page=page;const html=V.render(['applications','pending-review'],db,ui);
    const matches=[...html.matchAll(/href="#\/review\/([^"]+)"/g)];assert.ok(matches.length<=4);
    matches.forEach(m=>{assert.ok(!ids.has(m[1]));ids.add(m[1]);});
  }
  assert.equal(ids.size,total);
  ui.page=100;ui.q='Alex Tan';const filtered=V.render(['applications','pending-review'],db,ui);
  assert.equal(ui.page,1);assert.ok(filtered.includes('Alex Tan'));
  ui.q='nonexistent record';const empty=V.render(['applications','pending-review'],db,ui);
  assert.equal(ui.page,1);assert.ok(empty.includes('Showing 0–0 of 0 applications'));
});

test('dashboard uses the signed-in name and sorts recent applications newest first before slicing',()=>{
  const {HRViews:V}=views(),db=M.seed();db.currentUser={name:'Junye Shen'};
  db.applications[0].createdAt='2020-01-01T00:00:00.000Z';
  db.applications.at(-1).createdAt='2090-01-01T00:00:00.000Z';
  const html=V.render(['dashboard'],db,{...state(),page:900,pageSize:6});
  assert.ok(html.includes('Welcome, Junye Shen'));assert.ok(!html.includes('Good morning, Sarah'));
  const first=V.render(['dashboard'],db,{...state(),pageSize:6});
  assert.ok(first.includes('data-id="'+db.applications.at(-1).id+'"'));
  assert.ok(!first.includes('data-id="'+db.applications[0].id+'"'));
});

test('rejected application attention distinguishes historical, draft, uncertain and sent messages',()=>{
  const {HRViews:V}=views(),db=M.seed(),a=db.applications.find(a=>a.stage==='Rejected');
  db.notifications=[{applicationId:a.id,kind:'Interview invitation',status:'Sent'}];
  assert.equal(V.attention(db,a)[0],'Notification not prepared');
  db.notifications.push({applicationId:a.id,kind:'Rejected',status:'Draft'});
  assert.equal(V.attention(db,a)[0],'Notification draft prepared');
  db.notifications[1].status='Uncertain';assert.equal(V.attention(db,a)[0],'Delivery needs checking');
  db.notifications[1].status='Sent';assert.equal(V.attention(db,a)[0],'Notification sent');
});

test('notifications respect Singapore date boundaries and communication lists paginate',()=>{
  const c=views(),db=M.seed();db.currentUser={name:'Junye Shen',role:'HR_MANAGER'};db.mailEnabled=false;
  vm.runInContext(fs.readFileSync(require.resolve('../dist/hr-extra.js'),'utf8'),c);
  db.systemNotifications=Array.from({length:13},(_,i)=>({id:'n'+i,applicationId:db.applications[0].id,title:'Update '+i,eventType:'Status Update',createdAt:'2026-10-04T17:00:00.000Z',read:false,sourceModule:'Applications'}));
  const ui={...state(),pageSize:4,from:'2026-10-05',to:'2026-10-05'};
  const html=c.HRViews.render(['notifications'],db,ui);
  assert.equal((html.match(/class="notification-item/g)||[]).length,4);
  assert.ok(html.includes('of 13 records'));assert.ok(html.includes('data-action="application"'));
  assert.equal(c.HRViews.localDay('2026-10-04T17:00:00Z'),'2026-10-05');
  db.notifications=[{id:'draft',subject:'Subject',to:'test@example.com',createdAt:'2026-10-04T17:00:00Z',status:'Draft'}];
  const outbox=c.HRViews.render(['outbox'],db,{...state(),pageSize:4});
  assert.ok(outbox.includes('Email delivery is off'));
  assert.match(outbox,/data-action="mail-send"[^>]+disabled/);
});

test('resume upload refreshes a stale revision so the same selected file can be retried',async()=>{
  const c=views(),calls=[],user={id:'hr-qa'};let revision=1,uploads=0;
  Object.assign(c,{location:{protocol:'http:'},AbortSignal,document:{querySelector:()=>({hidden:true})},fetch:async(url,options)=>{
    calls.push({url,...options});
    if(url.endsWith('auth/me'))return {ok:true,json:async()=>({user,csrfToken:'qa'})};
    if(url.endsWith('hr/workspace'))return {ok:true,json:async()=>({revision,currentUser:user})};
    uploads++;
    if(uploads===1){revision=2;return {ok:false,status:409,json:async()=>({error:{code:'REVISION_CONFLICT',message:'Refresh first'}})};}
    return {ok:true,json:async()=>({db:{revision:3,currentUser:user}})};
  }});
  vm.runInContext(fs.readFileSync(require.resolve('../dist/api.js'),'utf8'),c);
  await c.HRRemote.boot();const file={type:'application/pdf',name:'resume.pdf',size:100};
  await assert.rejects(c.HRRemote.upload('candidate-qa',file),/Newer changes were loaded/);
  await c.HRRemote.upload('candidate-qa',file);
  const puts=calls.filter(x=>x.method==='PUT');assert.equal(puts[0].headers['If-Match'],'1');assert.equal(puts[1].headers['If-Match'],'2');
  assert.equal(c.HRRemote.db.revision,3);
});
