import nodemailer from 'nodemailer';
export function createMailer(env = process.env) {
  if (!env.MAIL_MODE || env.MAIL_MODE === 'preview') return { send: async () => ({ preview: true }) };
  if (env.MAIL_MODE !== 'smtp' || !env.SMTP_HOST || !env.MAIL_FROM) throw new Error('SMTP mode requires SMTP_HOST and MAIL_FROM.');
  if (env.MAIL_ALLOW_SMTP !== 'true') throw new Error('Real mail requires explicit MAIL_ALLOW_SMTP=true after approval.');
  const transport = nodemailer.createTransport({ host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 587), secure: env.SMTP_SECURE === 'true',
    disableFileAccess: true, disableUrlAccess: true,
    ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } } : {}) });
  // Accept plain-text workflow fields only, never raw messages or attachment paths.
  return { send: async ({ to, subject, text }) => { const info = await transport.sendMail({ from:env.MAIL_FROM,to,subject,text }); if (!info.accepted?.length) throw new Error('No accepted recipient'); return { preview:false }; } };
}
