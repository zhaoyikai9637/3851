import { useEffect, useState } from "react";
import { api, query } from "../api";
import {
  DateFields,
  dateTime,
  Empty,
  ErrorBox,
  Field,
  Loading,
  Modal,
  PageHeading,
  Pagination,
  historicalDateRange,
  useLoad,
} from "../shared";

const initial = {
  read: "all",
  type: "",
  from: "",
  to: "",
  page: 1,
  pageSize: 8,
};
export function Notifications() {
  const [filters, setFilters] = useState(initial),
    [draft, setDraft] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [message, setMessage] = useState(""),
    [application, setApplication] = useState(null);
  const load = useLoad(`/api/hr/notifications?${query(filters)}`);
  useEffect(() => {
    if (load.data && filters.page > 1 && !load.data.items.length)
      setFilters((v) => ({
        ...v,
        page: Math.max(1, Math.ceil(load.data.total / v.pageSize)),
      }));
  }, [load.data, filters.page]);
  async function mark(id) {
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      await api.request(
        id
          ? `/api/hr/notifications/${id}/read`
          : "/api/hr/notifications/read-all",
        { method: "PATCH" },
      );
      setMessage(
        id
          ? "Notification marked as read."
          : "All notifications marked as read.",
      );
      load.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  function apply(e) {
    e.preventDefault();
    setError(null);
    const { from, to, error: dateError } = historicalDateRange(
      draft.from,
      draft.to,
    );
    if (dateError) return setError(new Error(dateError));
    setFilters((v) => ({
      ...v,
      type: draft.type,
      from,
      to,
      page: 1,
    }));
  }
  return (
    <>
      <PageHeading
        title="Notification Center"
        description="Stay up to date with your recruitment activity."
        action={
          <button
            className="btn btn-primary"
            disabled={busy || load.busy || !load.data?.unread}
            onClick={() => mark()}
          >
            ✓ Mark all as read
          </button>
        }
      />
      <section className="surface">
        <div className="section-heading">
          <div className="filter-tabs">
            <button
              className={filters.read === "all" ? "active" : ""}
              onClick={() =>
                setFilters((v) => ({ ...v, read: "all", page: 1 }))
              }
              aria-pressed={filters.read === "all"}
            >
              All notifications
            </button>
            <button
              className={filters.read === "unread" ? "active" : ""}
              onClick={() =>
                setFilters((v) => ({ ...v, read: "unread", page: 1 }))
              }
              aria-pressed={filters.read === "unread"}
            >
              Unread{" "}
              <span className="count-pill">{load.data?.unread ?? "—"}</span>
            </button>
          </div>
          <span className="subtle small">Your activity inbox</span>
        </div>
        <form className="filter-form" onSubmit={apply}>
          <Field label="Notification type">
            {(id) => (
              <select
                id={id}
                className="form-select"
                value={draft.type}
                onChange={(e) =>
                  setDraft((v) => ({ ...v, type: e.target.value }))
                }
              >
                <option value="">All types</option>
                <option value="NEW_APPLICATION">New application</option>
                <option value="STATUS_UPDATED">Status updated</option>
              </select>
            )}
          </Field>
          <DateFields values={draft} setValues={setDraft} />
          <div className="filter-actions">
            <button className="btn btn-primary">Apply filters</button>
            <button
              type="button"
              className="btn btn-light"
              onClick={() => {
                setDraft(initial);
                setFilters(initial);
                setError(null);
              }}
            >
              Clear
            </button>
          </div>
        </form>
        <div className="surface-content">
          <ErrorBox error={error} />
          <div role="status" className="success-message">
            {message}
          </div>
          {load.busy ? (
            <Loading />
          ) : load.error ? (
            <ErrorBox error={load.error} retry={load.reload} />
          ) : (
            load.data && (
              <>
                {load.data.items.length ? (
                  <ul className="notification-list">
                    {load.data.items.map((item) => (
                      <li
                        key={item.notificationId}
                        className={`notification-card ${item.isRead ? "" : "unread"}`}
                      >
                        <span
                          className={`notification-symbol ${item.notificationType === "NEW_APPLICATION" ? "blue" : "green"}`}
                          aria-hidden="true"
                        >
                          {item.notificationType === "NEW_APPLICATION"
                            ? "+"
                            : "✓"}
                        </span>
                        <div className="notification-copy">
                          <div className="d-flex gap-2 align-items-center flex-wrap">
                            <h2>{item.title}</h2>
                            {!item.isRead && (
                              <span className="badge-soft">Unread</span>
                            )}
                          </div>
                          <p>{item.message}</p>
                          <small>
                            {item.sourceModule}{" "}
                            <span aria-hidden="true">·</span>{" "}
                            {dateTime(item.createdAt)}
                          </small>
                        </div>
                        <div className="notification-actions">
                          {item.applicationId && (
                            <button
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => setApplication(item.applicationId)}
                              aria-label={`View application for ${item.title}`}
                            >
                              View
                            </button>
                          )}
                          {!item.isRead && (
                            <button
                              className="text-button"
                              disabled={busy}
                              onClick={() => mark(item.notificationId)}
                              aria-label={`Mark ${item.title} as read`}
                            >
                              Mark as read
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty
                    title={
                      filters.read === "unread"
                        ? "You're all caught up"
                        : "No notifications found"
                    }
                  >
                    Try adjusting your filters or check back later.
                  </Empty>
                )}
                <Pagination
                  data={load.data}
                  onPage={(page) => setFilters((v) => ({ ...v, page }))}
                />
              </>
            )
          )}
        </div>
      </section>
      {application && (
        <ApplicationSummary
          id={application}
          onClose={() => setApplication(null)}
        />
      )}
    </>
  );
}
function ApplicationSummary({ id, onClose }) {
  const { data, busy, error, reload } = useLoad(`/api/hr/applications/${id}`);
  return (
    <Modal title="Application summary" onClose={onClose}>
      <p className="notice">
        Local fictional demo · Read-only summary. Recruitment actions are managed by
        the Applications team.
      </p>
      {busy ? (
        <Loading />
      ) : error ? (
        <ErrorBox error={error} retry={reload} />
      ) : (
        <dl className="detail-grid">
          <div>
            <dt>Candidate</dt>
            <dd>{data.candidateName}</dd>
          </div>
          <div>
            <dt>Position</dt>
            <dd>{data.positionTitle}</dd>
          </div>
          <div>
            <dt>Current status</dt>
            <dd>{data.currentStatus}</dd>
          </div>
          <div>
            <dt>Applied at</dt>
            <dd>{dateTime(data.appliedAt)}</dd>
          </div>
        </dl>
      )}
    </Modal>
  );
}
