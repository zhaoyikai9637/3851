import { useEffect, useId, useRef, useState } from "react";
import { useLocation, useOutletContext } from "react-router-dom";
import { ErrorBox } from "../../src/shared";
import { DateField } from "./DateField";
import { displayDate, jobDraft, jobPayload } from "./model";
import { jobBulletPoints } from "../../../shared/job-text.mjs";

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

export function JobDetails({
  job,
  templates,
  onClose,
  onSave,
  onStatus,
  onApplications,
  onRefresh,
}) {
  const layout = useOutletContext(), location = useLocation();
  const closeRef = useRef(null);
  const heading = useRef(null),
    content = useRef(null),
    formId = useId();
  const [draft, setDraft] = useState(() => jobDraft(job)),
    [baseline, setBaseline] = useState(() => JSON.stringify(jobDraft(job)));
  const [editing, setEditing] = useState(!job),
    [template, setTemplate] = useState("");
  const [error, setError] = useState(null),
    [busy, setBusy] = useState(false),
    [confirmation, setConfirmation] = useState(null);
  const dirty = editing && JSON.stringify(draft) !== baseline;
  useEffect(() => {
    if (confirmation) content.current?.scrollIntoView?.({block:'start'});
  }, [confirmation]);
  const title = editing ? (job ? "Edit posting" : "Add posting") : job.title;
  closeRef.current = close;
  useEffect(() => {
    layout?.setTrail({owner:location.key, items:[{label:'Job posting',route:'list'},{label:title}],open:()=>closeRef.current()});
    return () => layout?.setTrail(null);
  },[layout?.setTrail,location.key,title]);
  useEffect(() => {
    heading.current?.focus({preventScroll:true});
    heading.current?.closest('.job-details-page')?.scrollIntoView?.({block:'start'});
  }, [editing]);
  useEffect(()=>{
    if(!dirty)return;
    const warn=event=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',warn);
    return ()=>window.removeEventListener('beforeunload',warn);
  },[dirty]);
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
    setError(null);
    setEditing(true);
  }
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    try {
      const payload = jobPayload({ ...draft, status: job ? jobDraft(job).status : "Draft" });
      setBusy(true);
      await onSave(payload);
      onClose();
    } catch (error) {
      setError(error);
      content.current?.scrollIntoView?.({block:'start'});
    } finally {
      setBusy(false);
    }
  }
  const draftPosting = job?.status === "Draft";
  const closedPosting = ["Closed", "Stopped"].includes(job?.status);
  const statusTitle = draftPosting ? "Publish posting?" : closedPosting ? "Reopen recruitment?" : "Close recruitment?";
  const statusConfirm = draftPosting ? "Publish posting" : closedPosting ? "Confirm reopen" : "Confirm close";
  const statusDescription = draftPosting ? "This posting will become active. Applicants can see and apply for it when its publication dates allow." : closedPosting ? "New applications and existing application processing will resume. Publication dates still control candidate visibility." : "New applications and advancement through interviews and offers will stop. Existing records remain available.";
  async function status() {
    setBusy(true);
    setError(null);
    try {
      await onStatus(job.id, draftPosting || closedPosting ? "Active" : "Closed");
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
    <section
      className="job-details-page yyb-pages"
      aria-label={title}
    >
      <h2 ref={heading} tabIndex={-1} className="visually-hidden">{title}</h2>
      <div ref={content} className="job-page-content">
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
                : statusTitle
            }
          >
            <h3>
              {confirmation === "discard"
                ? "Discard unsaved changes?"
                : statusTitle}
            </h3>
            <p>
              {confirmation === "discard"
                ? "Your unsaved edits will be discarded."
                : statusDescription}
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
                  : statusConfirm}
              </button>
            </div>
          </section>
        )}
        {editing ? (
          <form id={formId} noValidate onSubmit={save}>
            <fieldset disabled={busy || !!confirmation} className="job-editor-fields">
                <section className="job-form-section" aria-label="Position information">
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
                      label="Salary range"
                      value={draft.salaryRange}
                      options={[...new Set(["", "SGD 1,000 - 3,000", "SGD 3,000 - 5,000", "SGD 5,000 - 8,000", "SGD 8,000 - 12,000", "SGD 12,000 - 16,000", "SGD 16,000 - 20,000", job?.salaryRange].filter(value => value != null))]}
                      onChange={change("salaryRange")}
                    />
                    {["Application deadline", "Publish date"].map(
                      (label, index) => {
                        const key = ["closingDate", "publishDate"][index];
                        return (
                          <DateField
                            key={key}
                            label={label}
                            value={draft[key]}
                            onChange={change(key)}
                            disabled={busy}
                          />
                        );
                      },
                    )}
                  </div>
                </section>
                <section className="job-form-section" aria-label="Description and requirements">
                  <Field
                    label="Job description"
                    multiline
                    rows={5}
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
                    rows={5}
                    maxLength={3000}
                    value={draft.requirements}
                    onChange={change("requirements")}
                  />
                  <span className="job-field-hint">
                    {count} / 8–12 requirements · one criterion per line
                  </span>
                </section>

            </fieldset>
          </form>
        ) : (
          <section className="job-read-details" aria-label="Job information">
              {draftPosting && <p className="notice gray">This posting is a draft. Select Publish posting when it is ready for applicants.</p>}
              <>
                <h3>Position information</h3>
                <dl>
                  {[
                    ["Department", job.department],
                    ["Employment type", job.type],
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
              <>
                <h3>Job description</h3>
                <ul className="job-bullet-list">{jobBulletPoints(job.description).map((item, index) => <li key={index}>{item}</li>)}</ul>
                <h3>Job requirements</h3>
                <ul className="job-bullet-list">
                  {jobBulletPoints(job.requirements).map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </>
              <>
                <h3>Compensation & publishing</h3>
                <dl>
                  {[
                    ["Salary range", job.salaryRange],
                    ["Application deadline", displayDate(job.closingDate)],
                    ["Publish date", displayDate(job.publishDate)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value || "Not set"}</dd>
                    </div>
                  ))}
                </dl>
              </>
          </section>
        )}
      </div>
      <footer className="job-page-footer">
        {editing ? (
          <>
            <span className="job-draft-state">
              {dirty ? "Unsaved changes" : job ? "No unsaved changes" : "New job"}
            </span>
            <div>
              <button type="button" className="job-secondary" disabled={busy} onClick={close}>
                Cancel editing
              </button>
              <button form={formId} className="job-primary" type="submit" disabled={busy || !!confirmation}>
                {busy ? "Saving…" : "Save"}
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
              {draftPosting ? "Publish posting" : closedPosting ? "Reopen recruitment" : "Close recruitment"}
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
    </section>
  );
}
