import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import multer from 'multer';
import sharp from 'sharp';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { ZodError } from 'zod';
import swaggerUi from 'swagger-ui-express';
import { HttpError, profileSchema, templateSchema, notificationFiltersSchema, notificationRestoreSchema, logFiltersSchema, idSchema } from './validation.js';
import { openapi } from './openapi.js';
import { verifiedHrIdentity, assertIdentityAdapter } from './team-auth.js';
const saveSession = req => new Promise((resolve,reject) => req.session.save(e => e ? reject(e) : resolve()));
const renewSession = req => new Promise((resolve,reject) => req.session.regenerate(e => e ? reject(e) : resolve()));
export function createApp({ services, config, sessionStore, staticDir, identity = null }) {
  if (identity) assertIdentityAdapter(identity);
  const app = express();
  app.disable('x-powered-by');
  if (config.production) app.set('trust proxy',1);
  // Local File previews use object URLs; allow them for images only, retaining
  // Helmet's default script/connect/object restrictions.
  app.use(helmet({ contentSecurityPolicy: { directives: { imgSrc: ["'self'", 'data:', 'blob:'] } } }));
  app.use(express.json({ limit:'100kb' }));
  app.use('/api', (req,res,next) => { res.set('Cache-Control','no-store'); next(); });
  app.use(session({ name:'jrs.hr.sid', secret:config.secret, resave:false, saveUninitialized:false,
    store:sessionStore, cookie:{ httpOnly:true, secure:config.production, sameSite:'lax', maxAge:8*3600000, path:'/' } }));
  app.get('/api/health', (req,res) => res.json({ status:'ok', module:'hr-notifications' }));
  app.get('/api/auth/config', (req,res) => res.json({ loginUrl:config.teamLoginUrl || null, adapterConfigured:Boolean(identity) }));
  app.get('/api/auth/csrf', async (req,res) => {
    req.session.csrf ||= crypto.randomBytes(32).toString('hex'); await saveSession(req); res.json({ csrfToken:req.session.csrf });
  });
  app.use('/api', (req,res,next) => {
    if (['GET','HEAD','OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    if (origin && origin !== config.origin) return next(new HttpError(403,'Untrusted request origin.'));
    const token = req.get('x-csrf-token');
    // Validate both values before decoding: JS character length is not UTF-8 byte length.
    const isToken = value => typeof value === 'string' && value.length === 64 && /^[a-f0-9]{64}$/.test(value);
    if (!isToken(token) || !isToken(req.session.csrf) || !crypto.timingSafeEqual(Buffer.from(token,'hex'),Buffer.from(req.session.csrf,'hex'))) return next(new HttpError(403,'CSRF token missing or expired. Refresh and retry.'));
    next();
  });
  const requireHr = async (req,res,next) => {
    const auth = verifiedHrIdentity(await identity?.resolve(req));
    await services.authorize(auth);
    req.hrUserId = auth.hrUserId;
    req.identityKey = crypto.createHash('sha256').update(JSON.stringify(auth)).digest('hex');
    // A token from a previous upstream account/session must never authorize a write.
    if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.session.identityKey !== req.identityKey) {
      throw new HttpError(403, 'The team session changed. Refresh before retrying.');
    }
    next();
  };
  app.get('/api/auth/me',requireHr,async (req,res) => {
    if (req.session.identityKey !== req.identityKey) {
      await renewSession(req);
      req.session.identityKey = req.identityKey;
      req.session.csrf = crypto.randomBytes(32).toString('hex');
      await saveSession(req);
    }
    res.json({user:await services.profile(req.hrUserId),csrfToken:req.session.csrf,mode:config.mode});
  });
  app.post('/api/auth/logout',requireHr,async (req,res) => {
    // The adapter must revoke the upstream session before confirming logout.
    // On failure keep local state and report failure; never claim global logout.
    await identity.logout(req,res);
    await new Promise((resolve,reject) => req.session.destroy(e => e ? reject(e) : resolve()));
    res.clearCookie('jrs.hr.sid',{path:'/',httpOnly:true,sameSite:'lax',secure:config.production});
    res.status(204).end();
  });
  app.get('/api/openapi.json', (req,res) => res.json(openapi));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, { swaggerOptions:{ persistAuthorization:false } }));
  app.use('/api/hr',requireHr);
  app.get('/api/hr/profile',async (req,res) => res.json(await services.profile(req.hrUserId)));
  app.patch('/api/hr/profile',async (req,res) => res.json(await services.updateProfile(req.hrUserId,profileSchema.parse(req.body))));
  const upload = multer({ storage:multer.memoryStorage(), limits:{ fileSize:2*1024*1024, files:1 } });
  app.post('/api/hr/profile/photo',upload.single('photo'),async (req,res) => {
    if (!req.file) throw new HttpError(422,'Choose a JPEG or PNG image (up to 2 MB).');
    let bytes;
    try {
      const img=sharp(req.file.buffer,{ limitInputPixels:16000000 }); const meta=await img.metadata();
      if (!['jpeg','png'].includes(meta.format)) throw new Error('Invalid format');
      bytes=await img.rotate().resize(384,384,{ fit:'cover' }).jpeg({ quality:85 }).toBuffer();
    } catch { throw new HttpError(422,'The file must be a valid JPEG or PNG, at most 16 megapixels.'); }
    await fs.mkdir(config.uploadDir,{recursive:true}); const name=`${crypto.randomUUID()}.jpg`; const target=path.join(config.uploadDir,name);
    await fs.writeFile(target,bytes,{flag:'wx'});
    let replacement;
    try { replacement = await services.updatePhoto(req.hrUserId,name); }
    catch(e) { await fs.unlink(target); throw e; }
    const previous = replacement.previousPhoto;
    if (previous && previous !== name && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.jpg$/.test(previous)) {
      try { if (!await services.photoInUse(previous)) await fs.unlink(path.join(config.uploadDir,previous)); }
      catch(e) { if (e.code !== 'ENOENT') console.warn('Superseded avatar cleanup deferred:',e.code || e.name); }
    }
    res.json(replacement.profile);
  });
  app.get('/api/hr/profile/photo',async (req,res) => {
    const name=await services.photo(req.hrUserId);
    if (!/^[a-f0-9-]{36}\.jpg$/.test(name)) throw new HttpError(404,'Photo unavailable.');
    res.sendFile(path.join(config.uploadDir,name));
  });
  app.get('/api/hr/notifications',async (req,res) => res.json(await services.notifications(req.hrUserId,notificationFiltersSchema.parse(req.query))));
  app.patch('/api/hr/notifications/read-all',async (req,res) => res.json(await services.markAllRead(req.hrUserId)));
  app.patch('/api/hr/notifications/restore-unread',async (req,res) => res.json(await services.restoreUnread(req.hrUserId,notificationRestoreSchema.parse(req.body).notificationIds)));
  app.patch('/api/hr/notifications/:id/read',async (req,res) => { await services.markRead(req.hrUserId,idSchema.parse(req.params.id)); res.status(204).end(); });
  app.get('/api/hr/templates',async (req,res) => res.json({ items:await services.templates() }));
  app.post('/api/hr/templates',async (req,res) => res.status(201).json(await services.createTemplate(req.hrUserId,templateSchema.parse(req.body))));
  app.put('/api/hr/templates/:id',async (req,res) => res.json(await services.updateTemplate(req.hrUserId,idSchema.parse(req.params.id),templateSchema.parse(req.body))));
  app.delete('/api/hr/templates/:id',async (req,res) => { await services.deleteTemplate(req.hrUserId,idSchema.parse(req.params.id)); res.status(204).end(); });
  app.get('/api/hr/logs',async (req,res) => res.json(await services.logs(req.hrUserId,logFiltersSchema.parse(req.query))));
  app.get('/api/hr/logs/:id',async (req,res) => res.json(await services.log(req.hrUserId,idSchema.parse(req.params.id))));
  app.get('/api/hr/attachments/:id/download',async (req,res) => {
    const a=await services.attachment(req.hrUserId,idSchema.parse(req.params.id));
    // file_url is a private storage basename, never a public URL or arbitrary path.
    if (!/^[a-f0-9-]{36}\.[a-z0-9]{1,8}$/.test(a.fileUrl)) throw new HttpError(404,'Attachment not available in module storage.');
    res.download(path.join(config.uploadDir,a.fileUrl),a.fileName);
  });
  app.get('/api/hr/applications/:id',async (req,res) => res.json(await services.application(req.hrUserId,idSchema.parse(req.params.id))));
  app.use('/api',(req,res,next) => next(new HttpError(404,'API route not found.')));
  if (staticDir) { app.use(express.static(staticDir)); app.get('/{*path}',(req,res) => res.sendFile(path.join(staticDir,'index.html'))); }
  app.use((err,req,res,next) => {
    if(res.headersSent) return next(err);
    let status=err.status || 500, message=err.message, fields;
    // Body parser messages can echo submitted fragments; publish stable errors.
    if(err.type==='entity.parse.failed') {status=400;message='Malformed JSON body.';}
    if(err.type==='entity.too.large') {status=413;message='Request body is too large.';}
    if(err instanceof ZodError) { status=422; message='Please check the entered values.'; fields=err.issues.map(i => ({ field:i.path.join('.'),message:i.message })); }
    if(err.name==='SequelizeUniqueConstraintError') {status=409;message='A record with that name already exists (including archived templates).';}
    if(err instanceof multer.MulterError) {status=422;message='Upload one image, no larger than 2 MB.';}
    if(err.code==='ENOENT') {status=404;message='File no longer available.';}
    if(status>=500) {console.error('Request failed:',err.name);message='Something went wrong. Please try again.';}
    res.status(status).json({error:{message,...(fields?{fields}:{})}});
  });
  return app;
}
