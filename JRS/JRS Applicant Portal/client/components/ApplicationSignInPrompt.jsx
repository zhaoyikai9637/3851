import {useEffect,useRef} from 'react';
import {signInUrl} from '../utils/signInUrl';

export default function ApplicationSignInPrompt({jobId,onClose}) {
  const ref=useRef(null);
  useEffect(()=>{
    const previous=document.activeElement,dialog=ref.current;
    dialog.showModal();
    return ()=>{dialog.close();previous?.focus();};
  },[]);
  const target='/applicant/apply/'+jobId;
  return <dialog ref={ref} className="application-signin-dialog" aria-labelledby="application-signin-title"
    onCancel={event=>{event.preventDefault();onClose();}}
    onClick={event=>{if(event.target===event.currentTarget){const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)onClose();}}}>
    <h2 id="application-signin-title">Sign in to apply</h2>
    <p>Sign in or create a candidate account to continue with this application.</p>
    <div className="application-signin-actions">
      <a className="btn btn-primary" href={signInUrl(target)}>Sign in</a>
      <a className="btn btn-outline-primary" href={signInUrl(target,true)}>Create account</a>
    </div>
    <button className="btn btn-link" type="button" onClick={onClose}>Continue browsing</button>
  </dialog>;
}
