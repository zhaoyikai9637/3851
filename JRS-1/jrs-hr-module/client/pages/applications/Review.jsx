import {CandidatePersonalInformation} from "./PersonalInformation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../../../JRS HR/dist/resume.js";
import { download } from "../recruitment/dialogs";
import { candidateOf, formatDate, jobOf, useWorkspace } from "../recruitment/workspaceClient";
import { Toast, useApplicationActions } from "./actions";
import { Avatar, Badge, Empty, formatDateTime, LegacyIcon, useReturnPath } from "./legacy";
import "./applications.css";

// Native React resume review and interview results page. It renders the same
// markup as the embedded workspace (HRReview.render plus the candidate emails
// panel) inside .hr-legacy, and uses the shared application dialogs.

const SAMPLE_WIDTH = 600;
const sampleResume = (person) => !person.resume && /^candidate-\d+$/.test(person.id);

function JobDetails({ job }) {
  const rows = [...(job.requirements || [])];
  const complete = rows.length >= 8 && rows.length <= 12;
  const information = [["Department", job.department], ["Employment type", job.type], ["Location", job.location]];
  return (
    <section className="job-information">
      <h3>Job Description</h3>
      <p className="job-description-text">{job.description}</p>
      <h3>Job Requirements</h3>
      {!complete && <p className="requirements-incomplete">This position needs 8–12 requirements. <Link to="/job-postings">Complete in Job Postings</Link></p>}
      <ol className="job-requirements-list">{rows.map((row, index) => <li key={index}>{row}</li>)}</ol>
      <details className="job-facts-section">
        <summary>Job Information</summary>
        <dl className="job-facts">{information.map(([label, value]) => <FactRow key={label} label={label} value={value} />)}</dl>
      </details>
    </section>
  );
}

function FactRow({ label, value }) {
  return <><dt>{label}</dt><dd>{value}</dd></>;
}

function MeetingSummary({ db, application }) {
  const meeting = db.interviews.find((interview) => interview.applicationId === application.id && interview.status === "Scheduled");
  if (!meeting) return null;
  return (
    <section className="review-meeting" aria-label="Scheduled interview">
      <h3>Interview scheduled</h3>
      <p>{formatDate(meeting.date)} · {meeting.time} · {meeting.duration} min</p>
      <p>{meeting.location}</p>
      <small>{meeting.interviewer} · {meeting.format}</small>
    </section>
  );
}

function Results({ db, application }) {
  const feedback = application.feedback;
  const meetings = db.interviews.filter((interview) => interview.applicationId === application.id).sort((x, y) => (y.date + y.time).localeCompare(x.date + x.time));
  return (
    <section className="result-feedback">
      <h3>Interview feedback</h3>
      {feedback ? (
        <>
          <div className="result-score"><strong>{feedback.rating}<small> / 5</small></strong><span>{feedback.recommendation}</span></div>
          {feedback.assessment?.length > 0 && (
            <dl className="assessment-results">{feedback.assessment.map((row, index) => <div key={index}><dt>{row.label}</dt><dd>{row.rating} / 5</dd></div>)}</dl>
          )}
          <p className="feedback-notes">{feedback.notes}</p>
          <p className="muted">Recorded {formatDateTime(feedback.recordedAt)}</p>
        </>
      ) : (
        <Empty title="Feedback not available" detail="Complete feedback from the Interviews page." />
      )}
      <h3>Interview details</h3>
      {meetings.length ? meetings.map((interview) => (
        <article className="result-meeting" key={interview.id}>
          <strong>{formatDate(interview.date)} · {interview.time}</strong>
          <Badge status={interview.status} />
          <p>{interview.interviewer} · {interview.format} · {interview.duration} min</p>
          <p className="muted">{interview.location}</p>
          {interview.notes && <p className="feedback-notes">{interview.notes}</p>}
        </article>
      )) : <p className="muted">No interview record is available.</p>}
    </section>
  );
}

