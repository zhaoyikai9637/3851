import {templateAllowed} from "./templatePolicy";
import { useEffect, useRef, useState } from "react";
import { Modal } from "../../src/shared";
import { DateField } from "../jobs/DateField";
import { displayDate, isoDate } from "../jobs/model";
import { FormError, Person } from "../recruitment/dialogs";
import { candidateOf, formatDate, jobOf, singaporeToday } from "../recruitment/workspaceClient";

// Application dialogs for the native Applications list. Each one sends the same
// workspace command, with the same fields, as the matching embedded workspace dialog.

export const REJECTION_REASONS = [
  "Qualifications do not meet the job requirements",
  "Skills do not meet the position requirements",
  "Insufficient relevant experience",
  "Position requirements do not match candidate expectations",
  "Candidate withdrew their application",
  "Position has been filled",
  "Other",
];

// Singapore business day, optionally offset by whole days (same as the workspace model).
export function businessDay(offset = 0, now = Date.now()) {
  return new Date(now + 8 * 3600000 + offset * 86400000).toISOString().slice(0, 10);
}

export function ApplicantCard({ db, application }) {
  return (
    <div className="interview-candidate application-candidate">
      <Person db={db} application={application} />
      <small>{jobOf(db, application).title} · Application ID {application.id}</small>
    </div>
  );
}

// Shared submit handling: validation, busy state and the server's error message.
function useSubmit(onSubmit) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event, payload) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit(typeof payload === "function" ? payload() : payload);
    } catch (submitError) {
      setError(submitError.message);
      setBusy(false);
    }
  }
  return { error, busy, submit };
}

function Footer({ form, busy, onClose, label, danger = false, cancel = "Cancel" }) {
  return (
    <>
      <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>{cancel}</button>
      <button type="submit" form={form} className={danger ? "btn btn-danger" : "btn btn-primary"} disabled={busy}>{label}</button>
    </>
  );
}

export function RejectForm({ db, application, onSubmit, onClose }) {
 const {error,busy,submit}=useSubmit(onSubmit);
 const [notes,setNotes]=useState(''),[notify,setNotify]=useState(Boolean(db.mailEnabled));
 return <Modal title="Reject application" onClose={onClose} footer={<Footer form="application-reject-form" busy={busy} onClose={onClose} label="Save" danger/>}>
  <form id="application-reject-form" className="interview-form" onSubmit={event=>submit(event,{applicationId:application.id,reason:'Application closed by HR.',notes,notify})}>
   <ApplicantCard db={db} application={application}/><FormError message={error}/>
   <p>This application will be closed and scheduled interviews will be cancelled.</p>
   <label>Comment<textarea maxLength={500} value={notes} onChange={event=>setNotes(event.target.value)}/></label>
   <label className="interview-check"><input type="checkbox" checked={notify} disabled={!db.mailEnabled} onChange={event=>setNotify(event.target.checked)}/><span>Send email notification</span></label>
   <p className="subtle">Selecting Send email notification sends the email when you save. Comments stay internal.</p>
  </form>
 </Modal>;
}

export function OfferForm({ db, application, onSubmit, onClose }) {
  const offer = application.offer || {};
  const [values, setValues] = useState({
    salary: String(offer.salary || 5200),
    startDate: displayDate(offer.startDate || businessDay(30)),
    expiry: displayDate(offer.expiry || businessDay(7)),
    terms: offer.terms || "Full-time position. Standard company benefits.",
  });
  const { error, busy, submit } = useSubmit(onSubmit);
  const set = (name) => (event) => setValues((current) => ({ ...current, [name]: event.target.value }));
  const payload = () => {
    const expiry = isoDate(values.expiry);
    if (expiry < singaporeToday()) throw new Error("Choose today or a later response date.");
    return { applicationId: application.id, salary: values.salary, startDate: isoDate(values.startDate), expiry, terms: values.terms };
  };
  return (
    <Modal title="Prepare Employment Offer" onClose={onClose} footer={<Footer form="application-offer-form" busy={busy} onClose={onClose} label="Save Offer" />}>
      <form id="application-offer-form" className="interview-form" onSubmit={(event) => submit(event, payload)}>
        <p className="subtle">Changes require approval before preparing an offer email.</p>
        <ApplicantCard db={db} application={application} />
        <FormError message={error} />
        <label>Monthly salary (SGD)<input type="number" required min={1} max={1000000} step="0.01" value={values.salary} onChange={set("salary")} /></label>
        <div className="interview-form-grid">
          <DateField label="Start date" value={values.startDate} onChange={(value) => setValues((current) => ({ ...current, startDate: value }))} />
          <DateField label="Respond by" value={values.expiry} onChange={(value) => setValues((current) => ({ ...current, expiry: value }))} min={singaporeToday()} />
        </div>
        <label>Offer terms<textarea required maxLength={3000} rows={4} value={values.terms} onChange={set("terms")} /></label>
      </form>
    </Modal>
  );
}

