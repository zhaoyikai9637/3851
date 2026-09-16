/* HTTP boundary. No recruitment records are stored in localStorage. */
(function(root){
  'use strict';
  let csrf='',user=null,db=null,pending=null,error='';
  async function request(path,{method='GET',body,headers={}}={}) {
    let response;
    try{response=await fetch('/api/'+path,{method,credentials:'same-origin',headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(csrf?{'X-CSRF-Token':csrf}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(45000)});}
    catch{throw Error('Connection interrupted. Retry the same action to check whether it was saved.');}
    let result;try{result=await response.json();}catch{throw Error('The server response could not be read. Please refresh.');}
    if(!response.ok){const e=new Error(result.error?.message||'Request failed.');e.status=response.status;e.code=result.error?.code;if(response.status===401&&user){error='Your session expired. Sign in again to continue.';document.querySelector('#storage-warning').hidden=false;document.querySelector('#storage-warning').textContent=error;}throw e;}
    return result;
  }
  function signIn() {
    const host=document.querySelector('#login-screen');host.hidden=false;
    host.innerHTML='<form class="login-card"><div class="login-brand">JRS <span>HR Workspace</span></div><h1>Sign in</h1><p>Use your HR work account.</p><div class="form-error" role="alert" hidden></div><label>Work email<input type="email" name="email" autocomplete="username" required autofocus></label><label>Password<input type="password" name="password" autocomplete="current-password" minlength="12" maxlength="128" required></label><button class="button primary" type="submit">Sign in</button></form>';
    return new Promise(resolve=>host.querySelector('form').addEventListener('submit',async ev=>{
      ev.preventDefault();const f=ev.target,b=f.querySelector('button'),out=f.querySelector('.form-error');b.disabled=true;out.hidden=true;
      try{const r=await request('auth/login',{method:'POST',body:Object.fromEntries(new FormData(f))});user=r.user;csrf=r.csrfToken;host.hidden=true;resolve();}
      catch(e){out.textContent=e.message;out.hidden=false;}finally{b.disabled=false;}
    }));
  }
  async function refresh(){db=await request('hr/workspace');user=db.currentUser;error='';return db;}
  async function boot(){
    if(location.protocol==='file:')throw Error('Start the backend with npm start, then open http://localhost:3000. This version requires the server.');
    try{const r=await request('auth/me');user=r.user;csrf=r.csrfToken;}catch(e){if(e.status!==401)throw e;await signIn();}
    await refresh();document.querySelector('#app-shell').hidden=false;return store;
  }
  const store={get db(){return db;},get user(){return user;},get error(){return error;},request,refresh,boot,
    async commit(command,p={}) {
      const fingerprint=JSON.stringify({command,p,user:user.id});
      if(!pending||pending.fingerprint!==fingerprint)pending={fingerprint,key:HRModel.uid('request')};
      try{const r=await request('hr/commands/'+encodeURIComponent(command),{method:'POST',body:p,headers:{'If-Match':String(db.revision),'Idempotency-Key':pending.key}});db=r.db;user=db.currentUser;pending=null;error='';return r.result;}
      catch(e){if(e.status&&e.status<500)pending=null;if(e.code==='REVISION_CONFLICT'){error=e.message;try{await refresh();}catch{}error='Newer changes were loaded. Review the current data before saving again.';}throw e;}
    },
    async send(id,attachResume){const r=await request('hr/notifications/'+encodeURIComponent(id)+'/send',{method:'POST',body:{attachResume},headers:{'If-Match':String(db.revision)}});db=r.db;return r;},
    async upload(candidateId,file){
      if(!file||file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf')||file.size>5242880)throw Error('Choose a PDF resume up to 5 MB.');
      const response=await fetch('/api/hr/candidates/'+encodeURIComponent(candidateId)+'/resume',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/pdf','X-CSRF-Token':csrf,'If-Match':String(db.revision),'X-Filename':encodeURIComponent(file.name)},body:file,signal:AbortSignal.timeout(45000)});
      const r=await response.json();if(!response.ok)throw Error(r.error?.message||'Resume upload failed.');db=r.db;
    },
    async logout(){await request('auth/logout',{method:'POST',body:{}});location.reload();}
  };
  root.HRRemote=store;
})(window);
