import {applyCandidateOwnership,assertCandidateReadAccess,assertManualCandidateEmail} from './candidate-ownership.mjs';
import {createCandidateRecoveryMailer} from './candidate-mail.mjs';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createDatabasePool,resilientSequelize,recoverRead} from './database-recovery.mjs';
import { Sequelize } from 'sequelize';
import { root, loadSettings, applicantPortalEnabled } from './config.mjs';
import {createFileStore} from './file-storage.mjs';
import {syncSentMail} from './mail-history-bridge.mjs';
import {mountReadiness} from './readiness.mjs';
import {recruitmentMailSettings} from './mail-settings.mjs';
import { createSharedIdentity, httpError } from './security.mjs';
import {requireRecruitmentUser} from './recruitment-auth.mjs';
import { namespacePool } from './sql-namespace.mjs';
import { createRecruitmentBridge } from './recruitment-bridge.mjs';
import { jobPublicationServices } from './job-publications.mjs';
import { jobEditorRouter } from './job-editor.mjs';
import { refreshCanonicalPeople } from './canonical-applicant-profile.mjs';
import { addSubmittedMaterials,submittedMaterialsRouter } from './submitted-materials.mjs';
import { loadAssessments, saveAssessments } from './interview-assessments.mjs';
import candidateRepository from '../JRS Login and profile/server/services/repository.js';
import candidateApp from '../JRS Login and profile/server/app.js';
import candidateMailer from '../JRS Login and profile/server/services/mailer.js';
import recruitmentRepository from '../JRS HR/server/repository.cjs';
import recruitmentApp from '../JRS HR/server/app.cjs';
import { defineModels as communicationModels } from '../jrs-hr-module/server/src/models.js';
import { createServices } from '../jrs-hr-module/server/src/services.js';
import { createApp as communicationApp } from '../jrs-hr-module/server/src/app.js';
import { DatabaseSessionStore } from '../jrs-hr-module/server/src/session-store.js';

