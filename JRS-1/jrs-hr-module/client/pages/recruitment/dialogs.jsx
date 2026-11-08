import { useState } from "react";
import { Modal } from "../../src/shared";
import { DateField } from "../jobs/DateField";
import { displayDate, isoDate } from "../jobs/model";
import { candidateOf, formatDate, initials, jobOf, singaporeToday } from "./workspaceClient";
import "../jobs/jobs.css";
import "../interviews/interviews.css";

// Dialogs and helpers shared by the native React recruitment pages (Interviews and
// Applications). They send the same workspace commands as the embedded workspace.

export const STATUSES = ["Scheduled", "Completed", "Cancelled"];
export const DURATIONS = ["15", "30", "45", "60", "90", "120"];
export const FORMATS = ["Video", "On-site", "Phone"];
const DEFAULT_CRITERIA = ["Relevant experience", "Technical skills", "Communication", "Teamwork"];
const RATINGS = [
  ["1", "1 — Poor"],
  ["2", "2 — Below expectations"],
  ["3", "3 — Meets expectations"],
  ["4", "4 — Strong"],
  ["5", "5 — Excellent"],
];

export const startsAt = (interview) => new Date(`${interview.date}T${interview.time}:00+08:00`).getTime();
export const hasEnded = (interview, now = Date.now()) => startsAt(interview) + interview.duration * 60000 <= now;
export const resumePath = (application) => (application.stage === "Interview Results" ? "results/" : "review/") + application.id;

export function StatusBadge({ status }) {
  return <span className={`interview-status interview-status-${status.toLowerCase()}`}>{status}</span>;
}

export function Person({ db, application }) {
  const person = candidateOf(db, application);
  return (
    <span className="person-cell">
      <span className="avatar" aria-hidden="true">{initials(person.name)}</span>
      <span>
        <strong>{person.name}</strong>
        {person.email && <small className="d-block subtle">{person.email}</small>}
      </span>
    </span>
  );
}

