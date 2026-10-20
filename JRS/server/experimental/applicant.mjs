import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { root } from '../config.mjs';
import { readSharedSession, verifySharedWrite, httpError } from '../security.mjs';
import { IntegratedApplicantData } from '../applicant-data.mjs';
import { defineModels as applicantModels } from '../../JRS Applicant Portal/server/models/index.js';
import jobRoutes from '../../JRS Applicant Portal/server/routes/jobs.js';
import profileRoutes from '../../JRS Applicant Portal/server/routes/profile.js';
import resumeRoutes from '../../JRS Applicant Portal/server/routes/resumes.js';
import applicationRoutes from '../../JRS Applicant Portal/server/routes/applications.js';
import optionRoutes from '../../JRS Applicant Portal/server/routes/options.js';
import { errorHandler as applicantErrors } from '../../JRS Applicant Portal/server/middleware/errors.js';

// Loaded only through the explicit experimental switch; not part of the default site.
export async function mountExperimentalApplicant({ app, applicantDb, repository, recruitment, bridge, uploadDir, identity, settings }) {
  await fs.mkdir(path.join(root, 'JRS Applicant Portal/uploads'), { recursive: true });
  const data = new IntegratedApplicantData(applicantDb, applicantModels(applicantDb), { repository, recruitment, bridge, uploadDir });
  app.locals.data = data;
  const applicants = express.Router();
  applicants.use(express.json({ limit: '100kb' }));
  applicants.use(async (req, res, next) => {
    if (req.path === '/jobs' || req.path.startsWith('/jobs/')) {
      if (req.method !== 'GET') throw httpError(405, 'Method not allowed.');
      return next();
    }
    if (req.path === '/auth/demo-session') return res.status(404).json({ message: 'Demo login is disabled in the integrated project.' });
    const account = await readSharedSession(req, repository);
    if (!account) throw httpError(401, 'Please sign in.');
    if (account.role !== 'candidate') throw httpError(403, 'Applicant access only.');
    verifySharedWrite(req, account, settings.origin);
    req.user = await data.getUserById(account.account_id);
    if (!req.user) throw httpError(403, 'Applicant profile is unavailable.');
    req.sharedAccount = account;
    next();
  });
  applicants.get('/auth/me', (req, res) => res.json({ user: req.user }));
  applicants.post('/auth/logout', async (req, res) => { await identity.logout(req, res); res.status(204).end(); });
  applicants.use('/jobs', jobRoutes);
  applicants.use('/options', optionRoutes);
  applicants.use('/profile', profileRoutes);
  applicants.use('/resumes', resumeRoutes);
  applicants.use('/applications', applicationRoutes);
  applicants.use(applicantErrors);
  app.use('/applicant-api', applicants);
  const applicantDist = path.join(root, 'JRS Applicant Portal/client/dist');
  app.use('/assets', express.static(path.join(applicantDist, 'assets'), { dotfiles: 'deny' }));
  app.get(/^\/(jobs|applicant|connect|auth\/complete)(\/.*)?$/, (req, res) => res.sendFile(path.join(applicantDist, 'index.html')));
  return data;
}
