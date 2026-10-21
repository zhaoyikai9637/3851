import test from 'node:test';
import assert from 'node:assert/strict';
import {templateSchema} from '../jrs-hr-module/server/src/validation.js';
import {createRecruitmentBridge} from '../server/recruitment-bridge.mjs';
import {createRequire} from 'node:module';
const {formalTemplates}=await import('../server/formal-mail-templates.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const require=createRequire(import.meta.url),M=require('../JRS HR/dist/state.js'),S=require('../JRS HR/server/service.cjs');
const user={id:'team-hr-1',name:'Test HR',role:'HR_MANAGER'};
test('formal templates retain every supported workflow and use validated business variables',()=>{
 assert.ok(Array.isArray(formalTemplates),'Formal template library is missing');
 assert.equal(formalTemplates.length,10);
 for(const template of formalTemplates){assert.ok(templateSchema.safeParse(template).success,template.templateName);assert.ok(!/^JRS/i.test(template.templateName));}
 assert.deepEqual([...new Set(formalTemplates.map(t=>t.usageType))].sort(),['ACCEPTED','APPLICATION_REJECTION','INTERVIEW_INVITE','INTERVIEW_REJECTION','IN_PROGRESS','OFFER_DECLINED_ACKNOWLEDGEMENT','OFFER_LETTER','OFFER_WITHDRAWAL','REJECTED'].sort());
});
test('formal scheduling and offer messages require actual workflow values before rendering',async()=>{
 assert.ok(formalTemplates,'Formal template library is missing');
 const native=[];
 await createRecruitmentBridge({}).templates({query:async()=>[formalTemplates.map((t,index)=>({template_id:index+1,template_name:t.templateName,subject:t.subject,body:t.body,usage_type:t.usageType,is_active:1,updated_at:'2026-10-21T00:00:00Z'}))],execute:async(_sql,p)=>native.push({id:p[0],name:p[1],kind:p[2],subject:p[3],body:p[4],active:true})});
 const db=M.seed(),a=db.applications[0];db.templates=native;a.stage='Interview';
 const schedule=native.find(t=>t.name==='Interview Schedule');assert.throws(()=>S.fillTemplate(db,a,user,schedule),/no date/);
 db.interviews=[{applicationId:a.id,status:'Scheduled',date:'2031-01-12',time:'09:30',format:'Video',location:'https://meeting.example.test/room',interviewer:'Test panel'}];
 const interview=S.fillTemplate(db,a,user,schedule).body;assert.ok(interview.includes('12/01/2031'));assert.ok(interview.includes('09:30'));assert.ok(interview.includes('https://meeting.example.test/room'));
 const offer=native.find(t=>t.kind==='Offer Letter');assert.throws(()=>S.fillTemplate(db,a,user,offer),/no (currency|salary)/);
 a.offer={salary:6200,currency:'SGD',startDate:'2031-02-01',expiry:'2031-01-20',status:'Pending',approval:'Approved'};a.stage='Offer';
 const body=S.fillTemplate(db,a,user,offer).body;assert.ok(body.includes('SGD 6200'));assert.ok(body.includes('01/02/2031'));assert.ok(body.includes('20/01/2031'));
 const declined=native.find(t=>t.kind==='Offer Declined Acknowledgement');assert.throws(()=>S.applyCommand(db,'message',{applicationId:a.id,templateId:declined.id},user),/decline/i);
});
