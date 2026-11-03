import test from 'node:test';import assert from 'node:assert/strict';import {createRecruitmentBridge} from '../server/recruitment-bridge.mjs';
const base=()=>({jobs:Array.from({length:50},(_,i)=>({id:'j'+i,title:'Role '+i,description:'Description',requirements:[],status:'Active'})),candidates:[],applications:[],systemNotifications:[]});
test('an unchanged business snapshot performs no mirror queries',async()=>{const before=base(),after=structuredClone(before);const db={query:()=>assert.fail('unchanged data must not be written')};await createRecruitmentBridge(db).mirror(db,before,after);});
test('mail-only changes do not rewrite all jobs or applications',async()=>{const before={...base(),notifications:[]},after={...structuredClone(before),notifications:[{id:'sent',status:'Sent'}]};let queries=0;const db={query:()=>queries++};await createRecruitmentBridge(db).mirror(db,before,after);assert.equal(queries,0);});
test('publication-only changes explicitly mirror the target job and preserve unrelated jobs',async()=>{const before=base();const sql=[];const db={query:async q=>{sql.push(q);return [[{user_id:1}]]},execute:async(q,args)=>{sql.push(q);if(q.includes('JRS_JOB_LINK'))return [[{canonical_id:4,portal_id:2}]];if(q.includes('JRS_JOB_PUBLICATION'))return [[{salary_range:'SGD 5,000'}]];return [{}]}};await createRecruitmentBridge(db).mirror(db,before,structuredClone(before),{jobIds:['j7']});assert.equal(sql.filter(q=>q.startsWith('UPDATE JOB_POSITION')).length,1);assert.equal(sql.filter(q=>q.includes('FROM JRS_JOB_LINK')).length,1);});
test('all templates are synchronized with one parameterized write',async()=>{const calls=[];const db={query:async()=>[Array.from({length:20},(_,i)=>({template_id:i,template_name:'T'+i,usage_type:'IN_PROGRESS',subject:'Hi [CandidateName]',body:'Body',is_active:1,updated_at:'2026-01-01'}))],execute:async(...args)=>calls.push(args)};await createRecruitmentBridge(db).templates(db);assert.equal(calls.length,1);assert.equal(calls[0][1].length,140);assert.ok(calls[0][1].includes('Hi {{candidateName}}'));});


test('mirrored notifications persist the original UTC instant rather than a server-local default',async()=>{
 const before=base(),after=structuredClone(before);after.jobs=[];
 before.jobs=[];
 after.systemNotifications=[{id:'utc-event',applicationId:'application-1',title:'Offer prepared',eventType:'Status Update',createdAt:'2026-11-03T13:26:46.835Z'}];
 let notification;
 const db={query:async()=>[[{user_id:1}]],execute:async(sql,args)=>{if(sql.includes('FROM JRS_HR_APPLICATION_LINK'))return [[{canonical_id:8}]];notification={sql,args};return [{}];}};
 await createRecruitmentBridge(db).mirror(db,before,after);
 assert.match(notification.sql,/created_at\) VALUES/);
 assert.equal(notification.args.at(-1),'2026-11-03 13:26:46');
 assert.equal(notification.args.at(-2),'recruiting:utc-event');
});
