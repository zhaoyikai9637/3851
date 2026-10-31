// Candidate recovery delivery only; HR transports retain their existing configuration.
export function candidateMailSettings(env) {
 const provider=env.CANDIDATE_MAIL_PROVIDER||'smtp';
 if(!['smtp','mailjet'].includes(provider))throw new Error('Unknown candidate mail provider.');
 const settings={provider,apiKey:env.MAILJET_API_KEY,secretKey:env.MAILJET_SECRET_KEY,from:env.MAILJET_FROM_EMAIL,name:env.MAILJET_FROM_NAME||'JRS',mode:env.CANDIDATE_MAIL_MODE||'sandbox',allowlist:(env.CANDIDATE_MAIL_ALLOWLIST||'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean)};
 if(!['sandbox','production'].includes(settings.mode))throw new Error('Invalid candidate mail mode.');
 if(provider==='mailjet'&&(!/^[a-f0-9]{32}$/i.test(settings.apiKey||'')||!/^[a-f0-9]{32}$/i.test(settings.secretKey||'')||!/^\S+@\S+\.\S+$/.test(settings.from||'')||/[\r\n]/.test(settings.name)||(settings.mode==='sandbox'&&!settings.allowlist.length)))throw new Error('Mailjet requires sender credentials and explicit sandbox recipients.');
 return settings;
}
export function createCandidateRecoveryMailer(base,settings,{fetchImpl=fetch}={}) {
 if(settings.provider!=='mailjet')return base;
 return {...base,candidateCodeReady:true,async sendCode(email,code){
  if(settings.mode==='sandbox'&&!settings.allowlist.includes(email.toLowerCase()))throw new Error('Candidate mail recipient is outside the allowlist.');
  if(!/^\d{4}$/.test(String(code)))throw new Error('Invalid recovery code.');
  try {
   const response=await fetchImpl('https://api.mailjet.com/v3.1/send',{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
    headers:{'Content-Type':'application/json',Authorization:'Basic '+Buffer.from(settings.apiKey+':'+settings.secretKey).toString('base64')},
    body:JSON.stringify({Messages:[{From:{Email:settings.from,Name:settings.name},To:[{Email:email}],Subject:'JRS password reset code',TextPart:`Your JRS verification code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`}]})
   });
   if(!response.ok)throw new Error('Rejected');
   const body=await response.json(),message=body.Messages?.[0];
   if(body.Messages?.length!==1||message.Status!=='success'||!message.To?.some(to=>to.Email?.toLowerCase()===email.toLowerCase()))throw new Error('Rejected');
  }catch{throw new Error('CANDIDATE_MAIL_DELIVERY_FAILED');}
 }};
}
