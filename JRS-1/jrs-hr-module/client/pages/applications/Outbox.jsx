import {useMemo,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {CommunicationContext,useApplicationContext} from '../../src/features/communication/ApplicationContext';
import {ErrorBox,Loading} from '../../src/shared';
import {useViewportRows} from '../../src/useViewportRows';
import {useWorkspace,formatDate} from '../recruitment/workspaceClient';
import {Toast,useApplicationActions} from './actions';
import './applications.css';
export function Outbox(){
 const workspace=useWorkspace(undefined,'/hr/outbox'),{db,error,load,checkSendStatus}=workspace,context=useApplicationContext();
 const {act,elements,toast,setToast}=useApplicationActions({workspace});
 const [query,setQuery]=useState(''),[status,setStatus]=useState(''),[page,setPage]=useState(1),host=useRef(null),size=useViewportRows(host,db?.revision,6);
 const rows=useMemo(()=>{const id=context.data?.recruitingId;return(db?.notifications||[]).filter(n=>(!id||n.applicationId===id)&&(!status||n.status===status)&&(!query||(n.subject+' '+n.to).toLowerCase().includes(query.toLowerCase())));},[db,context.data,query,status]);
 if(context.id&&context.busy||!db&&!error)return <Loading/>;
 if(error||context.error)return <ErrorBox error={error||context.error} retry={error?load:context.reload}/>;
 const pages=Math.max(1,Math.ceil(rows.length/size)),current=Math.min(page,pages),visible=rows.slice((current-1)*size,current*size);
 return <><CommunicationContext context={context}/><div className="hr-legacy fit-page" ref={host}>
  {!db.mailEnabled&&<p className="notice gray">Email delivery is off. You can prepare, edit and download drafts.</p>}
  <div className="page-filters"><label className="search"><input type="search" aria-label="Search messages" placeholder="Search messages" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/></label><select aria-label="Message status" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="">All statuses</option>{['Draft','Sending','Sent','Superseded','Uncertain'].map(s=><option key={s}>{s}</option>)}</select></div>
  <section className="panel fit-panel"><div className="fit-body">{visible.length?visible.map(n=><article className="notification-item email-outbox-item" key={n.id}><div><strong>{n.subject}</strong><p>{n.to}</p><small>{formatDate(n.createdAt)} · {n.status}</small>{n.lastError&&<p>{n.lastError}</p>}</div><div className="card-actions"><Link className="button secondary compact" to={'/applications?view=review/'+n.applicationId}>View application</Link><button className="button secondary compact" onClick={()=>act('message-edit',n)}>{n.status==='Draft'?'Review draft':'View message'}</button>{n.status==='Draft'&&<button className="button primary compact" disabled={!db.mailEnabled} onClick={()=>act('mail-send',n)}>Send</button>}{n.status==='Sending'&&<button className="button secondary compact" onClick={()=>checkSendStatus(n.id).then(()=>setToast('Sending status updated.')).catch(e=>setToast(e.message))}>Check sending status</button>}</div></article>):<div className="empty"><h3>No messages yet</h3><p>Prepare a candidate message from an application.</p></div>}</div><footer className="table-footer"><p>Showing {rows.length?(current-1)*size+1:0}–{Math.min(current*size,rows.length)} of {rows.length} messages</p><div className="pagination"><button className="button secondary compact" disabled={current===1} onClick={()=>setPage(current-1)}>Previous</button><span>Page {current} of {pages}</span><button className="button secondary compact" disabled={current===pages} onClick={()=>setPage(current+1)}>Next</button></div></footer></section>
 </div><Toast message={toast}/>{elements}</>;
}
