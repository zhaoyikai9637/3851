import ApplicantBreadcrumbs from "../../components/ApplicantBreadcrumbs";
import ActiveApplicationNotice from "../../components/ActiveApplicationNotice";
import useCurrentApplication from "../../hooks/useCurrentApplication";
import {formatDate} from '../../../../jrs-hr-module/shared/date-format.mjs';
import { ArrowLeft, BriefcaseBusiness, CalendarDays, CircleDollarSign, LogIn, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api, { getApiError } from "../../api/client";
import { jobLabel } from "../../utils/jobLabels";
import { jobBulletPoints } from "../../../../jrs-hr-module/shared/job-text.mjs";

export default function JobDetailsPage({ authenticated = false }) {
  const { jobId } = useParams();
  const current = useCurrentApplication(authenticated, jobId);
  const navigate = useNavigate();
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


  const navigation = authenticated
    ? <ApplicantBreadcrumbs items={[{ label: "Jobs", to: "/applicant/jobs" }, { label: job?.title || "Role Details" }]} />
    : <Link className="back-link" to="/jobs"><ArrowLeft size={20} aria-hidden="true" />Back to jobs</Link>;
  if (loading) return <>{navigation}<div className="full-page-message inline" role="status"><div className="spinner-border text-primary" /><p>Loading role details...</p></div></>;
  if (error || !job) return <>{navigation}<div className="alert alert-danger" role="alert">{error || "Role not found."}</div></>;

  return (
    <div className="page-stack role-details-page">
      {navigation}

      <section className="role-header surface">
        <div>
          <h2>{job.title}</h2>
          <p>{job.summary}</p>
          <div className="job-meta-list prominent">
            <span><MapPin size={19} />{job.location}</span>
            <span><BriefcaseBusiness size={19} />{jobLabel(job.employmentType)}</span>
            {job.closingDate && <span><CalendarDays size={19} />Apply by {formatDate(job.closingDate)}</span>}
            {job.salaryRange && <span><CircleDollarSign size={19} />{job.salaryRange}</span>}
          </div>
        </div>
        {authenticated ? (
          <button className="btn btn-primary btn-lg" type="button" disabled={!job.isOpen || current.loading || current.active || Boolean(current.previous)} onClick={() => navigate("/applicant/apply/" + job.id)}>
            {!job.isOpen ? "Applications closed" : current.active ? "Application in progress" : current.previous ? "Already applied" : "Apply for this role"}
          </button>
        ) : job.isOpen ? (
          <Link className="btn btn-primary btn-lg" to={"/connect?returnTo=" + encodeURIComponent("/applicant/jobs/" + job.id)}>
            <LogIn size={20} />
            {job.isOpen ? "Sign in to apply" : "Applications closed"}
          </Link>
        ) : <button className="btn btn-primary btn-lg" type="button" disabled>Applications closed</button>}
      </section>

      {authenticated && job.isOpen && (current.active || current.previous) && <ActiveApplicationNotice application={current.active ? current.application : current.previous} previous={!current.active} />}
      <div>
        <div className="role-information surface">
          <section>
            <h3>Job Description</h3>
            <ul className="detail-list">
              {jobBulletPoints(job.responsibilities).map((item, index) => <li key={index}>{item}</li>)}
            </ul>
          </section>
          <section>
            <h3>Job Requirements</h3>
            <ul className="detail-list">
              {jobBulletPoints(job.requirements).map((item, index) => <li key={index}>{item}</li>)}
            </ul>
          </section>
        </div>

      </div>
    </div>
  );
}
