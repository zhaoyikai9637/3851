import { ArrowLeft, BriefcaseBusiness, CalendarDays, CheckCircle2, CircleDollarSign, LogIn, MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api, { getApiError } from "../../api/client";

export default function JobDetailsPage({ authenticated = false }) {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [confirmed, setConfirmed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/jobs/" + jobId)
      .then(({ data }) => setJob(data.job))
      .catch((requestError) => setError(getApiError(requestError, "Unable to load this role.")))
      .finally(() => setLoading(false));
  }, [jobId]);

  const readyToApply = useMemo(
    () => authenticated && job && confirmed.length === job.requirements.length,
    [authenticated, confirmed, job],
  );

  function toggleRequirement(index) {
    setConfirmed((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index]);
  }

  if (loading) return <div className="full-page-message inline"><div className="spinner-border text-primary" /><p>Loading role details...</p></div>;
  if (error || !job) return <div className="alert alert-danger" role="alert">{error || "Role not found."}</div>;

  return (
    <div className="page-stack role-details-page">
      <Link className="back-link" to={authenticated ? "/applicant/jobs" : "/jobs"}><ArrowLeft size={20} />Back to jobs</Link>

      <section className="role-header surface">
        <div>
          <span className="department-badge">{job.department}</span>
          <h2>{job.title}</h2>
          <p>{job.summary}</p>
          <div className="job-meta-list prominent">
            <span><MapPin size={19} />{job.location}</span>
            <span><BriefcaseBusiness size={19} />{job.workMode} | {job.employmentType}</span>
            <span><CalendarDays size={19} />Apply by {new Date(job.closingDate + "T00:00:00").toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" })}</span>
            <span><CircleDollarSign size={19} />{job.salaryRange}</span>
          </div>
        </div>
        {authenticated ? (
          <button className="btn btn-primary btn-lg" type="button" disabled={!readyToApply || !job.isOpen} onClick={() => navigate("/applicant/apply/" + job.id)}>
            {job.isOpen ? "Apply for this role" : "Applications closed"}
          </button>
        ) : (
          <Link className={"btn btn-primary btn-lg " + (!job.isOpen ? "disabled" : "")} to={"/connect?returnTo=" + encodeURIComponent("/applicant/jobs/" + job.id)}>
            <LogIn size={20} />
            {job.isOpen ? "Sign in to apply" : "Applications closed"}
          </Link>
        )}
      </section>

      <div className="role-content-grid">
        <div className="role-information surface">
          <section>
            <h3>What you will do</h3>
            <ul className="detail-list">
              {job.responsibilities.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
          <section>
            <h3>Required qualifications</h3>
            <ul className="detail-list check-list">
              {job.requirements.map((item) => <li key={item}><CheckCircle2 size={20} />{item}</li>)}
            </ul>
          </section>
          <section>
            <h3>Preferred qualifications</h3>
            <ul className="detail-list">
              {job.preferredQualifications.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
          <section>
            <h3>Benefits and hiring process</h3>
            <ul className="detail-list">
              {job.benefits.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        </div>

        {authenticated ? <aside className="fit-check surface">
          <p className="eyebrow text-primary">SELF-CHECK</p>
          <h3>Can I apply?</h3>
          <p>Confirm each essential requirement before you continue. This is a manual check, not an automatic score.</p>
          <div className="fit-check-list">
            {job.requirements.map((requirement, index) => (
              <label className="fit-check-row" key={requirement}>
                <input className="form-check-input" type="checkbox" checked={confirmed.includes(index)} onChange={() => toggleRequirement(index)} />
                <span>{requirement}</span>
              </label>
            ))}
          </div>
          <div className={"fit-result " + (readyToApply ? "complete" : "")}>
            {readyToApply ? "You have confirmed the essential requirements." : confirmed.length + " of " + job.requirements.length + " requirements confirmed"}
          </div>
          <button className="btn btn-primary btn-lg w-100" type="button" disabled={!readyToApply || !job.isOpen} onClick={() => navigate("/applicant/apply/" + job.id)}>Continue to application</button>
        </aside> : (
          <aside className="public-apply-panel surface">
            <p className="eyebrow text-primary">READY TO APPLY?</p>
            <h3>Continue with an applicant account</h3>
            <p>Sign in through the team's shared authentication module. Your application, resumes, and progress are only available after sign-in.</p>
            <Link className="btn btn-primary btn-lg w-100" to={"/connect?returnTo=" + encodeURIComponent("/applicant/jobs/" + job.id)}>
              <LogIn size={20} />
              Sign in to continue
            </Link>
          </aside>
        )}
      </div>
    </div>
  );
}
