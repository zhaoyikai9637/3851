import {CandidatePersonalInformation} from "./PersonalInformation";
import { useEffect } from "react";
import { Link, useLocation, useOutletContext, useSearchParams } from "react-router-dom";
import { resumePath } from "../recruitment/dialogs";
import { jobOf, useWorkspace, formatDate } from "../recruitment/workspaceClient";
import { Toast, useApplicationActions } from "./actions";
import { Avatar, Badge, Empty, formatDateTime } from "./legacy";
import { CandidateEmails } from "./Review";
import "./applications.css";

// Native React candidate profile. It renders the same markup as the embedded
// workspace profile (heading actions, application tabs, details and history
// sections, candidate emails) inside .hr-legacy and uses the shared dialogs.
// "Candidate details" and "Tasks & history" are hosted in the workspace header.

const SECTIONS = [["details", "Candidate details"], ["history", "Tasks & history"]];

function Timeline({ db, applicationId }) {
  const items = (db.activity || []).filter((event) => event.applicationId === applicationId);
  if (!items.length) return <Empty title="No activity yet" detail="Status changes and saved notes will appear here." />;
  return (
    <ol className="timeline">
      {items.map((event) => (
        <li key={event.id}>
          <strong>{event.summary}</strong>
          <small>{event.actor} · {formatDateTime(event.at)}</small>
          {event.notes && <p>{event.notes}</p>}
        </li>
      ))}
    </ol>
  );
}

// applicationLink(id) gives the address of the same profile showing another application.
export function CandidateProfile({ candidateId, applicationId, applicationLink, fetcher }) {
  const location = useLocation();
  const workspace = useWorkspace(fetcher, "/hr" + location.pathname + location.search);
  const { db, error, load } = workspace;
  const { act, elements, toast } = useApplicationActions({ workspace });
  const [params, setParams] = useSearchParams();
  const setSections = useOutletContext()?.setSections;
  const section = params.get("section") === "history" ? "history" : "details";

  useEffect(() => {
    if (!setSections) return undefined;
    setSections({
      owner: location.key,
      label: "Candidate sections",
      items: SECTIONS.map(([id, label]) => ({ label, selected: id === section })),
      select(index) {
        const id = SECTIONS[index]?.[0];
        if (!id) return;
        const next = new URLSearchParams(window.location.search);
        if (id === "details") next.delete("section");
        else next.set("section", id);
        setParams(next, { replace: true });
      },
    });
    return () => setSections(null);
  }, [setSections, location.key, section, setParams]);

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        {error}{" "}
        <button className="btn btn-link p-0 align-baseline" type="button" onClick={load}>Try again</button>
      </div>
    );
  }
  if (!db) return <div className="loading-state" role="status"><span className="spinner-border spinner-border-sm" aria-hidden="true" /> Loading…</div>;

  const person = (db.candidates || []).find((item) => item.id === candidateId);
  if (!person) return <div className="hr-legacy"><Empty title="Candidate not found" /></div>;
  const applications = (db.applications || []).filter((item) => item.candidateId === person.id);
  const application = applications.find((item) => !applicationId || item.id === applicationId);

  if (!application) {
    return (
      <div className="hr-legacy" data-page="candidate">
        <div className="page-heading"><div><h2>{person.name}</h2></div><div className="heading-actions" /></div>
        <section className="panel padded">
          <h3>{person.name}</h3>
          <p>{person.email}</p>
          <p>{person.phone || "Not provided"}</p>
          <p>{person.location || "Not provided"}</p>
          <p>No applications recorded</p>
        </section>
      </div>
    );
  }

  const job = jobOf(db, application);
  const tasks = (db.tasks || []).filter((task) => task.applicationId === application.id);
  const here = { from: location.pathname + location.search };

  return (
    <>
      <div className="hr-legacy" data-page="candidate">
        <div className="page-heading">
          <div><h2>{person.name}</h2></div>
          <div className="heading-actions">
            <Link className="button secondary" to={"/applications?view=" + resumePath(application)} state={here}>Assess application</Link>
            <button type="button" className="button primary" onClick={() => act("review", application)}>Manage Application</button>
            {person.canEditProfile!==false && <button type="button" className="button secondary" onClick={() => act("candidate-edit", person)}>Edit Contact Details</button>}
            {person.canUploadResume!==false && <button type="button" className="button secondary" onClick={() => act("resume-upload", person.id)}>Upload Resume</button>}
          </div>
        </div>
        {applications.length > 1 && (
          <nav className="module-tabs" aria-label="Candidate applications">
            {applications.map((item) => (
              <Link key={item.id} className={item.id === application.id ? "active" : ""} to={applicationLink(item.id)} state={location.state} replace>{jobOf(db, item).title} · {item.stage}</Link>
            ))}
          </nav>
        )}
        {!setSections && (
          <nav className="section-tabs" aria-label="Candidate sections">
            {SECTIONS.map(([id, label]) => (
              <button key={id} type="button" className={"button " + (section === id ? "selected" : "")} aria-pressed={section === id} onClick={() => setParams((current) => { const next = new URLSearchParams(current); if (id === "details") next.delete("section"); else next.set("section", id); return next; }, { replace: true })}>{label}</button>
            ))}
          </nav>
        )}
        <div className="two-columns profile-grid single-section">
          <section className="panel padded" hidden={section !== "details"}>
            <div className="profile-heading">
              <Avatar person={person} />
              <div><h3>{person.name}</h3><p>{job.title} Applicant</p><Badge status={application.stage} /></div>
            </div>
            <dl className="details">
              <dt>Email</dt><dd>{person.email}</dd>
              <dt>Phone</dt><dd>{person.phone}</dd>
              <dt>Location</dt><dd>{person.location}</dd>
              <dt>Experience</dt><dd>{person.experience} years</dd>
              {person.education && person.education !== "Not recorded" && <><dt>Education</dt><dd>{person.education}</dd></>}
              <dt>Application</dt><dd>{application.id}</dd>
            </dl>
            <CandidatePersonalInformation person={person} application={application} current/>
            <h4>Skills</h4>
            <div className="skill-tags">{(person.skills || []).map((skill) => <span key={skill}>{skill}</span>)}</div>
            <div className="section-heading bare spaced">
              <h4>Private candidate note</h4>
              <button type="button" className="button text-button" onClick={() => act("candidate-notes", application)}>Edit note</button>
            </div>
            <div className="note-box">{person.notes || "No note added."}</div>
          </section>
          <section className="panel padded" hidden={section !== "history"}>
            <div className="section-heading bare">
              <h3>Tasks</h3>
              <button type="button" className="button secondary compact" onClick={() => act("task", application)}>Create Task</button>
            </div>
            {tasks.length ? tasks.map((task) => (
              <div className="task-item" key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <small>{task.assignee} · Due {formatDate(task.due)}</small>
                  {task.notes && <p>{task.notes}</p>}
                </div>
                {task.status === "Open"
                  ? <button type="button" className="button secondary compact" onClick={() => act("task-complete", task)}>Complete</button>
                  : <Badge status="Completed" />}
              </div>
            )) : <Empty title="No follow-up tasks" detail="Create a task to record the next action." />}
            <CandidatePersonalInformation person={person} application={application}/>
            <h3 className="spaced">Application Timeline</h3>
            <Timeline db={db} applicationId={application.id} />
          </section>
        </div>
        <CandidateEmails db={db} application={application} act={act} />
      </div>
      <Toast message={toast} />
      {elements}
    </>
  );
}