export function OfferReview({ db, application, onAction, onClose, busy }) {
  const offer = application.offer;
  const [confirming, setConfirming] = useState(false);
  const expired = offer.expiry < singaporeToday();
  const block = expired ? "Offer expired" : db.currentUser?.role !== "HR_MANAGER" ? "HR Manager approval required" : "";
  const approved = offer.approval === "Approved";
  return (
    <Modal
      title="Review Offer"
      onClose={onClose}
      footer={
        <div className="interview-detail-actions">
          <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => onAction("offer-edit")}>Edit Offer</button>
          {!approved && !confirming && <button type="button" className="btn btn-primary" disabled={busy || Boolean(block)} title={block || undefined} onClick={() => setConfirming(true)}>Approve Offer</button>}
          {!approved && confirming && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onAction("approve-offer")}>Save</button>}
          {approved && <button type="button" className="btn btn-primary" disabled={busy || expired} title={expired ? "Offer expired" : undefined} onClick={() => onAction("offer-message")}>Send offer email</button>}
          <button type="button" className="btn btn-link text-danger" disabled={busy} onClick={() => onAction("reject")}>Reject application</button>
        </div>
      }
    >
      <p className="subtle">Prepare, approve and record candidate responses.</p>
      <ApplicantCard db={db} application={application} />
      <dl className="interview-details">
        <dt>Monthly salary</dt><dd>SGD {Number(offer.salary).toLocaleString("en-SG")}</dd>
        <dt>Start date</dt><dd>{formatDate(offer.startDate)}</dd>
        <dt>Expiry</dt><dd className={expired ? "text-danger" : undefined}>{formatDate(offer.expiry)}{expired ? " · Expired" : ""}</dd>
        <dt>Approval</dt><dd>{offer.approval}</dd>
        <dt>Response</dt><dd>{offer.status}</dd>
      </dl>
      <div className="interview-note">{offer.terms}</div>
      {confirming && <p className="subtle">Approve these offer terms? Select Save to continue.</p>}
      <p className="subtle mb-0">Approval and acceptance are recorded in the application history. Record acceptance only when the candidate has confirmed.</p>
    </Modal>
  );
}


export function draftFile(notification) {
  const subject = notification.subject.replace(/[\r\n]/g, " ");
  const to = notification.to.replace(/[\r\n]/g, "");
  return "To: " + to + "\r\nSubject: " + subject + "\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nX-Unsent: 1\r\n\r\n" + notification.body.replace(/\r?\n/g, "\r\n");
}

