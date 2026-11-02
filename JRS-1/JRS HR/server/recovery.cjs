'use strict';
const M=require('../dist/state.js');
// A terminated process may have submitted SMTP mail without recording its reply.
// Release the workflow lock after 5 minutes, but never retry that message.
async function recoverStaleSends(repo) {
  return repo.transaction(async conn=>{
    const before=await repo.load(conn),after=M.clone(before),cutoff=Date.now()-5*60000;
    const stale=after.notifications.filter(n=>n.status==='Sending'&&Date.parse(n.sendingAt)<cutoff);
    if(!stale.length)return;
    for(const n of stale){n.status='Uncertain';n.lastError='Sending was interrupted. Check the email provider; this message will not be resent automatically.';}
    after.revision++;after.updatedAt=new Date().toISOString();await repo.save(conn,before,after);
  },true);
}
module.exports={recoverStaleSends};
