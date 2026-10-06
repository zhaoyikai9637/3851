import { BriefcaseBusiness, Building2, Clock3, MapPin, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { getApiError } from "../../api/client";

const initialFilters = {
  search: "",
  department: "",
  location: "",
  workMode: "",
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
        <div className="section-heading compact">
          <p className="eyebrow text-primary">{authenticated ? "APPLICANT JOB SEARCH" : "COMPANY VACANCIES"}</p>
          <h2>{authenticated ? "Find a suitable role" : "Explore open roles"}</h2>
          <p>{authenticated ? "Choose the one role that best matches your skills and experience." : "Search current opportunities and review the requirements before signing in."}</p>
        </div>

        <form className="job-search-form" onSubmit={handleSearch}>
          <label className="visually-hidden" htmlFor="job-search">Search roles</label>
          <div className="input-with-icon">
            <Search size={22} aria-hidden="true" />
            <input id="job-search" name="search" className="form-control form-control-lg" type="search" value={filters.search} onChange={updateFilter} maxLength={100} placeholder="Search by job title, skill, or department" />
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
              <span>Department</span>
              <select className="form-select form-select-lg" name="department" value={filters.department} onChange={updateFilter}>
                <option value="">All departments</option>
                {options.departments.map((value) => <option key={value} value={value}>{value}</option>)}
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
              <span>Work mode</span>
              <select className="form-select form-select-lg" name="workMode" value={filters.workMode} onChange={updateFilter}>
                <option value="">All work modes</option>
                {options.workModes.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="form-label-group">
              <span>Experience level</span>
              <select className="form-select form-select-lg" name="experienceLevel" value={filters.experienceLevel} onChange={updateFilter}>
                <option value="">All experience levels</option>
                {options.experienceLevels.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>

          <div className="filter-buttons">
            <button className="btn btn-primary" type="button" onClick={() => loadJobs(filters)}>Apply filters</button>
            <button className="btn btn-outline-secondary" type="button" onClick={handleReset}>Reset</button>
          </div>
        </aside>

        <section className="jobs-results" aria-live="polite">
          <div className="results-heading">
            <div>
              <p className="eyebrow">CURRENT VACANCIES</p>
              <h2>{loading ? "Finding roles..." : jobs.length + " role" + (jobs.length === 1 ? "" : "s") + " available"}</h2>
            </div>
            <span className="results-note">Applications close on the date shown</span>
          </div>

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
                      <span className="department-badge">{job.department}</span>
                      <h3>{job.title}</h3>
                    </div>
                    <span className="job-type">{job.employmentType}</span>
                  </div>
                  <p className="job-summary">{job.summary}</p>
                  <div className="job-meta-list">
                    <span><MapPin size={18} />{job.location}</span>
                    <span><Building2 size={18} />{job.workMode}</span>
                    <span><BriefcaseBusiness size={18} />{job.experienceLevel}</span>
                    <span><Clock3 size={18} />Closes {new Date(job.closingDate + "T00:00:00").toLocaleDateString("en-SG", { day: "numeric", month: "short" })}</span>
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
