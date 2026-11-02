const nodemailer = require('nodemailer');
function createMailer(config, {transport: suppliedTransport} = {}) {
    const smtp = config.smtp || {}, allowlist = (smtp.allowlist || []).map(email=>email.toLowerCase());
    const ready = Boolean(smtp.enabled && smtp.host && smtp.user && smtp.pass && smtp.from && (smtp.mode !== 'sandbox' || allowlist.length));
    const transport = ready ? suppliedTransport || nodemailer.createTransport({
        host: smtp.host, port: smtp.port, secure: smtp.secure, requireTLS: !smtp.secure,
        auth: { user: smtp.user, pass: smtp.pass }, tls: { rejectUnauthorized: true },
        connectionTimeout: 10000, socketTimeout: 15000, disableFileAccess: true, disableUrlAccess: true
    }) : null;
    async function send(email, subject, text) {
        if (!ready) throw new Error('SMTP_NOT_CONFIGURED');
        if(smtp.mode === 'sandbox' && !allowlist.includes(email.toLowerCase())) throw new Error('Recipient is outside the sandbox allowlist.');
        const info = await transport.sendMail({from:smtp.from,to:email,subject,text});
        if (!info.accepted?.some(address=>String(address).toLowerCase()===email.toLowerCase())) throw new Error('SMTP_RECIPIENT_NOT_ACCEPTED');
    }
    return { ready,
        sendHrAssistance: email=>send(email,'JRS account assistance','Please contact your supervisor or administrator to request a password reset. No self-service reset link has been issued. If you did not request this assistance, you can ignore this email.'),
        sendCode: (email,code)=>send(email,'JRS password reset code',`Your JRS verification code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`),
        sendResetLink: (email,url)=>send(email,'Reset your JRS password',`Use this single-use link to reset your JRS password:\n\n${url}\n\nIt expires in 10 minutes. If you did not request this, ignore this email.`)
    };
}
module.exports = { createMailer };
