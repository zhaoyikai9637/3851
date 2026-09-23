'use strict';
const {randomBytes,scrypt:rawScrypt,timingSafeEqual,createHash}=require('node:crypto');
const {promisify}=require('node:util');
const {fail}=require('./errors.cjs');
const scrypt=promisify(rawScrypt);
const hash=v=>createHash('sha256').update(v).digest('hex');
const token=()=>randomBytes(32).toString('hex');
async function passwordHash(password) {
  if(typeof password!=='string'||password.length<12||password.length>128)fail(422,'Password must contain 12–128 characters.');
  const salt=token(),key=await scrypt(password,salt,64,{N:32768,maxmem:64*1024*1024});
  return `scrypt$${salt}$${key.toString('hex')}`;
}
async function verify(password,stored) {
  if(typeof password!=='string'||password.length>128)return false;
  const [kind,salt,encoded]=String(stored).split('$');if(kind!=='scrypt'||!salt||encoded?.length!==128)return false;
  const key=await scrypt(password,salt,64,{N:32768,maxmem:64*1024*1024});return timingSafeEqual(key,Buffer.from(encoded,'hex'));
}
const publicUser=u=>({id:u.id,email:u.email,name:u.name,role:u.role,status:u.status,employeeId:u.employee_id,department:u.department,phone:u.phone,officeLocation:u.office_location});
function createAuth(pool,cfg) {
  // Same work factor for unknown usernames prevents a fast username oracle.
  const dummy=passwordHash(token());
  const cookie=(res,value,clear=false)=>res.cookie('jrs_session',value,{httpOnly:true,sameSite:'strict',secure:cfg.secure,path:'/',maxAge:clear?0:cfg.sessionHours*3600000});
  async function login(req,res) {
    const email=typeof req.body?.email==='string'?req.body.email.trim().toLowerCase():'';
    if(email.length>254)fail(400,'Invalid login details.');
    const buckets=[hash('ip:'+req.ip),hash('email:'+email)],now=Date.now();
    for(const bucket of buckets){
      await pool.execute('INSERT INTO hr_login_limit(bucket,attempts,reset_at) VALUES (?,1,?) ON DUPLICATE KEY UPDATE attempts=IF(reset_at<?,1,attempts+1),reset_at=IF(reset_at<?,VALUES(reset_at),reset_at)',[bucket,now+15*60000,now,now]);
      const [[limit]]=await pool.execute('SELECT attempts FROM hr_login_limit WHERE bucket=?',[bucket]);
      if(limit.attempts>(bucket===buckets[0]?50:10))fail(429,'Too many login attempts. Try again in 15 minutes.');
    }
    const [[u]]=await pool.execute('SELECT * FROM hr_user WHERE email=?',[email]);
    const valid=await verify(req.body?.password,u?.password_hash||await dummy);
    if(!valid||!u||u.status!=='Active')fail(401,'Email or password is incorrect.');
    const raw=token(),csrf=token();
    await pool.execute('DELETE FROM hr_session WHERE expires_at<?',[now]);
    await pool.execute('DELETE FROM hr_login_limit WHERE reset_at<?',[now]);
    await pool.execute('INSERT INTO hr_session(token_hash,user_id,csrf_token,expires_at) VALUES (?,?,?,?)',[hash(raw),u.id,csrf,now+cfg.sessionHours*3600000]);
    cookie(res,raw);res.json({user:publicUser(u),csrfToken:csrf});
  }
  async function requireUser(req,res,next) {
    const raw=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('jrs_session='))?.slice(12);
    if(!raw||!/^[a-f0-9]{64}$/.test(raw))fail(401,'Please sign in to continue.','UNAUTHENTICATED');
    const [[u]]=await pool.execute('SELECT u.*,s.csrf_token,s.token_hash FROM hr_session s JOIN hr_user u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.status=\'Active\'',[hash(raw),Date.now()]);
    if(!u)fail(401,'Your session expired. Please sign in again.','UNAUTHENTICATED');
    req.user=publicUser(u);req.session={csrf:u.csrf_token,hash:u.token_hash};
    if(!['GET','HEAD'].includes(req.method)&&req.headers['x-csrf-token']!==u.csrf_token)fail(403,'Refresh this page before saving.','CSRF');
    next();
  }
  async function logout(req,res) {await pool.execute('DELETE FROM hr_session WHERE token_hash=?',[req.session.hash]);cookie(res,'',true);res.json({ok:true});}
  async function changePassword(req,res) {
    const [[u]]=await pool.execute('SELECT password_hash FROM hr_user WHERE id=?',[req.user.id]);
    if(!await verify(req.body.currentPassword,u.password_hash))fail(422,'Current password is incorrect.');
    const next=await passwordHash(req.body.newPassword),conn=await pool.getConnection();
    try{await conn.beginTransaction();await conn.execute('UPDATE hr_user SET password_hash=? WHERE id=?',[next,req.user.id]);await conn.execute('DELETE FROM hr_session WHERE user_id=?',[req.user.id]);await conn.commit();}catch(e){await conn.rollback();throw e;}finally{conn.release();}
    cookie(res,'',true);res.json({ok:true});
  }
  return {login,requireUser,logout,changePassword};
}
module.exports={createAuth,passwordHash,verify,hash,token,publicUser};
