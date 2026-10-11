const nodemailer = require('nodemailer');
function createMailer(config) {
    const smtp = config.smtp;
    const ready = Boolean(smtp.enabled && smtp.host && smtp.user && smtp.pass && smtp.from);
    const transport = ready ? nodemailer.createTransport({
        host: smtp.host, port: smtp.port, secure: smtp.secure, requireTLS: !smtp.secure,
        auth: { user: smtp.user, pass: smtp.pass }, tls: { rejectUnauthorized: true },
        connectionTimeout: 10000, socketTimeout: 15000, disableFileAccess: true, disableUrlAccess: true
    }) : null;
    return { ready, async sendCode(email, code) {
        if (!ready) throw new Error('SMTP_NOT_CONFIGURED');
        await transport.sendMail({ from: smtp.from, to: email, subject: 'JRS password reset code',
            text: `Your JRS verification code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.` });
    } };
}
module.exports = { createMailer };
