import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorBox, Loading } from "../../src/shared";
import { Icon } from "../../src/icons";
import { createJobsClient } from "./api";
import { displayDate } from "./model";
import { JobDetails } from "./JobDetails";
import {useViewportRows} from '../../src/useViewportRows';
import "./jobs.css";

export function JobPostings() {
  const [client] = useState(() => createJobsClient()),
    navigate = useNavigate();
  const [data, setData] = useState(null),
    [error, setError] = useState(null),
    [details, setDetails] = useState(null);
  const list=useRef(null),trigger=useRef(null),pageSize=useViewportRows(list,data);
  useEffect(()=>{if(!details)trigger.current?.focus();},[details]);
  const [search, setSearch] = useState(""),
    [department, setDepartment] = useState(""),
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
    departments = [
      ...new Set([...items.map((job) => job.department), department].filter(Boolean)),
    ].sort(),
    filtered = items.filter(
      (job) =>
        (status === "All" || job.status === status) &&
        (!department || job.department === department) &&
        `${job.title} ${job.department} ${job.location}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize)),
    current = Math.min(page, pages),
    visible = filtered.slice((current - 1) * pageSize, current * pageSize);
  const selected = details?.id ? items.find((job) => job.id === details.id) : null;
  async function refresh() {
    const latest = await client.load();
    setData(latest);
    setError(null);
  }
  async function save(payload) {
    const latest = await client.save(payload, data.revision);
    setData(latest);
  }
  async function changeStatus(id, next) {
    const latest = await client.status(id, next, data.revision);
    setData(latest);
  }
  function open(id) {
    trigger.current=document.activeElement;
    setDetails({ id });
  }
  return (
    <>
    <div className="jobs-workspace" ref={list} hidden={!!details}>
      <div className="jobs-toolbar" role="toolbar" aria-label="Job filters and actions">
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
        <label className="jobs-filter">
          <span className="visually-hidden">Filter by department</span>
          <select
            value={department}
            disabled={!data}
            onChange={(event) => {
              setDepartment(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All departments</option>
            {departments.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="jobs-filter">
          <span className="visually-hidden">Filter by recruitment status</span>
          <select
            value={status}
            disabled={!data}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            {["All", "Active", "Draft", "Closed", "Stopped"].map((value) => (
              <option key={value} value={value}>
                {value === "All" ? "All statuses" : value}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="job-primary" disabled={!data} onClick={() => open(null)}>
          <Icon name="plus" />
          Create job
        </button>
      </div>
      <ErrorBox error={error} retry={() => refresh().catch(setError)} />
      {!data && !error ? (
        <Loading />
      ) : (
        data && (
          <section className="jobs-table-panel">
            <div className="jobs-table-scroll">
              <table className="jobs-table" aria-label="Job postings">
                <thead>
                  <tr>
                    <th>Position</th>
                    <th>Status</th>
                    <th>Applications</th>
                    <th>Salary range</th>
                    <th>Application deadline</th>
                    <th>
                      Actions
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
                          View job
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
                  onClick={() =>
                    items.length
                      ? (setSearch(""), setStatus("All"), setDepartment(""), setPage(1))
                      : open(null)
                  }
                >
                  {items.length ? "Clear filters" : "Create your first job"}
                </button>
              </div>
            )}
            <footer className="jobs-table-footer">
              <span>
                {filtered.length
                  ? `${(current - 1) * pageSize + 1}–${Math.min(current * pageSize, filtered.length)} of ${filtered.length} jobs`
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
                  Page {current} of {pages}
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
    </div>
      {details && (
        <JobDetails
          key={details.id || "new"}
          job={selected}
          templates={data.templates}
          onClose={() => setDetails(null)}
          onSave={save}
          onStatus={changeStatus}
          onRefresh={refresh}
          onApplications={(id) => navigate(`/applications?job=${encodeURIComponent(id)}`)}
        />
      )}
    </>
  );
}
