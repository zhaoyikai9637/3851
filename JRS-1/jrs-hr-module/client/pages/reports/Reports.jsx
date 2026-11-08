import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useOutletContext, useSearchParams } from "react-router-dom";
import { Download } from "lucide-react";
import { useViewportRows } from "../../src/useViewportRows";
import "./reports.css";

// Native React version of the recruitment Reports page (previously rendered by the
// embedded HR workspace). It reads the same workspace snapshot and uses the same
// command endpoint, so totals and task completion behave exactly as before.

export const STAGES = ["Pending Review", "Interview", "Interview Results", "Offer", "Rejected"];
const SECTIONS = [
  ["summary", "Overview"],
  ["jobs", "Job performance"],
  ["tasks", "Follow-up tasks"],
];
const TONE = { "Pending Review": "amber", Interview: "purple", "Interview Results": "purple", Offer: "green", Rejected: "red" };

async function readJson(response) {
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("The server response could not be read. Please refresh.");
  }
  if (!response.ok) {
    const error = new Error(data.error?.message || "Request failed.");
    error.status = response.status;
    error.code = data.error?.code;
    throw error;
  }
  return data;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value.length === 10 ? value + "T12:00:00+08:00" : value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Singapore", day: "2-digit", month: "short", year: "numeric" }).format(date);
}

