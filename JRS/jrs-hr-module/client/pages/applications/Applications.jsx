import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useViewportRows } from "../../src/useViewportRows";
import { Recruitment } from "../recruitment/Recruitment";
import { CancelForm, DetailsDialog, download, FeedbackForm, interviewCalendar, resumePath, ScheduleForm } from "../recruitment/dialogs";
import { candidateOf, formatDate, jobOf, useWorkspace } from "../recruitment/workspaceClient";
import { AcceptForm, ApplicationDetails, businessDay, FiltersDialog, MessageForm, OfferForm, OfferReview, ReceiveForm, RejectForm, RejectionReview } from "./dialogs";
import "./applications.css";

// Native React Applications list. It renders the same markup as the embedded
// workspace queue inside .hr-legacy (styled by the scoped copy of the legacy
// stylesheets), so it looks identical. Resume review, interview results and
// candidate profiles still open in the embedded workspace through ?view=.

export const STAGES = ["Pending Review", "Interview", "Interview Results", "Offer", "Rejected", "Hired"];
const TONES = { "Pending Review": "amber", Interview: "purple", "Interview Results": "purple", Offer: "green", Rejected: "red", Hired: "green" };
const AVATAR_TONES = ["blue", "purple", "green", "amber", "red"];

export const stagePath = (stage) => "applications" + (stage ? "/" + (stage === "Pending Review" ? "pending-review" : stage.toLowerCase().replaceAll(" ", "-")) : "");

// "" for the full queue, the stage for a stage queue, undefined for any other view.
export function stageForView(view) {
  if (!view || view === "applications") return "";
  const match = /^applications\/([a-z-]+)$/.exec(view);
  if (!match) return undefined;
  const slug = match[1] === "applications-review" ? "pending-review" : match[1];
  return STAGES.find((stage) => stagePath(stage) === "applications/" + slug);
}

