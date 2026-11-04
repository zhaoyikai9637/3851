export function mailSettings(env) {
 const smtp={enabled:env.SMTP_ENABLED==='true',host:env.SMTP_HOST,port:Number(env.SMTP_PORT||587),secure:env.SMTP_SECURE==='true',user:env.SMTP_USER,pass:env.SMTP_PASSWORD,from:env.SMTP_FROM,mode:env.SMTP_MODE||'sandbox',allowlist:(env.SMTP_RECIPIENT_ALLOWLIST||'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean)};
 if(!['sandbox','production'].includes(smtp.mode))throw new Error('SMTP_MODE must be sandbox or production.');
 if(smtp.enabled&&(!smtp.host||!smtp.user||!smtp.pass||!smtp.from||!/^\S+@\S+\.\S+$/.test(smtp.from)||!Number.isInteger(smtp.port)||smtp.port<1||smtp.port>65535||(smtp.port===465&&!smtp.secure)||(smtp.mode==='sandbox'&&!smtp.allowlist.length)))throw new Error('Enabled SMTP requires complete sender credentials, valid TLS settings and sandbox recipients.');
 return smtp;
}
export function recruitmentMailSettings(smtp) {
 return {...smtp,password:smtp.pass};
}

export function hrMailSettings(env,smtp){
 const provider=env.HR_MAIL_PROVIDER||'smtp';if(provider==='smtp')return recruitmentMailSettings(smtp);
 if(provider!=='mailjet')throw Error('HR_MAIL_PROVIDER must be smtp or mailjet.');
 if(env.HR_MAIL_ENABLED!==undefined&&!['true','false'].includes(env.HR_MAIL_ENABLED))throw Error('HR_MAIL_ENABLED must be true or false.');
 const settings={provider,enabled:env.HR_MAIL_ENABLED==='true',mode:env.HR_MAIL_MODE||'sandbox',allowlist:(env.HR_MAIL_RECIPIENT_ALLOWLIST||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean),apiKey:env.MAILJET_API_KEY,secretKey:env.MAILJET_SECRET_KEY,from:env.MAILJET_FROM_EMAIL,name:env.MAILJET_FROM_NAME||'JRS'};
 if(!['sandbox','production'].includes(settings.mode))throw Error('HR_MAIL_MODE must be sandbox or production.');
 if(settings.enabled&&(!/^[a-f0-9]{32}$/i.test(settings.apiKey||'')||!/^[a-f0-9]{32}$/i.test(settings.secretKey||'')||!/^\S+@\S+\.\S+$/.test(settings.from||'')||/[\r\n<>]/.test(settings.from)||/[\r\n]/.test(settings.name)||settings.name.length>100||(settings.mode==='sandbox'&&!settings.allowlist.length)))throw Error('Enabled HR Mailjet requires verified sender credentials and explicit sandbox recipients.');
 return settings;
}
