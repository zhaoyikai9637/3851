import {expect,it} from 'vitest';
import {createRequire} from 'node:module';
import {templateAllowed} from '../../pages/applications/templatePolicy';
const require=createRequire(import.meta.url);
const backend=require('../../../../JRS HR/dist/state.js');
it('keeps native template choices aligned with the authoritative HR policy',()=>{
 const kinds=['In Progress','Interview Invite','Offer Letter','Accepted','Rejected','Application Rejection','Interview Rejection','Offer Withdrawal','Offer Declined Acknowledgement','Unknown'];
 for(const stage of backend.STAGES)for(const source of backend.STAGES)for(const active of [true,false])for(const kind of kinds)for(const booked of [true,false])for(const approval of ['Approved','Pending']){
  const app={id:'a',stage,offer:{approval,status:'Declined',expiry:'2099-12-31'}},db={activity:[{applicationId:'a',to:'Rejected',from:source}],interviews:booked?[{applicationId:'a',status:'Scheduled'}]:[]},template={active,kind};
  expect(templateAllowed(db,app,template),[stage,source,active,kind,booked,approval].join('/')).toBe(backend.templateAllowed(db,app,template));
 }
});
