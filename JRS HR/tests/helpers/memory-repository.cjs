// Test double for HTTP/service tests only. The running app always uses MySQL.
const M=require('../../dist/state.js');
const {passwordHash}=require('../../server/auth.cjs');
const {templates}=require('../../scripts/database.cjs');
async function memoryRepository(){
  let db={...M.seed(),templates:templates(),systemNotifications:[],mailLogs:[]},requests=new Map(),sessions=new Map(),limits=new Map(),reads=new Set();
  const users=[{id:'test-manager',email:'manager@jrs.local',name:'Junye Shen',role:'HR_MANAGER',employee_id:'HR-TEST-1',status:'Active',phone:'',office_location:'',department:'HR',password_hash:await passwordHash('Integration-password-123')},{id:'test-staff',email:'staff@jrs.local',name:'HR Officer',role:'HR_STAFF',employee_id:'HR-TEST-2',status:'Active',phone:'',office_location:'',department:'HR',password_hash:await passwordHash('Integration-password-123')}];
  async function execute(sql,p=[]){
    if(sql.startsWith('INSERT INTO hr_login_limit')){const v=limits.get(p[0]);limits.set(p[0],{attempts:v&&v.reset_at>=p[2]?v.attempts+1:1,reset_at:p[1]});return [{}];}
    if(sql.startsWith('SELECT attempts'))return [[limits.get(p[0])]];
    if(sql.startsWith('SELECT * FROM hr_user WHERE email'))return [users.filter(u=>u.email===p[0])];
    if(sql.startsWith('SELECT * FROM hr_user WHERE id'))return [users.filter(u=>u.id===p[0])];
    if(sql.startsWith('INSERT INTO hr_session')){sessions.set(p[0],{token_hash:p[0],user_id:p[1],csrf_token:p[2],expires_at:p[3]});return [{}];}
    if(sql.startsWith('DELETE FROM hr_session WHERE token_hash')){sessions.delete(p[0]);return [{}];}
    if(sql.startsWith('DELETE FROM hr_session WHERE expires_at')){for(const [k,v] of sessions)if(v.expires_at<p[0])sessions.delete(k);return [{}];}
    if(sql.startsWith('DELETE FROM hr_login_limit')||sql.startsWith('DELETE FROM hr_request'))return [{}];
    if(sql.startsWith('SELECT u.*,s.csrf_token')){const s=sessions.get(p[0]),u=users.find(u=>u.id===s?.user_id&&u.status==='Active');return [u&&s.expires_at>p[1]?[{...u,...s}]:[]];}
    if(sql.startsWith('SELECT request_hash,result_json'))return [[requests.get(p[0])].filter(Boolean)];
    if(sql.startsWith('INSERT INTO hr_request')){requests.set(p[0],{request_hash:p[2],result_json:p[3]});return [{}];}
    if(sql.startsWith('UPDATE hr_user SET phone')){Object.assign(users.find(u=>u.id===p[2]),{phone:p[0],office_location:p[1]});return [{}];}
    if(sql.startsWith('INSERT IGNORE INTO hr_notification_read')){reads.add(p.join(':'));return [{}];}
    throw Error('Unexpected test SQL: '+sql);
  }
  let queue=Promise.resolve();
  const conn={execute,query:execute};
  return {pool:{execute,query:async()=>[[{ok:1}]]},
    async transaction(fn){const previous=queue;let release;queue=new Promise(r=>release=r);await previous;const old=M.clone(db),oldRequests=new Map(requests);try{return await fn(conn);}catch(e){db=old;requests=oldRequests;throw e;}finally{release();}},
    load:async()=>M.clone(db),save:async(c,b,a)=>{db=M.clone(a);},
    async snapshot(userId){const copy=M.clone(db);copy.systemNotifications.forEach(n=>n.read=reads.has(n.id+':'+userId));return copy;},
    inspect:()=>M.clone(db)
  };
}
module.exports={memoryRepository};