function ResumeViewer({ db, application, onUpload, onError }) {
  const original = candidateOf(db, application);
  const person = { ...original, ...(application.submission?.candidate || {}) };
  const job = jobOf(db, application);
  const submitted = application.submission?.resumeUrl;
  const sample = sampleResume(person);
  const available = Boolean(submitted) || Boolean(person.resume) || sample;
  const filename = application.submission?.resumeName || person.resume?.filename || (sample ? person.name.replaceAll(" ", "_") + "_Resume.pdf" : "No document uploaded");
  const [view, setView] = useState({ fit: true, zoom: 100 });
  const viewer = useRef(null);
  const canvas = useRef(null);
  const paper = useRef(null);

  // Same scaling as the embedded workspace: fit the 600px sample to the canvas, or zoom.
  useLayoutEffect(() => {
    const area = canvas.current, pages = paper.current;
    if (!area || !pages) return undefined;
    function apply() {
      const scale = view.fit ? Math.min(1, (area.clientWidth - 28) / SAMPLE_WIDTH) : view.zoom / 100;
      pages.style.width = SAMPLE_WIDTH + "px";
      pages.style.minWidth = "0";
      if (scale > 0) pages.style.zoom = String(scale);
    }
    apply();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(apply) : null;
    observer?.observe(area);
    return () => observer?.disconnect();
  }, [view, sample]);

  function currentZoom() {
    return view.fit && canvas.current ? Math.round(Math.min(1, (canvas.current.clientWidth - 28) / SAMPLE_WIDTH) * 100) : view.zoom;
  }
  function zoomBy(step) {
    setView({ fit: false, zoom: Math.max(50, Math.min(200, currentZoom() + step)) });
  }
  function follow(href) {
    const link = document.createElement("a");
    link.href = href;
    link.click();
  }
  function downloadResume() {
    if (submitted) return follow(submitted + "?download=1");
    if (original.resume) return follow("/recruitment/api/hr/candidates/" + encodeURIComponent(original.id) + "/resume?download=1");
    if (!sampleResume(original)) return onError("No resume has been uploaded.");
    download(window.HRResume.pdf(original, job), original.name.replaceAll(" ", "_") + "_Resume.pdf", "application/pdf");
  }
  function printResume() {
    if (submitted) return window.open(submitted, "_blank", "noopener");
    if (original.resume) return window.open("/recruitment/api/hr/candidates/" + encodeURIComponent(original.id) + "/resume", "_blank", "noopener");
    if (!sampleResume(original)) return onError("No resume has been uploaded.");
    const popup = window.open("", "_blank");
    if (!popup) return onError("Allow pop-ups to print the resume.");
    const title = original.name.replace(/[&<>"']/g, "");
    popup.document.write('<!doctype html><html><head><title>' + title + ' Resume</title><link rel="stylesheet" href="' + new URL("/recruitment/styles.css", window.location.href).href + '"><style>body{background:white}.resume-paper{width:190mm;min-height:270mm;margin:0 auto;break-after:page}.resume-paper:last-child{break-after:auto}@page{size:A4;margin:10mm}</style></head><body>' + window.HRResume.html(original, job, 1) + window.HRResume.html(original, job, 2) + "</body></html>");
    popup.document.close();
    popup.addEventListener("load", () => { popup.focus(); popup.print(); }, { once: true });
  }
  function fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => onError("Fullscreen is unavailable."));
    else viewer.current?.requestFullscreen?.().catch(() => onError("Fullscreen is unavailable."));
  }

  let content;
  if (submitted) {
    content = application.submission.resumeType === "application/pdf"
      ? <iframe className="uploaded-resume" src={submitted + "#view=FitH"} title={person.name + " submitted resume"} />
      : (/\.docx$/i.test(filename)||application.submission.resumeType==='application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        ? <iframe className="uploaded-resume" src={submitted+"/preview"} title={person.name+" submitted Word resume"} sandbox=""/>
        : <div className="empty-state"><a className="button secondary" href={submitted + "?download=1"}>Download submitted document</a></div>;
  } else if (person.resume) {
    content = <iframe className="uploaded-resume" src={"/recruitment/api/hr/candidates/" + encodeURIComponent(person.id) + "/resume#view=FitH"} title={person.name + " resume"} />;
  } else if (sample) {
    // The sample resume markup comes from the shared legacy generator, which escapes every value.
    content = <div className="resume-zoom resume-pages" ref={paper} dangerouslySetInnerHTML={{ __html: window.HRResume.html(person, job, 1) + window.HRResume.html(person, job, 2) }} />;
  } else {
    content = <Empty title="No resume uploaded" detail="Use Upload to add the applicant’s PDF." />;
  }

  let controls = null;
  if (submitted) controls = <a className="button secondary compact" href={submitted + "?download=1"}>Download submitted resume</a>;
  else if (person.resume) controls = <a className="button secondary compact" href={"/recruitment/api/hr/candidates/" + encodeURIComponent(person.id) + "/resume"} target="_blank" rel="noopener">Open PDF</a>;
  else if (sample) {
    controls = (
      <>
        <button type="button" className="button secondary compact" onClick={() => setView({ fit: true, zoom: 100 })}>Fit width</button>
        <button type="button" className="button secondary compact" onClick={() => setView({ fit: false, zoom: 100 })}>100%</button>
        <button type="button" className="button icon-button" aria-label="Zoom out" onClick={() => zoomBy(-10)}><LegacyIcon name="minus" /></button>
        <span className="zoom-label">{view.fit ? "Fit width" : view.zoom + "%"}</span>
        <button type="button" className="button icon-button" aria-label="Zoom in" onClick={() => zoomBy(10)}><LegacyIcon name="plus" /></button>
      </>
    );
  }

  return (
    <section className="panel resume-viewer" id="resume-viewer" aria-label="Applicant resume" ref={viewer}>
      <div className="resume-toolbar">
        <strong title={filename}>{filename}</strong>
        <div>
          {original.canUploadResume!==false && <button type="button" className="button secondary compact" onClick={() => onUpload(person.id)}>Upload</button>}
          <button type="button" className="button secondary compact" disabled={!available} onClick={downloadResume}><LegacyIcon name="download" />Download</button>
          <button type="button" className="button secondary compact" disabled={!(available && (!submitted || application.submission.resumeType === "application/pdf"))} onClick={printResume}><LegacyIcon name="print" />Print</button>
          <button type="button" className="button icon-button" aria-label="Fullscreen resume" onClick={fullscreen}><LegacyIcon name="expand" /></button>
        </div>
      </div>
      {controls && <div className="resume-view-controls">{controls}</div>}
      <div className="resume-canvas" tabIndex={0} aria-label="Scrollable resume" ref={canvas}>{content}</div>
    </section>
  );
}

export function CandidateEmails({ db, application, act }) {
  const navigate=useNavigate(),[linkError,setLinkError]=useState('');
  async function openOutbox(){try{const r=await fetch('/recruitment/api/hr/applications/'+encodeURIComponent(application.id)+'/communication-context',{credentials:'same-origin'});const d=await r.json();if(!r.ok)throw Error(d.error?.message||'Unable to open related emails.');navigate('/outbox?application='+d.applicationId);}catch(e){setLinkError(e.message);}}
  const items = (db.notifications || []).filter((notification) => notification.applicationId === application.id);
  return (
    <section className="panel padded spaced">
      <section aria-label="Candidate emails">
        <div className="section-heading bare">
          <h3>Candidate emails</h3>
          <button type="button" className="button secondary compact" onClick={openOutbox}>Email Outbox</button>
          <button type="button" className="button primary compact" onClick={() => act("message", application)}>New email</button>
        </div>
        {linkError&&<p role="alert">{linkError}</p>}
        {!db.mailEnabled && <p className="notice gray">Email sending is off. Drafts are saved for later.</p>}
        {items.length ? items.map((notification) => (
          <article className="notification-item" key={notification.id}>
            <div>
              <strong>{notification.subject}</strong>
              <small>{notification.status} · {formatDateTime(notification.createdAt)}</small>
              {notification.lastError && <p>{notification.lastError}</p>}
            </div>
            <div className="card-actions">
              <button type="button" className="button secondary compact" onClick={() => act("message-edit", notification)}>{notification.status === "Draft" ? "Edit draft" : "View message"}</button>
              {notification.status === "Draft" && <button type="button" className="button primary compact" onClick={() => act("mail-send", notification)}>Preview &amp; send</button>}
            </div>
          </article>
        )) : <p className="muted">No emails for this application.</p>}
      </section>
    </section>
  );
}

function Decisions({ db, application, results, act }) {
  const active = jobOf(db, application).status === "Active";
  if (results && application.stage === "Interview Results") {
    return <><button type="button" className="button primary" disabled={!(active && application.feedback)} title={!active ? "Activate this job to progress the application" : application.feedback ? undefined : "Record interview feedback first"} onClick={() => act("offer-edit", application)}>Prepare Offer</button><button type="button" className="button danger" onClick={() => act("reject", application)}>Reject</button></>;
  }
  if (!results && application.stage === "Pending Review") {
    return <><button type="button" className="button primary" disabled={!active} title={active ? undefined : "Activate this job to progress the application"} onClick={() => act("move-interview", application)}>Move to Interview</button><button type="button" className="button danger" onClick={() => act("reject", application)}>Reject</button></>;
  }
  if (application.stage === "Interview") {
    const meeting = db.interviews.find((interview) => interview.applicationId === application.id && interview.status === "Scheduled");
    return (
      <>
        {meeting
          ? <button type="button" className="button primary" onClick={() => act("interview", meeting)}>View Interview</button>
          : <button type="button" className="button primary" disabled={!active} title={active ? undefined : "Activate this job to schedule interviews"} onClick={() => act("schedule", application)}>Schedule Interview</button>}
        <button type="button" className="button danger" onClick={() => act("reject", application)}>Reject</button>
      </>
    );
  }
  if (application.stage === "Offer") {
    return <><button type="button" className="button primary" onClick={() => act("review", application)}>Review Offer</button><button type="button" className="button danger" onClick={() => act("reject", application)}>Reject</button></>;
  }
  return <button type="button" className="button secondary" onClick={() => act("review", application)}>{"Application details"}</button>;
}

export function Review({ id, results: resultsRoute = false, fetcher, compose=false, templateId }) {
  const workspace = useWorkspace(fetcher, "/hr/applications?view=" + (resultsRoute ? "results/" : "review/") + id);
  const { db, error, load } = workspace;
  const { act, elements, toast, setToast } = useApplicationActions({ workspace });
  const [back, backLabel] = useReturnPath();
  const navigate=useNavigate();
  const composeKey=useRef(null);
  useEffect(()=>{if(!compose||!db)return;const key=id+":"+(templateId||"");if(composeKey.current===key)return;const selected=db.applications.find(a=>a.id===id);if(!selected)return;composeKey.current=key;act("message",selected,{templateId});},[compose,db,id,templateId,act]);

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        {error}{" "}
        <button className="btn btn-link p-0 align-baseline" type="button" onClick={load}>Try again</button>
      </div>
    );
  }
  if (!db) return <div className="loading-state" role="status"><span className="spinner-border spinner-border-sm" aria-hidden="true" /> Loading…</div>;

  const application = db.applications.find((item) => item.id === id);
  if (!application) {
    return <div className="hr-legacy"><Link className="btn btn-outline-secondary mb-3" to={back}>{backLabel}</Link><Empty title="Application not found" detail="Return to Applications and select an existing record." /></div>;
  }
  const person = candidateOf(db, application);
  const job = jobOf(db, application);
  const params=new URL(back,'http://local').searchParams;
  const stageSlug=(params.get('view')||'').replace(/^applications\//,'');
  const queue=db.applications.filter(row=>{
    const candidate=candidateOf(db,row),job=jobOf(db,row);
    const slug=row.stage.toLowerCase().replaceAll(' ','-');
    return (!params.get('job')||row.jobId===params.get('job'))&&(!params.get('priority')||row.priority===params.get('priority'))&&(!params.get('from')||row.appliedDate>=params.get('from'))&&(!params.get('to')||row.appliedDate<=params.get('to'))&&(!params.get('q')||(candidate.name+' '+candidate.email+' '+job.title+' '+row.id).toLowerCase().includes(params.get('q').toLowerCase()))&&(!stageSlug||stageSlug==='applications'||slug===stageSlug);
  });
  const next=queue[queue.findIndex(row=>row.id===id)+1];
  const results = resultsRoute || application.stage === "Interview Results" || Boolean(application.feedback);

  return (
    <>
      <div className="hr-legacy review-page" data-page={resultsRoute ? "results" : "review"}>
        <div className="review-heading">
          <div className="review-person">
            <Avatar person={person} />
            <div><h2>{person.name}</h2><p>{job.title} · {application.id}</p></div>
            <Badge status={application.stage} />
          </div>
          <nav className="review-actions" aria-label="Application review actions"><Link className="button secondary" to={back}>{backLabel}</Link><button className="button secondary" type="button" disabled={!next} onClick={()=>navigate('/applications?view=review/'+next.id,{state:{from:back}})}>Next application</button><button type="button" className="button secondary" onClick={()=>act('application',application)}>Application details</button></nav>
        </div>
        <div className={"review-grid " + (results ? "results-grid" : "")}>
          <ResumeViewer db={db} application={application} onUpload={(candidateId) => act("resume-upload", candidateId)} onError={setToast} />
          <aside className="panel requirements">
            <div className="requirements-body" tabIndex={0}>
              {results ? (
                <>
                  <Results db={db} application={application} />
                  <details className="result-job-details"><summary>Job Description &amp; Requirements</summary><JobDetails job={job} /></details>
                </>
              ) : (
                <>
                  <MeetingSummary db={db} application={application} />
                  <JobDetails job={job} />
                </>
              )}
              <CandidatePersonalInformation person={person} application={application}/>
            </div>
            <div className="next-step">
              <div className="review-decision-actions"><Decisions db={db} application={application} results={results} act={act} /></div>
              {job.status !== "Active" && <p className="danger-text">Activate this job before progressing applicants.</p>}
            </div>
          </aside>
        </div>
        <CandidateEmails db={db} application={application} act={act} />
      </div>
      <Toast message={toast} />
      {elements}
    </>
  );
}