export function MessageForm({ db, application, notification, initialTemplateId, request, onSubmit, onDownload, onClose }) {
  const person = candidateOf(db, application);
  const job = jobOf(db, application);
  const rejected = application.stage === "Rejected";
  const [values, setValues] = useState(notification ? { templateId: notification.templateId || "", subject: notification.subject, body: notification.body } : {
    templateId: "",
    subject: (rejected ? "Application update — " : "Next steps — ") + job.title,
    body:
      "Hello " + person.name + ",\n\n" +
      (rejected
        ? "Thank you for your interest in " + job.title + ". After careful consideration, we will not be progressing your application for this position. We wish you the best in your job search."
        : "Thank you for your application for " + job.title + ". We will follow up with the next steps shortly.") +
      "\n\nBest regards,\n" + (db.currentUser?.name || ""),
  });
  const { error, busy, submit } = useSubmit(onSubmit);
  const [previewError, setPreviewError] = useState("");
  const previewSequence=useRef(0);
  const [previewing,setPreviewing]=useState(false);
  const set = (name) => (event) => setValues((current) => ({ ...current, [name]: event.target.value }));
  async function chooseTemplate(event) {
    const templateId = event.target.value;
    const sequence=++previewSequence.current;
    setPreviewing(Boolean(templateId));
    setValues((current) => ({ ...current, templateId }));
    setPreviewError("");
    if (!templateId) return;
    try {
      const preview = await request("hr/templates/" + encodeURIComponent(templateId) + "/preview", { applicationId: application.id });
      if(sequence===previewSequence.current)setValues((current) => ({ ...current, subject: preview.subject, body: preview.body }));
    } catch (requestError) {
      if(sequence!==previewSequence.current)return;
      setValues((current) => ({ ...current, templateId: "" }));
      setPreviewError(requestError.message);
    } finally {if(sequence===previewSequence.current)setPreviewing(false);}
  }
  const initialApplied=useRef(false);
  useEffect(()=>{if(initialTemplateId&&!initialApplied.current){initialApplied.current=true;chooseTemplate({target:{value:initialTemplateId}});}},[initialTemplateId]);
  const templates = (db.templates || []).filter((template) => template.active && templateAllowed(db,application,template));
  return (
    <Modal title="Candidate Message" onClose={onClose} footer={<Footer form="application-message-form" busy={busy||previewing} onClose={onClose} label="Save Email Draft" />}>
      <form id="application-message-form" className="interview-form" onSubmit={(event) => {if(previewing){event.preventDefault();return;}return submit(event, { applicationId: application.id, templateId: values.templateId, to: person.email, subject: values.subject, body: values.body, notificationId: notification?.id || undefined });}}>
        <p className="subtle">Prepare and review a draft. Send the saved message from Email Outbox.</p>
        <ApplicantCard db={db} application={application} />
        <FormError message={error || previewError} />
        <label>Email template
          <select value={values.templateId} onChange={chooseTemplate}>
            <option value="">Custom message</option>
            {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
        </label>
        <label>To<input type="email" readOnly value={person.email} /></label>
        <label>Subject<input aria-label="Subject" required maxLength={200} value={values.subject} onChange={set("subject")} /></label>
        <label>Message<textarea aria-label="Message" required maxLength={6000} rows={9} value={values.body} onChange={set("body")} /></label>
        {notification && <div><button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => onDownload(notification)}>Download saved draft (.eml)</button></div>}
        <p className="subtle mb-0">Private rejection reasons and internal notes are not added to the candidate email.</p>
      </form>
    </Modal>
  );
}

