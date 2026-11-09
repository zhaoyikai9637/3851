import { useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "../../src/icons";
import { Modal } from "../../src/shared";
import { useViewportRows } from "../../src/useViewportRows";
import { DateField } from "../jobs/DateField";
import { isoDate } from "../jobs/model";
import { candidateOf, formatDate, jobOf, useWorkspace, saveWithEmail } from "../recruitment/workspaceClient";
import { CancelForm, DetailsDialog, download, FeedbackForm, hasEnded, interviewCalendar, Person, resumePath, ScheduleForm, STATUSES, StatusBadge } from "../recruitment/dialogs";

import "../jobs/jobs.css";
import "./interviews.css";

export { interviewCalendar };

// Native React Interviews page (previously rendered by the embedded HR workspace).
// It reads the same workspace snapshot and sends the same commands
// (schedule, cancel-interview, feedback), so server rules are unchanged.

export function Interviews({ fetcher, now }) {
  const workspace=useWorkspace(fetcher,"/hr/interviews");
  const {db,error,load,commit}=workspace;
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [dialog, setDialog] = useState(null);
  const [notice, setNotice] = useState("");
  // Rows per page follow the space left in the window, so the page never needs scrolling.
  const host = useRef(null);
  const PAGE_SIZE = useViewportRows(host, db ? db.revision : -1, 8);
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
    const {notice}=await saveWithEmail(workspace,command,payload);
    setDialog(null);
    setNotice(message+(notice?" "+notice:""));
  }

  function onAction(kind, interview) {
    if (kind === "calendar") {
      download(interviewCalendar(db, interview), "JRS-Interview.ics", "text/calendar;charset=utf-8");
      return;
    }
    if(kind === "feedback") { setDialog(null); const next=new URLSearchParams(params); next.set("feedback",interview.id); setParams(next); return; }
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

  const feedbackId=params.get("feedback");
  function closeFeedback() { const next=new URLSearchParams(params); next.delete("feedback"); setParams(next); }
  if(feedbackId) {
    const interview=db.interviews.find(item=>item.id===feedbackId);
    const application=interview&&db.applications.find(item=>item.id===interview.applicationId);
    const allowed=interview&&application&&application.stage==="Interview"&&interview.status==="Scheduled"&&jobOf(db,application).status==="Active"&&hasEnded(interview,now);
    if(!allowed)return <section className="yyb-pages yyb-feedback-page"><p role="alert">Feedback is only available for an ended scheduled interview under an active job.</p><button type="button" className="job-secondary" onClick={closeFeedback}>Return to interviews</button></section>;
    return <FeedbackForm key={interview.id} page db={db} interview={interview} onClose={closeFeedback} onSubmit={async payload=>{await commit("feedback",payload);closeFeedback();setNotice("Feedback saved. The application is now in Interview Results.");}} />;
  }

  return (
    <div className="jobs-workspace interviews-page yyb-pages fit-page" ref={host}>
      <div className="jobs-toolbar" role="toolbar" aria-label="Interview filters and actions">
        <label className="jobs-search">
          <Icon name="search" />
          <input type="search" aria-label="Search interviews" placeholder="Search interviews" value={q} onChange={(event) => setFilter("q", event.target.value)} />
        </label>
        <label className="jobs-filter">
          <span>Status</span>
          <select aria-label="Filter interview status" value={status} onChange={(event) => setFilter("status", event.target.value)}>
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
          Arrange interview
        </button>
      </div>

      {notice && <div className="alert alert-success" role="status">{notice}</div>}

      {eligible.length > 0 && (
        <div className="interviews-waiting">
          <span><strong>{eligible.length}</strong> application{eligible.length === 1 ? "" : "s"} awaiting scheduling</span>
          <button type="button" className="job-secondary" onClick={() => setDialog({ kind: "choose" })}>Choose candidate</button>
        </div>
      )}

      <section className="jobs-table-panel fit-panel">
        {visible.length === 0 ? (
          <div className="jobs-empty">
            <Icon name="calendar" />
            <h2>No interviews found</h2>
            <p>Schedule a candidate in the Interview stage, or change your filters.</p>
          </div>
        ) : (
          <div className="jobs-table-scroll fit-body">
            <table className="jobs-table" aria-label="Interviews">
              <thead>
                <tr><th>Candidate</th><th>Position</th><th>Location</th><th>Type</th><th>Interviewer</th><th>Date / Time</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {visible.map((interview) => {
                  const application = db.applications.find((item) => item.id === interview.applicationId);
                  return (
                    <tr key={interview.id}>
                      <td>
                        <button type="button" className="interview-person-link" title="View resume" onClick={() => navigate("/applications?view=" + resumePath(application), { state: { from: location.pathname + location.search } })}>
                          <Person db={db} application={application} />
                        </button>

                      </td>
                      <td>{jobOf(db,application).title}</td>
                      <td>{interview.location}</td>
                      <td>{interview.format}</td>
                      <td>{interview.interviewer}</td>
                      <td>{formatDate(interview.date)}<small className="d-block subtle">{interview.time}</small></td>
                      <td><StatusBadge status={interview.status} /></td>
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

    </div>
  );
}
