export function mailSettings(env) {
 const smtp={enabled:env.SMTP_ENABLED==='true',host:env.SMTP_HOST,port:Number(env.SMTP_PORT||587),secure:env.SMTP_SECURE==='true',user:env.SMTP_USER,pass:env.SMTP_PASSWORD,from:env.SMTP_FROM,mode:env.SMTP_MODE||'sandbox',allowlist:(env.SMTP_RECIPIENT_ALLOWLIST||'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean)};
 if(!['sandbox','production'].includes(smtp.mode))throw new Error('SMTP_MODE must be sandbox or production.');
 if(smtp.enabled&&(!smtp.host||!smtp.user||!smtp.pass||!smtp.from||!/^\S+@\S+\.\S+$/.test(smtp.from)||!Number.isInteger(smtp.port)||smtp.port<1||smtp.port>65535||(smtp.port===465&&!smtp.secure)||(smtp.mode==='sandbox'&&!smtp.allowlist.length)))throw new Error('Enabled SMTP requires complete sender credentials, valid TLS settings and sandbox recipients.');
 return smtp;
}
export function recruitmentMailSettings(smtp) {
 return {...smtp,password:smtp.pass};
}
