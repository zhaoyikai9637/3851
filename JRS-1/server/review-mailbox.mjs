import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {reviewDirectory,assertReviewSettings} from './review-policy.mjs';
export function createReviewMailbox(settings) {
 assertReviewSettings(settings);
 const file=path.join(reviewDirectory,'mailbox.json');let writing=Promise.resolve();
 const transport={reviewCapture:true,messages:[],sendMail(message){const task=writing.then(async()=>{
  const entry={id:randomUUID(),at:new Date().toISOString(),to:[].concat(message.to||[]).map(row=>typeof row==='string'?row:row.address),subject:String(message.subject||''),text:String(message.text||''),attachments:(message.attachments||[]).map(row=>({filename:row.filename,size:row.content?.length||0}))};
  await fs.mkdir(reviewDirectory,{recursive:true});const rows=await fs.readFile(file,'utf8').then(JSON.parse,error=>{if(error.code==='ENOENT')return [];throw error;});rows.push(entry);await fs.writeFile(file,JSON.stringify(rows,null,2),{mode:0o600});transport.messages.push(entry);return {messageId:entry.id,accepted:entry.to,rejected:[]};
 });writing=task.catch(()=>{});return task;}};
 return transport;
}
