import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorBox, Loading } from "../../src/shared";
import { Icon } from "../../src/icons";
import { createJobsClient } from "./api";
import { displayDate } from "./model";
import { JobDrawer } from "./JobDrawer";
import "./jobs.css";

export function JobPostings() {
  const [client] = useState(() => createJobsClient()),
    navigate = useNavigate();
  const [data, setData] = useState(null),
    [error, setError] = useState(null),
    [drawer, setDrawer] = useState(null),
    [notice, setNotice] = useState("");
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("All"),
    [page, setPage] = useState(1);
  useEffect(() => {
    const controller = new AbortController();
    client
      .load(controller.signal)
      .then(setData)
      .catch((error) => {
        if (error.name !== "AbortError") setError(error);
      });
    return () => controller.abort();
  }, [client]);
  const items = data?.items || [],
    filtered = items.filter(
      (job) =>
        (status === "All" || job.status === status) &&
        `${job.title} ${job.department} ${job.location}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / 10)),
    current = Math.min(page, pages),
    visible = filtered.slice((current - 1) * 10, current * 10);
  const selected = drawer?.id ? items.find((job) => job.id === drawer.id) : null;
  async function refresh() {
    const latest = await client.load();
    setData(latest);
    setError(null);
  }
  async function save(payload) {
    const latest = await client.save(payload, data.revision);
    setData(latest);
    setNotice("Job saved.");
  }
  async function changeStatus(id, next) {
    const latest = await client.status(id, next, data.revision);
    setData(latest);
    setNotice(next === "Closed" ? "Job closed." : "Job reopened.");
  }
  function open(id) {
    setNotice("");
    setDrawer({ id });
  }
  return (
    <div className="jobs-workspace">
      <header className="jobs-page-heading">
        <div>
          <h1>Job Postings</h1>
          <div className="jobs-heading-counts">
            <span>
              <i className="jobs-live-dot" />
              {items.filter((job) => job.status === "Active").length} active
            </span>
            <span>{items.filter((job) => job.status === "Draft").length} drafts</span>
            <span>{items.filter((job) => job.status === "Closed").length} closed</span>
          </div>
        </div>
        <button type="button" className="job-primary" disabled={!data} onClick={() => open(null)}>
          <Icon name="plus" />
          Create job
        </button>
      </header>
      {notice && (
        <div className="jobs-save-notice" role="status">
          {notice}
          <button type="button" aria-label="Dismiss notification" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}
      <ErrorBox error={error} retry={() => refresh().catch(setError)} />
      {!data && !error ? (
        <Loading />
      ) : (
        data && (
          <section className="jobs-table-panel">
            <div className="jobs-toolbar">
              <div className="jobs-status-filters" role="group" aria-label="Filter job status">
                {["All", "Active", "Draft", "Closed"].map((value) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={status === value}
                    onClick={() => {
                      setStatus(value);
                      setPage(1);
                    }}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <label className="jobs-search">
                <Icon name="search" />
                <input
                  type="search"
                  aria-label="Search jobs"
                  placeholder="Search jobs"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                />
              </label>
            </div>
            <div className="jobs-table-scroll">
              <table className="jobs-table" aria-label="Job postings">
                <thead>
                  <tr>
                    <th>Position</th>
                    <th>Status</th>
                    <th>Applications</th>
                    <th>Salary range</th>
                    <th>Closing date</th>
                    <th>
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((job) => (
                    <tr key={job.id}>
                      <td>
                        <button
                          type="button"
                          className="job-title-button"
                          aria-label={`View ${job.title}`}
                          onClick={() => open(job.id)}
                        >
                          {job.title}
                        </button>
                        <div className="job-row-meta">
                          {job.department}
                          <span>·</span>
                          {job.location}
                          <span>·</span>
                          {job.type}
                        </div>
                      </td>
                      <td>
                        <span className={`job-status job-status-${job.status.toLowerCase()}`}>
                          {job.status}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="job-application-count"
                          aria-label={`View ${job.applications} applications for ${job.title}`}
                          onClick={() =>
                            navigate(`/applications?job=${encodeURIComponent(job.id)}`)
                          }
                        >
                          {job.applications}
                          <span aria-hidden="true">↗</span>
                        </button>
                      </td>
                      <td>{job.salaryRange || <span className="job-unset">Not set</span>}</td>
                      <td className="job-closing-date">
                        {displayDate(job.closingDate) || <span className="job-unset">Not set</span>}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="job-row-open"
                          aria-label={`Open ${job.title} details`}
                          onClick={() => open(job.id)}
                        >
                          View<span aria-hidden="true"> →</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!visible.length && (
              <div className="jobs-empty">
                <Icon name="jobs" />
                <h2>{items.length ? "No matching jobs" : "No job postings yet"}</h2>
                <button
                  type="button"
                  className="job-secondary"
                  onClick={() => (items.length ? (setSearch(""), setStatus("All")) : open(null))}
                >
                  {items.length ? "Clear filters" : "Create your first job"}
                </button>
              </div>
            )}
            <footer className="jobs-table-footer">
              <span>
                {filtered.length
                  ? `${(current - 1) * 10 + 1}–${Math.min(current * 10, filtered.length)} of ${filtered.length} jobs`
                  : "0 jobs"}
              </span>
              <nav aria-label="Job result pages">
                <button
                  type="button"
                  className="job-secondary"
                  disabled={current === 1}
                  onClick={() => setPage(current - 1)}
                >
                  Previous
                </button>
                <span>
                  {current} / {pages}
                </span>
                <button
                  type="button"
                  className="job-secondary"
                  disabled={current === pages}
                  onClick={() => setPage(current + 1)}
                >
                  Next
                </button>
              </nav>
            </footer>
          </section>
        )
      )}
      {drawer && (
        <JobDrawer
          key={drawer.id || "new"}
          job={selected}
          templates={data.templates}
          onClose={() => setDrawer(null)}
          onSave={save}
          onStatus={changeStatus}
          onRefresh={refresh}
          onApplications={(id) => navigate(`/applications?job=${encodeURIComponent(id)}`)}
        />
      )}
    </div>
  );
}
