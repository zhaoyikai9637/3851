import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { Sequelize } from 'sequelize';
import { root, loadSettings } from './config.mjs';
import {syncSentMail} from './mail-history-bridge.mjs';
import {mountReadiness} from './readiness.mjs';
import {recruitmentMailSettings} from './mail-settings.mjs';
import { readSharedSession, createSharedIdentity, verifySharedWrite, httpError } from './security.mjs';
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
import recruitmentAuth from '../JRS HR/server/auth.cjs';
import { defineModels as communicationModels } from '../jrs-hr-module/server/src/models.js';
import { createServices } from '../jrs-hr-module/server/src/services.js';
import { createApp as communicationApp } from '../jrs-hr-module/server/src/app.js';
import { DatabaseSessionStore } from '../jrs-hr-module/server/src/session-store.js';

export async function createRuntime({mailTransport}={}) {
  const settings = loadSettings(), pool = mysql.createPool(settings.db);
  const makeSequelize = () => new Sequelize(settings.DB_NAME, settings.DB_USER, settings.DB_PASSWORD, { dialect: 'mysql', host: settings.DB_HOST, port: settings.db.port, logging: false, timezone: '+00:00', dialectOptions: settings.db.ssl ? { ssl: settings.db.ssl } : {}, define: { underscored: true } });
  const communicationDb = makeSequelize();
  let applicantDb, data;
  const close = async () => { await Promise.all([pool.end(), communicationDb.close(), applicantDb?.close()]); };
  try {
    const [[version]] = await pool.query('SELECT version FROM JRS_INTEGRATION_VERSION WHERE id=1');
    if (version?.version !== 11) throw new Error('The database requires the approved integration schema version 11. Local setup is not a cloud migration command.');
    const experimental = settings.ENABLE_EXPERIMENTAL_APPLICANT_PORTAL !== 'false';
    const repository = new candidateRepository.Repository(pool,{integratedRoot:true}), bridge = createRecruitmentBridge(pool, { experimentalApplicantPortal: experimental });
    const recruitment = recruitmentRepository.createRepository(namespacePool(pool));
    const load = recruitment.load, save = recruitment.save, snapshot = recruitment.snapshot;
    recruitment.snapshot = async userId => loadAssessments(pool,await snapshot(userId));
    recruitment.load = async connection => { await bridge.templates(connection); return loadAssessments(connection,await load(connection)); };
    recruitment.save = async (connection, before, after) => { await save(connection, before, after); await saveAssessments(connection,before,after); await bridge.mirror(connection, before, after); };
    // The original repository closes over its private load/save. Wrap its transaction
    // callbacks too, so original HR command code crosses the same integration boundary.
    const transact = recruitment.transaction;
    recruitment.transaction = (fn, write = false) => transact(async connection => {
      await bridge.templates(connection);
      const result=await fn(connection);
      if(write)await syncSentMail(connection,{uploadDir:settings.uploadDir});
      return result;
    }, write);
    const originalSnapshot = recruitment.snapshot;
    recruitment.snapshot = async userId => {
      await bridge.templates(pool);
      return addSubmittedMaterials(pool,await originalSnapshot(userId));
    };
    const models = communicationModels(communicationDb, { integratedMailHistory: true });
    const uploadDir = settings.uploadDir;
    await fs.mkdir(uploadDir, { recursive: true });
    const config = { production: settings.production, secret: settings.SESSION_SECRET, origin: settings.origin, mode: 'team', companyName: 'JRS', uploadDir, teamLoginUrl: `${settings.origin}/pages/login/login.html`, sessionMs: 8 * 3600000, resetSecret: settings.RESET_SECRET, integratedRoot: true };
    const identity = createSharedIdentity(repository, config);
    const hr = communicationApp({ services: { ...createServices(models, config), ...jobPublicationServices(pool, recruitment, bridge) }, config, identity, sessionStore: new DatabaseSessionStore(models.Session) });
    const sharedAuth = {
      async login() { throw httpError(409, 'Use the shared JRS sign-in page.'); },
      async requireUser(req, res, next) {
        const account = await readSharedSession(req, repository);
        if (!account) throw httpError(401, 'Please sign in.');
        if (account.role !== 'hr') throw httpError(403, 'HR access only.');
        const canonical = await repository.hrIdentity(account.account_id);
        if (!canonical) throw httpError(403, 'HR profile is inactive.');
        verifySharedWrite(req, account, settings.origin);
        const id = `team-hr-${canonical.user_id}`;
        const [[row]] = await pool.execute("SELECT * FROM recruiting_user WHERE id=? AND status='Active'", [id]);
        if (!row || row.role !== canonical.role) throw httpError(403, 'HR workspace identity does not match.');
        await pool.execute('UPDATE recruiting_user SET name=?,email=?,department=?,phone=?,office_location=? WHERE id=?', [canonical.full_name, canonical.email, canonical.department, canonical.phone || '', canonical.office_location || '', id]);
        await refreshCanonicalPeople(pool);
        req.sharedAccount = account;
        req.user = recruitmentAuth.publicUser({ ...row, name: canonical.full_name, email: canonical.email });
        req.session = { csrf: account.csrf };
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
    mountReadiness(app,{pool,uploadDir});
    app.locals.data = data;
    app.get('/', (req, res) => res.redirect(experimental ? '/jobs' : '/pages/login/login.html'));
    app.get('/api/integration-config', (req, res) => res.json({ experimentalApplicantPortal: experimental }));
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
    app.use('/recruitment/api/hr/applications',submittedMaterialsRouter({pool,requireUser:sharedAuth.requireUser,uploadDir}));
    app.use('/recruitment', recruiting);
    if (experimental) {
      const { mountExperimentalApplicant } = await import('./experimental/applicant.mjs');
      applicantDb = makeSequelize();
      data = await mountExperimentalApplicant({ app, applicantDb, repository, recruitment, bridge, uploadDir, identity, settings });
    }
    const hrDist = path.join(root, 'jrs-hr-module/client/dist');
    app.use('/hr', express.static(hrDist, { dotfiles: 'deny' }));
    app.get(/^\/hr(?:\/.*)?$/, (req, res) => res.sendFile(path.join(hrDist, 'index.html')));
    app.use(candidateApp.createApp({ repository, config, mailer: candidateMailer.createMailer({smtp:settings.smtp}) }));
    return { app, close, settings, repository, recruitment, data };
  } catch (error) { await close(); throw error; }
}
