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

test('review status filter, avatar resume links and right-hand actions work across statuses',()=>{
  const {HRViews:V}=views(),db=M.seed(),ui=state();
  const html=V.render(['applications','offer'],db,ui);
  assert.equal(ui.stage,'Offer');assert.ok(html.includes('data-filter="queue"'));
  assert.ok(V.filtered(db,ui).every(a=>a.stage==='Offer'));
  const review=V.render(['applications','applications-review'],db,ui);
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

test('application lists keep ordinary workflow attention and preserve legacy records without academic holds',()=>{
  const {HRViews:V}=views(),db=M.seed(),pending=db.applications.find(a=>a.stage==='Pending Review'),offer=db.applications.find(a=>a.stage==='Offer');
  db.applications=[pending,offer];for(const c of db.candidates)Object.assign(c,{educationLevel:'Not recorded',educationMajor:'Accounting',graduationDate:null});
  let html=V.render(['applications','applications-review'],db,state());assert.ok(!/data-action="move-interview"[^>]*disabled/.test(html));
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
  assert.ok(html.includes('View Interview'));assert.ok(html.includes('View Profile'));
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

test('legacy candidate directory redirects to Applications while profile links retain application context',()=>{
  const {HRViews:V}=views(),db=M.seed(),app=db.applications[0];
  assert.equal(V.parseRoute('#/candidates').join('/'),'applications');
  assert.equal(V.parseRoute('#/applications/pending-review/').join('/'),'applications/applications-review');
  assert.ok(V.render(['review',app.id],db,state()).includes('href="#/candidate/'+app.candidateId+'/'+app.id+'"'));
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
  assert.ok(queue.includes('aria-current="page">Applications Review</span>'));
  assert.ok(!queue.includes('Interview Results')&&!queue.includes('Offer'));
  const review=V.secondaryNavigation(['review',app.id],db);
  assert.ok(review.includes('href="#/applications/applications-review"'));
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

async function controller(hash,{db=M.seed(),search=''}={}){
  const c=views(),elements=new Map(),events=new Map(),windowEvents=new Map(),storage=new Map();
  db.systemNotifications=[];db.currentUser={name:'HR User',role:'HR_MANAGER'};
  const element=selector=>{if(!elements.has(selector))elements.set(selector,{innerHTML:'',textContent:'',hidden:false,open:false,isConnected:true,classList:{toggle(){},remove(){}},showModal(){this.open=true;},close(){this.open=false;},focus(){},addEventListener(){},insertAdjacentHTML(_where,html){this.innerHTML+=html;}});return elements.get(selector);};
  Object.assign(c,{location:{hash,search},history:{replaceState(_state,_title,url){c.location.hash=url;}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{querySelector:element,querySelectorAll:()=>[],addEventListener:(name,fn)=>{if(!events.has(name))events.set(name,[]);events.get(name).push(fn);}},HRRemote:{boot:async()=>({db,error:''})},HRExtra:{attach:()=>({action:async()=>false})},setTimeout,clearTimeout,FormData:class{entries(){return [][Symbol.iterator]();}},URL});
  c.addEventListener=(name,fn)=>windowEvents.set(name,fn);c.scrollTo=()=>{};
  await vm.runInContext(fs.readFileSync(require.resolve('../dist/app.js'),'utf8'),c);
  return {c,e:element,storage,db,async selectQueue(value){for(const fn of events.get('change')||[])await fn({target:{dataset:{filter:'queue'},value}});},navigate(path){c.location.hash=path;windowEvents.get('hashchange')();},async action(name,id){const button={disabled:false,isConnected:false,dataset:{action:name,id},closest:()=>null};const event={target:{closest:selector=>selector==='[data-action]'?button:null},preventDefault(){}};for(const fn of events.get('click')||[])await fn(event);}};
}

test('job-specific application links initialize a removable position filter',async()=>{
  const db=M.seed(),id=db.jobs[0].id,page=await controller('#/applications',{db,search:'?job='+id});
  assert.ok(page.e('#content').innerHTML.includes('value="'+id+'" selected'));
  await page.action('clear-filters');
  assert.ok(!page.e('#content').innerHTML.includes('value="'+id+'" selected'));
});

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

test('HR explicitly chooses a rejection reason without an automatic academic decision',async()=>{
  const db=M.seed(),application=db.applications.find(a=>a.stage==='Pending Review'),applicant=db.candidates.find(c=>c.id===application.candidateId);
  Object.assign(applicant,{educationLevel:'Secondary school',graduationDate:null});
  const page=await controller('#/review/'+application.id,{db});await page.action('reject',application.id);const html=page.e('#modal-body').innerHTML;
  assert.match(html,/<select\b[^>]*name="reason"/);assert.ok(html.includes('Qualifications do not meet the job requirements'));
  assert.ok(!/<input\b[^>]*type="hidden"[^>]*name="reason"/.test(html));assert.equal(application.stage,'Pending Review');
});

test('controller supports direct links, Back/Forward route changes and clearing filters without leaving the selected stage',async()=>{
  const page=await controller('#/applications/pending-review');
  assert.ok(page.e('#secondary-navigation').innerHTML.includes('aria-current="page">Applications Review</span>'));
  await page.action('clear-filters');
  assert.ok(page.e('#secondary-navigation').innerHTML.includes('aria-current="page">Applications Review</span>'));
  assert.ok(!page.e('#content').innerHTML.includes('<th>WORKFLOW</th>'));
  page.navigate('#/applications/offer');assert.ok(page.e('#secondary-navigation').innerHTML.includes('aria-current="page">Offer</span>'));
  assert.ok(page.e('#secondary-navigation').innerHTML.includes('aria-current="page">Offer</span>'));
  page.navigate('#/applications/pending-review');assert.ok(page.e('#secondary-navigation').innerHTML.includes('aria-current="page">Applications Review</span>'));
  assert.ok(page.e('#secondary-navigation').innerHTML.includes('aria-current="page">Applications Review</span>'));
  page.navigate('#/applications');assert.equal(page.e('#secondary-navigation').innerHTML,'');
});

test('status selector reaches review, results, rejected, offer and all applications without a sidebar submenu',async()=>{
  const page=await controller('#/applications/offer');
  assert.ok(page.e('#content').innerHTML.includes('data-filter="queue"'));
  for(const [value,path] of [['Pending Review','applications/applications-review'],['Interview Results','applications/interview-results'],['Rejected','applications/rejected'],['Offer','applications/offer'],['','applications']]){
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
  db.notifications=[{id:'draft',applicationId:db.applications[0].id,subject:'Subject',to:'test@example.com',createdAt:'2026-10-04T17:00:00Z',status:'Draft'}];
  const emails=c.HRViews.applicationMessages(db,db.applications[0].id);
  assert.ok(emails.includes('Drafts are saved for later'));
  assert.match(emails,/data-action="mail-send"/);
  assert.ok(!c.HRViews.render(['outbox'],db,state()).includes('Search messages'));
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
