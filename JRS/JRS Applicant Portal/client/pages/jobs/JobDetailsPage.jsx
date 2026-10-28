import {formatDate} from '../../../../jrs-hr-module/shared/date-format.mjs';
import { ArrowLeft, BriefcaseBusiness, CalendarDays, CheckCircle2, CircleDollarSign, LogIn, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api, { getApiError } from "../../api/client";
import { jobLabel } from "../../utils/jobLabels";
import ApplicationSignInPrompt from '../../components/ApplicationSignInPrompt';

export default function JobDetailsPage({ authenticated = false }) {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signInPrompt,setSignInPrompt]=useState(false);

  useEffect(() => {
    api
      .get("/jobs/" + jobId)
      .then(({ data }) => setJob(data.job))
      .catch((requestError) => setError(getApiError(requestError, "Unable to load this role.")))
      .finally(() => setLoading(false));
  }, [jobId]);


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
          <button className="btn btn-primary btn-lg" type="button" disabled={!job.isOpen} onClick={() => navigate("/applicant/apply/" + job.id)}>
            {job.isOpen ? "Apply for this role" : "Applications closed"}
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-lg" disabled={!job.isOpen} onClick={()=>setSignInPrompt(true)}>
            <LogIn size={20} />
            {job.isOpen ? "Apply for this role" : "Applications closed"}
          </button>
        )}
      </section>
      {signInPrompt ? <ApplicationSignInPrompt jobId={job.id} onClose={()=>setSignInPrompt(false)}/> : null}

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
