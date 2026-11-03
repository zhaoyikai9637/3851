/* HTTP boundary. No recruitment records are stored in localStorage. */
(function(root){
  'use strict';
  let csrf='',user=null,db=null,pending=null,error='';
  async function request(path,{method='GET',body,headers={}}={}) {
    let response;
    try{response=await fetch('/recruitment/api/'+path,{method,credentials:'same-origin',headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(csrf?{'X-CSRF-Token':csrf}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(45000)});}
    catch{const error=Error('Connection interrupted. Check the saved state before retrying.');error.code='CONNECTION_INTERRUPTED';throw error;}
    let result;try{result=await response.json();}catch{throw Error('The server response could not be read. Please refresh.');}
    if(!response.ok){const e=new Error(result.error?.message||'Request failed.');e.status=response.status;e.code=result.error?.code;if(response.status===401&&user){error='Your session expired. Sign in again to continue.';document.querySelector('#storage-warning').hidden=false;document.querySelector('#storage-warning').textContent=error;}throw e;}
    return result;
  }
  function signIn() { window.top.location.assign('/pages/login/login.html'); return new Promise(() => {}); }
  async function refresh(){db=await request('hr/workspace');user=db.currentUser;if(db.csrfToken)csrf=db.csrfToken;error='';return db;}
  async function boot(){
    if(location.protocol==='file:')throw Error('Start the backend with npm start, then open http://localhost:3000. This version requires the server.');
    try{await refresh();}catch(e){if(e.status!==401)throw e;await signIn();}
    document.querySelector('#app-shell').hidden=false;return store;
  }
  async function sendingStatus(id,attempts=1) {
    for(let attempt=0;attempt<attempts;attempt++) {
      if(attempt)await new Promise(resolve=>setTimeout(resolve,1500));
      const status=await request('hr/notifications/'+encodeURIComponent(id)+'/status');
      const notification=db?.notifications.find(row=>row.id===id);
      if(notification)Object.assign(notification,{status:status.status,lastError:status.lastError});
      // A partial status read must not advance the revision of an older full snapshot.
      if(status.status==='Sent'){try{await refresh();}catch{}return {sent:true,db};}
      if(status.status==='Uncertain')throw Error('Sending could not be confirmed. Check the mail provider before taking any further action. This email will not be resent automatically.');
      if(status.status!=='Sending'&&status.status!=='Draft')throw Error('This email is no longer available for sending. Refresh to check its status.');
      if(attempts===1)return {sent:false,db};
    }
    throw Error('The sending result is still pending. Check sending status before taking any further action. This email will not be resent automatically.');
  }
  const activeSends=new Map();
  const store={get db(){return db;},get user(){return user;},get error(){return error;},request,refresh,boot,
    async commit(command,p={}) {
      const fingerprint=JSON.stringify({command,p,user:user.id});
      if(!pending||pending.fingerprint!==fingerprint)pending={fingerprint,key:HRModel.uid('request')};
      try{const r=await request('hr/commands/'+encodeURIComponent(command),{method:'POST',body:p,headers:{'If-Match':String(db.revision),'Idempotency-Key':pending.key}});db=r.db;user=db.currentUser;pending=null;error='';return r.result;}
      catch(e){if(e.status&&e.status<500)pending=null;if(e.code==='REVISION_CONFLICT'){error=e.message;try{await refresh();}catch{}error='Newer changes were loaded. Review the current data before saving again.';}throw e;}
    },
    checkSendStatus:sendingStatus,
    async send(id,attachResume){
      if(activeSends.has(id))return activeSends.get(id);
      const operation=(async()=>{
        try{const result=await request('hr/notifications/'+encodeURIComponent(id)+'/send',{method:'POST',body:{attachResume},headers:{'If-Match':String(db.revision)}});db=result.db;return result;}
        catch(error){
          if(error.status&&error.status<500&&error.status!==409)throw error;
          return sendingStatus(id,20);
        }
      })();
      activeSends.set(id,operation);
      try{return await operation;}finally{activeSends.delete(id);}
    },
    async upload(candidateId,file){
      if(!file||file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf')||file.size>5242880)throw Error('Choose a PDF resume up to 5 MB.');
      const response=await fetch('/recruitment/api/hr/candidates/'+encodeURIComponent(candidateId)+'/resume',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/pdf','X-CSRF-Token':csrf,'If-Match':String(db.revision),'X-Filename':encodeURIComponent(file.name)},body:file,signal:AbortSignal.timeout(45000)});
      const r=await response.json();if(!response.ok){
        const e=new Error(r.error?.message||'Resume upload failed.');e.status=response.status;e.code=r.error?.code;
        if(e.code==='REVISION_CONFLICT'){
          try{await refresh();e.message='Newer changes were loaded. Review them, then upload the resume again.';}catch{}
        }
        throw e;
      }db=r.db;
    },
    async logout(){await request('auth/logout',{method:'POST',body:{}});location.reload();}
  };
  root.HRRemote=store;
})(window);
