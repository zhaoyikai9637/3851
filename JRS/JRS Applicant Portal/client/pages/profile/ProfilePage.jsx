import { Award, BookOpen, BriefcaseBusiness, Languages, Mail, MapPin, Pencil, Phone, Plus, Sparkles, Trash2, UserRound, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import accountApi, { getAccountError } from "../../api/accountClient";

// Personal profile, previously a separate static page. It uses the shared account
// API so it edits exactly the same records as before. Education and languages are
// edited on My Resume, which captures their structured levels.

const COUNTRY_CODES = ["+65", "+60", "+61", "+44", "+1", "+86", "+91", "+62", "+63", "+66", "+84"];

function monthLabel(value) {
  if (!value) return "";
  const [year, month] = value.split("-");
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

function initials(name) {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Dialog({ title, onClose, onSubmit, saving, children }) {
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="profile-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="profile-dialog surface" role="dialog" aria-modal="true" aria-label={title} onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
        <header className="profile-dialog-header">
          <h2>{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>
        <div className="profile-dialog-body">{children}</div>
        <footer className="profile-dialog-footer">
          <button className="btn btn-outline-secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
        </footer>
      </form>
    </div>
  );
}

function Field({ label, children, required = false }) {
  return (
    <label className="form-label-group">
      <span>{label}{required && <b> *</b>}</span>
      {children}
    </label>
  );
}

function Section({ icon: Icon, title, action, children }) {
  return (
    <section className="surface profile-section-card">
      <div className="profile-section-head">
        <div className="icon-heading"><Icon size={22} aria-hidden="true" /><h2>{title}</h2></div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }) {
  return <p className="profile-empty">{children}</p>;
}

const emptyRole = { job_title: "", company_name: "", start_month_year: "", end_month_year: "", is_current_role: false, description: "" };
const emptyCert = { cert_name: "", issuing_org: "", issue_month_year: "", expiry_month_year: "", no_expiry: false, description: "" };

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState(null);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [skillInput, setSkillInput] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await accountApi.get("/profile");
      setProfile(data.profile);
      setError("");
    } catch (requestError) {
      setError(getAccountError(requestError, "Unable to load your profile."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openDialog(kind, values) {
    setDialog(kind);
    setDraft(values);
    setDialogError("");
    setNotice("");
    setSkillInput("");
  }

  const closeDialog = useCallback(() => {
    if (!saving) setDialog(null);
  }, [saving]);

  function update(name) {
    return (event) => {
      const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
      setDraft((current) => ({ ...current, [name]: value }));
    };
  }

  async function save(request, successMessage) {
    setSaving(true);
    setDialogError("");
    try {
      await request();
      await load();
      setDialog(null);
      setNotice(successMessage);
    } catch (requestError) {
      setDialogError(getAccountError(requestError, "Unable to save these changes."));
    } finally {
      setSaving(false);
    }
  }

  async function removeRecord(section, id) {
    if (!window.confirm("Delete this record?")) return;
    try {
      await accountApi.delete(`/profile/${section}/${id}`);
      await load();
      setNotice("Record deleted.");
    } catch (requestError) {
      setNotice("");
      setError(getAccountError(requestError, "Unable to delete this record."));
    }
  }

  function addSkill() {
    const skill = skillInput.trim();
    if (!skill) return;
    const skills = draft.skills || [];
    if (skills.some((item) => item.toLowerCase() === skill.toLowerCase())) {
      setDialogError("This skill is already in your list.");
      return;
    }
    if (skill.length > 50) {
      setDialogError("Each skill must be 50 characters or fewer.");
      return;
    }
    setDraft({ skills: [...skills, skill] });
    setSkillInput("");
    setDialogError("");
  }

  if (loading) {
    return (
      <div className="page-stack" aria-busy="true">
        <span className="jrs-skeleton" style={{ height: 120 }} />
        <span className="jrs-skeleton" style={{ height: 180 }} />
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="alert alert-danger" role="alert">
        {error || "Unable to load your profile."}{" "}
        <button className="btn btn-link p-0 align-baseline" type="button" onClick={() => { setLoading(true); load(); }}>Try again</button>
      </div>
    );
  }

  const fullName = profile.full_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Your profile";
  const phone = profile.contact_number ? `${profile.country_code || ""} ${profile.contact_number}`.trim() : "";
  const readLanguages = profile.languages.filter((item) => item.can_read).map((item) => item.language_name);
  const writeLanguages = profile.languages.filter((item) => item.can_write).map((item) => item.language_name);

  return (
    <div className="page-stack profile-page">
      {notice && <div className="alert alert-success mb-0" role="status">{notice}</div>}
      {error && <div className="alert alert-danger mb-0" role="alert">{error}</div>}

      <section className="surface profile-identity">
        <div className="avatar avatar-large" aria-hidden="true">{initials(fullName)}</div>
        <div className="profile-identity-copy">
          <h2>{fullName}</h2>
          <ul className="profile-contact-list">
            <li><Mail size={17} aria-hidden="true" />{profile.email}</li>
            {phone && <li><Phone size={17} aria-hidden="true" />{phone}</li>}
            {profile.home_location && <li><MapPin size={17} aria-hidden="true" />{profile.home_location}</li>}
          </ul>
        </div>
        <button
          className="btn btn-outline-primary"
          type="button"
          onClick={() => openDialog("personal", {
            first_name: profile.first_name || fullName.split(" ")[0] || "",
            last_name: profile.last_name || fullName.split(" ").slice(1).join(" "),
            home_location: profile.home_location || "",
            country_code: profile.country_code || "+65",
            contact_number: profile.contact_number || "",
          })}
        >
          <Pencil size={17} />Edit details
        </button>
      </section>

      <Section
        icon={Sparkles}
        title="Personal summary"
        action={<button className="btn btn-outline-primary btn-sm" type="button" onClick={() => openDialog("summary", { personal_summary: profile.personal_summary || "" })}>{profile.personal_summary ? <><Pencil size={16} />Edit</> : <><Plus size={16} />Add</>}</button>}
      >
        {profile.personal_summary ? <p className="profile-summary">{profile.personal_summary}</p> : <Empty>Add a short summary of your experience and career goals.</Empty>}
      </Section>

      <Section
        icon={BriefcaseBusiness}
        title="Career history"
        action={<button className="btn btn-outline-primary btn-sm" type="button" onClick={() => openDialog("career", { ...emptyRole })}><Plus size={16} />Add role</button>}
      >
        {profile.career.length === 0 ? <Empty>No roles added yet.</Empty> : (
          <ul className="profile-records">
            {profile.career.map((row) => (
              <li key={row.role_id}>
                <div>
                  <strong>{row.job_title}</strong>
                  <span>{row.company_name}</span>
                  <small>{monthLabel(row.start_month_year)} to {row.is_current_role ? "Present" : monthLabel(row.end_month_year) || "Not specified"}</small>
                  {row.description && <p>{row.description}</p>}
                </div>
                <div className="profile-record-actions">
                  <button className="btn btn-link btn-sm" type="button" onClick={() => openDialog("career", { ...emptyRole, ...row, description: row.description || "" })}>Edit</button>
                  <button className="btn btn-link btn-sm text-danger" type="button" onClick={() => removeRecord("career", row.role_id)} aria-label={`Delete ${row.job_title}`}><Trash2 size={16} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        icon={Award}
        title="Licences and certifications"
        action={<button className="btn btn-outline-primary btn-sm" type="button" onClick={() => openDialog("certifications", { ...emptyCert })}><Plus size={16} />Add certification</button>}
      >
        {profile.certifications.length === 0 ? <Empty>No certifications added yet.</Empty> : (
          <ul className="profile-records">
            {profile.certifications.map((row) => (
              <li key={row.cert_id}>
                <div>
                  <strong>{row.cert_name}</strong>
                  <span>{row.issuing_org}</span>
                  <small>
                    {row.issue_month_year ? `Issued ${monthLabel(row.issue_month_year)}` : "Issue date not specified"}
                    {" · "}
                    {row.no_expiry ? "No expiry" : row.expiry_month_year ? `Expires ${monthLabel(row.expiry_month_year)}` : "Expiry not specified"}
                  </small>
                  {row.description && <p>{row.description}</p>}
                </div>
                <div className="profile-record-actions">
                  <button className="btn btn-link btn-sm" type="button" onClick={() => openDialog("certifications", { ...emptyCert, ...row, description: row.description || "" })}>Edit</button>
                  <button className="btn btn-link btn-sm text-danger" type="button" onClick={() => removeRecord("certifications", row.cert_id)} aria-label={`Delete ${row.cert_name}`}><Trash2 size={16} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        icon={UserRound}
        title="Skills"
        action={<button className="btn btn-outline-primary btn-sm" type="button" onClick={() => openDialog("skills", { skills: [...profile.skills] })}><Pencil size={16} />Edit skills</button>}
      >
        {profile.skills.length === 0 ? <Empty>No skills added yet.</Empty> : (
          <div className="profile-chips">{profile.skills.map((skill) => <span className="profile-chip" key={skill}>{skill}</span>)}</div>
        )}
      </Section>

      <div className="profile-two-column">
        <Section icon={BookOpen} title="Education" action={<Link className="btn btn-link btn-sm" to="/applicant/resume">Edit on My Resume</Link>}>
          {profile.education.length === 0 ? <Empty>No education added yet.</Empty> : (
            <ul className="profile-records compact">
              {profile.education.map((row) => (
                <li key={row.education_id}>
                  <div>
                    <strong>{row.qualification}</strong>
                    <span>{row.institution}</span>
                    <small>{row.is_current_study ? "Currently studying" : row.finished_year ? `Completed ${row.finished_year}` : "Completion not specified"}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section icon={Languages} title="Languages" action={<Link className="btn btn-link btn-sm" to="/applicant/resume">Edit on My Resume</Link>}>
          {profile.languages.length === 0 ? <Empty>No languages added yet.</Empty> : (
            <dl className="profile-language-list">
              <dt>Reading</dt><dd>{readLanguages.join(", ") || "None"}</dd>
              <dt>Writing</dt><dd>{writeLanguages.join(", ") || "None"}</dd>
            </dl>
          )}
        </Section>
      </div>

      {dialog === "personal" && (
        <Dialog title="Edit personal details" onClose={closeDialog} saving={saving} onSubmit={() => save(() => accountApi.put("/profile", draft), "Personal details saved.")}>
          {dialogError && <div className="alert alert-danger" role="alert">{dialogError}</div>}
          <div className="form-grid two-columns">
            <Field label="First name" required><input className="form-control" value={draft.first_name} onChange={update("first_name")} maxLength={50} required /></Field>
            <Field label="Last name"><input className="form-control" value={draft.last_name} onChange={update("last_name")} maxLength={50} /></Field>
          </div>
          <Field label="Home location"><input className="form-control" value={draft.home_location} onChange={update("home_location")} maxLength={100} /></Field>
          <div className="form-grid profile-phone-grid">
            <Field label="Code">
              <select className="form-select" value={draft.country_code} onChange={update("country_code")}>
                {[...new Set([draft.country_code, ...COUNTRY_CODES].filter(Boolean))].map((code) => <option key={code} value={code}>{code}</option>)}
              </select>
            </Field>
            <Field label="Contact number"><input className="form-control" inputMode="tel" value={draft.contact_number} onChange={update("contact_number")} maxLength={20} /></Field>
          </div>
          <p className="form-text">Your email address is your sign-in name and cannot be changed here.</p>
        </Dialog>
      )}

      {dialog === "summary" && (
        <Dialog title="Personal summary" onClose={closeDialog} saving={saving} onSubmit={() => save(() => accountApi.put("/profile/summary", draft), "Summary saved.")}>
          {dialogError && <div className="alert alert-danger" role="alert">{dialogError}</div>}
          <Field label="Summary">
            <textarea className="form-control" rows={6} value={draft.personal_summary} onChange={update("personal_summary")} maxLength={2000} />
          </Field>
        </Dialog>
      )}

      {dialog === "career" && (
        <Dialog
          title={draft.role_id ? "Edit role" : "Add role"}
          onClose={closeDialog}
          saving={saving}
          onSubmit={() => {
            const body = {
              job_title: draft.job_title.trim(),
              company_name: draft.company_name.trim(),
              description: (draft.description || "").trim(),
              is_current_role: Boolean(draft.is_current_role),
              start_month_year: draft.start_month_year || null,
              end_month_year: draft.is_current_role ? null : draft.end_month_year || null,
            };
            save(() => (draft.role_id ? accountApi.put(`/profile/career/${draft.role_id}`, body) : accountApi.post("/profile/career", body)), "Role saved.");
          }}
        >
          {dialogError && <div className="alert alert-danger" role="alert">{dialogError}</div>}
          <Field label="Job title" required><input className="form-control" value={draft.job_title} onChange={update("job_title")} maxLength={100} required /></Field>
          <Field label="Company" required><input className="form-control" value={draft.company_name} onChange={update("company_name")} maxLength={100} required /></Field>
          <div className="form-grid two-columns">
            <Field label="Start month"><input className="form-control" type="month" value={draft.start_month_year || ""} onChange={update("start_month_year")} /></Field>
            <Field label="End month"><input className="form-control" type="month" value={draft.is_current_role ? "" : draft.end_month_year || ""} onChange={update("end_month_year")} disabled={draft.is_current_role} /></Field>
          </div>
          <label className="form-check">
            <input className="form-check-input" type="checkbox" checked={Boolean(draft.is_current_role)} onChange={update("is_current_role")} />
            <span className="form-check-label">I currently work in this role</span>
          </label>
          <Field label="Description"><textarea className="form-control" rows={4} value={draft.description} onChange={update("description")} maxLength={2000} /></Field>
        </Dialog>
      )}

      {dialog === "certifications" && (
        <Dialog
          title={draft.cert_id ? "Edit certification" : "Add certification"}
          onClose={closeDialog}
          saving={saving}
          onSubmit={() => {
            const body = {
              cert_name: draft.cert_name.trim(),
              issuing_org: draft.issuing_org.trim(),
              description: (draft.description || "").trim(),
              no_expiry: Boolean(draft.no_expiry),
              issue_month_year: draft.issue_month_year || null,
              expiry_month_year: draft.no_expiry ? null : draft.expiry_month_year || null,
            };
            save(() => (draft.cert_id ? accountApi.put(`/profile/certifications/${draft.cert_id}`, body) : accountApi.post("/profile/certifications", body)), "Certification saved.");
          }}
        >
          {dialogError && <div className="alert alert-danger" role="alert">{dialogError}</div>}
          <Field label="Name" required><input className="form-control" value={draft.cert_name} onChange={update("cert_name")} maxLength={100} required /></Field>
          <Field label="Issuing organisation"><input className="form-control" value={draft.issuing_org} onChange={update("issuing_org")} maxLength={100} /></Field>
          <div className="form-grid two-columns">
            <Field label="Issue month"><input className="form-control" type="month" value={draft.issue_month_year || ""} onChange={update("issue_month_year")} /></Field>
            <Field label="Expiry month"><input className="form-control" type="month" value={draft.no_expiry ? "" : draft.expiry_month_year || ""} onChange={update("expiry_month_year")} disabled={draft.no_expiry} /></Field>
          </div>
          <label className="form-check">
            <input className="form-check-input" type="checkbox" checked={Boolean(draft.no_expiry)} onChange={update("no_expiry")} />
            <span className="form-check-label">This credential does not expire</span>
          </label>
          <Field label="Description"><textarea className="form-control" rows={3} value={draft.description} onChange={update("description")} maxLength={2000} /></Field>
        </Dialog>
      )}

      {dialog === "skills" && (
        <Dialog title="Edit skills" onClose={closeDialog} saving={saving} onSubmit={() => save(() => accountApi.put("/profile/skills", { skills: draft.skills }), "Skills saved.")}>
          {dialogError && <div className="alert alert-danger" role="alert">{dialogError}</div>}
          <div className="profile-skill-input">
            <input
              className="form-control"
              value={skillInput}
              onChange={(event) => setSkillInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSkill(); } }}
              placeholder="Type a skill and press Enter"
              aria-label="New skill"
              maxLength={50}
            />
            <button className="btn btn-outline-primary" type="button" onClick={addSkill}><Plus size={16} />Add</button>
          </div>
          <div className="profile-chips">
            {(draft.skills || []).length === 0 && <span className="profile-empty">No skills have been added.</span>}
            {(draft.skills || []).map((skill) => (
              <span className="profile-chip" key={skill}>
                {skill}
                <button type="button" aria-label={`Remove ${skill}`} onClick={() => setDraft({ skills: draft.skills.filter((item) => item !== skill) })}><X size={14} /></button>
              </span>
            ))}
          </div>
        </Dialog>
      )}
    </div>
  );
}