export function FiltersDialog({ db, filters, onApply, onClose }) {
  const [values, setValues] = useState({
    job: filters.job,
    priority: filters.priority,
    from: filters.from ? displayDate(filters.from) : "",
    to: filters.to ? displayDate(filters.to) : "",
  });
  const [error, setError] = useState("");
  const set = (name) => (event) => setValues((current) => ({ ...current, [name]: event.target.value }));
  function apply(event) {
    event.preventDefault();
    try {
      onApply({ job: values.job, priority: values.priority, from: values.from ? isoDate(values.from) : "", to: values.to ? isoDate(values.to) : "" });
    } catch (applyError) {
      setError(applyError.message);
    }
  }
  return (
    <Modal title="Filter Applications" onClose={onClose} footer={<Footer form="application-filters-form" busy={false} onClose={onClose} label="Apply Filters" />}>
      <form id="application-filters-form" className="interview-form" onSubmit={apply}>
        <p className="subtle">Apply filters to the work queue.</p>
        <FormError message={error} />
        <label>Position
          <select value={values.job} onChange={set("job")}>
            <option value="">All positions</option>
            {db.jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
          </select>
        </label>
        <label>Priority
          <select value={values.priority} onChange={set("priority")}>
            <option value="">All priorities</option>
            <option>High</option>
            <option>Normal</option>
          </select>
        </label>
        <div className="interview-form-grid">
          <DateField label="Applied from" value={values.from} onChange={(value) => setValues((current) => ({ ...current, from: value }))} />
          <DateField label="Applied to" value={values.to} onChange={(value) => setValues((current) => ({ ...current, to: value }))} />
        </div>
      </form>
    </Modal>
  );
}

export function ReceiveForm({ db, onSubmit, onClose }) {
  const activeJobs = db.jobs.filter((job) => job.status === "Active");
  const [values, setValues] = useState({
    jobId: activeJobs[0]?.id || "",
    candidateId: "",
    name: "",
    email: "",
    phone: "",
    location: "Singapore",
    experience: "0",
    skills: "",
    priority: "Normal",
  });
  const { error, busy, submit } = useSubmit(onSubmit);
  const set = (name) => (event) => setValues((current) => ({ ...current, [name]: event.target.value }));
  const payload = () => {
    const base = { jobId: values.jobId, priority: values.priority };
    if (values.candidateId) return { ...base, candidateId: values.candidateId };
    const { name, email, phone, location, experience, skills } = values;
    return { ...base, candidate: { name, email, phone, location, experience, skills } };
  };
  const fresh = !values.candidateId;
  return (
    <Modal title="Receive Application" onClose={onClose} footer={<Footer form="application-receive-form" busy={busy} onClose={onClose} label="Create Application" />}>
      <form id="application-receive-form" className="interview-form" onSubmit={(event) => submit(event, payload)}>
        <p className="subtle">Record an application received by the HR team.</p>
        <FormError message={error} />
        <label>Position
          <select required value={values.jobId} onChange={set("jobId")}>
            {activeJobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
          </select>
        </label>
        <label>Existing candidate (or enter new details)
          <select value={values.candidateId} onChange={set("candidateId")}>
            <option value="">New candidate</option>
            {db.candidates.filter(person=>person.canReceiveApplication!==false).map((person) => <option key={person.id} value={person.id}>{person.name} · {person.email}</option>)}
          </select>
        </label>
        {fresh && (
          <>
            <label>Full name<input required maxLength={100} value={values.name} onChange={set("name")} /></label>
            <label>Email<input type="email" required maxLength={254} value={values.email} onChange={set("email")} /></label>
            <label>Phone<input required maxLength={40} value={values.phone} onChange={set("phone")} /></label>
            <label>Location<input required maxLength={100} value={values.location} onChange={set("location")} /></label>
            <label>Experience (years)<input type="number" required min={0} max={70} step="0.1" value={values.experience} onChange={set("experience")} /></label>
            <label>Skills (comma separated)<input required maxLength={500} value={values.skills} onChange={set("skills")} /></label>
          </>
        )}
        <label>Priority
          <select value={values.priority} onChange={set("priority")}>
            <option>Normal</option>
            <option>High</option>
          </select>
        </label>
      </form>
    </Modal>
  );
}

export function ApplicationDetails({ db, application, onInterview, onClose }) {
  const meetings = db.interviews.filter((interview) => interview.applicationId === application.id);
  return (
    <Modal title="Application details" onClose={onClose}>
      <p className="subtle">{candidateOf(db, application).name} · {jobOf(db, application).title}</p>
      <ApplicantCard db={db} application={application} />
      <dl className="interview-details">
        <dt>Stage</dt><dd>{application.stage}</dd>
        <dt>Applied</dt><dd>{formatDate(application.appliedDate)}</dd>
        <dt>Position</dt><dd>{jobOf(db, application).title}</dd>
      </dl>
      {meetings.length > 0 && (
        <>
          <h3 className="interview-subheading">Interviews</h3>
          <ul className="interviews-choose">
            {meetings.map((interview) => (
              <li key={interview.id}>
                <span>{formatDate(interview.date)} · {interview.time}<small className="d-block subtle">{interview.status}</small></span>
                <button type="button" className="job-secondary" onClick={() => onInterview(interview)}>Details</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}

export function MessageView({ notification, onClose }) {
  return (
    <Modal title={notification.status + " Message"} onClose={onClose}>
      <p className="subtle">{notification.status === "Sent" ? "This message was accepted by the email server." : "This message is read-only."}</p>
      <h3 className="interview-subheading">{notification.subject}</h3>
      <p className="subtle">{notification.to}</p>
      <div className="interview-note">{notification.body}</div>
    </Modal>
  );
}

export function SendEmail({ db, notification, onSubmit, onClose }) {
  const application = db.applications.find((item) => item.id === notification.applicationId);
  const person = candidateOf(db, application);
  const [attach, setAttach] = useState(false);
  const { error, busy, submit } = useSubmit(onSubmit);
  const payload = () => {
    if (!db.mailEnabled) throw new Error("Email sending is not configured. The message remains a draft.");
    return { id: notification.id, attachResume: attach };
  };
  return (
    <Modal
      title="Send Candidate Email"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="application-send-form" className="btn btn-primary" disabled={busy || !db.mailEnabled}>Send Email</button>
        </>
      }
    >
      <form id="application-send-form" className="interview-form" onSubmit={(event) => submit(event, payload)}>
        <p className="subtle">Review the recipient and message before sending.</p>
        <FormError message={error} />
        <dl className="interview-details">
          <dt>To</dt><dd>{notification.to}</dd>
          <dt>Subject</dt><dd>{notification.subject}</dd>
        </dl>
        <div className="interview-note">{notification.body}</div>
        {person.resume && <label className="interview-check"><input type="checkbox" checked={attach} onChange={(event) => setAttach(event.target.checked)} /><span>Attach the candidate’s uploaded resume</span></label>}
        {!db.mailEnabled && <p className="text-danger mb-0">Email sending has not been configured. This message remains a draft.</p>}
      </form>
    </Modal>
  );
}

export function UploadResume({ onSubmit, onClose }) {
  const [file, setFile] = useState(null);
  const { error, busy, submit } = useSubmit(onSubmit);
  return (
    <Modal title="Upload Resume" onClose={onClose} footer={<Footer form="application-upload-form" busy={busy} onClose={onClose} label="Upload Resume" />}>
      <form id="application-upload-form" className="interview-form" onSubmit={(event) => submit(event, () => file)}>
        <p className="subtle">PDF, maximum 5 MB.</p>
        <FormError message={error} />
        <label>Resume file<input type="file" accept=".pdf,application/pdf" onChange={(event) => setFile(event.target.files[0] || null)} /></label>
      </form>
    </Modal>
  );
}

export function CandidateForm({ candidate, onSubmit, onClose }) {
  const [values, setValues] = useState({
    name: candidate.name || "",
    email: candidate.email || "",
    phone: candidate.phone || "",
    location: candidate.location || "Singapore",
    experience: String(candidate.experience ?? 0),
    skills: (candidate.skills || []).join(", "),
  });
  const { error, busy, submit } = useSubmit(onSubmit);
  const set = (name) => (event) => setValues((current) => ({ ...current, [name]: event.target.value }));
  return (
    <Modal title="Edit Contact Details" onClose={onClose} footer={<Footer form="candidate-edit-form" busy={busy} onClose={onClose} label="Save Changes" />}>
      <form id="candidate-edit-form" className="interview-form" onSubmit={(event) => submit(event, { id: candidate.id, ...values })}>
        <p className="subtle">Update contact and profile information.</p>
        <FormError message={error} />
        <label>Full name<input required maxLength={100} value={values.name} onChange={set("name")} /></label>
        <label>Email<input type="email" required maxLength={254} value={values.email} onChange={set("email")} /></label>
        <label>Phone<input required maxLength={40} value={values.phone} onChange={set("phone")} /></label>
        <label>Location<input required maxLength={100} value={values.location} onChange={set("location")} /></label>
        <label>Experience (years)<input type="number" required min={0} max={70} step="0.1" value={values.experience} onChange={set("experience")} /></label>
        <label>Skills (comma separated)<input required maxLength={500} value={values.skills} onChange={set("skills")} /></label>
      </form>
    </Modal>
  );
}

export function NoteForm({ db, application, onSubmit, onClose }) {
  const [notes, setNotes] = useState(candidateOf(db, application).notes || "");
  const { error, busy, submit } = useSubmit(onSubmit);
  return (
    <Modal title="Private Candidate Note" onClose={onClose} footer={<Footer form="candidate-note-form" busy={busy} onClose={onClose} label="Save Note" />}>
      <form id="candidate-note-form" className="interview-form" onSubmit={(event) => submit(event, { applicationId: application.id, notes })}>
        <p className="subtle">Visible only inside the HR workspace.</p>
        <FormError message={error} />
        <label>Note<textarea required maxLength={3000} rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      </form>
    </Modal>
  );
}

export function TaskForm({ db, application, onSubmit, onClose }) {
  const [values, setValues] = useState({ title: "", assignee: db.currentUser?.name || "", due: displayDate(businessDay(1)), notes: "" });
  const { error, busy, submit } = useSubmit(onSubmit);
  const set = (name) => (event) => setValues((current) => ({ ...current, [name]: event.target.value }));
  const payload = () => {
    const due = isoDate(values.due);
    if (due < singaporeToday()) throw new Error("Due date cannot be in the past.");
    return { applicationId: application.id, title: values.title, assignee: values.assignee, due, notes: values.notes };
  };
  return (
    <Modal title="Create Follow-up Task" onClose={onClose} footer={<Footer form="candidate-task-form" busy={busy} onClose={onClose} label="Create Task" />}>
      <form id="candidate-task-form" className="interview-form" onSubmit={(event) => submit(event, payload)}>
        <p className="subtle">Record preparation work for the hiring team.</p>
        <ApplicantCard db={db} application={application} />
        <FormError message={error} />
        <label>Task title<input required maxLength={150} placeholder="e.g. Prepare technical interview questions" value={values.title} onChange={set("title")} /></label>
        <div className="interview-form-grid">
          <label>Assigned to<input required maxLength={100} value={values.assignee} onChange={set("assignee")} /></label>
          <DateField label="Due date" value={values.due} onChange={(value) => setValues((current) => ({ ...current, due: value }))} min={singaporeToday()} />
        </div>
        <label>Task notes<textarea maxLength={1000} rows={3} value={values.notes} onChange={set("notes")} /></label>
      </form>
    </Modal>
  );
}
