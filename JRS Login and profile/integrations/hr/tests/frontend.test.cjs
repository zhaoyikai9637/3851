const test=globalThis.test??require('node:test').test;
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const M=require('../dist/state.js');

function views(){
  const context={console,Blob,HRModel:M};context.window=context;vm.createContext(context);
  for(const file of ['icons.js','resume.js','views.js'])vm.runInContext(fs.readFileSync(require.resolve('../dist/'+file),'utf8'),context);
  return context;
}
function state(){return {page:1,q:'',job:'',stage:'',priority:'',from:'',to:'',resumePage:1,zoom:90};}

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
  assert.ok(html.includes('<th>WORKFLOW</th>'));
  assert.ok(html.includes('View Interview'));assert.ok(html.includes('View Profile'));
  assert.ok(html.includes('Showing 1–2 of 2 applications'));
});

test('sidebar provides accessible expansion, direct category links and a single selected category',()=>{
  const {HRViews:V}=views(),db=M.seed();db.systemNotifications=[];
  const html=V.navigation(['applications','pending-review'],db,true);
  assert.ok(html.includes('aria-expanded="true"'));assert.ok(html.includes('aria-controls="application-navigation"'));
  for(const [slug] of V.applicationStages)assert.ok(html.includes('href="#/applications/'+slug+'"'));
  assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
  assert.ok(/href="#\/applications\/pending-review" aria-current="page"/.test(html));
  assert.ok(!html.includes('href="#/candidates"'));
  assert.ok(V.navigation(['dashboard'],db,false).includes('class="nav-children" hidden'));
});

test('legacy candidate directory redirects to Applications while profile links retain application context',()=>{
  const {HRViews:V}=views(),db=M.seed(),app=db.applications[0];
  assert.equal(V.parseRoute('#/candidates').join('/'),'applications');
  assert.equal(V.parseRoute('#/applications/pending-review/').join('/'),'applications/pending-review');
  assert.ok(V.render(['review',app.id],db,state()).includes('href="#/candidate/'+app.candidateId+'/'+app.id+'"'));
  assert.equal(V.activeApplicationStage(['candidate',app.candidateId,app.id],db),app.stage);
  assert.ok(V.render(['review',app.id],db,state()).includes('Job Requirements'));
  const second={...db.applications[1],id:'SECOND-APPLICATION',candidateId:app.candidateId,stage:'Interview Results'};db.applications.push(second);
  const profile=V.render(['candidate',app.candidateId,second.id],db,{...state(),profileApplicationId:second.id});
  assert.ok(profile.includes('href="#/review/'+second.id+'"'));
  assert.equal(V.activeApplicationStage(['candidate',app.candidateId,second.id],db),'Interview Results');
  const applications=V.render(['applications'],db,state());
  assert.ok(applications.includes('href="#/candidate/'+app.candidateId+'/'+app.id+'"'));
});

test('unknown or malformed application routes never silently display all records',()=>{
  const {HRViews:V}=views(),db=M.seed();
  assert.ok(V.render(['applications','unknown'],db,state()).includes('Queue not found'));
  assert.ok(V.render(['applications','offer','extra'],db,state()).includes('Queue not found'));
  assert.equal(V.parseRoute('#/applications/%E0%A4%A')[0],'not-found');
});

async function controller(hash){
  const c=views(),elements=new Map(),events=new Map(),windowEvents=new Map(),storage=new Map(),db=M.seed();
  db.systemNotifications=[];db.currentUser={name:'HR User',role:'HR_MANAGER'};
  const element=selector=>{if(!elements.has(selector))elements.set(selector,{innerHTML:'',textContent:'',hidden:false,open:false,isConnected:true,focus(){},addEventListener(){},insertAdjacentHTML(_where,html){this.innerHTML+=html;}});return elements.get(selector);};
  Object.assign(c,{location:{hash},history:{replaceState(_state,_title,url){c.location.hash=url;}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{querySelector:element,querySelectorAll:()=>[],addEventListener:(name,fn)=>{if(!events.has(name))events.set(name,[]);events.get(name).push(fn);}},HRRemote:{boot:async()=>({db,error:''})},HRExtra:{attach:()=>({action:async()=>false})},setTimeout,clearTimeout,FormData,URL});
  c.addEventListener=(name,fn)=>windowEvents.set(name,fn);c.scrollTo=()=>{};
  await vm.runInContext(fs.readFileSync(require.resolve('../dist/app.js'),'utf8'),c);
  return {c,e:element,storage,navigate(path){c.location.hash=path;windowEvents.get('hashchange')();},async action(name){const button={disabled:false,isConnected:false,dataset:{action:name},closest:()=>null};const event={target:{closest:selector=>selector==='[data-action]'?button:null},preventDefault(){}};for(const fn of events.get('click')||[])await fn(event);}};
}

test('controller supports direct links, Back/Forward route changes and clearing filters without leaving the selected stage',async()=>{
  const page=await controller('#/applications/pending-review');
  assert.ok(page.e('#content').innerHTML.includes('<h2>Pending Review</h2>'));
  await page.action('clear-filters');
  assert.ok(page.e('#content').innerHTML.includes('<h2>Pending Review</h2>'));
  assert.ok(!page.e('#content').innerHTML.includes('<th>WORKFLOW</th>'));
  page.navigate('#/applications/offer');assert.ok(page.e('#content').innerHTML.includes('<h2>Offer</h2>'));
  page.navigate('#/applications/pending-review');assert.ok(page.e('#content').innerHTML.includes('<h2>Pending Review</h2>'));
  page.navigate('#/applications');assert.ok(page.e('#content').innerHTML.includes('<h2>All Applications</h2>'));
});

test('expansion toggle persists its state and retains the current application page',async()=>{
  const page=await controller('#/applications/rejected'),before=page.e('#content').innerHTML;
  await page.action('applications-toggle');assert.equal(page.storage.get('jrs-applications-expanded'),'false');
  assert.ok(page.e('#navigation').innerHTML.includes('aria-expanded="false"'));
  assert.equal(page.e('#content').innerHTML,before);
  await page.action('applications-toggle');assert.equal(page.storage.get('jrs-applications-expanded'),'true');
  assert.equal(page.c.location.hash,'#/applications/rejected');
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
