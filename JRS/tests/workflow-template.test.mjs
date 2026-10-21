import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {templateSchema} from '../jrs-hr-module/server/src/validation.js';
const require=createRequire(import.meta.url),M=require('../JRS HR/dist/state.js'),S=require('../JRS HR/server/service.cjs');
const user={id:'team-hr-1',name:'Test HR',role:'HR_MANAGER'};

for(const command of ['template-save','template-delete']) test(`native ${command} cannot mutate an authoritative template mirror`,()=>{
 const db=M.seed();db.templates=[{id:'canonical-template-3',name:'Authoritative',kind:'Interview Invite',subject:'Interview',body:'Thank you.',active:true}];
 const before=JSON.stringify(db);
 assert.throws(()=>S.applyCommand(db,command,{id:'canonical-template-3',name:'Changed',kind:'Interview Invite',subject:'Changed',body:'Changed',active:true},user),error=>error.status===409&&/Templates/.test(error.message));
 assert.equal(JSON.stringify(db),before);
});
test('the template editor accepts real interview and offer variables while native rendering formats actual dates',()=>{
 const template={templateName:'Interview invitation',usageType:'INTERVIEW_INVITE',subject:'Interview for [JobTitle]',body:'[InterviewDate] [InterviewTime] [InterviewLocation] [InterviewFormat] [Interviewer] [OfferDeadline]'};
 assert.equal(templateSchema.safeParse(template).success,true);
 const db=M.seed(),a=db.applications[0];a.stage='Interview';db.interviews=[{applicationId:a.id,status:'Scheduled',date:'2031-01-12',time:'09:30',location:'Room 2',format:'On-site',interviewer:'Panel'}];
 const rendered=S.fillTemplate(db,a,user,{subject:'Interview',body:'{{date}} {{time}} {{location}}'});
 assert.equal(rendered.body,'12/01/2031 09:30 Room 2');
 assert.throws(()=>S.fillTemplate(db,a,user,{subject:'Offer',body:'{{expiry}}'}));
});
test('stage-specific rejection templates reject the wrong source stage',()=>{
 const db={...M.seed(),templates:[],mailLogs:[],systemNotifications:[]},a=db.applications[0];a.stage='Interview Results';
 S.applyCommand(db,'reject',{applicationId:a.id,reason:'Role requirements',notify:false},user);
 db.templates.push({id:'review-rejection',name:'Application Rejection',kind:'Application Rejection',active:true,subject:'Update',body:'Thank you.'});
 assert.throws(()=>S.applyCommand(db,'message',{applicationId:a.id,templateId:'review-rejection'},user),/stage/i);
 db.templates[0].kind='Interview Rejection';
 const result=S.applyCommand(db,'message',{applicationId:a.id,templateId:'review-rejection'},user);
 assert.equal(result.notification.templateId,'review-rejection');
 assert.equal(result.notification.templateName,'Application Rejection');
});
