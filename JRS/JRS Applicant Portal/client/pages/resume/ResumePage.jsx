import { ArrowRight, BookOpen, Eye, EyeOff, FileText, Languages, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { getApiError } from "../../api/client";

const emptyEducation = () => ({ institution: "", qualification: "", startYear: "", graduationYear: "" });
const emptyLanguage = () => ({ language: "", readingLevel: "", writingLevel: "" });

export default function ResumePage() {
  const [profile, setProfile] = useState({
    phone: "",
    location: "",
    availabilityStatus: "AVAILABLE",
    education: [emptyEducation()],
    languages: [emptyLanguage()],
  });
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  async function loadData() {
    setLoading(true);
    try {
      const [profileResponse, resumeResponse] = await Promise.all([api.get("/profile"), api.get("/resumes")]);
      const loadedProfile = profileResponse.data.profile;
      setProfile({
        ...loadedProfile,
        education: loadedProfile.education?.length ? loadedProfile.education : [emptyEducation()],
        languages: loadedProfile.languages?.length ? loadedProfile.languages : [emptyLanguage()],
      });
      setResumes(resumeResponse.data.resumes);
    } catch (requestError) {
      setMessage({ type: "danger", text: getApiError(requestError, "Unable to load your profile.") });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function updateProfileField(event) {
    const { name, value } = event.target;
    setProfile((current) => ({ ...current, [name]: value }));
  }

  function updateListItem(listName, index, event) {
    const { name, value } = event.target;
    setProfile((current) => ({
      ...current,
      [listName]: current[listName].map((item, itemIndex) => itemIndex === index ? { ...item, [name]: value } : item),
    }));
  }

  function addListItem(listName) {
    const emptyItem = listName === "education" ? emptyEducation() : emptyLanguage();
    setProfile((current) => ({ ...current, [listName]: [...current[listName], emptyItem] }));
  }

  function removeListItem(listName, index) {
    setProfile((current) => ({
      ...current,
      [listName]: current[listName].length === 1
        ? current[listName]
        : current[listName].filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const { data } = await api.put("/profile", profile);
      setProfile(data.profile);
      setMessage({ type: "success", text: "Profile and visibility settings saved." });
    } catch (requestError) {
      setMessage({ type: "danger", text: getApiError(requestError, "Unable to save your profile.") });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="full-page-message inline"><div className="spinner-border text-primary" /><p>Loading your profile...</p></div>;

  return (
    <form className="page-stack resume-page" onSubmit={saveProfile}>
      {message && <div className={"alert alert-" + message.type + " mb-0"} role="alert">{message.text}</div>}

      <section className="surface resume-summary-section">
        <div className="resume-summary-icon" aria-hidden="true"><FileText size={30} /></div>
        <div>
          <p className="eyebrow text-primary">RESUME FILES</p>
          <h2>{resumes.length > 0 ? `${resumes.length} resume${resumes.length === 1 ? "" : "s"} ready` : "Upload your first resume"}</h2>
          <p>{resumes.length > 0 ? `Latest file: ${resumes[0].originalName}` : "A resume is required before you can submit an application."}</p>
        </div>
        <Link className="btn btn-primary btn-lg" to="/applicant/resume/upload">
          {resumes.length > 0 ? "Manage resumes" : "Upload resume"}<ArrowRight size={20} />
        </Link>
      </section>

      <section className="surface visibility-section">
        <div>
          <p className="eyebrow text-primary">RECRUITER VISIBILITY</p>
          <h2>Can recruiters contact you?</h2>
          <p>Keep your profile available when you are open to a new role. Close it when you no longer want recruitment messages.</p>
        </div>
        <div className="visibility-choice" role="group" aria-label="Recruiter visibility">
          <button className={"visibility-option " + (profile.availabilityStatus === "AVAILABLE" ? "selected" : "")} type="button" onClick={() => setProfile((current) => ({ ...current, availabilityStatus: "AVAILABLE" }))}>
            <Eye size={24} />
            <span><strong>Available</strong><small>Recruiters can find my profile</small></span>
          </button>
          <button className={"visibility-option " + (profile.availabilityStatus === "CLOSED" ? "selected" : "")} type="button" onClick={() => setProfile((current) => ({ ...current, availabilityStatus: "CLOSED" }))}>
            <EyeOff size={24} />
            <span><strong>Closed</strong><small>Do not show my profile to recruiters</small></span>
          </button>
        </div>
      </section>

      <section className="surface form-section">
        <div className="section-heading">
          <h2>Contact information</h2>
          <p>These details will be used for your application and recruiter contact.</p>
        </div>
        <div className="form-grid two-columns">
          <label className="form-label-group">
            <span>Phone number</span>
            <input className="form-control form-control-lg" name="phone" value={profile.phone} onChange={updateProfileField} maxLength={30} />
          </label>
          <label className="form-label-group">
            <span>Current location</span>
            <input className="form-control form-control-lg" name="location" value={profile.location} onChange={updateProfileField} maxLength={100} />
          </label>
        </div>
      </section>

      <section className="surface form-section">
        <div className="section-heading with-action">
          <div className="icon-heading"><BookOpen size={25} /><div><h2>Education</h2><p>Include the school, qualification, study period, and graduation year.</p></div></div>
          <button className="btn btn-outline-primary" type="button" onClick={() => addListItem("education")} disabled={profile.education.length >= 5}><Plus size={19} />Add education</button>
        </div>
        <div className="structured-list">
          {profile.education.map((education, index) => (
            <fieldset className="structured-entry" key={index}>
              <div className="experience-entry-heading">
                <legend>Education {index + 1}</legend>
                {profile.education.length > 1 && <button className="icon-button danger" type="button" onClick={() => removeListItem("education", index)} aria-label={"Remove education " + (index + 1)}><Trash2 size={20} /></button>}
              </div>
              <div className="form-grid two-columns">
                <label className="form-label-group"><span>School or university</span><input className="form-control" name="institution" value={education.institution} onChange={(event) => updateListItem("education", index, event)} maxLength={150} /></label>
                <label className="form-label-group"><span>Qualification</span><input className="form-control" name="qualification" value={education.qualification} onChange={(event) => updateListItem("education", index, event)} maxLength={150} /></label>
                <label className="form-label-group"><span>Start year</span><input className="form-control" type="number" name="startYear" min="1950" max="2100" value={education.startYear} onChange={(event) => updateListItem("education", index, event)} /></label>
                <label className="form-label-group"><span>Graduation year</span><input className="form-control" type="number" name="graduationYear" min="1950" max="2100" value={education.graduationYear} onChange={(event) => updateListItem("education", index, event)} /></label>
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      <section className="surface form-section">
        <div className="section-heading with-action">
          <div className="icon-heading"><Languages size={25} /><div><h2>Languages</h2><p>Record reading and writing ability separately.</p></div></div>
          <button className="btn btn-outline-primary" type="button" onClick={() => addListItem("languages")} disabled={profile.languages.length >= 8}><Plus size={19} />Add language</button>
        </div>
        <div className="structured-list">
          {profile.languages.map((language, index) => (
            <fieldset className="structured-entry" key={index}>
              <div className="experience-entry-heading">
                <legend>Language {index + 1}</legend>
                {profile.languages.length > 1 && <button className="icon-button danger" type="button" onClick={() => removeListItem("languages", index)} aria-label={"Remove language " + (index + 1)}><Trash2 size={20} /></button>}
              </div>
              <div className="form-grid three-columns">
                <label className="form-label-group"><span>Language</span><input className="form-control" name="language" value={language.language} onChange={(event) => updateListItem("languages", index, event)} maxLength={60} /></label>
                <label className="form-label-group"><span>Reading level</span><select className="form-select" name="readingLevel" value={language.readingLevel} onChange={(event) => updateListItem("languages", index, event)}><option value="">Select</option><option>Basic</option><option>Intermediate</option><option>Advanced</option><option>Native</option></select></label>
                <label className="form-label-group"><span>Writing level</span><select className="form-select" name="writingLevel" value={language.writingLevel} onChange={(event) => updateListItem("languages", index, event)}><option value="">Select</option><option>Basic</option><option>Intermediate</option><option>Advanced</option><option>Native</option></select></label>
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      <div className="sticky-save-bar">
        <span>{profile.availabilityStatus === "AVAILABLE" ? "Profile visible to recruiters" : "Profile hidden from recruiters"}</span>
        <button className="btn btn-primary btn-lg" type="submit" disabled={saving}><Save size={20} />{saving ? "Saving..." : "Save profile"}</button>
      </div>
    </form>
  );
}
