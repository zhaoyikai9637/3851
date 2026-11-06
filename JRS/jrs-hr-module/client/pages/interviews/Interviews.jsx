import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "../../src/icons";
import { Modal } from "../../src/shared";
import { DateField } from "../jobs/DateField";
import { displayDate, isoDate } from "../jobs/model";
import { candidateOf, formatDate, initials, jobOf, singaporeToday, useWorkspace } from "../recruitment/workspaceClient";
import "../jobs/jobs.css";
import "./interviews.css";

// Native React Interviews page (previously rendered by the embedded HR workspace).
// It reads the same workspace snapshot and sends the same commands
// (schedule, cancel-interview, feedback), so server rules are unchanged.

const PAGE_SIZE = 8;
const STATUSES = ["Scheduled", "Completed", "Cancelled"];
const DURATIONS = ["15", "30", "45", "60", "90", "120"];
const FORMATS = ["Video", "On-site", "Phone"];
const DEFAULT_CRITERIA = ["Relevant experience", "Technical skills", "Communication", "Teamwork"];
const RATINGS = [
  ["1", "1 — Poor"],
  ["2", "2 — Below expectations"],
  ["3", "3 — Meets expectations"],
  ["4", "4 — Strong"],
  ["5", "5 — Excellent"],
];

const startsAt = (interview) => new Date(`${interview.date}T${interview.time}:00+08:00`).getTime();
const hasEnded = (interview, now = Date.now()) => startsAt(interview) + interview.duration * 60000 <= now;
const resumePath = (application) => (application.stage === "Interview Results" ? "results/" : "review/") + application.id;

function StatusBadge({ status }) {
  return <span className={`interview-status interview-status-${status.toLowerCase()}`}>{status}</span>;
}

