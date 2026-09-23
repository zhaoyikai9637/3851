'use strict';
const express=require('express');
const {randomUUID}=require('node:crypto');
const {createAuth,publicUser}=require('./auth.cjs');
const {createService,text,find,fillTemplate,audit,variables}=require('./service.cjs');
const {createMailer}=require('./mail.cjs');
const {HttpError,fail}=require('./errors.cjs');
const M=require('../dist/state.js');
function createApp({repo,cfg,transport}) {
  const app=express(),auth=createAuth(repo.pool,cfg),service=createService(repo),mailer=createMailer(repo,cfg,transport);
  app.disable('x-powered-by');
  app.use((req,res,next)=>{
    req.requestId=randomUUID();res.set('X-Request-ID',req.requestId);
    res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'SAMEORIGIN','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; object-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"});
    if(req.path.startsWith('/api/'))res.set('Cache-Control','no-store');
    if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin&&req.headers.origin!==cfg.origin)return next(new HttpError(403,'This request origin is not allowed.'));
    next();
  });
  app.get('/api/health',async(req,res)=>{try{await repo.pool.query('SELECT 1');res.json({ok:true,database:'connected'});}catch{res.status(503).json({ok:false,database:'unavailable'});}});
  app.use(express.json({limit:'64kb',strict:true}));
  // Team handoff defaults to no writes, including login sessions and rate-limit rows.
  app.use('/api',(req,res,next)=>{
    if(cfg.writesEnabled===false&&!['GET','HEAD','OPTIONS'].includes(req.method))return next(new HttpError(503,'Shared database writes are not enabled. Complete the schema review and team integration setup first.','TEAM_READ_ONLY'));
    next();
  });
  app.post('/api/auth/login',auth.login);
  app.use('/api',auth.requireUser);
  app.get('/api/auth/me',(req,res)=>res.json({user:req.user,csrfToken:req.session.csrf}));
  app.post('/api/auth/logout',auth.logout);
  app.post('/api/auth/password',auth.changePassword);
  const workspace=async userId=>{
    const db=await repo.snapshot(userId),[[u]]=await repo.pool.execute('SELECT * FROM hr_user WHERE id=?',[userId]);
    db.currentUser=publicUser(u);db.mailEnabled=cfg.mail.enabled;db.timezone='Asia/Singapore';return db;
  };
  app.get('/api/hr/workspace',async(req,res)=>res.json(await workspace(req.user.id)));
  app.get('/api/hr/templates/variables',(req,res)=>res.json({variables}));
  app.post('/api/hr/templates/:id/preview',async(req,res)=>{const db=await repo.snapshot(req.user.id),a=find(db.applications,req.body.applicationId),t=find(db.templates,req.params.id);if(!t.active)fail(409,'This template is archived.');res.json(fillTemplate(db,a,req.user,t));});
  app.post('/api/hr/commands/:command',async(req,res)=>{
    const revision=Number(req.get('If-Match'));
    if(!req.get('If-Match'))fail(428,'If-Match revision is required.');
    const result=await service.execute(req.params.command,req.body,req.user,revision,req.get('Idempotency-Key'));
    res.json({...result,db:await workspace(req.user.id)});
  });
  // Read endpoints are paginated for other group modules; the first-party UI uses
  // one consistent workspace snapshot because its dashboard aggregates all queues.
  for(const resource of ['applications','candidates','jobs','interviews','tasks','notifications','systemNotifications','mailLogs']) {
    app.get('/api/hr/'+resource,async(req,res)=>{
      const db=await repo.snapshot(req.user.id),q=String(req.query.q||'').toLowerCase();
      const page=Math.max(1,Number.parseInt(req.query.page)||1),limit=Math.max(1,Math.min(100,Number.parseInt(req.query.limit)||20));
      const items=db[resource].filter(r=>(!req.query.stage||r.stage===req.query.stage)&&(!req.query.status||r.status===req.query.status)&&(!req.query.jobId||r.jobId===req.query.jobId)&&(!q||[r.name,r.title,r.subject,r.id,r.email].some(v=>String(v||'').toLowerCase().includes(q))));
      res.json({items:items.slice((page-1)*limit,page*limit),total:items.length,page,limit,revision:db.revision});
    });
  }
  app.post('/api/hr/notifications/:id/send',async(req,res)=>{
    if(typeof req.body.attachResume!=='boolean')fail(422,'Choose whether to attach the resume.');
    const result=await mailer.send(req.params.id,req.user,Number(req.get('If-Match')),req.body.attachResume);res.json({...result,db:await workspace(req.user.id)});
  });
  app.put('/api/hr/candidates/:id/resume',express.raw({type:'application/pdf',limit:'5mb'}),async(req,res)=>{
    if(!Buffer.isBuffer(req.body)||req.body.length<12||req.body.subarray(0,5).toString()!=='%PDF-'||!req.body.subarray(-2048).toString().includes('%%EOF'))fail(422,'Upload a valid PDF file, up to 5 MB.');
    let filename;try{filename=decodeURIComponent(req.get('X-Filename')||'Resume.pdf');}catch{fail(422,'Invalid filename.');}
    filename=text(filename,'Filename',150).replace(/[\x00-\x1f\x7f/\\]/g,'_');if(!filename.toLowerCase().endsWith('.pdf'))fail(422,'Resume must be a PDF.');
    await repo.transaction(async conn=>{
      const before=await repo.load(conn);if(!req.get('If-Match')||Number(req.get('If-Match'))!==before.revision)fail(409,'Refresh before uploading this resume.','REVISION_CONFLICT');
      find(before.candidates,req.params.id);const after=M.clone(before),at=new Date().toISOString();
      await conn.execute('INSERT INTO hr_resume(candidate_id,filename,size_bytes,content,uploaded_at) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE filename=VALUES(filename),size_bytes=VALUES(size_bytes),content=VALUES(content),uploaded_at=VALUES(uploaded_at)',[req.params.id,filename,req.body.length,req.body,at]);
      audit(after,req.user,'Candidate resume uploaded',after.applications.find(a=>a.candidateId===req.params.id)?.id||null,filename);after.revision++;after.updatedAt=at;await repo.save(conn,before,after);
    },true);res.json({db:await workspace(req.user.id)});
  });
  app.get('/api/hr/candidates/:id/resume',async(req,res)=>{
    const [[r]]=await repo.pool.execute('SELECT filename,content FROM hr_resume WHERE candidate_id=?',[req.params.id]);if(!r)fail(404,'No uploaded resume is available.');
    res.set('Content-Type','application/pdf');res.set('Content-Disposition',`${req.query.download==='1'?'attachment':'inline'}; filename="resume.pdf"; filename*=UTF-8''${encodeURIComponent(r.filename)}`);res.send(r.content);
  });
  app.get('/api/hr/mailLogs/:id/attachments',async(req,res)=>{const [rows]=await repo.pool.execute('SELECT id,filename,size_bytes AS size FROM hr_notification_attachment WHERE log_id=?',[req.params.id]);res.json({items:rows});});
  app.get('/api/hr/attachments/:id',async(req,res)=>{const [[r]]=await repo.pool.execute('SELECT filename,content FROM hr_notification_attachment WHERE id=?',[req.params.id]);if(!r)fail(404,'Attachment not found.');res.type('pdf').set('Content-Disposition',`attachment; filename="attachment.pdf"; filename*=UTF-8''${encodeURIComponent(r.filename)}`).send(r.content);});
  app.use('/api',(req,res)=>res.status(404).json({error:{code:'NOT_FOUND',message:'API route not found.'}}));
  app.use(express.static(cfg.publicDir,{dotfiles:'deny',index:'index.html',maxAge:0,fallthrough:true}));
  app.use((req,res)=>res.status(404).send('Page not found.'));
  app.use((err,req,res,next)=>{
    if(res.headersSent)return next(err);
    let status=err.status||500,message=err.message,code=err.code||'REQUEST_ERROR';
    if(err.code==='ER_DUP_ENTRY'){status=409;message='This record already exists.';code='DUPLICATE';}
    if(err.type==='entity.too.large'){status=413;message='The uploaded request is too large.';}
    if(status>=500&&!(err instanceof HttpError)){console.error(`[${req.requestId}] ${err.code||err.name}`);message='The server could not complete this request. Refresh to check the saved state; retry uses the same request key.';code='SERVER_ERROR';}
    res.status(status).json({error:{code,message,requestId:req.requestId}});
  });
  return app;
}
module.exports={createApp};
