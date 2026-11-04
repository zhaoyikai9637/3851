import {Link,useLocation} from 'react-router-dom';
import {ErrorBox,useLoad} from '../../shared';
export function applicationPath(id,{compose=false,templateId}={}){
 const params=new URLSearchParams({application:String(id)});if(compose)params.set('compose','1');if(templateId)params.set('template',String(templateId));return '/applications?'+params;
}
export function useApplicationContext(){
 const {search}=useLocation(),value=new URLSearchParams(search).get('application');
 const id=value&&/^[1-9]\d*$/.test(value)&&Number(value)<=2147483647?Number(value):null;
 const load=useLoad(id?'/api/hr/applications/'+id+'/communication-context':null);
 return {id,...load};
}
export function CommunicationContext({context,templateId}){
 const {pathname}=useLocation(),{id,data,busy,error}=context;
 if(!id)return null;
 const canUse=templateId&&data?.eligibleTemplateIds?.includes(Number(templateId));
 return <section className="surface communication-context" aria-label="Application communications">
  {busy?<p role="status">Loading application…</p>:error?<ErrorBox error={error} retry={context.reload}/>:data?<>
   <strong>{data.candidateName} · {data.positionTitle}</strong><span className="subtle">{data.currentStatus}</span>
   <nav className="communication-context-links" aria-label="Application links">
    <Link to={applicationPath(id)}>Open application</Link><Link to={applicationPath(id,{compose:true})}>Write email</Link>
    {[['notifications','Notifications'],['outbox','Email Outbox'],['templates','Templates'],['logs','Logs']].map(([path,label])=><Link key={path} to={'/'+path+'?application='+id} aria-current={pathname==='/'+path?'page':undefined}>{label}</Link>)}
    {canUse?<Link className="btn btn-primary btn-sm" to={applicationPath(id,{compose:true,templateId})}>Use selected template</Link>:null}
   </nav>
  </>:null}
 </section>;
}
