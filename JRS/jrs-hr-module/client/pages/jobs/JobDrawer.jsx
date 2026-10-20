import { useEffect, useId, useRef, useState } from "react";
import { ErrorBox } from "../../src/shared";
import { DateField } from "./DateField";
import { displayDate, jobDraft, jobPayload } from "./model";

const sections = ["Overview", "Requirements", "Publishing"];
function Field({ label, value, onChange, multiline = false, ...props }) {
  const id = useId(),
    Control = multiline ? "textarea" : "input";
  return (
    <div className={`job-field${multiline ? " job-field-wide" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <Control
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...props}
      />
    </div>
  );
}
function Select({ label, value, options, onChange }) {
  const id = useId();
  return (
    <div className="job-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>
    </div>
  );
}

export function JobDrawer({
  job,
  templates,
  onClose,
  onSave,
  onStatus,
  onApplications,
  onRefresh,
}) {
  const dialog = useRef(null),
    content = useRef(null),
    formId = useId();
  const [draft, setDraft] = useState(() => jobDraft(job)),
    [baseline, setBaseline] = useState(() => JSON.stringify(jobDraft(job)));
  const [editing, setEditing] = useState(!job),
    [section, setSection] = useState("Overview"),
    [template, setTemplate] = useState("");
  const [error, setError] = useState(null),
    [busy, setBusy] = useState(false),
    [confirmation, setConfirmation] = useState(null);
  const dirty = editing && JSON.stringify(draft) !== baseline;
  useEffect(() => {
    if (confirmation && content.current) content.current.scrollTop = 0;
  }, [confirmation]);
  const title = editing ? (job ? "Edit job" : "Create job") : job.title;
  useEffect(() => {
    const previous = document.activeElement,
      overflow = document.body.style.overflow;
    dialog.current.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.current?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  const change = (key) => (value) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
  };
  function close() {
    if (busy) return;
    if (dirty) setConfirmation("discard");
    else onClose();
  }
  function edit(event) {
    event.preventDefault();
    const value = jobDraft(job);
    setDraft(value);
    setBaseline(JSON.stringify(value));
    setSection("Overview");
    setError(null);
    setEditing(true);
  }
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    try {
      const payload = jobPayload(draft);
      setBusy(true);
      await onSave(payload);
      onClose();
    } catch (error) {
      setError(error);
      if (error.tab) setSection(error.tab);
      if (content.current) content.current.scrollTop = 0;
    } finally {
      setBusy(false);
    }
  }
  async function status() {
    setBusy(true);
    setError(null);
    try {
      await onStatus(job.id, job.status === "Closed" ? "Active" : "Closed");
      onClose();
    } catch (error) {
      setError(error);
      setConfirmation(null);
    } finally {
      setBusy(false);
    }
  }
  const count = draft.requirements.split(/\r?\n/).filter((row) => row.trim()).length;
  return (
    <dialog
      ref={dialog}
      className="job-drawer"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header className="job-drawer-heading">
        <div>
          <span className="job-kicker">{editing ? "JOB EDITOR" : "JOB DETAILS"}</span>
          <h2>{title}</h2>
          {!editing && (
            <span className={`job-status job-status-${job.status.toLowerCase()}`}>
              {job.status}
            </span>
          )}
        </div>
        <button
          type="button"
          className="job-icon-button"
          aria-label="Close job drawer"
          disabled={busy}
          onClick={close}
        >
          ×
        </button>
      </header>
      <div className="job-drawer-tabs" role="tablist" aria-label="Job details sections">
        {sections.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={section === name}
            onClick={() => setSection(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <div ref={content} className="job-drawer-content">
        <ErrorBox error={error} />
        {error?.status === 409 && (
          <button
            type="button"
            className="job-secondary"
            disabled={busy}
            onClick={async () => {
              try {
                await onRefresh();
                setError(new Error("Latest data loaded. Review your edits before saving again."));
              } catch (error) {
                setError(error);
              }
            }}
          >
            Load latest workspace
          </button>
        )}
        {confirmation && (
          <section
            className="job-confirmation"
            role="alertdialog"
            aria-label={
              confirmation === "discard"
                ? "Discard unsaved changes?"
                : job.status === "Closed"
                  ? "Reopen this job?"
                  : "Close this job?"
            }
          >
            <h3>
              {confirmation === "discard"
                ? "Discard unsaved changes?"
                : job.status === "Closed"
                  ? "Reopen this job?"
                  : "Close this job?"}
            </h3>
            <p>
              {confirmation === "discard"
                ? "Your unsaved edits will be discarded."
                : job.status === "Closed"
                  ? "This job will be active again."
                  : "Existing applications will be retained. This job will no longer be active."}
            </p>
            <div className="job-confirmation-actions">
              <button
                type="button"
                className="job-secondary"
                disabled={busy}
                onClick={() => setConfirmation(null)}
              >
                {confirmation === "discard" ? "Keep editing" : "Cancel"}
              </button>
              <button
                type="button"
                className="job-primary"
                disabled={busy}
                onClick={confirmation === "discard" ? onClose : status}
              >
                {confirmation === "discard"
                  ? "Discard changes"
                  : job.status === "Closed"
                    ? "Confirm reopen"
                    : "Confirm close"}
              </button>
            </div>
          </section>
        )}
        {editing ? (
          <form id={formId} noValidate onSubmit={save}>
            <fieldset disabled={busy || !!confirmation} className="job-editor-fields">
              {section === "Overview" && (
                <>
                  <div className="job-section-title">
                    <h3>Position information</h3>
                  </div>
                  <div className="job-form-grid">
                    <Field
                      label="Job title"
                      value={draft.title}
                      onChange={change("title")}
                      maxLength={100}
                    />
                    <Field
                      label="Department"
                      value={draft.department}
                      onChange={change("department")}
                      maxLength={100}
                    />
                    <Select
                      label="Employment type"
                      value={draft.type}
                      options={["Full-time", "Part-time", "Contract", "Internship"]}
                      onChange={change("type")}
                    />
                    <Select
                      label="Work arrangement"
                      value={draft.mode}
                      options={["On-site", "Hybrid", "Remote"]}
                      onChange={change("mode")}
                    />
                    <Field
                      label="Location"
                      value={draft.location}
                      onChange={change("location")}
                      maxLength={100}
                    />
                    <Field
                      label="Experience"
                      value={draft.experience}
                      onChange={change("experience")}
                      maxLength={100}
                    />
                    <Field
                      label="Required skills"
                      value={draft.skills}
                      onChange={change("skills")}
                      maxLength={500}
                    />
                    <Select
                      label="Posting status"
                      value={draft.status}
                      options={["Draft", "Active", "Closed"]}
                      onChange={change("status")}
                    />
                  </div>
                </>
              )}
              {section === "Requirements" && (
                <>
                  <div className="job-section-title">
                    <h3>Description & requirements</h3>
                  </div>
                  <Field
                    label="Job description"
                    multiline
                    rows={6}
                    maxLength={3000}
                    value={draft.description}
                    onChange={change("description")}
                  />
                  <div className="job-template-control">
                    <label>
                      Requirement template
                      <select
                        value={template}
                        onChange={(event) => setTemplate(event.target.value)}
                      >
                        <option value="">Choose a template</option>
                        {templates.map((item) => (
                          <option key={item.title}>{item.title}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="job-secondary"
                      type="button"
                      disabled={!template}
                      onClick={() =>
                        change("requirements")(
                          templates.find((item) => item.title === template).requirements.join("\n"),
                        )
                      }
                    >
                      Use template
                    </button>
                  </div>
                  <Field
                    label="Job requirements"
                    multiline
                    rows={12}
                    maxLength={3000}
                    value={draft.requirements}
                    onChange={change("requirements")}
                  />
                  <span className="job-field-hint">
                    {count} / 8–12 requirements · one criterion per line
                  </span>
                </>
              )}
              {section === "Publishing" && (
                <>
                  <div className="job-section-title">
                    <h3>Compensation & publishing</h3>
                  </div>
                  <div className="job-form-grid">
                    <Field
                      label="Salary range"
                      value={draft.salaryRange}
                      onChange={change("salaryRange")}
                      maxLength={80}
                      placeholder="e.g. SGD 5,000 - 6,000"
                    />
                    {["Closing date", "Publish date", "Unpublish date"].map((label, index) => {
                      const key = ["closingDate", "publishDate", "unpublishDate"][index];
                      return (
                        <DateField
                          key={key}
                          label={label}
                          value={draft[key]}
                          onChange={change(key)}
                          disabled={busy}
                        />
                      );
                    })}
                  </div>
                </>
              )}
            </fieldset>
          </form>
        ) : (
          <section className="job-read-details" aria-label={section}>
            {section === "Overview" && (
              <>
                <h3>Position information</h3>
                <dl>
                  {[
                    ["Department", job.department],
                    ["Employment type", job.type],
                    ["Work arrangement", job.mode],
                    ["Location", job.location],
                    ["Experience", job.experience],
                    ["Applications", job.applications],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value === "" || value == null ? "—" : value}</dd>
                    </div>
                  ))}
                </dl>
                <h3>Required skills</h3>
                <div className="job-skill-list">
                  {job.skills.map((skill) => (
                    <span key={skill}>{skill}</span>
                  ))}
                </div>
              </>
            )}
            {section === "Requirements" && (
              <>
                <h3>Job description</h3>
                <p className="job-description">{job.description}</p>
                <h3>Job requirements</h3>
                <ol>
                  {job.requirements.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ol>
              </>
            )}
            {section === "Publishing" && (
              <>
                <h3>Compensation & publishing</h3>
                <dl>
                  {[
                    ["Salary range", job.salaryRange],
                    ["Closing date", displayDate(job.closingDate)],
                    ["Publish date", displayDate(job.publishDate)],
                    ["Unpublish date", displayDate(job.unpublishDate)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value || "Not set"}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </section>
        )}
      </div>
      <footer className="job-drawer-footer">
        {editing ? (
          <>
            <span className="job-draft-state">
              {dirty ? "Unsaved changes" : job ? "No unsaved changes" : "New job"}
            </span>
            <div>
              <button type="button" className="job-secondary" disabled={busy} onClick={close}>
                Cancel editing
              </button>
              <button
                key="save-job"
                form={formId}
                className="job-primary"
                type="submit"
                disabled={busy || !!confirmation}
              >
                {busy ? "Saving…" : "Save job"}
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              className="job-secondary"
              disabled={busy}
              onClick={() => setConfirmation("status")}
            >
              {job.status === "Closed" ? "Reopen job" : "Close job"}
            </button>
            <div>
              <button
                type="button"
                className="job-secondary"
                disabled={busy}
                onClick={() => onApplications(job.id)}
              >
                View applications
              </button>
              <button
                key="edit-job"
                type="button"
                className="job-primary"
                disabled={busy}
                onClick={edit}
              >
                Edit job
              </button>
            </div>
          </>
        )}
      </footer>
    </dialog>
  );
}
