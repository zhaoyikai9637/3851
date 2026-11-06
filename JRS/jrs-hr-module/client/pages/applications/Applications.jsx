import { useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useViewportRows } from "../../src/useViewportRows";
import { Recruitment } from "../recruitment/Recruitment";
import { download, resumePath } from "../recruitment/dialogs";
import { candidateOf, formatDate, jobOf, useWorkspace } from "../recruitment/workspaceClient";
import { Toast, useApplicationActions } from "./actions";
import { businessDay, FiltersDialog } from "./dialogs";
import { Avatar, Badge, Empty, LegacyIcon, useReturnPath } from "./legacy";
import { Review } from "./Review";
import "./applications.css";

// Native React Applications list. It renders the same markup as the embedded
// workspace queue inside .hr-legacy (styled by the scoped copy of the legacy
// stylesheets), so it looks identical. Resume review, interview results and
// the candidate profile still opens in the embedded workspace through ?view=;
// resume review and interview results are native (Review.jsx).

export const STAGES = ["Pending Review", "Interview", "Interview Results", "Offer", "Rejected", "Hired"];
export const stagePath = (stage) => "applications" + (stage ? "/" + (stage === "Pending Review" ? "pending-review" : stage.toLowerCase().replaceAll(" ", "-")) : "");

// "" for the full queue, the stage for a stage queue, undefined for any other view.
export function stageForView(view) {
  if (!view || view === "applications") return "";
  const match = /^applications\/([a-z-]+)$/.exec(view);
  if (!match) return undefined;
  const slug = match[1] === "applications-review" ? "pending-review" : match[1];
  return STAGES.find((stage) => stagePath(stage) === "applications/" + slug);
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
  return "\ufeff" + [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}

export function ApplicationsPage() {
  const view = new URLSearchParams(useLocation().search).get("view") || "applications";
  const stage = stageForView(view);
  const detail = /^(review|results)\/([A-Za-z0-9_-]+)$/.exec(view);
  if (detail) return <Review key={view} id={detail[2]} results={detail[1] === "results"} />;
  if (stage === undefined) return <CandidateFromApplications />;
  return <Applications stage={stage} />;
}

// The candidate profile still opens in the embedded workspace, with a way back.
function CandidateFromApplications() {
  const [back, label] = useReturnPath();
  return (
    <>
      <Link className="btn btn-outline-secondary mb-3" to={back}>{label}</Link>
      <Recruitment key="/applications" page="applications" title="Applications" />
    </>
  );
}

export function Applications({ stage = "", fetcher }) {
  const workspace = useWorkspace(fetcher, "/hr/applications");
  const { db, error, load } = workspace;
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  // Detail pages return to this exact queue, filters and page included.
  const from = { from: location.pathname + location.search };
  const [filtersOpen, setFiltersOpen] = useState(false);
  const open = (path) => "/applications?view=" + path;
  const { act, elements, toast, setToast } = useApplicationActions({ workspace, onCreated: (application) => navigate(open("review/" + application.id)) });
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

  // Clearing returns to the full queue: every filter, including the status, is reset.
  function clearFilters() {
    navigate("/applications");
  }

  function exportList() {
    const rows = items.map((application) => [application.id, candidateOf(db, application).name, candidateOf(db, application).email, jobOf(db, application).title, application.stage, application.priority, application.appliedDate]);
    download(csvFile(["Application ID", "Candidate", "Email", "Position", "Stage", "Priority", "Applied Date"], rows), "JRS-Applications.csv", "text/csv;charset=utf-8");
    setToast("Exported " + items.length + " matching applications.");
  }

  function rowActions(application) {
    const active = jobOf(db, application).status === "Active";
    const details = <Link className="button secondary compact" to={open("candidate/" + application.candidateId + "/" + application.id)} state={from}>Details</Link>;
    const blocked = active ? undefined : "Activate this job to progress the application";
    const reject = <button type="button" className="button danger compact" onClick={() => act("reject", application)}>Reject</button>;
    const meeting = application.stage === "Interview" && db.interviews.find((interview) => interview.applicationId === application.id && interview.status === "Scheduled");
    if (application.stage === "Interview" && !meeting) {
      return <><button type="button" className="button primary compact" disabled={!active} title={blocked} onClick={() => act("schedule", application)}>Schedule Interview</button>{reject}{details}</>;
    }
    switch (application.stage) {
      case "Pending Review":
        return <><button type="button" className="button primary compact" disabled={!active} title={blocked} onClick={() => act("move-interview", application)}>Move to Interview</button>{reject}{details}</>;
      case "Interview":
        return <><button type="button" className="button primary compact" onClick={() => act("review", application)}>View Interview</button>{reject}{details}</>;
      case "Interview Results":
        return <><Link className="button primary compact" to={open("results/" + application.id)} state={from}>View Results</Link><button type="button" className="button secondary compact" disabled={!(active && application.feedback)} title={blocked || (application.feedback ? undefined : "Record interview feedback first")} onClick={() => act("offer-edit", application)}>Prepare Offer</button>{reject}{details}</>;
      case "Offer":
        return <><button type="button" className="button primary compact" onClick={() => act("review", application)}>Review Offer</button>{reject}{details}</>;
      case "Rejected":
        return <><button type="button" className="button secondary compact" onClick={() => act("review", application)}>Review Rejection</button>{details}</>;
      default:
        return <button type="button" className="button secondary compact" onClick={() => act("review", application)}>Details</button>;
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
  const activeFilters = [
    stage ? "Status: " + stage : "",
    filters.q ? "Search “" + filters.q + "”" : "",
    filters.job ? db.jobs.find((job) => job.id === filters.job)?.title || "Selected position" : "",
    filters.priority ? filters.priority + " priority" : "",
    filters.from ? "From " + formatDate(filters.from) : "",
    filters.to ? "To " + formatDate(filters.to) : "",
  ].filter(Boolean);
  const showStage = !stage;

  return (
    <>
      <div className="hr-legacy fit-page applications-page" data-page="applications" ref={host}>
        <section className="panel queue-panel fit-panel">
          <div className="section-heading queue-toolbar">
            <div className="queue-filters">
              <label className="search">
                <LegacyIcon name="search" />
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
              <button type="button" className="button secondary" onClick={exportList}><LegacyIcon name="download" />Export</button>
              <button type="button" className="button secondary" data-action="filters" onClick={() => setFiltersOpen(true)}>Filters</button>
              <button type="button" className="button primary" onClick={() => act("receive")}><LegacyIcon name="plus" />Receive Application</button>
            </div>
          </div>
          {(hasFilters || stage) && (
            <div className="filter-strip">
              <span className="muted">{activeFilters.join(" · ")}</span>
              <button type="button" className="button text-button" onClick={clearFilters}>Clear filters</button>
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
                          <Link to={open(resumePath(application))} state={from} className="applicant-resume-link" aria-label={"View resume for " + person.name} title="View resume">
                            <div className="person"><Avatar person={person} /><div><strong>{person.name}</strong><small>{person.email}</small></div></div>
                          </Link>
                        </td>
                        <td className="muted">{jobOf(db, application).title}</td>
                        {showStage && <td><Badge status={application.stage} /></td>}
                        <td>{headline}<small className={application.priority === "High" ? "danger-text" : "muted"}>{detail}</small></td>
                        <td className="align-right"><div className="row-actions">{rowActions(application)}</div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="No applications found" detail="No applications match this queue and its filters." />
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
      </div>
      <Toast message={toast} />
      {filtersOpen && <FiltersDialog db={db} filters={filters} onClose={() => setFiltersOpen(false)} onApply={(values) => { update(values); setFiltersOpen(false); }} />}
      {elements}
    </>
  );
}
