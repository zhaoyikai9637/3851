import { DataTypes as D } from 'sequelize';
export function defineModels(db) {
  const pk = () => ({ type: D.INTEGER, primaryKey: true, autoIncrement: true });
  const str = (length, required = true) => ({ type: D.STRING(length), allowNull: !required });
  const fk = (nullable = false) => ({ type: D.INTEGER, allowNull: nullable });
  const HrUser = db.define('HrUser', {
    userId: pk(), employeeId: { ...str(30), unique: true }, fullName: str(100), email: { ...str(150), unique: true },
    phone: str(20, false), role: str(50), department: str(100), officeLocation: str(100, false),
    profilePhotoUrl: str(255, false), accountStatus: { ...str(20), defaultValue: 'ACTIVE' }, lastLoginAt: D.DATE
  }, { tableName: 'HR_USER' });
  // Standalone authentication adapter; passwords are NEVER stored in HR_USER.
  const Account = db.define('Account', {
    accountId: pk(), email: { ...str(150), unique: true }, passwordHash: str(255),
    role: str(20), hrUserId: { ...fk(true), unique: true }
  }, { tableName: 'MODULE_ACCOUNT' });
  const Session = db.define('Session', {
    sid: { type: D.STRING(128), primaryKey: true }, data: { type: D.TEXT('medium'), allowNull: false }, expires: { type: D.DATE, allowNull: false }
  }, { tableName: 'MODULE_SESSION', timestamps: false });
  const Template = db.define('EmailTemplate', {
    templateId: pk(), templateName: { ...str(150), unique: true }, subject: str(255),
    body: { type: D.TEXT, allowNull: false }, usageType: str(50),
    isActive: { type: D.BOOLEAN, allowNull: false, defaultValue: true }, createdBy: fk(), updatedBy: fk(true)
  }, { tableName: 'EMAIL_TEMPLATE' });
  // These three models are a documented contract with the team's Applications module.
  const Candidate = db.define('Candidate', { candidateId: pk(), fullName: str(100), email: str(150) }, { tableName: 'CANDIDATE' });
  const Job = db.define('JobPosition', { positionId: pk(), title: str(150) }, { tableName: 'JOB_POSITION' });
  const Application = db.define('Application', {
    applicationId: pk(), candidateId: fk(), positionId: fk(), assignedHrUserId: fk(),
    currentStatus: str(50), appliedAt: { type: D.DATE, allowNull: false, defaultValue: D.NOW }
  }, { tableName: 'APPLICATION' });
  const Notification = db.define('SystemNotification', {
    notificationId: pk(), recipientUserId: fk(), applicationId: fk(true), notificationType: str(50),
    title: str(180), message: { type: D.TEXT, allowNull: false }, sourceModule: { ...str(100), defaultValue: 'Applications' },
    eventKey: { ...str(150, false), unique: true }, isRead: { type: D.BOOLEAN, allowNull: false, defaultValue: false }, readAt: D.DATE
  }, { tableName: 'SYSTEM_NOTIFICATION', updatedAt: false });
  const Log = db.define('NotificationLog', {
    logId: pk(), applicationId: fk(), templateId: fk(), senderUserId: fk(),
    triggerEvent: str(100), sourceModule: str(100), recipientEmail: str(150),
    candidateName: str(100), positionTitle: str(150), templateName: str(150),
    emailSubject: str(255), emailBody: { type: D.TEXT, allowNull: false },
    deliveryStatus: { ...str(20), defaultValue: 'PENDING' }, sentAt: D.DATE,
    eventKey: { ...str(150, false), unique: true }, errorMessage: str(255, false),
    isDemo: { type: D.BOOLEAN, allowNull: false, defaultValue: false }
  }, { tableName: 'NOTIFICATION_LOG', updatedAt: false });
  const Attachment = db.define('NotificationAttachment', {
    attachmentId: pk(), logId: fk(), fileName: str(255), fileUrl: str(255), fileType: str(80)
  }, { tableName: 'NOTIFICATION_ATTACHMENT', updatedAt: false });
  Account.belongsTo(HrUser, { foreignKey: 'hrUserId', as: 'hr', onDelete: 'RESTRICT' });
  Template.belongsTo(HrUser, { foreignKey: 'createdBy', as: 'creator', onDelete: 'RESTRICT' });
  Template.belongsTo(HrUser, { foreignKey: 'updatedBy', as: 'editor', onDelete: 'SET NULL' });
  Application.belongsTo(Candidate, { foreignKey: 'candidateId', as: 'candidate', onDelete: 'RESTRICT' });
  Application.belongsTo(Job, { foreignKey: 'positionId', as: 'position', onDelete: 'RESTRICT' });
  Application.belongsTo(HrUser, { foreignKey: 'assignedHrUserId', as: 'assignee', onDelete: 'RESTRICT' });
  Notification.belongsTo(HrUser, { foreignKey: 'recipientUserId', as: 'recipient', onDelete: 'RESTRICT' });
  Notification.belongsTo(Application, { foreignKey: 'applicationId', as: 'application', onDelete: 'SET NULL' });
  Log.belongsTo(Application, { foreignKey: 'applicationId', as: 'application', onDelete: 'RESTRICT' });
  Log.belongsTo(Template, { foreignKey: 'templateId', as: 'template', onDelete: 'RESTRICT' });
  Log.belongsTo(HrUser, { foreignKey: 'senderUserId', as: 'sender', onDelete: 'RESTRICT' });
  Log.hasMany(Attachment, { foreignKey: 'logId', as: 'attachments', onDelete: 'RESTRICT' });
  Attachment.belongsTo(Log, { foreignKey: 'logId', as: 'log', onDelete: 'RESTRICT' });
  return { HrUser, Account, Session, Template, Candidate, Job, Application, Notification, Log, Attachment };
}
