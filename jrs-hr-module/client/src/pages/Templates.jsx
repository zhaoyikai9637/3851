import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import {
  Empty,
  ErrorBox,
  Field,
  Loading,
  Modal,
  PageHeading,
  usageTypes,
  useLoad,
} from "../shared";

const blank = {
  templateName: "",
  subject: "",
  body: "",
  usageType: "INTERVIEW_INVITE",
};
const tokens = ["CandidateName", "JobTitle", "CompanyName", "HRName"];
const fieldsOf = (row) =>
  row
    ? Object.fromEntries(Object.keys(blank).map((key) => [key, row[key]]))
    : { ...blank };
export function Templates() {
  const load = useLoad("/api/hr/templates");
  const [selected, setSelected] = useState(undefined),
    [dirty, setDirty] = useState(false),
    [confirmation, setConfirmation] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [message, setMessage] = useState("");
  const activeId =
    selected === undefined
      ? (load.data?.items[0]?.templateId ?? null)
      : selected;
  function choose(id) {
    if (id === activeId) return;
    if (dirty) setConfirmation({ kind: "discard", id });
    else {
      setSelected(id);
      setMessage("");
    }
  }
  async function confirm() {
    if (confirmation.kind === "discard") {
      setDirty(false);
      setSelected(confirmation.id);
      setConfirmation(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.request(`/api/hr/templates/${activeId}`, { method: "DELETE" });
      setSelected(undefined);
      setDirty(false);
      setConfirmation(null);
      setMessage(
        "Template deleted. Existing email history has been preserved.",
      );
      load.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const item = load.data?.items.find((t) => t.templateId === activeId);
  return (
    <>
      <PageHeading
        title="Email Templates"
        description="Give every recruitment message a thoughtful starting point."
        action={
          <button
            className="btn btn-primary"
            disabled={load.busy}
            onClick={() => choose(null)}
          >
            + Create template
          </button>
        }
      />
      <div role="status" className="success-message">
        {message}
      </div>
      {load.busy ? (
        <Loading />
      ) : load.error ? (
        <ErrorBox error={load.error} retry={load.reload} />
      ) : (
        load.data && (
          <div className="templates-grid">
            <section className="surface template-list-panel">
              <div className="section-heading">
                <h2>Templates</h2>
                <span className="section-count">
                  {load.data.items.length} saved
                </span>
              </div>
              <div className="template-list">
                {load.data.items.length ? (
                  load.data.items.map((t) => (
                    <button
                      key={t.templateId}
                      className={`template-option ${activeId === t.templateId ? "selected" : ""}`}
                      onClick={() => choose(t.templateId)}
                      aria-pressed={activeId === t.templateId}
                    >
                      <span className="template-icon" aria-hidden="true">
                        ✉
                      </span>
                      <span>
                        <strong>{t.templateName}</strong>
                        <small>{usageTypes[t.usageType] || t.usageType}</small>
                      </span>
                      <span aria-hidden="true">›</span>
                    </button>
                  ))
                ) : (
                  <Empty title="No templates yet">
                    Create a template to get started.
                  </Empty>
                )}
              </div>
              <p className="template-footnote">
                Shared templates for your HR team.
              </p>
            </section>
            <TemplateEditor
              key={activeId ?? "new"}
              template={item}
              onDirty={setDirty}
              onDelete={() => {
                setError(null);
                setConfirmation({ kind: "delete" });
              }}
              onSaved={(id) => {
                setSelected(id);
                setDirty(false);
                setMessage("Template saved.");
                load.reload();
              }}
            />
          </div>
        )
      )}
      {confirmation && (
        <Modal
          title={
            confirmation.kind === "delete"
              ? "Delete this template?"
              : "Discard unsaved changes?"
          }
          onClose={() => !busy && setConfirmation(null)}
          footer={
            <>
              <button
                className="btn btn-outline-secondary"
                disabled={busy}
                onClick={() => setConfirmation(null)}
              >
                Keep editing
              </button>
              <button
                className="btn btn-danger"
                disabled={busy}
                onClick={confirm}
              >
                {busy
                  ? "Deleting…"
                  : confirmation.kind === "delete"
                    ? "Delete template"
                    : "Discard changes"}
              </button>
            </>
          }
        >
          <p>
            {confirmation.kind === "delete"
              ? "This template will be removed from the active list. Previously sent emails keep their original content. Its name remains reserved."
              : "Your changes have not been saved. Continue to another template?"}
          </p>
          <ErrorBox error={error} />
        </Modal>
      )}
    </>
  );
}
function TemplateEditor({ template, onDirty, onDelete, onSaved }) {
  const { user } = useAuth();
  const [form, setForm] = useState(() => fieldsOf(template)),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(false);
  const subjectRef = useRef(null),
    bodyRef = useRef(null),
    focused = useRef("body");
  const dirty = JSON.stringify(form) !== JSON.stringify(fieldsOf(template));
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const change = (key) => (e) =>
    setForm((v) => ({ ...v, [key]: e.target.value }));
  function insert(token) {
    const key = focused.current,
      el = key === "subject" ? subjectRef.current : bodyRef.current;
    const start = el.selectionStart ?? form[key].length,
      end = el.selectionEnd ?? start;
    setForm((v) => ({
      ...v,
      [key]: v[key].slice(0, start) + `[${token}]` + v[key].slice(end),
    }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length + 2, start + token.length + 2);
    });
  }
  async function save(e) {
    e.preventDefault();
    setError(null);
    const unknown = [
      ...(form.subject + "\n" + form.body).matchAll(
        /\[([A-Za-z][A-Za-z0-9_]*)\]/g,
      ),
    ].filter((m) => !tokens.includes(m[1]));
    if (unknown.length)
      return setError(
        new Error(
          `Unsupported variable: ${unknown[0][0]}. Choose one of the four supported variables.`,
        ),
      );
    if (form.subject.length > 255 || form.body.length > 20000)
      return setError(
        new Error(
          "Subject must be at most 255 characters and body at most 20,000 characters.",
        ),
      );
    setBusy(true);
    try {
      const saved = await api.request(
        template
          ? `/api/hr/templates/${template.templateId}`
          : "/api/hr/templates",
        { method: template ? "PUT" : "POST", body: form },
      );
      onSaved(saved.templateId);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const render = (text) =>
    text.replace(
      /\[([A-Za-z][A-Za-z0-9_]*)\]/g,
      (match, key) =>
        ({
          CandidateName: "Casey Taylor",
          JobTitle: "Software Developer",
          CompanyName: "JRS",
          HRName: user.fullName,
        })[key] || match,
    );
  return (
    <section className="surface template-editor">
      <div className="section-heading">
        <div>
          <h2>{template ? "Edit template" : "Create template"}</h2>
          <p className="subtle small mb-0">
            {dirty
              ? "Unsaved changes"
              : "Personalize messages with reusable variables."}
          </p>
        </div>
        <span className="badge-soft">Plain text</span>
      </div>
      <form onSubmit={save} className="editor-form">
        <ErrorBox error={error} />
        <fieldset disabled={busy}>
          <div className="two-fields">
            <Field label="Template name">
              {(id) => (
                <input
                  id={id}
                  className="form-control"
                  required
                  maxLength={150}
                  value={form.templateName}
                  onChange={change("templateName")}
                />
              )}
            </Field>
            <Field label="Usage type">
              {(id) => (
                <select
                  id={id}
                  className="form-select"
                  value={form.usageType}
                  onChange={change("usageType")}
                >
                  {Object.entries(usageTypes).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <Field label="Email subject">
            {(id) => (
              <input
                ref={subjectRef}
                id={id}
                className="form-control"
                required
                maxLength={255}
                value={form.subject}
                onFocus={() => {
                  focused.current = "subject";
                }}
                onChange={change("subject")}
              />
            )}
          </Field>
          <Field label="Email body">
            {(id) => (
              <textarea
                ref={bodyRef}
                id={id}
                className="form-control template-body"
                required
                maxLength={20000}
                rows={10}
                value={form.body}
                onFocus={() => {
                  focused.current = "body";
                }}
                onChange={change("body")}
              />
            )}
          </Field>
          <div className="variable-box">
            <strong>Insert a variable</strong>
            <p className="subtle small">
              Add to the subject or body at your cursor.
            </p>
            <div className="d-flex gap-2 flex-wrap">
              {tokens.map((token) => (
                <button
                  key={token}
                  type="button"
                  className="variable-button"
                  onClick={() => insert(token)}
                >
                  [{token}]
                </button>
              ))}
            </div>
          </div>
        </fieldset>
        <div className="editor-actions">
          <div>
            {template && (
              <button
                type="button"
                className="btn btn-outline-danger"
                disabled={busy}
                onClick={onDelete}
              >
                Delete
              </button>
            )}
            <button
              type="button"
              className="btn btn-light"
              onClick={() => setPreview(true)}
            >
              Preview
            </button>
          </div>
          <div>
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={busy || !dirty}
              onClick={() => {
                setForm(fieldsOf(template));
                setError(null);
              }}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={busy || (!dirty && !!template)}
            >
              {busy ? "Saving…" : "Save template"}
            </button>
          </div>
        </div>
      </form>
      {preview && (
        <Modal title="Template preview" onClose={() => setPreview(false)}>
          <p className="notice">Sample values only. No email is sent.</p>
          <dl>
            <dt>Subject</dt>
            <dd className="text-snapshot">{render(form.subject) || "—"}</dd>
          </dl>
          <div className="email-snapshot">
            {render(form.body) || "Add email content to preview it here."}
          </div>
        </Modal>
      )}
    </section>
  );
}
