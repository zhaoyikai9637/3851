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
