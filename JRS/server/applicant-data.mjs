import {applicationQuestions} from './applicant-questions.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { MySqlDataLayer, jobFilters, matchesJob } from '../JRS Applicant Portal/server/data/createDataLayer.js';
import hrService from '../JRS HR/server/service.cjs';
import state from '../JRS HR/dist/state.js';
import files from '../JRS Login and profile/server/services/files.js';
import { namespacePool } from './sql-namespace.mjs';
import { httpError } from './security.mjs';
import { workFacts } from './applicant-facts.mjs';
import { readApplicantProfile,writeApplicantProfile,contactColumns } from './canonical-applicant-profile.mjs';
import { locationLabel } from '../JRS Applicant Portal/shared/contactFields.js';
import { publicationState } from './job-publications.mjs';

// Reuse the applicant module's validators, models and data methods. A shared
// transaction makes an applicant submission and its HR queue entry atomic.
export class IntegratedApplicantData extends MySqlDataLayer {
  constructor(sequelize, models, { repository, recruitment, bridge, uploadDir }) {
    super(sequelize, models);
    Object.assign(this, { repository, recruitment, bridge, uploadDir });
  }
  async refreshPublicationStatus() {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' });
    await this.repository.pool.execute("UPDATE jobs j JOIN JRS_JOB_LINK l ON l.portal_id=j.id JOIN recruiting_job_position r ON r.id=l.recruiting_id LEFT JOIN JRS_JOB_PUBLICATION p ON p.recruiting_id=r.id SET j.is_open=(r.status='Active' AND (p.publish_date IS NULL OR p.publish_date<=?) AND (p.unpublish_date IS NULL OR p.unpublish_date>?) AND (p.closing_date IS NULL OR p.closing_date>=?))", [today, today, today]);
  }
  async publicationRecords() {
    const [rows] = await this.repository.pool.query('SELECT l.portal_id AS id,r.status,p.publish_date AS publishDate,p.closing_date AS closingDate,p.unpublish_date AS unpublishDate FROM JRS_JOB_LINK l JOIN recruiting_job_position r ON r.id=l.recruiting_id LEFT JOIN JRS_JOB_PUBLICATION p ON p.recruiting_id=r.id WHERE l.portal_id IS NOT NULL');
    return new Map(rows.map(row => [row.id,publicationState(row.status,row)]));
  }
  presentJob(job, state, intake=true) {
    return {...job,...(intake?{roleQuestions:applicationQuestions(job.roleQuestions)}:{}),isOpen:!!state?.accepting,isVisible:!!state?.visible,applicationAvailability:state?.accepting?'Accepting applications':'No longer accepting applications'};
  }
  async listJobs(filters) {
    const [records, publications] = await Promise.all([this.models.Job.findAll({order:[['closingDate','ASC']]}),this.publicationRecords()]);
    const jobs = records.filter(row=>publications.get(row.id)?.visible).map(row=>this.presentJob(row.toJSON(),publications.get(row.id)));
    return {jobs:jobs.filter(job=>matchesJob(job,filters)),filters:jobFilters(jobs)};
  }
  async getJob(id) {
    const [job,publications] = await Promise.all([super.getJob(id),this.publicationRecords()]);
    const state=publications.get(Number(id));
    return job && state?.visible ? this.presentJob(job,state) : null;
  }
  async getCurrentApplication(userId) {
    const application = await super.getCurrentApplication(userId);
    if (!application) return null;
    const publications = await this.publicationRecords();
    const [[link]] = await this.repository.pool.execute('SELECT job_snapshot,applicant_snapshot FROM JRS_APPLICATION_LINK WHERE portal_id=? AND account_id=?',[application.id,userId]);
    const snapshot=typeof link?.job_snapshot==='string'?JSON.parse(link.job_snapshot):link?.job_snapshot;
    application.jobSnapshotAvailable=!!snapshot;
    application.submittedProfile=typeof link?.applicant_snapshot==='string'?JSON.parse(link.applicant_snapshot):link?.applicant_snapshot||null;
    application.job=this.presentJob(snapshot || application.job,publications.get(application.jobId),false);
    return application;
  }
  async getUserById(id) {
    const [[account]] = await this.repository.pool.execute("SELECT a.account_id,c.full_name,a.email FROM MODULE_ACCOUNT a JOIN CANDIDATE c ON c.account_id=a.account_id WHERE a.account_id=? AND a.role='candidate'", [id]);
    if (!account) return null;
    const user = { id: account.account_id, fullName: account.full_name, email: account.email, role: 'applicant' };
    const [record] = await this.models.User.findOrCreate({ where: { id: user.id }, defaults: user });
    if(record.fullName!==user.fullName || record.email!==user.email)await record.update(user);
    return user;
  }
  async getProfile(userId) {
    return readApplicantProfile(this.repository.pool,userId);
  }
  async updateProfile(userId, values) {
    const connection=await this.repository.pool.getConnection();
    try { await connection.beginTransaction();
      const profile=await writeApplicantProfile(connection,userId,values);
      await connection.commit();return profile;
    } catch(error) {await connection.rollback();throw error;} finally {connection.release();}
  }
  async listResumes(userId) {
    return this.sequelize.transaction(async transaction=>{
      await this.sequelize.query('SELECT account_id FROM MODULE_ACCOUNT WHERE account_id=? FOR UPDATE',{replacements:[userId],transaction});
      const [files]=await this.sequelize.query('SELECT f.*,l.portal_id FROM RESUME_FILE f JOIN CANDIDATE c ON c.candidate_id=f.candidate_id LEFT JOIN JRS_RESUME_LINK l ON l.canonical_id=f.file_id WHERE c.account_id=? ORDER BY f.file_id DESC',{replacements:[userId],transaction});
      const result=[];
      for(const file of files){let id=file.portal_id;
        if(!id){const row=await this.models.Resume.create({userId,originalName:file.file_name,storedName:file.storage_key,mimeType:file.file_type,size:file.file_size},{transaction});id=row.id;
          await this.sequelize.query('INSERT INTO JRS_RESUME_LINK(portal_id,canonical_id) VALUES(?,?)',{replacements:[id,file.file_id],transaction});}
        result.push({id,userId,originalName:file.file_name,storedName:file.storage_key,mimeType:file.file_type,size:file.file_size});
      }return result;
    });
  }
  async resumeFile(userId,resumeId) {
    const [[file]]=await this.repository.pool.execute('SELECT f.* FROM RESUME_FILE f JOIN CANDIDATE c ON c.candidate_id=f.candidate_id JOIN JRS_RESUME_LINK l ON l.canonical_id=f.file_id WHERE c.account_id=? AND l.portal_id=?',[userId,resumeId]);
    return file||null;
  }
  async createResume(userId, file) {
    const bytes = await fs.readFile(file.path);
    const mime = await files.inspectResume({ buffer: bytes, originalname: file.originalname });
    const canonical = await this.repository.candidate(userId);
    const key = randomBytes(32).toString('hex');
    await fs.mkdir(this.uploadDir, { recursive: true });
    await fs.copyFile(file.path, path.join(this.uploadDir, key), fs.constants.COPYFILE_EXCL);
    try {
      const created = await this.sequelize.transaction(async transaction => {
        const resume = await this.models.Resume.create({ userId, originalName: file.originalname, storedName: key, mimeType: mime, size: bytes.length }, { transaction });
        await this.sequelize.query('INSERT INTO RESUME_FILE(candidate_id,file_name,storage_key,file_type,file_size) VALUES(?,?,?,?,?)', { replacements: [canonical.candidate_id, file.originalname, key, mime, bytes.length], transaction });
        const [[inserted]] = await this.sequelize.query('SELECT LAST_INSERT_ID() AS id', { transaction });
        await this.sequelize.query('INSERT INTO JRS_RESUME_LINK(portal_id,canonical_id) VALUES(?,?)', { replacements: [resume.id, inserted.id], transaction });
        return resume.toJSON();
      });
      await fs.unlink(file.path).catch(()=>{});return created;
    } catch (error) { await fs.unlink(path.join(this.uploadDir, key)); throw error; }
  }
  async deleteResume(userId, resumeId) {
    const resume = await this.models.Resume.findOne({ where: { userId, id: resumeId } });
    if (!resume) return null;
    if (await this.models.Application.count({ where: { resumeId } })) throw httpError(409, 'A resume attached to an application cannot be deleted.');
    const [[link]] = await this.repository.pool.execute('SELECT r.storage_key,l.canonical_id FROM JRS_RESUME_LINK l JOIN RESUME_FILE r ON r.file_id=l.canonical_id WHERE l.portal_id=?', [resumeId]);
    const result = await super.deleteResume(userId, resumeId);
    if (link) { await this.repository.pool.execute('DELETE FROM JRS_RESUME_LINK WHERE portal_id=?', [resumeId]); await this.repository.pool.execute('DELETE FROM RESUME_FILE WHERE file_id=?', [link.canonical_id]); await fs.unlink(path.join(this.uploadDir, link.storage_key)).catch(() => {}); }
    return result;
  }
  async createApplication(userId, values) {
    if(values.declarationAccepted!==true)throw httpError(422,'Accept the applicant declaration before submitting.');
    const facts = workFacts(values.experiences);
    await this.refreshPublicationStatus();
    return this.sequelize.transaction(async transaction => {
      const query = (sql, replacements = []) => this.sequelize.query(sql, { replacements, transaction });
      const connection = namespacePool({ query, execute: query });
      await query('SELECT account_id FROM MODULE_ACCOUNT WHERE account_id=? FOR UPDATE', [userId]);
      await query('SELECT revision FROM recruiting_workspace WHERE id=1 FOR UPDATE');
      const active = await this.models.Application.findOne({ where: { userId, status: { [(await import('sequelize')).Op.notIn]: ['Withdrawn', 'Rejected'] } }, transaction });
      if (active) throw httpError(409, 'You already have an active application. Withdraw it before applying again.');
      const [job, resume] = await Promise.all([
        this.models.Job.findOne({ where: { id: values.jobId, isOpen: true }, transaction }),
        this.models.Resume.findOne({ where: { id: values.resumeId, userId }, transaction }),
      ]);
      if (!job) throw httpError(404, 'This role is not available for applications.');
      if (!resume) throw httpError(400, 'Choose a resume belonging to your account.');
      if (applicationQuestions(job.roleQuestions).some(q => q.required && !String(values.roleAnswers[q.id] || '').trim())) throw httpError(400, 'Answer every required question.');
      const [[canonical]] = await query('SELECT * FROM CANDIDATE WHERE account_id=?', [userId]);
      const [[jobLink]] = await query('SELECT * FROM JRS_JOB_LINK WHERE portal_id=?', [job.id]);
      if (!jobLink || !canonical) throw httpError(409, 'This job or candidate has not been linked.');
      const [[publication]] = await query('SELECT r.status,p.publish_date AS publishDate,p.closing_date AS closingDate,p.unpublish_date AS unpublishDate FROM recruiting_job_position r LEFT JOIN JRS_JOB_PUBLICATION p ON p.recruiting_id=r.id WHERE r.id=?',[jobLink.recruiting_id]);
      if (!publicationState(publication?.status,publication).accepting) throw httpError(404,'This role is not available for applications.');
      const before = await this.recruitment.load(connection), after = state.clone(before), at = new Date().toISOString();
      const candidateId = `account-${userId}`;
      if (!after.candidates.some(c => c.id === candidateId)) {
        const c = { name: canonical.full_name, email: canonical.email, phone: values.phone, location: locationLabel(values.location), ...facts,
          graduateStatus: 'Not recorded', educationLevel: 'Not recorded', educationMajor: '', graduationDate: null, education: 'Not recorded' };
        after.candidates.push({ ...c, id: candidateId, notes: `${values.coverLetter}\n\n${values.experiences.map(e => `${e.companyName} — ${e.jobTitle} (${e.startDate}–${e.currentRole ? 'Present' : e.endDate})\n${e.responsibilities}`).join('\n\n')}`.slice(0, 6000), createdAt: at });
        await query('INSERT INTO JRS_CANDIDATE_LINK(recruiting_id,canonical_id) VALUES(?,?)', [candidateId, canonical.candidate_id]);
      }
      const [[manager]] = await query("SELECT id,name,role FROM recruiting_user WHERE status='Active' AND role='HR_MANAGER' ORDER BY id LIMIT 1");
      if (!manager) throw httpError(409, 'No active recruitment manager is available.');
      const result = hrService.applyCommand(after, 'application-create', { candidateId, jobId: jobLink.recruiting_id }, manager);
      result.activity.actor = `Applicant: ${canonical.full_name}`.slice(0, 100);
      result.activity.actorId = null;
      const submittedJob={...job.toJSON(),roleQuestions:applicationQuestions(job.roleQuestions)};
      const application = await this.models.Application.create({ userId, ...values,declarationAccepted:true,declarationAcceptedAt:new Date(at) }, { transaction });
      after.revision++; after.updatedAt = at;
      await this.recruitment.save(connection, before, after);
      const [[canonicalApplication]] = await query('SELECT canonical_id FROM JRS_HR_APPLICATION_LINK WHERE recruiting_id=?', [result.application.id]);
      await query('INSERT INTO JRS_APPLICATION_LINK(portal_id,recruiting_id,canonical_id,account_id,job_snapshot) VALUES(?,?,?,?,?)', [application.id, result.application.id, canonicalApplication.canonical_id, userId,JSON.stringify(submittedJob)]);
      const profile=await readApplicantProfile({query},userId);
      const [[resumeLink]] = await query('SELECT f.* FROM RESUME_FILE f JOIN JRS_RESUME_LINK l ON l.canonical_id=f.file_id WHERE l.portal_id=?', [resume.id]);
      if (!resumeLink) throw httpError(409,'The selected resume has not been linked.');
      await query('UPDATE JRS_APPLICATION_LINK SET applicant_snapshot=? WHERE portal_id=?',[JSON.stringify({...profile,fullName:canonical.full_name,email:canonical.email,...values,declarationAcceptedAt:at,resume:{canonicalId:resumeLink.file_id,name:resume.originalName,mimeType:resume.mimeType}}),application.id]);
      await writeApplicantProfile({query},userId,{phone:values.phone,location:values.location,experiences:values.experiences});
      if (resumeLink?.file_type === 'application/pdf') await connection.execute('INSERT INTO hr_resume(candidate_id,filename,size_bytes,content,uploaded_at) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE filename=VALUES(filename),size_bytes=VALUES(size_bytes),content=VALUES(content),uploaded_at=VALUES(uploaded_at)', [candidateId, resume.originalName.slice(0, 150), resume.size, await fs.readFile(path.join(this.uploadDir, resumeLink.storage_key)), at]);
      return { ...application.toJSON(), job: submittedJob, resume: resume.toJSON() };
    });
  }
  async withdrawApplication(userId, applicationId) {
    return this.sequelize.transaction(async transaction => {
      const query = (sql, replacements = []) => this.sequelize.query(sql, { replacements, transaction });
      const connection = namespacePool({ query, execute: query });
      await query('SELECT revision FROM recruiting_workspace WHERE id=1 FOR UPDATE');
      const application = await this.models.Application.findOne({ where: { id: applicationId, userId }, transaction, lock: transaction.LOCK.UPDATE });
      if (!application) return null;
      if (['Accepted', 'Rejected', 'Withdrawn'].includes(application.status)) throw httpError(409, 'This application can no longer be withdrawn.');
      const [[link]] = await query('SELECT * FROM JRS_APPLICATION_LINK WHERE portal_id=? AND account_id=?', [applicationId, userId]);
      if (!link) throw httpError(409, 'Application linkage is unavailable.');
      const before = await this.recruitment.load(connection), after = state.clone(before), a = after.applications.find(a => a.id === link.recruiting_id);
      if (!a) throw httpError(409, 'The HR application is unavailable.');
      a.stage = 'Rejected'; a.rejectionReason = 'Candidate withdrew their application'; a.rejectionConfirmed = true;
      a.notes.push({ text: 'Withdrawn by the candidate through the applicant portal.', actor: 'Applicant', at: new Date().toISOString() });
      const user = await this.getUserById(userId), job = after.jobs.find(j => j.id === a.jobId);
      const event = hrService.audit(after, { id: null, name: `Applicant: ${user.fullName}`.slice(0, 100) }, 'Application withdrawn by candidate', a.id);
      after.systemNotifications.unshift({ id: event.id, applicationId: a.id, title: `${user.fullName} withdrew their application for ${job.title}`.slice(0, 180), eventType: 'Status Update', sourceModule: 'Applications', createdAt: event.at });
      after.interviews.filter(i => i.applicationId === a.id && i.status === 'Scheduled').forEach(i => { i.status = 'Cancelled'; });
      after.revision++; after.updatedAt = new Date().toISOString();
      await query('UPDATE JRS_APPLICATION_LINK SET withdrawn=TRUE WHERE portal_id=?', [applicationId]);
      await this.recruitment.save(connection, before, after);
      await application.update({ status: 'Withdrawn', statusMessage: 'You withdrew this application.' }, { transaction });
      return application.toJSON();
    });
  }
}
