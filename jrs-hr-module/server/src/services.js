import { Op } from 'sequelize';
import { HttpError, renderTemplate } from './validation.js';
const plain = x => x?.get ? x.get({ plain: true }) : x;
export function profileDto(row) {
  const p = plain(row);
  return { userId: p.userId, employeeId: p.employeeId, fullName: p.fullName, email: p.email,
    phone: p.phone || '', role: p.role, department: p.department, officeLocation: p.officeLocation || '',
    photoUrl: p.profilePhotoUrl ? '/api/hr/profile/photo' : null, accountStatus: p.accountStatus, lastLoginAt: p.lastLoginAt };
}
const notFound = () => new HttpError(404, 'Record not found or not accessible.');
function dateWhere(from, to) {
  const range = {};
  // Date filters use Asia/Singapore calendar days; records remain UTC in MySQL.
  if (from) range[Op.gte] = new Date(`${from}T00:00:00+08:00`);
  if (to) range[Op.lt] = new Date(new Date(`${to}T00:00:00+08:00`).getTime() + 86400000);
  return Reflect.ownKeys(range).length ? range : undefined;
}
const page = (rows, count, f, extra = {}) => ({ items: rows.map(plain), total: count, page: f.page, pageSize: f.pageSize, ...extra });
const successfulLog = userId => ({ senderUserId: userId, deliveryStatus: 'SENT', sentAt: { [Op.ne]: null } });
export function createServices(m, { companyName = 'JRS' } = {}) {
  const getApplication = async (userId, applicationId, transaction) => {
    const app = await m.Application.findOne({ where: { applicationId, assignedHrUserId: userId }, include: ['candidate', 'position'], transaction });
    if (!app) throw notFound();
    return app;
  };
  return {
    async authorize(auth) {
      const hr = await m.HrUser.findByPk(auth.hrUserId);
      if (auth.role !== 'HR' || !hr || hr.accountStatus !== 'ACTIVE') throw new HttpError(403, 'HR profile is no longer authorized.');
      return hr;
    },
    async profile(userId) { const hr = await m.HrUser.findByPk(userId); if (!hr) throw notFound(); return profileDto(hr); },
    async updateProfile(userId, fields) {
      const hr = await m.HrUser.findByPk(userId); if (!hr) throw notFound();
      // Explicit allow-list: role/email/employee ID/status are NEVER editable here.
      await hr.update({ fullName: fields.fullName, phone: fields.phone || null, officeLocation: fields.officeLocation || null });
      return profileDto(hr);
    },
    async updatePhoto(userId, name) {
      // Serialize replacements per HR so two concurrent uploads do not lose the
      // previous filename needed for storage cleanup. HTTP still returns only DTO.
      return m.HrUser.sequelize.transaction(async transaction => {
        const hr = await m.HrUser.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
        if (!hr) throw notFound();
        const previousPhoto = hr.profilePhotoUrl;
        await hr.update({ profilePhotoUrl: name }, { transaction });
        return { profile: profileDto(hr), previousPhoto };
      });
    },
    async photoInUse(name) {
      const [profiles, attachments] = await Promise.all([
        m.HrUser.count({ where: { profilePhotoUrl: name } }),
        m.Attachment.count({ where: { fileUrl: name } })
      ]);
      return profiles > 0 || attachments > 0;
    },
    async photo(userId) { const hr = await m.HrUser.findByPk(userId); if (!hr?.profilePhotoUrl) throw notFound(); return hr.profilePhotoUrl; },
    async notifications(userId, f) {
      const where = { recipientUserId: userId };
      if (f.read === 'unread') where.isRead = false;
      if (f.type) where.notificationType = f.type;
      if (f.search) where[Op.or] = ['title','message','sourceModule'].map(key => ({ [key]: { [Op.substring]: f.search } }));
      const dates = dateWhere(f.from, f.to); if (dates) where.createdAt = dates;
      const [{ rows, count }, unread, all] = await Promise.all([
        m.Notification.findAndCountAll({ where, attributes: { exclude: ['eventKey'] }, order: [['createdAt','DESC'],['notificationId','DESC']], limit: f.pageSize, offset: (f.page-1)*f.pageSize }),
        m.Notification.count({ where: { recipientUserId: userId, isRead: false } }),
        m.Notification.count({ where: { recipientUserId: userId } })
      ]);
      return page(rows, count, f, { unread, all });
    },
    async markRead(userId, notificationId) {
      const n = await m.Notification.findOne({ where: { notificationId, recipientUserId: userId } });
      if (!n) throw notFound();
      if (!n.isRead) await n.update({ isRead: true, readAt: new Date() });
    },
    async markAllRead(userId) {
      const rows = await m.Notification.findAll({ where: { recipientUserId: userId, isRead: false }, attributes: ['notificationId'] });
      const notificationIds = rows.map(row => plain(row).notificationId);
      if (!notificationIds.length) return { updated: 0, notificationIds: [] };
      const [count] = await m.Notification.update(
        { isRead: true, readAt: new Date() },
        { where: { recipientUserId: userId, notificationId: { [Op.in]: notificationIds }, isRead: false } },
      );
      return { updated: count, notificationIds };
    },
    async restoreUnread(userId, notificationIds) {
      const [count] = await m.Notification.update(
        { isRead: false, readAt: null },
        { where: { recipientUserId: userId, notificationId: { [Op.in]: notificationIds }, isRead: true } },
      );
      return { updated: count };
    },
    async templates() { return m.Template.findAll({ where: { isActive: true }, order: [['templateId','ASC']] }); },
    async createTemplate(userId, fields) { return m.Template.create({ ...fields, createdBy: userId, updatedBy: userId, isActive: true }); },
    async updateTemplate(userId, id, fields) { const t = await m.Template.findOne({ where: { templateId: id, isActive: true } }); if (!t) throw notFound(); return t.update({ ...fields, updatedBy: userId }); },
    async deleteTemplate(userId, id) { const t = await m.Template.findOne({ where: { templateId: id, isActive: true } }); if (!t) throw notFound(); await t.update({ isActive: false, updatedBy: userId }); },
    async logs(userId, f) {
      const where = successfulLog(userId);
      if (f.search) where[Op.or] = ['candidateName','positionTitle'].map(key => ({ [key]: { [Op.substring]: f.search } }));
      if (f.trigger) where.triggerEvent = f.trigger;
      const dates = dateWhere(f.from, f.to); if (dates) where.sentAt = { ...where.sentAt, ...dates };
      const { rows, count } = await m.Log.findAndCountAll({ where, attributes: { exclude: ['emailBody','eventKey','errorMessage'] }, order: [['sentAt','DESC'],['logId','DESC']], limit: f.pageSize, offset: (f.page-1)*f.pageSize });
      return page(rows, count, f);
    },
    async log(userId, logId) { const l = await m.Log.findOne({ where: { logId, ...successfulLog(userId) }, include: ['attachments'], attributes: { exclude: ['eventKey','errorMessage'] } }); if (!l) throw notFound(); const value=plain(l); value.attachments=value.attachments.map(a => ({ attachmentId:a.attachmentId,fileName:a.fileName,fileType:a.fileType })); return value; },
    async attachment(userId, attachmentId) {
      const a = await m.Attachment.findByPk(attachmentId, { include: [{ model: m.Log, as: 'log', where: successfulLog(userId), required: true }] });
      if (!a) throw notFound(); return plain(a);
    },
    async application(userId, id) { const a = plain(await getApplication(userId,id)); return { applicationId: a.applicationId, candidateName: a.candidate.fullName, positionTitle: a.position.title, currentStatus: a.currentStatus, appliedAt: a.appliedAt }; },
    // Server-to-server / in-process integration only. Never trust browser event fields.
    async recordApplicationEvent({ eventKey, applicationId, type }, { transaction } = {}) {
      if (typeof eventKey !== 'string' || !eventKey.trim() || eventKey.length > 120 || !['NEW_APPLICATION','STATUS_UPDATED'].includes(type)) throw new HttpError(422,'Invalid workflow event.');
      const app = await m.Application.findByPk(applicationId, { include: ['candidate','position'], transaction });
      if (!app) throw notFound();
      const [row] = await m.Notification.findOrCreate({ where: { eventKey }, defaults: { recipientUserId: app.assignedHrUserId, applicationId, notificationType: type,
        title: type === 'NEW_APPLICATION' ? 'New application received' : 'Candidate status updated',
        message: type === 'NEW_APPLICATION' ? `${app.candidate.fullName} applied for ${app.position.title}.` : `${app.candidate.fullName}'s application is now ${app.currentStatus}.`, sourceModule:'Applications' }, transaction });
      if (row.applicationId !== applicationId || row.notificationType !== type) throw new HttpError(409,'Event key already belongs to a different notification.');
      return row;
    },
    async sendWorkflowEmail({ userId, applicationId, templateId, eventKey, triggerEvent }, mailer) {
      if (typeof eventKey !== 'string' || !eventKey.trim() || eventKey.length > 150) throw new HttpError(422,'A unique eventKey is required.');
      if (typeof triggerEvent !== 'string' || !triggerEvent.trim() || triggerEvent.length > 100) throw new HttpError(422,'A trigger event is required (100 characters maximum).');
      const app = await getApplication(userId,applicationId);
      const template = await m.Template.findOne({ where: { templateId, isActive: true } });
      const hr = await m.HrUser.findByPk(userId); if (!template || !hr) throw notFound();
      const values = { CandidateName:app.candidate.fullName, JobTitle:app.position.title, CompanyName:companyName, HRName:hr.fullName };
      const subject = renderTemplate(template.subject,values), body = renderTemplate(template.body,values);
      if (/[\r\n]/.test(subject) || subject.length > 255) throw new HttpError(422,'Rendered subject is invalid.');
      // Unique event key guarantees one send attempt. Never automatically resend an
      // ambiguous PENDING message after SMTP success / database-write failure.
      const [log, created] = await m.Log.findOrCreate({ where: { eventKey }, defaults: { applicationId, templateId, senderUserId:userId,
        triggerEvent, sourceModule:'Applications', recipientEmail:app.candidate.email, candidateName:values.CandidateName,
        positionTitle:values.JobTitle, templateName:template.templateName, emailSubject:subject, emailBody:body, deliveryStatus:'PENDING' } });
      if (!created) {
        if (log.senderUserId !== userId || log.applicationId !== applicationId || log.templateId !== templateId || log.triggerEvent !== triggerEvent) throw new HttpError(409,'Event key already belongs to a different email attempt.');
        return log;
      }
      let result;
      try { result = await mailer.send({ to:app.candidate.email,subject,text:body }); }
      catch { await log.update({ deliveryStatus:'FAILED', errorMessage:'Mail provider rejected or could not confirm this attempt.' }); return log; }
      if (typeof result?.preview !== 'boolean') throw new Error('Mail adapter returned an unconfirmed result; attempt remains PENDING.');
      await log.update({ deliveryStatus:result.preview ? 'PREVIEW' : 'SENT', sentAt:result.preview ? null : new Date() });
      return log;
    }
  };
}
