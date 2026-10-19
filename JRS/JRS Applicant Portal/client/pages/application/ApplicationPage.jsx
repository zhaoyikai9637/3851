import { ArrowLeft, ArrowRight, Check, FileText, FileUp, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api, { getApiError } from "../../api/client";

const steps = ["Basic information", "Work experience", "Role questions", "Review"];

function newExperience() {
  return {
    companyName: "",
    jobTitle: "",
    startDate: "",
    endDate: "",
    currentRole: false,
    responsibilities: "",
    achievements: "",
    skills: "",
  };
}

function CharacterCount({ value, limit }) {
  return <span className="character-count">{value.length}/{limit}</span>;
}

export default function ApplicationPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [resumes, setResumes] = useState([]);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    phone: "",
    location: "",
    resumeId: "",
    coverLetter: "",
    experiences: [newExperience()],
    roleAnswers: {},
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.get("/jobs/" + jobId), api.get("/profile"), api.get("/resumes")])
      .then(([jobResponse, profileResponse, resumeResponse]) => {
        setJob(jobResponse.data.job);
        setResumes(resumeResponse.data.resumes);
        setForm((current) => ({
          ...current,
          phone: profileResponse.data.profile.phone || "",
          location: profileResponse.data.profile.location || "",
          resumeId: resumeResponse.data.resumes[0]?.id || "",
        }));
      })
      .catch((requestError) => setError(getApiError(requestError, "Unable to prepare the application form.")))
      .finally(() => setLoading(false));
  }, [jobId]);

  const selectedResume = useMemo(
    () => resumes.find((resume) => String(resume.id) === String(form.resumeId)),
    [form.resumeId, resumes],
  );

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateExperience(index, event) {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({
      ...current,
      experiences: current.experiences.map((experience, experienceIndex) => (
        experienceIndex === index
          ? { ...experience, [name]: type === "checkbox" ? checked : value, ...(name === "currentRole" && checked ? { endDate: "" } : {}) }
          : experience
      )),
    }));
  }

  function addExperience() {
    if (form.experiences.length >= 5) return;
    setForm((current) => ({ ...current, experiences: [...current.experiences, newExperience()] }));
  }

  function removeExperience(index) {
    if (form.experiences.length === 1) return;
    setForm((current) => ({
      ...current,
      experiences: current.experiences.filter((_, experienceIndex) => experienceIndex !== index),
    }));
  }

  function updateAnswer(questionId, value) {
    setForm((current) => ({
      ...current,
      roleAnswers: { ...current.roleAnswers, [questionId]: value },
    }));
  }

  function validateCurrentStep() {
    if (step === 0) {
      if (!form.phone.trim() || !form.location.trim()) return "Please complete your phone number and location.";
      if (!form.resumeId) return "Upload and select a resume before continuing.";
    }
    if (step === 1) {
      const incomplete = form.experiences.some((experience) => (
        !experience.companyName.trim()
        || !experience.jobTitle.trim()
        || !experience.startDate
        || (!experience.currentRole && !experience.endDate)
        || !experience.responsibilities.trim()
      ));
      if (incomplete) return "Complete the required fields for every work experience.";
    }
    if (step === 2) {
      const unanswered = job.roleQuestions.some((question) => question.required && !String(form.roleAnswers[question.id] || "").trim());
      if (unanswered) return "Answer all required questions for this role.";
    }
    return "";
  }

  function goNext() {
    const validationError = validateCurrentStep();
    if (validationError) {
      setError(validationError);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setError("");
    setStep((current) => Math.min(current + 1, steps.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitApplication() {
    setSubmitting(true);
    setError("");
    try {
      await api.post("/applications", {
        jobId: Number(jobId),
        phone: form.phone,
        location: form.location,
        resumeId: Number(form.resumeId),
        coverLetter: form.coverLetter,
        experiences: form.experiences,
        roleAnswers: form.roleAnswers,
      });
      navigate("/applicant/status", { replace: true, state: { submitted: true } });
    } catch (requestError) {
      setError(getApiError(requestError, "Your application could not be submitted."));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="full-page-message inline"><div className="spinner-border text-primary" /><p>Preparing your application...</p></div>;
  if (!job) return <div className="alert alert-danger" role="alert">{error || "Role not found."}</div>;

  return (
    <div className="page-stack application-page">
      <Link className="back-link" to={"/applicant/jobs/" + job.id}><ArrowLeft size={20} />Back to role details</Link>

      <section className="application-heading surface">
        <div>
          <p className="eyebrow text-primary">APPLYING FOR</p>
          <h2>{job.title}</h2>
          <p>{job.department} | {job.location} | {job.employmentType}</p>
        </div>
        <span className="step-position">Step {step + 1} of {steps.length}</span>
      </section>

      <nav className="application-steps surface" aria-label="Application progress">
        {steps.map((label, index) => (
          <button key={label} className={"application-step " + (index === step ? "active" : "") + (index < step ? " complete" : "")} type="button" onClick={() => index < step && setStep(index)}>
            <span>{index < step ? <Check size={18} /> : index + 1}</span>
            {label}
          </button>
        ))}
      </nav>

      {error && <div className="alert alert-danger mb-0" role="alert">{error}</div>}

      {step === 0 && (
        <section className="surface form-section">
          <div className="section-heading">
            <h2>Basic information</h2>
            <p>Confirm your contact details and select the resume for this role.</p>
          </div>
          <div className="form-grid two-columns">
            <label className="form-label-group">
              <span>Phone number <b>*</b></span>
              <input className="form-control form-control-lg" name="phone" value={form.phone} onChange={updateField} maxLength={30} required />
            </label>
            <label className="form-label-group">
              <span>Current location <b>*</b></span>
              <input className="form-control form-control-lg" name="location" value={form.location} onChange={updateField} maxLength={100} required />
            </label>
          </div>
          <label className="form-label-group">
            <span>Resume for this application <b>*</b></span>
            {resumes.length > 0 ? (
              <>
                <select className="form-select form-select-lg" name="resumeId" value={form.resumeId} onChange={updateField} required>
                  <option value="">Select a resume</option>
                  {resumes.map((resume) => <option key={resume.id} value={resume.id}>{resume.originalName}</option>)}
                </select>
                <div className="resume-select-support">
                  <span>{resumes.length} resume{resumes.length === 1 ? "" : "s"} available</span>
                  <Link to={`/applicant/resume/upload?returnTo=${encodeURIComponent(`/applicant/apply/${job.id}`)}`}><FileUp size={17} />Upload another resume</Link>
                </div>
              </>
            ) : (
              <div className="resume-required-box">
                <FileText size={25} />
                <div><strong>No resume uploaded</strong><p>Upload a resume before submitting an application.</p></div>
                <Link className="btn btn-outline-primary" to={`/applicant/resume/upload?returnTo=${encodeURIComponent(`/applicant/apply/${job.id}`)}`}>Upload resume</Link>
              </div>
            )}
          </label>
          <label className="form-label-group">
            <span>Short cover note</span>
            <textarea className="form-control" name="coverLetter" rows="6" value={form.coverLetter} onChange={updateField} maxLength={1500} placeholder="Explain why this role suits your experience and career goals." />
            <CharacterCount value={form.coverLetter} limit={1500} />
          </label>
        </section>
      )}

      {step === 1 && (
        <section className="surface form-section work-experience-section">
          <div className="section-heading with-action">
            <div>
              <h2>Work experience</h2>
              <p>This is the main area for showing your value. Include responsibilities, achievements, and measurable results.</p>
            </div>
            <button className="btn btn-outline-primary" type="button" onClick={addExperience} disabled={form.experiences.length >= 5}><Plus size={19} />Add experience</button>
          </div>

          <div className="experience-list">
            {form.experiences.map((experience, index) => (
              <fieldset className="experience-entry" key={index}>
                <div className="experience-entry-heading">
                  <legend>Experience {index + 1}</legend>
                  {form.experiences.length > 1 && (
                    <button className="icon-button danger" type="button" onClick={() => removeExperience(index)} aria-label={"Remove experience " + (index + 1)}><Trash2 size={20} /></button>
                  )}
                </div>
                <div className="form-grid two-columns">
                  <label className="form-label-group">
                    <span>Company name <b>*</b></span>
                    <input className="form-control form-control-lg" name="companyName" value={experience.companyName} onChange={(event) => updateExperience(index, event)} maxLength={120} required />
                  </label>
                  <label className="form-label-group">
                    <span>Job title <b>*</b></span>
                    <input className="form-control form-control-lg" name="jobTitle" value={experience.jobTitle} onChange={(event) => updateExperience(index, event)} maxLength={120} required />
                  </label>
                  <label className="form-label-group">
                    <span>Start month <b>*</b></span>
                    <input className="form-control form-control-lg" type="month" name="startDate" value={experience.startDate} onChange={(event) => updateExperience(index, event)} required />
                  </label>
                  <label className="form-label-group">
                    <span>End month <b>*</b></span>
                    <input className="form-control form-control-lg" type="month" name="endDate" value={experience.endDate} onChange={(event) => updateExperience(index, event)} disabled={experience.currentRole} required={!experience.currentRole} />
                  </label>
                </div>
                <label className="form-check current-role-check">
                  <input className="form-check-input" type="checkbox" name="currentRole" checked={experience.currentRole} onChange={(event) => updateExperience(index, event)} />
                  <span className="form-check-label">I currently work in this role</span>
                </label>
                <label className="form-label-group">
                  <span>Main responsibilities <b>*</b></span>
                  <textarea className="form-control large-textarea" name="responsibilities" rows="7" value={experience.responsibilities} onChange={(event) => updateExperience(index, event)} maxLength={1200} placeholder="Describe your main duties and the scope of your work." required />
                  <CharacterCount value={experience.responsibilities} limit={1200} />
                </label>
                <label className="form-label-group">
                  <span>Projects and achievements</span>
                  <textarea className="form-control" name="achievements" rows="5" value={experience.achievements} onChange={(event) => updateExperience(index, event)} maxLength={1000} placeholder="Add outcomes, project examples, awards, or measurable improvements." />
                  <CharacterCount value={experience.achievements} limit={1000} />
                </label>
                <label className="form-label-group">
                  <span>Skills, tools, and measurable results</span>
                  <textarea className="form-control" name="skills" rows="4" value={experience.skills} onChange={(event) => updateExperience(index, event)} maxLength={600} placeholder="Example: React, JavaScript, reduced page load time by 20%." />
                  <CharacterCount value={experience.skills} limit={600} />
                </label>
              </fieldset>
            ))}
          </div>
          {form.experiences.length >= 5 && <p className="field-help">A maximum of five work experiences keeps the application concise for recruiters.</p>}
        </section>
      )}

      {step === 2 && (
        <section className="surface form-section">
          <div className="section-heading">
            <h2>Questions for {job.title}</h2>
            <p>These questions are specific to this vacancy. Other roles may ask different questions.</p>
          </div>
          <div className="role-question-list">
            {job.roleQuestions.map((question) => (
              <label className="form-label-group" key={question.id}>
                <span>{question.label} {question.required && <b>*</b>}</span>
                {question.type === "select" ? (
                  <select className="form-select form-select-lg" value={form.roleAnswers[question.id] || ""} onChange={(event) => updateAnswer(question.id, event.target.value)} required={question.required}>
                    <option value="">Select an answer</option>
                    {question.options.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                ) : (
                  <>
                    <textarea className="form-control" rows={question.type === "short" ? 3 : 6} value={form.roleAnswers[question.id] || ""} onChange={(event) => updateAnswer(question.id, event.target.value)} maxLength={question.maxLength} placeholder={question.placeholder} required={question.required} />
                    <CharacterCount value={form.roleAnswers[question.id] || ""} limit={question.maxLength} />
                  </>
                )}
              </label>
            ))}
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="surface form-section review-section">
          <div className="section-heading">
            <h2>Review your focused application</h2>
            <p>You are applying for one position at this company. Check the details before submission.</p>
          </div>
          <dl className="review-grid">
            <div><dt>Position</dt><dd>{job.title}</dd></div>
            <div><dt>Resume</dt><dd>{selectedResume?.originalName}</dd></div>
            <div><dt>Phone</dt><dd>{form.phone}</dd></div>
            <div><dt>Location</dt><dd>{form.location}</dd></div>
            <div><dt>Work experience</dt><dd>{form.experiences.length} entr{form.experiences.length === 1 ? "y" : "ies"}</dd></div>
            <div><dt>Role questions</dt><dd>{job.roleQuestions.length} completed</dd></div>
          </dl>
          <div className="submission-note">
            <Check size={21} />
            <p>By submitting, you confirm that the information is accurate and may be reviewed by the company recruitment team.</p>
          </div>
        </section>
      )}

      <div className="application-actions">
        <button className="btn btn-outline-secondary btn-lg" type="button" disabled={step === 0 || submitting} onClick={() => setStep((current) => Math.max(current - 1, 0))}><ArrowLeft size={20} />Previous</button>
        {step < steps.length - 1 ? (
          <button className="btn btn-primary btn-lg" type="button" onClick={goNext}>Continue<ArrowRight size={20} /></button>
        ) : (
          <button className="btn btn-success btn-lg" type="button" onClick={submitApplication} disabled={submitting}>{submitting ? "Submitting..." : "Submit application"}<Check size={20} /></button>
        )}
      </div>
    </div>
  );
}
