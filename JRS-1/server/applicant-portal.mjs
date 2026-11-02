import express from 'express';
import multer from 'multer';
import {createHash} from 'node:crypto';
import path from 'node:path';
import { root } from './config.mjs';
import { readSharedSession, verifySharedWrite, httpError } from './security.mjs';
import { IntegratedApplicantData } from './applicant-data.mjs';
import { defineModels as applicantModels } from '../JRS Applicant Portal/server/models/index.js';
import optionRoutes from '../JRS Applicant Portal/server/routes/options.js';
import jobRoutes from '../JRS Applicant Portal/server/routes/jobs.js';
import profileRoutes from '../JRS Applicant Portal/server/routes/profile.js';
import applicationRoutes from '../JRS Applicant Portal/server/routes/applications.js';

// Shared-session applicant portal. Legacy experimental imports delegate here.
export async function mountApplicantPortal({ app, applicantDb, repository, recruitment, bridge, uploadDir, fileStore, identity, settings }) {
  const data = new IntegratedApplicantData(applicantDb, applicantModels(applicantDb), { repository, recruitment, bridge, uploadDir, fileStore });
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
  applicants.use('/options', optionRoutes);
  applicants.use('/jobs', jobRoutes);
  applicants.use('/profile', profileRoutes);
  applicants.get('/resumes/:id/download',async(req,res,next)=>{
    try{const file=await data.resumeFile(req.user.id,id(req.params.id));
      if(!file||!/^[a-f0-9]{64}$/.test(file.storage_key))throw httpError(404,'Resume is unavailable.');
      const bytes=await data.fileStore.get(file.storage_key);
      res.attachment(file.file_name).type(file.file_type).set('Cache-Control','no-store').send(bytes);
    }catch(error){next(error);}
  });
  const id = value => {const parsed=Number(value);if(!Number.isSafeInteger(parsed)||parsed<1)throw httpError(400,'Invalid resume identifier.');return parsed;};
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1,fields:0},fileFilter(req,file,done){if(!['.pdf','.doc','.docx'].includes(path.extname(file.originalname).toLowerCase())||file.originalname.length>180)return done(httpError(400,'Upload a PDF, DOC or DOCX resume with a file name of at most 180 characters.'));done(null,true);}});
  applicants.get('/resumes',async(req,res)=>res.json({resumes:await data.listResumes(req.user.id)}));
  applicants.post('/resumes',async(req,res,next)=>{const window=Math.floor(Date.now()/3600000),key=createHash('sha256').update('applicant-upload:'+req.user.id+':'+window).digest('hex');if(!await repository.rateLimit(key,new Date((window+1)*3600000),20))throw httpError(429,'Too many uploads. Please try again later.');next();},upload.single('resume'),async(req,res)=>{if(!req.file)throw httpError(400,'Choose a resume file to upload.');res.status(201).json({resume:await data.createResume(req.user.id,req.file)});});
  applicants.delete('/resumes/:resumeId',async(req,res)=>{const resume=await data.deleteResume(req.user.id,id(req.params.resumeId));if(!resume)throw httpError(404,'Resume not found.');res.status(204).end();});
  applicants.use('/applications', applicationRoutes);
  applicants.use((req,res)=>res.status(404).json({message:'Applicant API route not found.'}));
  applicants.use((error,req,res,next)=>{if(res.headersSent)return next(error);const status=error instanceof multer.MulterError?400:error.status||500;if(status>=500)console.error('Applicant request failed:',error.code||'INTERNAL_ERROR');res.status(status).json({message:status>=500?'The server could not complete this request.':error instanceof multer.MulterError?'Upload one resume of at most 5 MB.':error.message});});
  app.use('/applicant-api', applicants);
  const applicantDist = path.join(root, 'JRS Applicant Portal/client/dist');
  app.use('/assets', express.static(path.join(applicantDist, 'assets'), { dotfiles: 'deny' }));
  app.get(/^\/(jobs|applicant|connect|auth\/complete)(\/.*)?$/, (req, res) => res.sendFile(path.join(applicantDist, 'index.html')));
  return data;
}