// Calendar file identical to the embedded workspace's download.
export function interviewCalendar(db, interview, now = new Date()) {
  const application = db.applications.find((item) => item.id === interview.applicationId);
  const start = new Date(startsAt(interview));
  const end = new Date(start.getTime() + interview.duration * 60000);
  const stamp = (value) => value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const clean = (value) => String(value ?? "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//JRS//HR Workspace//EN",
    "BEGIN:VEVENT",
    `UID:${interview.id}@jrs.local`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    "SUMMARY:" + clean(`Interview: ${candidateOf(db, application).name} — ${jobOf(db, application).title}`),
    "LOCATION:" + clean(interview.location),
    "DESCRIPTION:" + clean(`Interviewer: ${interview.interviewer}\n${interview.notes || ""}`),
    "STATUS:" + (interview.status === "Cancelled" ? "CANCELLED" : "CONFIRMED"),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function download(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function FormError({ message }) {
  return message ? <div className="alert alert-danger" role="alert">{message}</div> : null;
}

export function ScheduleForm({ db, application, interview, onSubmit, onClose, title, submitLabel }) {
  const [values, setValues] = useState({
    date: "",
    time: "",
    location: "",
    interviewer: "",
    duration: String(interview?.duration || 45),
    format: interview?.format || "Video",
    notes: interview?.notes || "",
    notify: Boolean(db.mailEnabled),
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (name) => (event) => setValues((current) => ({ ...current, [name]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setBusy(true);
    setError("");
    try {
      const date = isoDate(values.date);
      if (date < singaporeToday()) throw new Error("Choose today or a later date.");
      await onSubmit({ ...values, date, applicationId: application.id, interviewId: interview?.id || undefined });
    } catch (submitError) {
      setError(submitError.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={title || (interview ? "Reschedule Interview" : "Schedule Interview")}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="interview-schedule-form" className="btn btn-primary" disabled={busy}>
            {submitLabel || "Save"}
          </button>
        </>
      }
    >
      <form id="interview-schedule-form" className="interview-form" onSubmit={submit} autoComplete="off" noValidate={false}>
        <p className="subtle">Times are Singapore time (UTC+08:00). Overlapping bookings are blocked.</p>
        <div className="interview-candidate"><Person db={db} application={application} /><small>{jobOf(db, application).title}</small></div>
        <FormError message={error} />
        <div className="interview-form-grid">
          <DateField label="Interview date" value={values.date} onChange={(value) => setValues((current) => ({ ...current, date: value }))} min={singaporeToday()} />
          <label>Interview time<input type="time" required value={values.time} onChange={set("time")} /></label>
        </div>
        <label>Interview venue or meeting link<input required maxLength={300} placeholder="Room, address or video meeting link" value={values.location} onChange={set("location")} /></label>
        <label>Interviewer<input required maxLength={100} placeholder="Enter interviewer" value={values.interviewer} onChange={set("interviewer")} /></label>
        <div className="interview-form-grid">
          <label>Meeting venue<select value={values.format} onChange={set("format")}>{FORMATS.map((value) => <option key={value}>{value}</option>)}</select></label>
        </div>
        <label>Comment (optional)<textarea maxLength={500} rows={3} value={values.notes} onChange={set("notes")} /></label>
        <label className="interview-check"><input type="checkbox" checked={values.notify} disabled={!db.mailEnabled} onChange={set("notify")} /><span>Send email notification</span></label>
        <p className="subtle mb-0">Selecting Send email notification sends the email when you save.</p>
      </form>
    </Modal>
  );
}

export function CancelForm({ db, interview, onSubmit, onClose }) {
  const application = db.applications.find((item) => item.id === interview.applicationId);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setBusy(true);
    try {
      await onSubmit({ reason, applicationId: application.id, interviewId: interview.id });
    } catch (submitError) {
      setError(submitError.message);
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Cancel Interview"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>Keep interview</button>
          <button type="submit" form="interview-cancel-form" className="btn btn-danger" disabled={busy}>Cancel Interview</button>
        </>
      }
    >
      <form id="interview-cancel-form" className="interview-form" onSubmit={submit}>
        <p className="subtle">The candidate remains in Interview and can be rescheduled.</p>
        <div className="interview-candidate"><Person db={db} application={application} /></div>
        <FormError message={error} />
        <label>Cancellation reason<textarea required maxLength={500} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      </form>
    </Modal>
  );
}

export function FeedbackForm({ db, interview, onSubmit, onClose }) {
  const application = db.applications.find((item) => item.id === interview.applicationId);
  const [criteria, setCriteria] = useState(DEFAULT_CRITERIA.map((label, index) => ({ key: index, label, rating: "" })));
  const [values, setValues] = useState({ rating: "", recommendation: "", notes: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (name) => (event) => setValues((current) => ({ ...current, [name]: event.target.value }));
  const updateCriterion = (key, field, value) => setCriteria((rows) => rows.map((row) => (row.key === key ? { ...row, [field]: value } : row)));

  async function submit(event) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setBusy(true);
    try {
      await onSubmit({
        ...values,
        assessment: JSON.stringify(criteria.map((row) => ({ label: row.label, rating: Number(row.rating) }))),
        applicationId: application.id,
        interviewId: interview.id,
      });
    } catch (submitError) {
      setError(submitError.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Record Interview Feedback"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="interview-feedback-form" className="btn btn-primary" disabled={busy}>Complete Interview</button>
        </>
      }
    >
      <form id="interview-feedback-form" className="interview-form" onSubmit={submit}>
        <p className="subtle">Completing feedback moves the application to Interview Results.</p>
        <div className="interview-candidate"><Person db={db} application={application} /></div>
        <FormError message={error} />
        <section className="interview-assessment" aria-label="Assessment criteria">
          <h3>Assessment criteria</h3>
          {criteria.map((row) => (
            <div className="interview-assessment-row" key={row.key}>
              <label>Criterion name<input required maxLength={80} placeholder="e.g. System design" value={row.label} onChange={(event) => updateCriterion(row.key, "label", event.target.value)} /></label>
              <label>Rating
                <select required value={row.rating} onChange={(event) => updateCriterion(row.key, "rating", event.target.value)}>
                  <option value="">Choose rating</option>
                  {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} / 5</option>)}
                </select>
              </label>
              <button type="button" className="btn btn-link btn-sm" disabled={criteria.length <= 1} onClick={() => setCriteria((rows) => rows.filter((item) => item.key !== row.key))}>Remove</button>
            </div>
          ))}
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setCriteria((rows) => [...rows, { key: Math.max(-1, ...rows.map((item) => item.key)) + 1, label: "", rating: "" }])}>Add criterion</button>
          <p className="subtle mb-0">1 Below expectations · 2 Developing · 3 Meets expectations · 4 Strong · 5 Excellent</p>
        </section>
        <label>Overall rating
          <select required value={values.rating} onChange={set("rating")}>
            <option value="">Choose overall rating</option>
            {RATINGS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Recommendation
          <select required value={values.recommendation} onChange={set("recommendation")}>
            <option value="">Choose recommendation</option>
            {["Proceed", "Hold", "Reject"].map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label>Interview feedback<textarea required maxLength={3000} rows={4} value={values.notes} onChange={set("notes")} /></label>
      </form>
    </Modal>
  );
}

export function DetailsDialog({ db, interview, onAction, onClose, now }) {
  const application = db.applications.find((item) => item.id === interview.applicationId);
  const activeJob = jobOf(db, application).status === "Active";
  const ended = hasEnded(interview, now);
  return (
    <Modal
      title="Interview details"
      onClose={onClose}
      footer={
        <div className="interview-detail-actions">
          <button type="button" className="btn btn-outline-secondary" onClick={() => onAction("calendar", interview)}>Download calendar event</button>
          {interview.status === "Scheduled" && (
            <>
              <button type="button" className="btn btn-outline-secondary" disabled={!activeJob} title={activeJob ? undefined : "Activate this job to reschedule interviews"} onClick={() => onAction("reschedule", interview)}>Reschedule</button>
              <button type="button" className="btn btn-link text-danger" onClick={() => onAction("cancel", interview)}>Cancel interview</button>
              <button type="button" className="btn btn-primary" disabled={!ended} title={ended ? undefined : "Feedback becomes available after the interview ends"} onClick={() => onAction("feedback", interview)}>Record Feedback</button>
            </>
          )}
        </div>
      }
    >
      <div className="interview-candidate"><Person db={db} application={application} /><small>{jobOf(db, application).title}</small></div>
      <dl className="interview-details">
        <dt>Date</dt><dd>{formatDate(interview.date)}</dd>
        <dt>Time</dt><dd>{interview.time} · {interview.duration} minutes</dd>
        <dt>Interviewer</dt><dd>{interview.interviewer}</dd>
        <dt>Format</dt><dd>{interview.format}</dd>
        <dt>Details</dt><dd>{interview.location}</dd>
        <dt>Status</dt><dd><StatusBadge status={interview.status} /></dd>
      </dl>
      {interview.notes && <div className="interview-note">{interview.notes}</div>}
      {interview.feedback && (
        <>
          <h3 className="interview-subheading">Feedback · {interview.feedback.rating}/5</h3>
          <div className="interview-note">{interview.feedback.notes}</div>
        </>
      )}
      {interview.status === "Scheduled" && !ended && <p className="subtle mb-0">Feedback can be recorded once the interview has ended.</p>}
    </Modal>
  );
}