export async function createRuntime({mailTransport}={}) {
  const settings = loadSettings();
  if(settings.DB_MODE==='review' && (!mailTransport?.reviewCapture || typeof mailTransport.sendMail!=='function'))throw Error('Review mode requires its local captured mailbox. Use npm run review:start.');
  const fileStore = createFileStore(settings), pool = createDatabasePool(settings.db);
  const makeSequelize = () => resilientSequelize(new Sequelize(settings.DB_NAME, settings.DB_USER, settings.DB_PASSWORD, { dialect: 'mysql', host: settings.DB_HOST, port: settings.db.port, logging: false, timezone: '+00:00', dialectOptions: settings.db.ssl ? { ssl: settings.db.ssl } : {}, define: { underscored: true }, retry: {max:0}, pool:{max:4,min:0,idle:10000,evict:5000,acquire:20000} }));
  const communicationDb = makeSequelize();
  let applicantDb, data;
  const close = async () => { await Promise.all([pool.end(), communicationDb.close(), applicantDb?.close()]); };
  try {
    const [[version]] = await pool.query('SELECT version FROM JRS_INTEGRATION_VERSION WHERE id=1');
    if (version?.version !== 12) throw new Error('The database requires the approved integration schema version 12. Local setup is not a cloud migration command.');
    const experimental = applicantPortalEnabled(settings);
    const repository = new candidateRepository.Repository(pool,{integratedRoot:true}), bridge = createRecruitmentBridge(pool, { experimentalApplicantPortal: experimental });
    const recruitment = recruitmentRepository.createRepository(namespacePool(pool));
    const load = recruitment.load, save = recruitment.save, snapshot = recruitment.snapshot;
    recruitment.snapshot = async userId => loadAssessments(pool,await recoverRead(()=>snapshot(userId)));
    recruitment.load = async connection => { await bridge.templates(connection); return applyCandidateOwnership(connection,await loadAssessments(connection,await load(connection))); };
    recruitment.save = async (connection, before, after, options) => { await save(connection, before, after); await saveAssessments(connection,before,after); await bridge.mirror(connection, before, after, options); };
    // The original repository closes over its private load/save. Wrap its transaction
    // callbacks too, so original HR command code crosses the same integration boundary.
    const transact = recruitment.transaction;
    recruitment.transaction = async (fn, write = false) => {
      if(write)await refreshCanonicalPeople(pool);
      return transact(async connection => {
      if(write)await bridge.templates(connection);
      const result=await fn(connection);
      if(write)await syncSentMail(connection,{uploadDir:settings.uploadDir,fileStore});
      return result;
      }, write);
    };
    recruitment.assertCandidateReadAccess=id=>assertCandidateReadAccess(pool,id);
    recruitment.assertManualCandidateEmail=(connection,address)=>assertManualCandidateEmail(connection,address);
    const originalSnapshot = recruitment.snapshot;
    recruitment.snapshot = async userId => {
      await Promise.all([refreshCanonicalPeople(pool),bridge.templates(pool)]);
      return addSubmittedMaterials(pool,await originalSnapshot(userId));
    };
    const models = communicationModels(communicationDb, { integratedMailHistory: true });
    const uploadDir = settings.uploadDir;
    await fs.mkdir(uploadDir, { recursive: true });
    if(fileStore.kind==='supabase')await fileStore.check();
    const config = { production: settings.production, secret: settings.SESSION_SECRET, origin: settings.origin, mode: 'team', companyName: 'JRS', uploadDir, fileStore, teamLoginUrl: `${settings.origin}/pages/login/login.html`, sessionMs: 8 * 3600000, resetSecret: settings.RESET_SECRET, integratedRoot: true };
    const identity = createSharedIdentity(repository, config);
    const hr = communicationApp({ services: { ...createServices(models, config), ...jobPublicationServices(pool, recruitment, bridge) }, config, identity, sessionStore: new DatabaseSessionStore(models.Session) });
    const sharedAuth = {
      async login() { throw httpError(409, 'Use the shared JRS sign-in page.'); },
      async requireUser(req, res, next) {
        await requireRecruitmentUser(req,pool,settings.origin);
        next();
      },
      async logout(req, res) { await identity.logout(req, res); res.json({ ok: true }); },
      async changePassword(req, res) {
        if (!await repository.changePassword(req.sharedAccount.account_id, req.body.currentPassword, req.body.newPassword)) throw httpError(422, 'Current password is incorrect.');
        await identity.logout(req, res); res.json({ ok: true });
      },
    };
    const recruiting = recruitmentApp.createApp({ repo: recruitment, cfg: { origin: settings.origin, secure: settings.production, writesEnabled: true, mail: recruitmentMailSettings(settings.smtp), publicDir: path.join(root, 'JRS HR/dist') }, sharedAuth, transport:mailTransport });
    const app = express();
    app.disable('x-powered-by');
    if(settings.production)app.set('trust proxy',1);
    mountReadiness(app,{pool,uploadDir,fileStore});
    app.locals.data = data;
    app.get('/', (req, res) => res.redirect(settings.ENABLE_EXPERIMENTAL_APPLICANT_PORTAL !== 'false' ? '/jobs' : '/pages/login/login.html'));
    app.get('/api/integration-config', (req, res) => res.json({ valid:true, experimentalApplicantPortal: experimental }));
    app.get('/login', (req, res) => res.redirect('/pages/login/login.html'));
    for (const feature of ['job-management', 'create-job', 'edit-job', 'interview-schedule', 'interview-feedback']) {
      app.get(`/pages/${feature}/${feature}.html`, (req, res) => res.redirect(feature.startsWith('interview-') ? '/hr/interviews' : '/hr/job-postings'));
    }
    if (experimental) for (const [old, target] of [['jobs', '/applicant/jobs'], ['resume', '/applicant/resume'], ['application-status', '/applicant/status']]) app.get(`/pages/${old}/${old}.html`, (req, res) => res.redirect(target));
    app.use((req, res, next) => {
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Referrer-Policy', 'same-origin');
      if (/^\/(api|applicant-api|recruitment\/api)/.test(req.path)) res.set('Cache-Control', 'no-store');
      next();
    });
    app.use((req, res, next) => /^\/api\/(auth|hr)(\/|$)/.test(req.path) ? hr(req, res, next) : next());
    app.use('/recruitment/api/hr/job-postings', jobEditorRouter({ recruitment, pool, requireUser:sharedAuth.requireUser }));
    app.use('/recruitment/api/hr/applications',submittedMaterialsRouter({pool,requireUser:sharedAuth.requireUser,uploadDir,fileStore}));
    app.use('/recruitment', recruiting);
    if (experimental) {
      const { mountApplicantPortal } = await import('./applicant-portal.mjs');
      applicantDb = makeSequelize();
      data = await mountApplicantPortal({ app, applicantDb, repository, recruitment, bridge, uploadDir, fileStore, identity, settings });
    }
    const hrDist = path.join(root, 'jrs-hr-module/client/dist');
    app.use('/hr', express.static(hrDist, { dotfiles: 'deny' }));
    app.get(/^\/hr(?:\/.*)?$/, (req, res) => res.sendFile(path.join(hrDist, 'index.html')));
    app.use(candidateApp.createApp({ repository, config, mailer: createCandidateRecoveryMailer(candidateMailer.createMailer({smtp:settings.smtp},settings.DB_MODE==='review'?{transport:mailTransport}:{}),settings.candidateMail) }));
    return { app, close, settings, repository, recruitment, data, fileStore };
  } catch (error) { await close(); throw error; }
}

