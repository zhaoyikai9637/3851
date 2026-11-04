// Private HR documents are sent only by the existing explicit send workflow.
export function createHrMailjetTransport(settings,{fetchImpl=fetch}={}){
 return {async sendMail(message){
  const recipient=String(message.to||'').trim();
  if(!settings.enabled)throw Error('HR_MAIL_DISABLED');
  if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient)||/[\r\n]/.test(String(message.subject||''))||!String(message.subject||'').trim()||typeof message.text!=='string')throw Error('Invalid HR message.');
  if(settings.mode==='sandbox'&&!settings.allowlist.includes(recipient.toLowerCase()))throw Error('Recipient is outside the HR mail allowlist.');
  const attachments=message.attachments||[];if(!Array.isArray(attachments)||attachments.length>1)throw Error('Invalid HR attachment.');
  const files=attachments.map(a=>{if(!Buffer.isBuffer(a.content)||a.content.length>5*1024*1024||a.contentType!=='application/pdf'||/[\r\n]/.test(a.filename||'')||!a.filename||a.path||a.href)throw Error('Invalid HR attachment.');return {ContentType:a.contentType,Filename:a.filename,Base64Content:a.content.toString('base64')};});
  try{
   const response=await fetchImpl('https://api.mailjet.com/v3.1/send',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json',Authorization:'Basic '+Buffer.from(settings.apiKey+':'+settings.secretKey).toString('base64')},body:JSON.stringify({Messages:[{From:{Email:settings.from,Name:settings.name},To:[{Email:recipient}],Subject:message.subject,TextPart:message.text,...(files.length?{Attachments:files}:{})}]})});
   if(!response.ok)throw Error('Rejected');const body=await response.json(),sent=body.Messages?.[0],to=sent?.To?.find(t=>t.Email?.toLowerCase()===recipient.toLowerCase());if(body.Messages?.length!==1||sent?.Status!=='success'||!to)throw Error('Rejected');
   return {accepted:[recipient],messageId:String(to.MessageUUID||to.MessageID||message.messageId||'')};
  }catch{throw Error('HR_MAIL_DELIVERY_FAILED');}
 }};
}
