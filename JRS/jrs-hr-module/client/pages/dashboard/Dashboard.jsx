import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "../../src/icons";
import { candidateOf, formatDate, initials, jobOf, useWorkspace } from "../recruitment/workspaceClient";
import "../jobs/jobs.css";
import "./dashboard.css";

// Native React Dashboard (previously rendered by the embedded HR workspace).
// Same figures and links as before; it only reads the workspace snapshot.

const PAGE_SIZE = 7;
const TONE = { "Pending Review": "amber", Interview: "purple", "Interview Results": "purple", Offer: "green", Rejected: "red", Hired: "green" };
const ACCENTS = ["blue", "purple", "green"];

// Singapore business day, offset by whole days (same rule as the embedded workspace).
export function businessDay(offset = 0, now = Date.now()) {
  return new Date(now + 8 * 3600000 + offset * 86400000).toISOString().slice(0, 10);
}

export function StageBadge({ stage }) {
  return <span className={`stage-badge tone-${TONE[stage] || "gray"}`}>{stage}</span>;
}

export function Dashboard({ fetcher, now }) {
  const { db, error, load } = useWorkspace(fetcher, "/hr/dashboard");
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState("today");
  const page = Math.max(1, Number(params.get("page")) || 1);

  const summary = useMemo(() => {
    if (!db) return null;
    const clock = now ?? Date.now();
    const today = businessDay(0, clock);
    const weekEnd = businessDay(6, clock);
    const scheduled = db.interviews
      .filter((item) => item.status === "Scheduled")
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    return {
      today: scheduled.filter((item) => item.date === today),
      week: scheduled.filter((item) => item.date >= today && item.date <= weekEnd),
      next: scheduled.find((item) => new Date(`${item.date}T${item.time}:00+08:00`).getTime() > clock),
      recent: [...db.applications].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "") || b.id.localeCompare(a.id)),
    };
  }, [db, now]);

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        {error}{" "}
        <button className="btn btn-link p-0 align-baseline" type="button" onClick={load}>Try again</button>
      </div>
    );
  }
  if (!db || !summary) return <div className="loading-state" role="status"><span className="spinner-border spinner-border-sm" aria-hidden="true" /> Loading…</div>;

  const pages = Math.max(1, Math.ceil(summary.recent.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = summary.recent.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const periodItems = period === "today" ? summary.today : summary.week;
  const applicationOf = (interview) => db.applications.find((item) => item.id === interview.applicationId);

  function goToPage(value) {
    const next = new URLSearchParams(params);
    if (value <= 1) next.delete("page");
    else next.set("page", String(value));
    setParams(next);
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-actions">
        <button type="button" className="job-primary" onClick={() => navigate("/job-postings?create=1")}>
          <Icon name="plus" />
          Create Job Posting
        </button>
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-panel dashboard-performance" aria-labelledby="dashboard-performance">
          <h2 id="dashboard-performance">Job Post Performance</h2>
          {db.jobs.length === 0 ? (
            <p className="subtle mb-0">No job postings yet.</p>
          ) : (
            <div className="dashboard-job-stats">
              {db.jobs.slice(0, 3).map((job, index) => {
                const count = db.applications.filter((item) => item.jobId === job.id).length;
                return (
                  <div className="dashboard-job-stat" key={job.id}>
                    <span className={`dashboard-disc tone-${ACCENTS[index]}`} aria-hidden="true"><Icon name={index === 2 ? "reports" : "jobs"} /></span>
                    <span>
                      <strong>{job.title}</strong>
                      <small>{count} applications</small>
                    </span>
                    <b>{count}</b>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="dashboard-panel dashboard-overview" aria-labelledby="dashboard-overview">
          <div className="dashboard-panel-heading">
            <h2 id="dashboard-overview">Interview Overview</h2>
            <Link to="/interviews">View calendar →</Link>
          </div>
          <div className="dashboard-interview-stats">
            <span className="dashboard-disc tone-purple" aria-hidden="true"><Icon name="calendar" /></span>
            <div><small>TODAY</small><strong>{summary.today.length}</strong></div>
            <div><small>NEXT 7 DAYS</small><strong>{summary.week.length}</strong></div>
            <div className="dashboard-next">
              <small>NEXT</small>
              <b>{summary.next ? summary.next.time : "—"}</b>
              <small>{summary.next ? candidateOf(db, applicationOf(summary.next)).name : "No upcoming interview"}</small>
            </div>
          </div>
        </section>

        <section className="dashboard-panel dashboard-recent flush" aria-labelledby="dashboard-recent">
          <div className="dashboard-panel-heading padded">
            <h2 id="dashboard-recent">Recent Applications</h2>
            <Link to="/applications">View all applications →</Link>
          </div>
          {visible.length === 0 ? (
            <p className="subtle dashboard-empty-line">No applications yet.</p>
          ) : (
            <div className="jobs-table-scroll">
              <table className="jobs-table" aria-label="Recent applications">
                <thead>
                  <tr><th>Candidate</th><th>Position</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {visible.map((application) => {
                    const person = candidateOf(db, application);
                    const job = jobOf(db, application);
                    return (
                      <tr key={application.id}>
                        <td>
                          <span className="person-cell">
                            <span className="avatar" aria-hidden="true">{initials(person.name)}</span>
                            <span><strong>{person.name}</strong>{person.email && <small className="d-block subtle">{person.email}</small>}</span>
                          </span>
                        </td>
                        <td>{job.title}<small className="d-block subtle">{[job.department, job.type].filter(Boolean).join(" · ")}</small></td>
                        <td><StageBadge stage={application.stage} /></td>
                        <td>
                          <button type="button" className="job-secondary" aria-label={`View application from ${person.name}`} onClick={() => navigate(`/applications?view=candidate/${application.candidateId}/${application.id}`)}>View</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <footer className="jobs-table-footer">
            <span>{summary.recent.length ? `Showing ${(current - 1) * PAGE_SIZE + 1}–${Math.min(current * PAGE_SIZE, summary.recent.length)} of ${summary.recent.length} recent applications` : "0 recent applications"}</span>
            <nav aria-label="Recent application pages">
              <button type="button" className="job-secondary" disabled={current <= 1} onClick={() => goToPage(current - 1)}>Previous</button>
              <span>Page {current} of {pages}</span>
              <button type="button" className="job-secondary" disabled={current >= pages} onClick={() => goToPage(current + 1)}>Next</button>
            </nav>
          </footer>
        </section>

        <section className="dashboard-panel dashboard-schedule" aria-labelledby="dashboard-schedule">
          <h2 id="dashboard-schedule">Interview Schedule</h2>
          <p className="subtle">Manage upcoming candidate interviews</p>
          <div className="dashboard-segmented" role="group" aria-label="Schedule period">
            <button type="button" aria-pressed={period === "today"} className={period === "today" ? "selected" : ""} onClick={() => setPeriod("today")}>Today · {summary.today.length}</button>
            <button type="button" aria-pressed={period === "week"} className={period === "week" ? "selected" : ""} onClick={() => setPeriod("week")}>Next 7 days · {summary.week.length}</button>
          </div>
          {periodItems.length ? (
            periodItems.slice(0, 3).map((interview) => {
              const application = applicationOf(interview);
              return (
                <div key={interview.id}>
                  <p className="dashboard-day">{formatDate(interview.date)}</p>
                  <button type="button" className="dashboard-interview-card" onClick={() => navigate(`/interviews?status=&interview=${encodeURIComponent(interview.id)}`)}>
                    <span className="dashboard-time">{interview.time}<small>{interview.duration} MIN</small></span>
                    <span>
                      <strong>{candidateOf(db, application).name}</strong>
                      <small>{jobOf(db, application).title} · {interview.duration} min</small>
                      <small>{interview.format} · {interview.location}</small>
                    </span>
                  </button>
                </div>
              );
            })
          ) : (
            <div className="dashboard-empty">
              <Icon name="calendar" />
              <strong>No interviews scheduled</strong>
              <p>{db.applications.some((item) => item.stage === "Interview") ? "Schedule a candidate from the Interview queue." : "Move a candidate to Interview to start scheduling."}</p>
            </div>
          )}
          <Link className="job-secondary dashboard-full" to="/interviews">View Full Calendar</Link>
        </section>
      </div>
    </div>
  );
}
