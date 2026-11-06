import {formatDate} from '../../../../jrs-hr-module/shared/date-format.mjs';
import { ArrowLeft, BriefcaseBusiness, CalendarDays, CheckCircle2, CircleDollarSign, LogIn, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import api, { getApiError } from "../../api/client";
import ActiveApplicationNotice from "../../components/ActiveApplicationNotice";
import { useAuth } from "../../context/AuthContext";
import useCurrentApplication from "../../hooks/useCurrentApplication";
import { jobLabel } from "../../utils/jobLabels";
import { loginUrl, workspacePathFor } from "../../utils/navigation";

export default function JobDetailsPage({ authenticated = false }) {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: sessionLoading } = useAuth();
  const current = useCurrentApplication(authenticated);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/jobs/" + jobId)
      .then(({ data }) => setJob(data.job))
      .catch((requestError) => setError(getApiError(requestError, "Unable to load this role.")))
      .finally(() => setLoading(false));
  }, [jobId]);

  // A signed-in applicant on the public page is moved to the workspace version of the same role.
  if (!authenticated && !sessionLoading && user) return <Navigate to={workspacePathFor(location.pathname)} replace />;
  if (loading) return <div className="full-page-message inline"><div className="spinner-border text-primary" /><p>Loading role details...</p></div>;
  if (error || !job) return <div className="alert alert-danger" role="alert">{error || "Role not found."}</div>;

  return (
    <div className="page-stack role-details-page">
      <Link className="back-link" to={authenticated ? "/applicant/jobs" : "/jobs"}><ArrowLeft size={20} />Back to jobs</Link>

      <section className="role-header surface">
        <div>
          <h2>{job.title}</h2>
          <p>{job.summary}</p>
          <div className="job-meta-list prominent">
            <span><MapPin size={19} />{job.location}</span>
            <span><BriefcaseBusiness size={19} />{jobLabel(job.workMode)} | {jobLabel(job.employmentType)}</span>
            {job.closingDate && <span><CalendarDays size={19} />Apply by {formatDate(job.closingDate)}</span>}
            {job.salaryRange && <span><CircleDollarSign size={19} />{job.salaryRange}</span>}
          </div>
        </div>
        {authenticated ? (
          <button className="btn btn-primary btn-lg" type="button" disabled={!job.isOpen || current.loading || current.active} onClick={() => navigate("/applicant/apply/" + job.id)}>
            {!job.isOpen ? "Applications closed" : current.active ? "Application in progress" : "Apply for this role"}
          </button>
        ) : job.isOpen ? (
          <a className="btn btn-primary btn-lg" href={loginUrl("/applicant/apply/" + job.id)}>
            <LogIn size={20} />
            Sign in to apply
          </a>
        ) : <button className="btn btn-primary btn-lg" type="button" disabled>Applications closed</button>}
      </section>

      {authenticated && job.isOpen && current.active && <ActiveApplicationNotice application={current.application} />}

      <div>
        <div className="role-information surface">
          <section>
            <h3>Job Description</h3>
            <ul className="detail-list">
              {job.responsibilities.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
          <section>
            <h3>Job Requirements</h3>
            <ul className="detail-list check-list">
              {job.requirements.map((item) => <li key={item}><CheckCircle2 size={20} />{item}</li>)}
            </ul>
          </section>
        </div>

      </div>
    </div>
  );
}