function Person({ db, application }) {
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

function download(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function FormError({ message }) {
  return message ? <div className="alert alert-danger" role="alert">{message}</div> : null;
}

function ScheduleForm({ db, application, interview, onSubmit, onClose }) {
  const [values, setValues] = useState({
    date: interview ? displayDate(interview.date) : "",
    time: interview?.time || "",
    location: interview?.location || "",
    interviewer: interview?.interviewer || "",
    duration: String(interview?.duration || 45),
    format: interview?.format || "Video",
    notes: interview?.notes || "",
    notify: true,
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
      title={interview ? "Reschedule Interview" : "Schedule Interview"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="interview-schedule-form" className="btn btn-primary" disabled={busy}>
            {interview ? "Save New Schedule" : "Confirm Interview"}
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
          <label>Duration<select value={values.duration} onChange={set("duration")}>{DURATIONS.map((value) => <option key={value} value={value}>{value} minutes</option>)}</select></label>
          <label>Meeting format<select value={values.format} onChange={set("format")}>{FORMATS.map((value) => <option key={value}>{value}</option>)}</select></label>
        </div>
        <label>Internal notes (optional)<textarea maxLength={500} rows={3} value={values.notes} onChange={set("notes")} /></label>
        <label className="interview-check"><input type="checkbox" checked={values.notify} onChange={set("notify")} /><span>Prepare interview email draft</span></label>
        <p className="subtle mb-0">No email is sent automatically.</p>
      </form>
    </Modal>
  );
}

function CancelForm({ db, interview, onSubmit, onClose }) {
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

function FeedbackForm({ db, interview, onSubmit, onClose }) {
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

function DetailsDialog({ db, interview, onAction, onClose, now }) {
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

export function Interviews({ fetcher, now }) {
  const { db, error, load, commit } = useWorkspace(fetcher, "/hr/interviews");
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState(null);
  const [notice, setNotice] = useState("");
  const q = params.get("q") || "";
  const status = params.has("status") ? params.get("status") : "Scheduled";
  const date = params.get("date") || "";
  const page = Math.max(1, Number(params.get("page")) || 1);

  function setFilter(name, value, keepPage = false) {
    const next = new URLSearchParams(params);
    if (value === "" && name !== "status") next.delete(name);
    else next.set(name, value);
    if (!keepPage) next.delete("page");
    setParams(next, { replace: name === "q" });
  }

  const eligible = useMemo(
    () => (db ? db.applications.filter((item) => item.stage === "Interview" && jobOf(db, item).status === "Active" && !db.interviews.some((interview) => interview.applicationId === item.id && interview.status === "Scheduled")) : []),
    [db],
  );

  const items = useMemo(() => {
    if (!db) return [];
    let isoFilter = "";
    try {
      isoFilter = date ? isoDate(date) : "";
    } catch {
      isoFilter = "";
    }
    return db.interviews
      .filter((interview) => {
        const application = db.applications.find((item) => item.id === interview.applicationId);
        return (!status || interview.status === status)
          && (!q || candidateOf(db, application).name.toLowerCase().includes(q.toLowerCase()))
          && (!isoFilter || interview.date === isoFilter);
      })
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }, [db, q, status, date]);

  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = items.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  async function run(command, payload, message) {
    await commit(command, payload);
    setDialog(null);
    setNotice(message);
  }

  function onAction(kind, interview) {
    if (kind === "calendar") {
      download(interviewCalendar(db, interview), "JRS-Interview.ics", "text/calendar;charset=utf-8");
      return;
    }
    setDialog({ kind, interview });
  }

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        {error}{" "}
        <button className="btn btn-link p-0 align-baseline" type="button" onClick={load}>Try again</button>
      </div>
    );
  }
  if (!db) return <div className="loading-state" role="status"><span className="spinner-border spinner-border-sm" aria-hidden="true" /> Loading…</div>;

  return (
    <div className="jobs-workspace interviews-page">
      <div className="jobs-toolbar" role="toolbar" aria-label="Interview filters and actions">
        <label className="jobs-search">
          <Icon name="search" />
          <input type="search" aria-label="Search interviews" placeholder="Search interviews" value={q} onChange={(event) => setFilter("q", event.target.value)} />
        </label>
        <label className="jobs-filter">
          <span className="visually-hidden">Filter interview status</span>
          <select value={status} onChange={(event) => setFilter("status", event.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <div className="interviews-date-filter">
          <DateField label="Interview date" value={date} onChange={(value) => setFilter("date", value)} />
        </div>
        <button type="button" className="job-secondary" onClick={() => setParams(new URLSearchParams({ status: "" }))}>Clear filters</button>
        <button type="button" className="job-primary" onClick={() => setDialog({ kind: "choose" })}>
          <Icon name="plus" />
          Schedule Interview
        </button>
      </div>

      {notice && <div className="alert alert-success" role="status">{notice}</div>}

      {eligible.length > 0 && (
        <div className="interviews-waiting">
          <span><strong>{eligible.length}</strong> application{eligible.length === 1 ? "" : "s"} awaiting scheduling</span>
          <button type="button" className="job-secondary" onClick={() => setDialog({ kind: "choose" })}>Choose candidate</button>
        </div>
      )}

      <section className="jobs-table-panel">
        {visible.length === 0 ? (
          <div className="jobs-empty">
            <Icon name="calendar" />
            <h2>No interviews found</h2>
            <p>Schedule a candidate in the Interview stage, or change your filters.</p>
          </div>
        ) : (
          <div className="jobs-table-scroll">
            <table className="jobs-table" aria-label="Interviews">
              <thead>
                <tr><th>Applicant</th><th>Interview status</th><th>Date &amp; time</th><th>Meeting</th><th>Action</th></tr>
              </thead>
              <tbody>
                {visible.map((interview) => {
                  const application = db.applications.find((item) => item.id === interview.applicationId);
                  return (
                    <tr key={interview.id}>
                      <td>
                        <button type="button" className="interview-person-link" title="View resume" onClick={() => navigate("/applications?view=" + resumePath(application))}>
                          <Person db={db} application={application} />
                        </button>
                        <small className="d-block subtle interview-job">{jobOf(db, application).title}</small>
                      </td>
                      <td><StatusBadge status={interview.status} /></td>
                      <td>{formatDate(interview.date)}<small className="d-block subtle">{interview.time} · {interview.duration} min</small></td>
                      <td>{interview.format}<small className="d-block subtle">{interview.interviewer}</small></td>
                      <td><button type="button" className="job-secondary" onClick={() => setDialog({ kind: "details", interview })}>View</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <footer className="jobs-table-footer">
          <span>{items.length ? `Showing ${(current - 1) * PAGE_SIZE + 1}–${Math.min(current * PAGE_SIZE, items.length)} of ${items.length} interviews` : "0 interviews"}</span>
          <nav aria-label="Interview pages">
            <button type="button" className="job-secondary" disabled={current <= 1} onClick={() => setFilter("page", String(current - 1), true)}>Previous</button>
            <span>Page {current} of {pages}</span>
            <button type="button" className="job-secondary" disabled={current >= pages} onClick={() => setFilter("page", String(current + 1), true)}>Next</button>
          </nav>
        </footer>
      </section>

      {dialog?.kind === "choose" && (
        <Modal title="Choose Candidate" onClose={() => setDialog(null)}>
          <p className="subtle">Choose an application in the Interview stage with an active job.</p>
          {eligible.length === 0 ? (
            <p className="mb-0"><strong>No applicants awaiting scheduling.</strong> Move an application to Interview under an active job to schedule a meeting.</p>
          ) : (
            <ul className="interviews-choose">
              {eligible.map((application) => (
                <li key={application.id}>
                  <Person db={db} application={application} />
                  <button type="button" className="job-secondary" onClick={() => setDialog({ kind: "schedule", application })}>Schedule</button>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
      {dialog?.kind === "details" && (
        <DetailsDialog db={db} interview={db.interviews.find((item) => item.id === dialog.interview.id) || dialog.interview} onAction={onAction} onClose={() => setDialog(null)} now={now} />
      )}
      {(dialog?.kind === "schedule" || dialog?.kind === "reschedule") && (
        <ScheduleForm
          db={db}
          application={dialog.application || db.applications.find((item) => item.id === dialog.interview.applicationId)}
          interview={dialog.kind === "reschedule" ? dialog.interview : null}
          onClose={() => setDialog(null)}
          onSubmit={(payload) => run("schedule", payload, "Interview schedule saved.")}
        />
      )}
      {dialog?.kind === "cancel" && (
        <CancelForm db={db} interview={dialog.interview} onClose={() => setDialog(null)} onSubmit={(payload) => run("cancel-interview", payload, "Interview cancelled.")} />
      )}
      {dialog?.kind === "feedback" && (
        <FeedbackForm db={db} interview={dialog.interview} onClose={() => setDialog(null)} onSubmit={(payload) => run("feedback", payload, "Feedback saved. The application is now in Interview Results.")} />
      )}
    </div>
  );
}
