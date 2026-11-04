import {formatDate,formatDateTime} from '../../../../jrs-hr-module/shared/date-format.mjs';
import { ArrowRight, BriefcaseBusiness, CalendarDays, Check, EyeOff, FileText, MapPin, MessageSquareText, UserRoundPen, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import api, { getApiError } from "../../api/client";
import { locationLabel } from "../../../shared/contactFields";

const timeline = ["Submitted", "In Review", "Interview", "Decision"];

function timelinePosition(status) {
  if (status === "Submitted") return 0;
  if (status === "In Review") return 1;
  if (status === "Interview") return 2;
  if (["Decision", "Accepted", "Rejected"].includes(status)) return 3;
  return -1;
}

export default function ApplicationStatusPage() {
  const location = useLocation();
  const [application, setApplication] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applicationError, setApplicationError] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [message, setMessage] = useState(location.state?.submitted ? { type: "success", text: "Your application was submitted successfully." } : null);

  async function loadApplication() {
    setLoading(true);
    setApplicationError(null);
    try {
      const response = await api.get("/applications/me");
      setApplication(response.data.application);
    } catch (error) {
      setApplicationError(getApiError(error, "Unable to load your application status. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  async function loadProfile() {
    setProfileError(null);
    try {
      const response = await api.get("/profile");
      setProfile(response.data.profile);
    } catch {
      setProfileError("Your profile settings could not be loaded. Your application is still saved.");
    }
  }

  useEffect(() => {
    loadApplication();
    loadProfile();
  }, []);

  const currentPosition = useMemo(() => timelinePosition(application?.status), [application]);

  async function closeJobSearch() {
    try {
      const { data } = await api.put("/profile", { ...profile, availabilityStatus: "CLOSED" });
      setProfile(data.profile);
      setMessage({ type: "success", text: "Your job-search status has been updated. HR can still view your submitted applications." });
    } catch (requestError) {
      setMessage({ type: "danger", text: getApiError(requestError, "Unable to update your job-search status.") });
    }
  }

  async function withdrawApplication() {
    if (!window.confirm("Withdraw this application? You can apply for another role after it is withdrawn.")) return;
    try {
      const { data } = await api.post("/applications/" + application.id + "/withdraw");
      setApplication(data.application);
      setMessage({ type: "success", text: "Your application has been withdrawn." });
    } catch (requestError) {
      setMessage({ type: "danger", text: getApiError(requestError, "Unable to withdraw this application.") });
    }
  }

  if (loading) return <div className="full-page-message inline"><div className="spinner-border text-primary" /><p>Checking your application...</p></div>;

  if (applicationError && !application) return (
    <section className="surface empty-state large" role="alert">
      <h2>Unable to load your application</h2>
      <p>{applicationError}</p>
      <button className="btn btn-primary" onClick={loadApplication} type="button">Try again</button>
    </section>
  );

  if (!application) {
    return (
      <div className="page-stack">
        {message && <div className={"alert alert-" + message.type} role="alert">{message.text}</div>}
        <section className="empty-state surface large">
          <BriefcaseBusiness size={44} aria-hidden="true" />
          <h2>No current application</h2>
          <p>Review the company's open positions and choose the single role that best fits your experience.</p>
          <Link className="btn btn-primary btn-lg" to="/applicant/jobs">Find a suitable role<ArrowRight size={20} /></Link>
        </section>
      </div>
    );
  }

  const withdrawn = application.status === "Withdrawn";

  return (
    <div className="page-stack status-page">
      {applicationError && <div className="alert alert-danger" role="alert">{applicationError}<button className="btn btn-link" onClick={loadApplication} type="button">Try again</button></div>}
      {profileError && <div className="alert alert-warning" role="alert">{profileError}<button className="btn btn-link" onClick={loadProfile} type="button">Retry profile settings</button></div>}
      {message && <div className={"alert alert-" + message.type + " mb-0"} role="alert">{message.text}</div>}

      <section className="status-role-header surface">
        <div>
          <p className="eyebrow text-primary">YOUR APPLICATION</p>
          <h2>{application.job.title}</h2>
          <div className="job-meta-list prominent">
            <span><BriefcaseBusiness size={19} />{application.job.department}</span>
            <span><MapPin size={19} />{application.job.location}</span>
            <span><CalendarDays size={19} />Submitted {formatDate(application.submittedAt)}</span>
          </div>
        </div>
        <span className={"status-badge status-" + application.status.toLowerCase().replaceAll(" ", "-")}>{application.status}</span>
      </section>

      {withdrawn ? (
        <section className="surface withdrawn-panel">
          <XCircle size={34} />
          <div><h3>Application withdrawn</h3><p>This application is no longer being considered. You may now apply for another suitable role.</p></div>
          <Link className="btn btn-primary" to="/applicant/jobs">View open roles</Link>
        </section>
      ) : (
        <>
          <section className="surface progress-section">
            <div className="section-heading">
              <h2>Application progress</h2>
              <p>The recruitment team will update this timeline as your application moves forward.</p>
            </div>
            <ol className="status-timeline">
              {timeline.map((item, index) => (
                <li className={(index <= currentPosition ? "reached " : "") + (index === currentPosition ? "current" : "")} key={item}>
                  <span className="timeline-marker">{index < currentPosition ? <Check size={20} /> : index + 1}</span>
                  <strong>{item}</strong>
                </li>
              ))}
            </ol>
          </section>

          <div className="status-grid">
            <section className="surface status-update">
              <div className="panel-title-row">
                <div><p className="eyebrow text-primary">CURRENT UPDATE</p><h2>{application.status}</h2></div>
                <MessageSquareText size={28} />
              </div>
              <p className="status-message">{application.statusMessage}</p>
              <small>Last updated {formatDateTime(application.updatedAt)}</small>
            </section>

            <section className="surface application-summary">
              <h2>Application details</h2>
              <dl>
                <div><dt>Application ID</dt><dd>JRS-{String(application.id).padStart(5, "0")}</dd></div>
                <div><dt>Resume</dt><dd><FileText size={18} />{application.resume?.originalName || "Resume attached"}</dd></div>
                <div><dt>Location</dt><dd>{locationLabel(application.location)}</dd></div>
              </dl>
            </section>
          </div>
        </>
      )}

      <section className="surface applicant-actions">
        <div className="section-heading">
          <h2>Applicant actions</h2>
          <p>Keep your profile current while the recruitment team reviews your application.</p>
        </div>
        <div className="action-buttons">
          <Link className="btn btn-outline-primary btn-lg" to="/applicant/resume"><UserRoundPen size={20} />Edit profile and resumes</Link>
          {profile && !profileError && profile.availabilityStatus !== "CLOSED" && <button className="btn btn-outline-secondary btn-lg" type="button" onClick={closeJobSearch}><EyeOff size={20} />Not looking for opportunities</button>}
          {!withdrawn && !["Accepted", "Rejected"].includes(application.status) && <button className="btn btn-outline-danger btn-lg" type="button" onClick={withdrawApplication}><XCircle size={20} />Withdraw application</button>}
        </div>
      </section>
    </div>
  );
}
