import { useEffect, useId, useRef, useState } from "react";
import { api } from "./api";

export function useLoad(url) {
  const [state, setState] = useState({ data: null, busy: true, error: null });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ data: null, busy: true, error: null });
    api
      .request(url, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ data, busy: false, error: null });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ data: null, busy: false, error });
      });
    return () => controller.abort();
  }, [url, revision]);
  return { ...state, reload: () => setRevision((v) => v + 1) };
}
export const dateTime = (value) =>
  value
    ? new Intl.DateTimeFormat("en-SG", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Singapore",
      }).format(new Date(value))
    : "—";
export const usageTypes = {
  INTERVIEW_INVITE: "Interview invite",
  OFFER_LETTER: "Offer letter",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  IN_PROGRESS: "In progress",
};
export function ErrorBox({ error, retry }) {
  if (!error) return null;
  return (
    <div className="alert alert-danger" role="alert">
      <div>{error.message || String(error)}</div>
      {error.fields?.length > 0 && (
        <ul className="mb-0 mt-2">
          {error.fields.map((e, i) => (
            <li key={i}>
              {e.field}: {e.message}
            </li>
          ))}
        </ul>
      )}
      {retry && (
        <button className="btn btn-sm btn-outline-danger mt-2" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading-state" role="status">
      <span className="spinner-border spinner-border-sm" aria-hidden="true" />{" "}
      Loading…
    </div>
  );
}
export function Empty({ title, children }) {
  return (
    <div className="empty-state">
      <span className="empty-symbol" aria-hidden="true">
        ✓
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
export function PageHeading({
  eyebrow = "HR WORKSPACE",
  title,
  description,
  action,
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="subtle mb-0">{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Field({ label, children, help }) {
  const id = useId();
  return (
    <div className="field">
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      {children(id)}
      {help && <small className="subtle d-block mt-1">{help}</small>}
    </div>
  );
}
export function Pagination({ data, onPage }) {
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <nav className="pagination-row" aria-label="Results pages">
      <span className="subtle">
        {data.total
          ? `${(data.page - 1) * data.pageSize + 1}–${Math.min(data.page * data.pageSize, data.total)} of ${data.total}`
          : "0 results"}
      </span>
      <div className="d-flex gap-2 align-items-center">
        <button
          className="btn btn-light btn-sm"
          disabled={data.page <= 1}
          onClick={() => onPage(data.page - 1)}
        >
          Previous
        </button>
        <span>
          Page {data.page} of {pages}
        </span>
        <button
          className="btn btn-light btn-sm"
          disabled={data.page >= pages}
          onClick={() => onPage(data.page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
export function Modal({ title, children, onClose, footer }) {
  const ref = useRef(null),
    titleId = useId();
  useEffect(() => {
    const dialog = ref.current,
      previous = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="jrs-dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="dialog-body">{children}</div>
      <div className="dialog-footer">
        {footer || (
          <button className="btn btn-outline-secondary" onClick={onClose}>
            Close
          </button>
        )}
      </div>
    </dialog>
  );
}
export function Avatar({ user, large = false }) {
  return (
    <span className={`avatar ${large ? "avatar-large" : ""}`}>
      {user.photoUrl ? (
        <img src={user.photoUrl} alt={`${user.fullName}'s profile`} />
      ) : (
        <span aria-hidden="true">
          {user.fullName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((n) => n[0])
            .join("")}
        </span>
      )}
    </span>
  );
}
export function DateFields({ values, setValues }) {
  return (
    <>
      <Field label="From date">
        {(id) => (
          <input
            id={id}
            type="date"
            className="form-control"
            value={values.from}
            onChange={(e) => setValues((v) => ({ ...v, from: e.target.value }))}
          />
        )}
      </Field>
      <Field label="To date">
        {(id) => (
          <input
            id={id}
            type="date"
            className="form-control"
            value={values.to}
            min={values.from || undefined}
            onChange={(e) => setValues((v) => ({ ...v, to: e.target.value }))}
          />
        )}
      </Field>
    </>
  );
}
