import {formatDate} from '../../../../jrs-hr-module/shared/date-format.mjs';
import { BriefcaseBusiness, Clock3, MapPin, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { getApiError } from "../../api/client";
import { jobLabel } from "../../utils/jobLabels";

const initialFilters = {
  search: "",
  employmentType: "",
  location: "",
  experienceLevel: "",
};

export default function JobsPage({ authenticated = false }) {
  const [filters, setFilters] = useState(initialFilters);
  const [jobs, setJobs] = useState([]);
  const [options, setOptions] = useState({ departments: [], locations: [], workModes: [], experienceLevels: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadJobs(values) {
    setLoading(true);
    setError("");
    try {
      const params = Object.fromEntries(Object.entries(values).filter(([, value]) => value));
      const { data } = await api.get("/jobs", { params });
      setJobs(data.jobs);
      setOptions(data.filters);
    } catch (requestError) {
      setError(getApiError(requestError, "Unable to load current company openings."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadJobs(initialFilters);
  }, []);

  function updateFilter(event) {
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function handleSearch(event) {
    event.preventDefault();
    loadJobs(filters);
  }

  function handleReset() {
    setFilters(initialFilters);
    loadJobs(initialFilters);
  }

  return (
    <div className="page-stack">
      <section className="search-surface surface">
        <form className="job-search-form" onSubmit={handleSearch}>
          <label className="visually-hidden" htmlFor="job-search">Search roles</label>
          <div className="input-with-icon">
            <Search size={22} aria-hidden="true" />
            <input id="job-search" name="search" className="form-control form-control-lg" type="search" value={filters.search} onChange={updateFilter} maxLength={100} placeholder="Search by job title or skill" />
          </div>
          <button className="btn btn-primary btn-lg" type="submit">Search jobs</button>
        </form>
      </section>

      <div className="jobs-layout">
        <aside className="surface filters-panel">
          <div className="panel-title-row">
            <h2>Filters</h2>
            <SlidersHorizontal size={22} aria-hidden="true" />
          </div>

          <div className="filter-fields">
            <label className="form-label-group">
              <span>Employment type</span>
              <select className="form-select form-select-lg" name="employmentType" value={filters.employmentType} onChange={updateFilter}>
                <option value="">All employment types</option>
                <option value="FULL_TIME">Full-time</option>
                <option value="PART_TIME">Part-time</option>
              </select>
            </label>
            <label className="form-label-group">
              <span>Location</span>
              <select className="form-select form-select-lg" name="location" value={filters.location} onChange={updateFilter}>
                <option value="">All locations</option>
                {options.locations.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="form-label-group">
              <span>Experience required</span>
              <select className="form-select form-select-lg" name="experienceLevel" value={filters.experienceLevel} onChange={updateFilter}>
                <option value="">All experience levels</option>
                <option value="YEARS_1_3">1-3 years</option>
                <option value="YEARS_3_5">3-5 years</option>
                <option value="YEARS_5_7">5-7 years</option>
              </select>
            </label>
          </div>

          <div className="filter-buttons">
            <button className="btn btn-primary" type="button" onClick={() => loadJobs(filters)}>Apply filters</button>
            <button className="btn btn-outline-secondary" type="button" onClick={handleReset}>Reset</button>
          </div>
        </aside>

        <section className="jobs-results" aria-live="polite">
          {loading && <div role="status"><span className="spinner-border text-primary" aria-hidden="true" /><span className="visually-hidden">Loading jobs...</span></div>}

          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          {!loading && !error && jobs.length === 0 && (
            <div className="empty-state surface">
              <Search size={34} aria-hidden="true" />
              <h3>No matching roles</h3>
              <p>Try a broader search or reset the filters.</p>
              <button className="btn btn-outline-primary" type="button" onClick={handleReset}>Reset filters</button>
            </div>
          )}

          <div className="job-list">
            {jobs.map((job) => (
              <article className="job-card surface" key={job.id}>
                <div className="job-card-main">
                  <div className="job-title-row">
                    <div>
                      <h3>{job.title}</h3>
                    </div>
                    <span className="job-type">{jobLabel(job.employmentType)}</span>
                  </div>
                  <p className="job-summary">{job.summary}</p>
                  <div className="job-meta-list">
                    <span><MapPin size={18} />{job.location}</span>
                    <span><BriefcaseBusiness size={18} />{jobLabel(job.experienceLevel)}</span>
                    {job.closingDate && <span><Clock3 size={18} />Closes {formatDate(job.closingDate)}</span>}
                  </div>
                </div>
                <div className="job-card-action">
                  <Link className="btn btn-outline-primary btn-lg" to={(authenticated ? "/applicant/jobs/" : "/jobs/") + job.id}>View details</Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