// Same CSV rules as the legacy export: BOM for Excel, quoted cells, formula injection guarded.
export function reportCsv(db) {
  const cell = (value) => '"' + String(value ?? "").replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"';
  const header = ["Position", "Total applications", ...STAGES];
  const rows = db.jobs.map((job) => {
    const apps = db.applications.filter((item) => item.jobId === job.id);
    return [job.title, apps.length, ...STAGES.map((stage) => apps.filter((item) => item.stage === stage).length)];
  });
  return "﻿" + [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}

function Pager({ page, total, size, onChange }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (total <= size) return null;
  const first = (page - 1) * size + 1;
  return (
    <div className="report-pager">
      <span>Showing {first}–{Math.min(page * size, total)} of {total}</span>
      <div>
        <button className="btn btn-outline-secondary btn-sm" type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
        <span>Page {page} of {pages}</span>
        <button className="btn btn-outline-secondary btn-sm" type="button" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button>
      </div>
    </div>
  );
}

export function Reports({ fetcher = (...args) => fetch(...args) }) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  // Inside the HR workspace the section tabs live in the page header, like the other
  // pages with sections; rendered on its own (tests) the tabs stay in the page.
  const setSections = useOutletContext()?.setSections;
  const section = SECTIONS.some(([id]) => id === params.get("section")) ? params.get("section") : "summary";
  const [db, setDb] = useState(null);
  const [csrf, setCsrf] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [page, setPage] = useState(1);
  // Rows per page follow the space left in the window, so the page never needs scrolling.
  const host = useRef(null);
  const PAGE_SIZE = useViewportRows(host, db ? `${db.revision}-${section}` : -1, 6);

  const load = useCallback(async () => {
    try {
      const [me, workspace] = await Promise.all([
        fetcher("/recruitment/api/auth/me", { credentials: "same-origin" }).then(readJson),
        fetcher("/recruitment/api/hr/workspace", { credentials: "same-origin" }).then(readJson),
      ]);
      setCsrf(me.csrfToken || "");
      setDb(workspace);
      setError("");
    } catch (requestError) {
      if (requestError.status === 401) {
        window.location.assign("/pages/login/login.html?returnTo=" + encodeURIComponent("/hr/reports"));
        return;
      }
      setError(requestError.message);
    }
  }, [fetcher]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [section]);

  useEffect(() => {
    if (!setSections) return undefined;
    setSections({
      owner: location.key,
      label: "Report sections",
      items: SECTIONS.map(([id, label]) => ({ label, selected: id === section })),
      select(index) {
        const id = SECTIONS[index]?.[0];
        if (!id) return;
        const next = new URLSearchParams(window.location.search);
        if (id === "summary") next.delete("section");
        else next.set("section", id);
        setParams(next);
      },
    });
    return () => setSections(null);
  }, [setSections, location.key, section, setParams]);

  const stats = useMemo(() => {
    if (!db) return null;
    const total = db.applications.length;
    return {
      total,
      cards: [
        ["Applications", total],
        ["Active jobs", db.jobs.filter((job) => job.status === "Active").length],
        ["Scheduled interviews", db.interviews.filter((item) => item.status === "Scheduled").length],
      ],
      stages: STAGES.map((stage) => [stage, db.applications.filter((item) => item.stage === stage).length]),
      tasks: db.tasks.filter((task) => task.status === "Open"),
    };
  }, [db]);

  function chooseSection(id) {
    const next = new URLSearchParams(params);
    if (id === "summary") next.delete("section");
    else next.set("section", id);
    setParams(next);
  }

  function exportReport() {
    const blob = new Blob([reportCsv(db)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "JRS-Recruitment-Report.csv";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function completeTask(task) {
    setBusy(task.id);
    setNotice("");
    try {
      const result = await fetcher("/recruitment/api/hr/commands/complete-task", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
          "If-Match": String(db.revision),
          "Idempotency-Key": "request-" + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36)),
        },
        body: JSON.stringify({ id: task.id }),
      }).then(readJson);
      setDb(result.db);
      setNotice(`Task "${task.title}" completed.`);
    } catch (requestError) {
      if (requestError.code === "REVISION_CONFLICT") {
        await load();
        setNotice("Newer changes were loaded. Review the task list before trying again.");
      } else setNotice(requestError.message);
    } finally {
      setBusy("");
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
  if (!stats) return <p className="report-loading" role="status">Loading reports...</p>;

  const jobsPage = db.jobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const tasksPage = stats.tasks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="reports-page fit-page" ref={host}>
      <div className="report-heading">
        <button className="btn btn-primary" type="button" onClick={exportReport}><Download size={18} aria-hidden="true" />Export Report</button>
      </div>

      {!setSections && (
        <nav className="report-tabs" aria-label="Report sections">
          {SECTIONS.map(([id, label]) => (
            <button key={id} type="button" className={section === id ? "selected" : ""} aria-pressed={section === id} onClick={() => chooseSection(id)}>{label}</button>
          ))}
        </nav>
      )}

      {notice && <div className="alert alert-info" role="status">{notice}</div>}

      {section === "summary" && (
        <>
          <div className="report-stats">
            {stats.cards.map(([name, value]) => (
              <section className="report-card" key={name}>
                <p>{name}</p>
                <strong>{value}</strong>
              </section>
            ))}
          </div>
          <section className="report-card fit-panel">
            <h3>Applications by stage</h3>
            <div className="report-stage-bars fit-body">
              {stats.stages.map(([stage, count]) => (
                <div key={stage}>
                  <div className="report-stage-label"><span>{stage}</span><strong>{count}</strong></div>
                  <div className="report-bar-track" role="presentation">
                    <span className={"tone-" + (TONE[stage] || "gray")} style={{ width: (stats.total ? (count / stats.total) * 100 : 0) + "%" }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {section === "jobs" && (
        <section className="report-card flush fit-panel">
          <div className="table-responsive fit-body">
            <table className="report-table">
              <thead>
                <tr><th>Position</th><th>Applications</th><th>In review</th><th>Offers</th></tr>
              </thead>
              <tbody>
                {jobsPage.map((job) => {
                  const apps = db.applications.filter((item) => item.jobId === job.id);
                  return (
                    <tr key={job.id}>
                      <td>{job.title}</td>
                      <td>{apps.length}</td>
                      <td>{apps.filter((item) => item.stage === "Pending Review").length}</td>
                      <td>{apps.filter((item) => item.stage === "Offer").length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {db.jobs.length === 0 && <p className="report-empty">No job postings yet.</p>}
          <Pager page={page} total={db.jobs.length} size={PAGE_SIZE} onChange={setPage} />
        </section>
      )}

      {section === "tasks" && (
        <section className="report-card fit-panel">
          {stats.tasks.length === 0 ? (
            <div className="report-empty">
              <strong>No open tasks</strong>
              <p>Tasks created from candidate records appear here.</p>
            </div>
          ) : (
            <ul className="report-tasks fit-body">
              {tasksPage.map((task) => (
                <li key={task.id} data-fit-row>
                  <div>
                    <strong>{task.title}</strong>
                    <small>{task.assignee}{task.due ? " · " + formatDate(task.due) : ""}</small>
                  </div>
                  <button className="btn btn-outline-secondary btn-sm" type="button" disabled={busy === task.id} onClick={() => completeTask(task)}>
                    {busy === task.id ? "Completing..." : "Complete"}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Pager page={page} total={stats.tasks.length} size={PAGE_SIZE} onChange={setPage} />
        </section>
      )}
    </div>
  );
}
