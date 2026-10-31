import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {runInNewContext} from 'node:vm';
const base=new URL('../JRS Login and profile/client/utils/',import.meta.url);
const targets={'/pages/jobs/jobs.html':'/applicant/jobs','/pages/resume/resume.html':'/applicant/resume','/pages/application-status/application-status.html':'/applicant/status'};
for(const [legacy,target]of Object.entries(targets))test('integrated legacy address forwards without rendering display fixtures: '+legacy,async()=>{
 const source=await fs.readFile(new URL('portal-display.js',base),'utf8');let callback,replaced;
 const window={location:{pathname:legacy,replace:value=>{replaced=value;}}};Object.defineProperty(window,'JRS_PORTAL_JOBS',{get(){throw new Error('Display fixtures must not be used');}});
 runInNewContext(source,{window,document:{addEventListener:(event,listener)=>{callback=listener;}},JRS:{request:async endpoint=>{assert.equal(endpoint,'/integration-config');return {valid:true,experimentalApplicantPortal:true};}}});
 await callback();assert.equal(replaced,target);
});
for(const enabled of [true,false])test('profile navigation follows integrated mode without changing the profile entry: '+enabled,async()=>{
 const source=await fs.readFile(new URL('navigation.js',base),'utf8'),callbacks=[];
 const links=Object.keys(targets).map(path=>({href:'http://localhost:3101'+path}));
 const window={JRS:{},location:{href:'http://localhost:3101/pages/profile/profile.html'}};
 runInNewContext(source,{URL,window,document:{addEventListener:(event,listener)=>callbacks.push(listener),getElementById:()=>null,querySelectorAll:()=>links},JRS:{request:async()=>({valid:true,experimentalApplicantPortal:enabled})}});
 for(const callback of callbacks)await callback();
 assert.deepEqual(links.map(link=>link.href),enabled?Object.values(targets):Object.keys(targets).map(path=>'http://localhost:3101'+path));
});
