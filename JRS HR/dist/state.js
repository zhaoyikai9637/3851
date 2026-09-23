/* Shared pure HR rules. The backend is authoritative; browser storage is demo-only. */
(function(root){
  'use strict';
  const KEY='jrs.hr.workspace.v2';
  const STAGES=['Pending Review','Interview','Interview Results','Offer','Rejected','Hired'];
  const uid=p=>p+'-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2));
  const iso=()=>new Date().toISOString(), clone=v=>JSON.parse(JSON.stringify(v));
  const day=(offset=0)=>{const d=new Date(Date.now()+8*3600000+offset*86400000);return d.toISOString().slice(0,10);};
  const instant=(date,time)=>new Date(date+'T'+time+':00+08:00').getTime();
  const find=(items,id,label='Record')=>{const x=items.find(x=>x.id===id);if(!x)throw Error(label+' was not found.');return x;};
  const required=(value,label,max=500)=>{const v=String(value??'').trim();if(!v)throw Error(label+' is required.');if(v.length>max)throw Error(label+' is too long.');return v;};
  function dateCheck(v,label){if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v+'T12:00:00'))||new Date(v+'T12:00:00').getDate()!==Number(v.slice(-2)))throw Error('Choose a valid '+label+'.');}
  function seed(){
    const defs=[['Software Developer','Engineering','Java, React, SQL, REST API, Git'],['UI Designer','Design','Figma, UI Design, Prototyping, Accessibility'],['Data Analyst','Analytics','SQL, Python, Power BI, Data Analysis'],['Marketing Executive','Marketing','SEO, Analytics, Campaigns, Copywriting'],['Support Officer','Customer Success','Communication, CRM, Troubleshooting'],['System Analyst','Technology','SQL, UML, Requirements, Documentation'],['Backend Engineer','Engineering','Node.js, SQL, REST API, Git'],['HR Business Partner','Human Resources','Recruitment, Communication, HRIS'],['DevOps Engineer','Engineering','Docker, Linux, CI/CD, Cloud'],['Finance Executive','Finance','Excel, Accounting, Reporting']];
    const jobs=defs.map((j,i)=>({id:'job-'+i,title:j[0],department:j[1],skills:j[2].split(', '),type:i===3?'Contract':'Full-time',location:'Singapore',mode:'On-site',experience:'2+ years',education:'Diploma or Degree',status:'Active',description:'Work with the '+j[1].toLowerCase()+' team to deliver reliable work and improve everyday processes.',requirements:i===0?['Experience with Java or Spring Boot','Frontend experience with React','SQL database and REST API knowledge','Docker or cloud deployment experience']:['Relevant experience in '+j[1].toLowerCase(),'Strong communication and teamwork','Practical experience with '+j[2].split(', ')[0]],createdAt:iso()}));
    const names=['Alex Tan','Sarah Lim','Daniel Wong','Natalie Chen','Emily Chen','Michael Lee','Jason Ho','James Koh','Amelia Goh','Marcus Ong','Olivia Teo','Chloe Ng','Ethan Low','Isabelle Tan','Ryan Chua','Grace Yeo','Lucas Lim','Sophie Koh','Benjamin Lee','Hannah Wong','Noah Tan','Zoe Goh','Aaron Ng','Charlotte Ho'];
    const first=['Adrian','Alicia','Brandon','Celeste','Darren','Elena','Felix','Giselle','Isaac','Jasmine','Kevin','Lydia','Nathan'],last=['Teo','Chua','Goh','Ong','Yeo','Koh','Low'];
    for(let i=24;i<115;i++)names.push(first[Math.floor((i-24)/7)]+' '+last[(i-24)%7]);
    const preset={0:'Pending Review',1:'Interview Results',2:'Offer',3:'Pending Review',4:'Rejected',5:'Interview Results',6:'Pending Review'};
    const remaining={'Pending Review':39,'Interview Results':22,'Offer':17,'Rejected':30};
    const candidates=[],applications=[];
    names.forEach((name,i)=>{const j=jobs[i<7?[0,1,2,3,4,5,0][i]:i%10];let stage=preset[i];if(!stage){stage=Object.keys(remaining).find(k=>remaining[k]>0);remaining[stage]--;}
      const c={id:'candidate-'+i,name,email:name.toLowerCase().replaceAll(' ','.')+'@example.com',phone:'+65 8123 '+String(4500+i),location:'Singapore',skills:[...j.skills],experience:2+i%5,education:j.department==='Engineering'?'Diploma in Information Technology':'Degree in '+j.department,notes:'',createdAt:iso()};candidates.push(c);
      applications.push({id:'APP-2026-'+String(156+i).padStart(4,'0'),candidateId:c.id,jobId:j.id,stage,appliedDate:day(-(i===0?4:i%8+1)),priority:i===0||i%7===0?'High':'Normal',retentionStartedAt:['Offer','Rejected'].includes(stage)?iso():null,rejectionReason:stage==='Rejected'?'Skills do not meet the position requirements':'',rejectionConfirmed:stage==='Rejected'&&i%5!==0,notes:[],feedback:stage==='Interview Results'?{rating:4,notes:'Strong practical knowledge and clear communication. Review team fit before making a final decision.',recommendation:'Proceed',recordedAt:iso()}:null,offer:stage==='Offer'?{salary:5200,currency:'SGD',startDate:day(30),expiry:day(i===2?1:7),approval:i%4===2?'Awaiting approval':'Approved',status:'Draft',terms:'Full-time position. Standard company benefits.',createdAt:iso()}:null,createdAt:iso()});
    });
    const interviews=applications.filter(a=>a.stage==='Interview Results').map((a,i)=>({id:'interview-'+i,applicationId:a.id,date:day(-1-i%3),time:'10:00',duration:45,format:'Video',location:'Video interview',interviewer:'Sarah Mitchell',notes:'',status:'Completed',feedback:clone(a.feedback)}));
    return {schemaVersion:2,revision:0,createdAt:iso(),jobs,candidates,applications,interviews,tasks:[],notifications:[],activity:[]};
  }
  function validate(db){
    if(!db||db.schemaVersion!==2||!Number.isInteger(db.revision))throw Error('Unsupported workspace data.');
    for(const key of ['jobs','candidates','applications','interviews','tasks','notifications','activity'])if(!Array.isArray(db[key])||db[key].some(x=>!x||typeof x.id!=='string')||new Set(db[key].map(x=>x.id)).size!==db[key].length)throw Error('Invalid '+key+' data.');
    for(const c of db.candidates)if(typeof c.name!=='string'||typeof c.email!=='string'||!Array.isArray(c.skills))throw Error('Invalid candidate data.');
    for(const j of db.jobs)if(typeof j.title!=='string'||!Array.isArray(j.skills)||!Array.isArray(j.requirements)||!['Active','Draft','Closed'].includes(j.status))throw Error('Invalid job data.');
    for(const a of db.applications){find(db.candidates,a.candidateId);find(db.jobs,a.jobId);if(!STAGES.includes(a.stage)||!Array.isArray(a.notes)||typeof a.appliedDate!=='string'||(a.stage==='Offer'&&!a.offer))throw Error('Invalid application data.');}
    for(const i of db.interviews){find(db.applications,i.applicationId);if(!['Scheduled','Completed','Cancelled'].includes(i.status)||!Number.isFinite(i.duration))throw Error('Invalid interview data.');}
    for(const t of db.tasks){find(db.applications,t.applicationId);if(!['Open','Completed'].includes(t.status))throw Error('Invalid task data.');}
    for(const n of db.notifications)if(n.applicationId)find(db.applications,n.applicationId);
    for(const a of db.activity)if(a.applicationId)find(db.applications,a.applicationId);
    return true;
  }
  function apply(db,action,p,context={}){
    const actor=context.actor||'Sarah Mitchell';
    const a=p.applicationId?find(db.applications,p.applicationId,'Application'):null,c=a?find(db.candidates,a.candidateId):null,j=a?find(db.jobs,a.jobId):null;
    const activity=(summary,notes='',from=null,to=null)=>{const e={id:uid('activity'),applicationId:a?.id||null,summary,notes,from,to,actor,at:iso()};db.activity.unshift(e);return e;};
    const message=(subject,body)=>{body=body.replace(/Sarah Mitchell(?=\n|$)/g,actor);const n={id:uid('notice'),applicationId:a.id,candidateId:c.id,to:c.email,subject,body,status:'Draft',read:false,createdAt:iso()};db.notifications.unshift(n);return n;};
    const transition=(to,allowed,summary,notes='')=>{if(!allowed.includes(a.stage))throw Error('This action is not available from '+a.stage+'.');const from=a.stage;a.stage=to;a.retentionStartedAt=['Offer','Rejected'].includes(to)?iso():null;if(notes)a.notes.push({text:notes,at:iso(),actor});return activity(summary,notes,from,to);};
    let result={};
    switch(action){
      case 'move-interview':{
        if(j.status!=='Active')throw Error('Activate this job before advancing the application.');const notes=String(p.notes||'').trim();if(notes.length>500)throw Error('Notes must be 500 characters or fewer.');
        result.activity=transition('Interview',['Pending Review'],c.name+' moved to Interview',notes);
        if(p.notify){result.notification=message('Interview invitation — '+j.title,'Hello '+c.name+',\n\nThank you for applying for '+j.title+'. We would like to invite you to the interview stage. Our team will follow up with the schedule and preparation details.\n\nBest regards,\nSarah Mitchell\nJRS Recruitment');result.notification.kind='Interview invitation';}break;
      }
      case 'reject':{
        const reason=required(p.reason,'Rejection reason'),notes=String(p.notes||'').trim();if(notes.length>500)throw Error('Notes must be 500 characters or fewer.');
        result.activity=transition('Rejected',['Pending Review','Interview','Interview Results','Offer'],c.name+' rejected',notes);a.rejectionReason=reason;a.rejectionConfirmed=true;
        db.interviews.filter(i=>i.applicationId===a.id&&i.status==='Scheduled').forEach(i=>i.status='Cancelled');
        db.notifications.filter(n=>n.applicationId===a.id&&n.status==='Draft').forEach(n=>n.status='Superseded');
        if(p.notify)result.notification=message('Application update — '+j.title,'Hello '+c.name+',\n\nThank you for your interest in '+j.title+' and the time you shared with us. After careful consideration, we will not be progressing your application for this position. We wish you the best in your job search.\n\nBest regards,\nSarah Mitchell\nJRS Recruitment');break;
      }
      case 'schedule':{
        if(a.stage!=='Interview'||j.status!=='Active')throw Error('Scheduling requires an active job and an application in Interview.');dateCheck(p.date,'interview date');if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.time))throw Error('Choose a valid time.');
        const start=instant(p.date,p.time),duration=Number(p.duration);if(start<=Date.now())throw Error('Choose an interview time in the future.');if(![15,30,45,60,90,120].includes(duration))throw Error('Choose a valid duration.');
        const interviewer=required(p.interviewer,'Interviewer',100),location=required(p.location,'Meeting details',300);if(!['Video','On-site','Phone'].includes(p.format))throw Error('Choose an interview format.');
        const existing=p.interviewId?find(db.interviews,p.interviewId,'Interview'):null;if(existing&&(existing.applicationId!==a.id||existing.status!=='Scheduled'))throw Error('This interview cannot be rescheduled.');
        for(const i of db.interviews.filter(i=>i.status==='Scheduled'&&i.id!==p.interviewId)){const s=instant(i.date,i.time),other=find(db.applications,i.applicationId);if(start<s+i.duration*60000&&start+duration*60000>s&&(other.candidateId===c.id||i.interviewer.toLowerCase()===interviewer.toLowerCase()||(p.format==='On-site'&&i.format==='On-site'&&i.location.toLowerCase()===location.toLowerCase())))throw Error('This time overlaps another interview for the candidate, interviewer or meeting room.');}
        if(db.interviews.some(i=>i.applicationId===a.id&&i.status==='Scheduled'&&i.id!==p.interviewId))throw Error('Reschedule the existing interview instead of creating a duplicate.');
        const value={id:existing?.id||uid('interview'),applicationId:a.id,date:p.date,time:p.time,duration,format:p.format,location,interviewer,notes:String(p.notes||'').trim(),status:'Scheduled',feedback:null};if(existing)Object.assign(existing,value);else db.interviews.push(value);
        activity(existing?'Interview rescheduled':'Interview scheduled',p.date+' '+p.time+' · '+interviewer);
        db.notifications.filter(n=>n.applicationId===a.id&&n.kind==='Interview schedule'&&n.status==='Draft').forEach(n=>n.status='Superseded');
        if(p.notify){const n=message('Interview schedule — '+j.title,'Hello '+c.name+',\n\nYour interview for '+j.title+' is scheduled for '+p.date+' at '+p.time+' (Singapore time, UTC+08:00), for '+duration+' minutes.\nFormat: '+p.format+'\nDetails: '+location+'\nInterviewer: '+interviewer+'\n\nBest regards,\nSarah Mitchell');n.kind='Interview schedule';}result.interview=value;break;
      }
      case 'cancel-interview':{const i=find(db.interviews,p.interviewId);if(i.applicationId!==a.id||i.status!=='Scheduled')throw Error('Only a scheduled interview can be cancelled.');const reason=required(p.reason,'Cancellation reason');i.status='Cancelled';db.notifications.filter(n=>n.applicationId===a.id&&n.kind==='Interview schedule'&&n.status==='Draft').forEach(n=>n.status='Superseded');activity('Interview cancelled',reason);break;}
      case 'feedback':{const i=find(db.interviews,p.interviewId);if(i.applicationId!==a.id||i.status!=='Scheduled')throw Error('This interview is not awaiting feedback.');if(instant(i.date,i.time)>Date.now())throw Error('Record feedback after the interview starts.');const rating=Number(p.rating);if(!Number.isInteger(rating)||rating<1||rating>5)throw Error('Choose a rating between 1 and 5.');if(!['Proceed','Hold','Reject'].includes(p.recommendation))throw Error('Choose a recommendation.');const f={rating,notes:required(p.notes,'Feedback',3000),recommendation:p.recommendation,recordedAt:iso()};result.activity=transition('Interview Results',['Interview'],'Interview feedback recorded');i.status='Completed';i.feedback=f;a.feedback=f;break;}
      case 'offer':{
        if(!['Interview Results','Offer'].includes(a.stage)||j.status!=='Active')throw Error('Prepare offers from interview results for an active job.');if(a.offer&&a.offer.status!=='Draft')throw Error('This offer is no longer editable.');const salary=Number(p.salary);if(!Number.isFinite(salary)||salary<=0||salary>1000000)throw Error('Enter a valid monthly salary.');dateCheck(p.startDate,'start date');dateCheck(p.expiry,'expiry date');if(p.expiry<day()||p.startDate<=p.expiry)throw Error('Expiry must be today or later; start date must be after expiry.');const terms=required(p.terms,'Offer terms',3000);db.notifications.filter(n=>n.applicationId===a.id&&n.kind==='Offer'&&n.status==='Draft').forEach(n=>n.status='Superseded');a.offer={salary,currency:'SGD',startDate:p.startDate,expiry:p.expiry,terms,approval:'Awaiting approval',status:'Draft',createdAt:a.offer?.createdAt||iso()};result.activity=a.stage==='Interview Results'?transition('Offer',['Interview Results'],'Offer prepared'):activity('Offer details updated');break;
      }
      case 'approve-offer':if(a.stage!=='Offer'||a.offer?.status!=='Draft'||a.offer.approval==='Approved'||a.offer.expiry<day())throw Error('Only an unapproved, unexpired draft offer can be approved.');a.offer.approval='Approved';activity('Offer approved');break;
      case 'offer-message':{
        if(a.stage!=='Offer'||a.offer?.approval!=='Approved'||a.offer.expiry<day())throw Error('Approve a valid offer before preparing email.');if(db.notifications.some(n=>n.applicationId===a.id&&n.kind==='Offer'&&n.status==='Draft'))throw Error('An offer email is already in the outbox.');const n=message('Employment offer — '+j.title,'Hello '+c.name+',\n\nWe are pleased to offer you the role of '+j.title+'.\nMonthly salary: SGD '+a.offer.salary+'\nStart date: '+a.offer.startDate+'\nPlease respond by: '+a.offer.expiry+'\n\n'+a.offer.terms+'\n\nBest regards,\nSarah Mitchell');n.kind='Offer';activity('Offer email prepared');break;
      }
      case 'accept-offer':if(a.stage!=='Offer'||a.offer?.approval!=='Approved'||a.offer.expiry<day())throw Error('Only an approved, unexpired offer can be accepted.');a.offer.status='Accepted';result.activity=transition('Hired',['Offer'],'Offer acceptance recorded',required(p.notes,'Acceptance record',1000));break;
      case 'confirm-rejection':if(a.stage!=='Rejected')throw Error('This application is not rejected.');a.rejectionReason=required(p.reason,'Reason');a.rejectionConfirmed=true;activity('Rejection reason confirmed');break;
      case 'message':{if(a.stage==='Rejected'&&!a.rejectionConfirmed)throw Error('Confirm the rejection reason before preparing a notice.');if(p.notificationId){const n=find(db.notifications,p.notificationId);if(n.applicationId!==a.id)throw Error('This email belongs to another application.');if(n.status!=='Draft')throw Error('This draft has been superseded by a later change. Prepare a new message instead.');n.subject=required(p.subject,'Subject',200);n.body=required(p.body,'Message',6000);activity('Email draft updated');result.notification=n;}else{result.notification=message(required(p.subject,'Subject',200),required(p.body,'Message',6000));activity('Email draft prepared');}break;}
      case 'read-notification':find(db.notifications,p.id).read=true;break;
      case 'read-all':db.notifications.forEach(n=>n.read=true);break;
      case 'task':{const title=required(p.title,'Task title',150),assignee=required(p.assignee,'Assignee',100);dateCheck(p.due,'due date');if(p.due<day())throw Error('Due date cannot be in the past.');db.tasks.push({id:uid('task'),applicationId:a.id,title,assignee,due:p.due,notes:String(p.notes||'').trim(),status:'Open',createdAt:iso()});activity('Interview task created',title);break;}
      case 'complete-task':{const t=find(db.tasks,p.id);if(t.status!=='Open')throw Error('This task is already completed.');t.status='Completed';db.activity.unshift({id:uid('activity'),applicationId:t.applicationId,summary:'Task completed',notes:t.title,actor,at:iso()});break;}
      case 'candidate-notes':c.notes=required(p.notes,'Candidate note',3000);activity('Candidate notes updated');break;
      case 'job-save':{const old=p.id?find(db.jobs,p.id):null;const v={title:required(p.title,'Job title',100),department:required(p.department,'Department',100),type:p.type,mode:p.mode,location:required(p.location,'Location',100),experience:required(p.experience,'Experience',100),education:required(p.education,'Education',150),description:required(p.description,'Description',3000),requirements:required(p.requirements,'Requirements',3000).split('\n').map(x=>x.trim()).filter(Boolean),skills:required(p.skills,'Skills',500).split(',').map(x=>x.trim()).filter(Boolean),status:p.status};if(!['Active','Draft','Closed'].includes(v.status)||!['Full-time','Part-time','Contract','Internship'].includes(v.type)||!['On-site','Hybrid','Remote'].includes(v.mode))throw Error('Choose valid job settings.');if(old)Object.assign(old,v);else db.jobs.push({id:uid('job'),...v,createdAt:iso()});activity(old?'Job posting updated':'Job posting created',v.title);break;}
      case 'job-status':{const item=find(db.jobs,p.id);if(!['Active','Closed'].includes(p.status))throw Error('Invalid job status.');item.status=p.status;activity('Job posting '+p.status.toLowerCase(),item.title);break;}
      default:throw Error('Unknown action.');
    }
    if(result.activity&&result.notification)result.activity.notificationId=result.notification.id;
    for (const n of db.notifications) if (!n.kind) n.kind='Message';
    validate(db);return result;
  }
  function createStore(storage){
    let db,error='',raw=null,corrupt=false;try{raw=storage.getItem(KEY);if(raw){db=JSON.parse(raw);validate(db);}else db=seed();}catch(e){db=seed();error='Saved data could not be loaded. Manage data lets you export the original data or restore a valid backup.';corrupt=true;}
    function commit(action,p={}){if(corrupt)throw Error(error);let current;try{current=storage.getItem(KEY);}catch(e){throw Error('Browser storage is unavailable. Allow local storage to save changes.');}if(current!==raw)throw Error('This workspace changed in another tab. Reload before saving.');const next=clone(db),result=apply(next,action,p);next.revision++;next.updatedAt=iso();const text=JSON.stringify(next);try{storage.setItem(KEY,text);}catch(e){throw Error('Changes were not saved. Browser storage may be full or blocked. Export a backup before clearing space.');}db=next;raw=text;return result;}
    function restore(value){validate(value);const copy=clone(value);copy.revision++;copy.updatedAt=iso();const text=JSON.stringify(copy);storage.setItem(KEY,text);db=copy;raw=text;corrupt=false;error='';}
    return {get db(){return db;},get error(){return error;},get raw(){return raw;},commit,restore,reset(){restore(seed());}};
  }
  root.HRModel={KEY,STAGES,seed,validate,apply,createStore,day,uid,clone};if(typeof module!=='undefined')module.exports=root.HRModel;
})(typeof window!=='undefined'?window:globalThis);