function Svg({ name }) {
  const paths = {
    search: <><circle cx="10" cy="10" r="7" /><path d="m15 15 7 7" /></>,
    download: <path d="M12 2v14m-5-5 5 5 5-5M3 17v5h18v-5" />,
    plus: <path d="M12 3v18M3 12h18" />,
    file: <><rect x="5" y="4" width="14" height="18" rx="2" /><path d="M9 2h6v5H9zM8 11h8M8 15h8M8 19h5" /></>,
  };
  return <svg className="" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Avatar({ person }) {
  const tone = AVATAR_TONES[(Number(String(person.id || "").split("-").pop()) || 0) % 5];
  return <span className={"avatar " + tone}>{person.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>;
}

// Attention text, identical to the embedded workspace queue.
export function attention(db, application, today = businessDay()) {
  const stage = application.stage;
  if (stage === "Pending Review") {
    const days = Math.max(0, Math.floor((new Date(today) - new Date(application.appliedDate)) / 86400000));
    return ["Resume waiting " + days + " days", application.priority === "High" ? "High priority" : "Review requirements and experience"];
  }
  if (stage === "Interview Results") return ["Feedback received", "Final decision required"];
  if (stage === "Offer") {
    const offer = application.offer || {};
    return offer.expiry < today ? ["Offer expired", "Review terms or close application"] : ["Offer expires " + formatDate(offer.expiry), offer.approval === "Approved" ? "Ready for candidate response" : "Approval required"];
  }
  if (stage === "Rejected") {
    const messages = (db.notifications || []).filter((note) => note.applicationId === application.id && (note.kind === "Rejected" || (!note.kind && (!application.retentionStartedAt || note.createdAt >= application.retentionStartedAt))));
    const has = (status) => messages.some((note) => note.status === status);
    const status = has("Sent") ? "Notification sent" : has("Uncertain") ? "Delivery needs checking" : has("Sending") ? "Notification sending" : has("Draft") ? "Notification draft prepared" : "Notification not prepared";
    return [status, application.rejectionConfirmed ? "Reason confirmed" : "Confirm rejection reason"];
  }
  if (stage === "Interview") return [(db.interviews || []).some((interview) => interview.applicationId === application.id && interview.status === "Scheduled") ? "Interview scheduled" : "Schedule required", "Awaiting interview"];
  return ["Offer accepted", "Hiring completed"];
}

function csvFile(headers, rows) {
  const cell = (value) => '"' + String(value ?? "").replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"';
  return "﻿" + [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}

export function ApplicationsPage() {
  const view = new URLSearchParams(useLocation().search).get("view") || "applications";
  const stage = stageForView(view);
  if (stage === undefined) return <Recruitment key="/applications" page="applications" title="Applications" />;
  return <Applications stage={stage} />;
}

export function Applications({ stage = "", fetcher }) {
  const { db, error, load, commit, request } = useWorkspace(fetcher, "/hr/applications");
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState("");
  const host = useRef(null);
  const filters = {
    q: params.get("q") || "",
    job: params.get("job") || "",
    priority: params.get("priority") || "",
    from: params.get("from") || "",
    to: params.get("to") || "",
  };
  const page = Math.max(1, Number(params.get("page")) || 1);
  const size = useViewportRows(host, db ? `${db.revision}-${stage}` : -1, 6);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 5500);
    return () => clearTimeout(timer);
  }, [toast]);

  const items = useMemo(() => {
    if (!db) return [];
    const q = filters.q.toLowerCase();
    return db.applications.filter((application) => {
      const person = candidateOf(db, application);
      const job = jobOf(db, application);
      return (!q || (person.name + " " + person.email + " " + job.title + " " + application.id).toLowerCase().includes(q))
        && (!filters.job || application.jobId === filters.job)
        && (!stage || application.stage === stage)
        && (!filters.priority || application.priority === filters.priority)
        && (!filters.from || application.appliedDate >= filters.from)
        && (!filters.to || application.appliedDate <= filters.to);
    });
  }, [db, stage, filters.q, filters.job, filters.priority, filters.from, filters.to]);

  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pages);
  const visible = items.slice((current - 1) * size, current * size);

  function update(changes, replace = false) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, String(value));
      else next.delete(key);
    }
    if (!("page" in changes)) next.delete("page");
    setParams(next, { replace });
  }
  function chooseStage(value) {
    const next = new URLSearchParams(params);
    next.delete("page");
    if (value) next.set("view", stagePath(value));
    else next.delete("view");
    navigate("/applications" + (next.toString() ? "?" + next : ""));
  }
  const open = (path) => "/applications?view=" + path;

  async function run(command, payload, message, after) {
    const result = await commit(command, payload);
    setDialog(null);
    setToast(message);
    after?.(result);
  }

  function exportList() {
    const rows = items.map((application) => [application.id, candidateOf(db, application).name, candidateOf(db, application).email, jobOf(db, application).title, application.stage, application.priority, application.appliedDate]);
    download(csvFile(["Application ID", "Candidate", "Email", "Position", "Stage", "Priority", "Applied Date"], rows), "JRS-Applications.csv", "text/csv;charset=utf-8");
    setToast("Exported " + items.length + " matching applications.");
  }

  // "Review" buttons open the dialog that fits the application's stage.
  function review(application) {
    if (application.stage === "Offer") return setDialog({ kind: "offer-review", id: application.id });
    if (application.stage === "Rejected") return setDialog({ kind: "rejection", id: application.id });
    if (application.stage === "Interview") {
      const meeting = db.interviews.find((interview) => interview.applicationId === application.id && interview.status === "Scheduled");
      return setDialog(meeting ? { kind: "details", interview: meeting } : { kind: "schedule", id: application.id });
    }
    setDialog({ kind: "application", id: application.id });
  }

  function interviewAction(kind, interview) {
    if (kind === "calendar") return download(interviewCalendar(db, interview), "JRS-Interview.ics", "text/calendar;charset=utf-8");
    setDialog({ kind: kind === "reschedule" ? "reschedule" : kind, interview });
  }

  function offerAction(kind, application) {
    if (kind === "approve-offer") {
      setDialog({ kind: "offer-review", id: application.id, busy: true });
      commit("approve-offer", { applicationId: application.id })
        .then(() => setDialog({ kind: "offer-review", id: application.id }))
        .catch((commandError) => { setDialog({ kind: "offer-review", id: application.id }); setToast(commandError.message); });
      return;
    }
    if (kind === "offer-message") {
      commit("offer-message", { applicationId: application.id })
        .then(() => { setDialog(null); setToast("Offer email draft prepared in Email Outbox."); })
        .catch((commandError) => setToast(commandError.message));
      return;
    }
    setDialog({ kind, id: application.id });
  }

  function rowActions(application) {
    const job = jobOf(db, application);
    const active = job.status === "Active";
    const details = <Link className="button secondary compact" to={open("candidate/" + application.candidateId + "/" + application.id)}>Details</Link>;
    const reject = <button type="button" className="button danger compact" onClick={() => setDialog({ kind: "reject", id: application.id })}>Reject</button>;
    const meeting = application.stage === "Interview" && db.interviews.find((interview) => interview.applicationId === application.id && interview.status === "Scheduled");
    if (application.stage === "Interview" && !meeting) {
      return <><button type="button" className="button primary compact" disabled={!active} onClick={() => setDialog({ kind: "schedule", id: application.id })}>Schedule Interview</button>{reject}{details}</>;
    }
    switch (application.stage) {
      case "Pending Review":
        return <><button type="button" className="button primary compact" disabled={!active} onClick={() => setDialog({ kind: "move-interview", id: application.id })}>Move to Interview</button>{reject}{details}</>;
      case "Interview":
        return <><button type="button" className="button primary compact" onClick={() => review(application)}>View Interview</button>{reject}{details}</>;
      case "Interview Results":
        return <><Link className="button primary compact" to={open("results/" + application.id)}>View Results</Link><button type="button" className="button secondary compact" disabled={!(active && application.feedback)} onClick={() => setDialog({ kind: "offer-edit", id: application.id })}>Prepare Offer</button>{reject}</>;
      case "Offer":
        return <><button type="button" className="button primary compact" onClick={() => review(application)}>Review Offer</button>{reject}{details}</>;
      case "Rejected":
        return <><button type="button" className="button secondary compact" onClick={() => review(application)}>Review Rejection</button>{details}</>;
      default:
        return <button type="button" className="button secondary compact" onClick={() => review(application)}>Details</button>;
    }
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

  const hasFilters = filters.job || filters.priority || filters.from || filters.to || filters.q;
  const showStage = !stage;
  const target = dialog?.id ? db.applications.find((application) => application.id === dialog.id) : null;
  const close = () => setDialog(null);

  return (
    <>
      <div className="hr-legacy fit-page applications-page" ref={host}>
        <section className="panel queue-panel fit-panel">
          <div className="section-heading queue-toolbar">
            <div className="queue-filters">
              <label className="search">
                <Svg name="search" />
                <input role="searchbox" value={filters.q} placeholder="Search applications" aria-label="Search applications" onChange={(event) => update({ q: event.target.value }, true)} />
              </label>
              <select aria-label="Filter by position" value={filters.job} onChange={(event) => update({ job: event.target.value })}>
                <option value="">All positions</option>
                {db.jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
              </select>
              <select aria-label="Filter application status" value={stage} onChange={(event) => chooseStage(event.target.value)}>
                <option value="">All statuses</option>
                {STAGES.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
            <div className="heading-actions">
              <button type="button" className="button secondary" onClick={exportList}><Svg name="download" />Export</button>
              <button type="button" className="button secondary" data-action="filters" onClick={() => setDialog({ kind: "filters" })}>Filters</button>
              <button type="button" className="button primary" onClick={() => setDialog({ kind: "receive" })}><Svg name="plus" />Receive Application</button>
            </div>
          </div>
          {hasFilters && (
            <div className="filter-strip">
              <span className="muted">{[filters.priority ? filters.priority + " priority" : "", filters.from ? "From " + formatDate(filters.from) : "", filters.to ? "To " + formatDate(filters.to) : ""].filter(Boolean).join(" · ")}</span>
              <button type="button" className="button text-button" onClick={() => update({ q: "", job: "", priority: "", from: "", to: "" })}>Clear filters</button>
            </div>
          )}
          {visible.length ? (
            <div className="table-scroll fit-body">
              <table className="application-table" aria-label="Applications">
                <thead>
                  <tr><th>APPLICANT</th><th>POSITION</th>{showStage && <th>STATUS</th>}<th>ATTENTION NEEDED</th><th className="align-right">ACTIONS</th></tr>
                </thead>
                <tbody>
                  {visible.map((application) => {
                    const person = candidateOf(db, application);
                    const [headline, detail] = attention(db, application);
                    return (
                      <tr key={application.id}>
                        <td>
                          <Link to={open(resumePath(application))} className="applicant-resume-link" aria-label={"View resume for " + person.name} title="View resume">
                            <div className="person"><Avatar person={person} /><div><strong>{person.name}</strong><small>{person.email}</small></div></div>
                          </Link>
                        </td>
                        <td className="muted">{jobOf(db, application).title}</td>
                        {showStage && <td><span className={"badge " + (TONES[application.stage] || "gray")}>{application.stage}</span></td>}
                        <td>{headline}<small className={application.priority === "High" ? "danger-text" : "muted"}>{detail}</small></td>
                        <td className="align-right"><div className="row-actions">{rowActions(application)}</div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty"><Svg name="file" /><h3>No applications found</h3><p>No applications match this queue and its filters.</p></div>
          )}
          <footer className="table-footer">
            <p>Showing {items.length ? (current - 1) * size + 1 : 0}–{Math.min(current * size, items.length)} of {items.length} applications</p>
            <div className="pagination">
              <button type="button" className="button secondary compact" disabled={current === 1} aria-label="Previous page" onClick={() => update({ page: current - 1 })}>Previous</button>
              <span>Page {current} of {pages}</span>
              <button type="button" className="button secondary compact" disabled={current >= pages} aria-label="Next page" onClick={() => update({ page: current + 1 })}>Next</button>
            </div>
          </footer>
        </section>
        <div className="applications-toast" role="status" hidden={!toast}>{toast}</div>
      </div>

      {dialog?.kind === "filters" && (
        <FiltersDialog db={db} filters={filters} onClose={close} onApply={(values) => { update(values); close(); }} />
      )}
      {dialog?.kind === "receive" && (
        <ReceiveForm db={db} onClose={close} onSubmit={(payload) => run("application-create", payload, "Application received.", (result) => navigate(open("review/" + result.application.id)))} />
      )}
      {dialog?.kind === "reject" && target && (
        <RejectForm db={db} application={target} onClose={close} onSubmit={(payload) => run("reject", payload, "Application rejected.")} />
      )}
      {(dialog?.kind === "move-interview" || dialog?.kind === "schedule") && target && (
        <ScheduleForm
          db={db}
          application={target}
          interview={null}
          title={dialog.kind === "move-interview" ? "Move to Interview" : undefined}
          onClose={close}
          onSubmit={(payload) => dialog.kind === "move-interview"
            ? run("move-interview", payload, "Interview scheduled. The application is now in Interview.")
            : run("schedule", payload, "Interview schedule saved.")}
        />
      )}
      {dialog?.kind === "details" && (
        <DetailsDialog db={db} interview={db.interviews.find((item) => item.id === dialog.interview.id) || dialog.interview} onAction={interviewAction} onClose={close} />
      )}
      {dialog?.kind === "reschedule" && (
        <ScheduleForm db={db} application={db.applications.find((item) => item.id === dialog.interview.applicationId)} interview={dialog.interview} onClose={close} onSubmit={(payload) => run("schedule", payload, "Interview schedule saved.")} />
      )}
      {dialog?.kind === "cancel" && (
        <CancelForm db={db} interview={dialog.interview} onClose={close} onSubmit={(payload) => run("cancel-interview", payload, "Interview cancelled.")} />
      )}
      {dialog?.kind === "feedback" && (
        <FeedbackForm db={db} interview={dialog.interview} onClose={close} onSubmit={(payload) => run("feedback", payload, "Feedback saved. The application is now in Interview Results.")} />
      )}
      {dialog?.kind === "offer-edit" && target && (
        <OfferForm db={db} application={target} onClose={close} onSubmit={(payload) => run("offer", payload, "Offer saved. Manager approval is required.")} />
      )}
      {dialog?.kind === "offer-review" && target?.offer && (
        <OfferReview db={db} application={target} busy={dialog.busy} onClose={close} onAction={(kind) => offerAction(kind, target)} />
      )}
      {dialog?.kind === "offer-accept" && target && (
        <AcceptForm db={db} application={target} onClose={close} onSubmit={(payload) => run("accept-offer", payload, "Acceptance recorded. The application is now Hired.")} />
      )}
      {dialog?.kind === "rejection" && target && (
        <RejectionReview db={db} application={target} onClose={close} onMessage={() => setDialog({ kind: "message", id: target.id })} onSubmit={(payload) => run("confirm-rejection", payload, "Changes saved.")} />
      )}
      {dialog?.kind === "message" && target && (
        <MessageForm db={db} application={target} request={request} onClose={close} onSubmit={(payload) => run("message", payload, "Email draft saved. No email has been sent.")} />
      )}
      {dialog?.kind === "application" && target && (
        <ApplicationDetails db={db} application={target} onClose={close} onInterview={(interview) => setDialog({ kind: "details", interview })} />
      )}
    </>
  );
}
