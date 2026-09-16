import { useEffect, useMemo, useState } from "react";
import { api, query } from "../api";
import { Icon } from "../icons";
import {
  DateFields,
  dateTime,
  Empty,
  ErrorBox,
  Modal,
  PageHeading,
  Pagination,
  businessToday,
  historicalDateRange,
  useLoad,
} from "../shared";

const initial = {
  read: "all",
  search: "",
  type: "",
  from: "",
  to: "",
  page: 1,
  pageSize: 20,
};

const notificationPresentation = {
  NEW_APPLICATION: { icon: "applications", action: "Review application" },
  STATUS_UPDATED: { icon: "person", action: "View candidate" },
  INTERVIEW: { icon: "calendar", action: "Open interview" },
  MESSAGE: { icon: "mail", action: "Read message" },
  OFFER: { icon: "jobs", action: "Review offer" },
  SYSTEM: { icon: "bell", action: "View details" },
};

function businessDate(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.year}-${values.month}-${values.day}`;
}

function previousBusinessDate(today) {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function groupNotifications(items, now = new Date()) {
  const today = businessToday(now);
  const yesterday = previousBusinessDate(today);
  const groups = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Earlier", items: [] },
  ];
  for (const item of items) {
    const date = businessDate(item.createdAt);
    const group = date === today ? groups[0] : date === yesterday ? groups[1] : groups[2];
    group.items.push(item);
  }
  return groups.filter((group) => group.items.length);
}

function notificationTime(value, group, now = new Date()) {
  const date = new Date(value);
  if (group === "Today") {
    const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000));
    if (minutes < 1) return "Just now";
    if (minutes < 60)
      return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(-minutes, "minute");
    const hours = Math.max(1, Math.floor(minutes / 60));
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(-hours, "hour");
  }
  if (group === "Yesterday")
    return `Yesterday, ${new Intl.DateTimeFormat("en-SG", {
      timeStyle: "short",
      timeZone: "Asia/Singapore",
    }).format(date)}`;
  return dateTime(value);
}

function typeLabel(type) {
  return {
    NEW_APPLICATION: "New application",
    STATUS_UPDATED: "Status updated",
  }[type] || type;
}

function NotificationSkeleton() {
  return (
    <div className="notification-skeleton" role="status" aria-label="Loading notifications">
      {[1, 2, 3].map((item) => (
        <div className="notification-skeleton-row" key={item} aria-hidden="true">
          <span />
          <div>
            <i />
            <i />
          </div>
        </div>
      ))}
    </div>
  );
}

function NotificationRow({ item, group, busy, onOpen, onMark }) {
  const presentation =
    notificationPresentation[item.notificationType] || notificationPresentation.SYSTEM;
  const details = (
    <>
      <span className="notification-state" aria-hidden="true" />
      <span className="notification-symbol" aria-hidden="true">
        <Icon name={presentation.icon} size={18} />
      </span>
      <span className="notification-copy">
        <span className="notification-title">{item.title}</span>
        <span className="notification-message">{item.message}</span>
        <span className="notification-meta">
          {item.sourceModule} <span aria-hidden="true">·</span>{" "}
          {notificationTime(item.createdAt, group)}
        </span>
      </span>
      {item.applicationId && (
        <span className="notification-cta" aria-hidden="true">
          {presentation.action} <span>→</span>
        </span>
      )}
    </>
  );
  return (
    <li className={`notification-card${item.isRead ? "" : " unread"}`}>
      {item.applicationId ? (
        <button
          type="button"
          className="notification-card-main"
          onClick={() => onOpen(item.applicationId)}
          aria-label={`${presentation.action}: ${item.title}`}
        >
          {details}
        </button>
      ) : (
        <div className="notification-card-main">{details}</div>
      )}
      {!item.isRead && (
        <button
          type="button"
          className="notification-read-action"
          disabled={busy}
          onClick={() => onMark(item.notificationId)}
          aria-label={`Mark ${item.title} as read`}
        >
          Mark as read
        </button>
      )}
    </li>
  );
}

export function Notifications() {
  const [filters, setFilters] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [showDates, setShowDates] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [filterError, setFilterError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [application, setApplication] = useState(null);
  const load = useLoad(`/api/hr/notifications?${query(filters)}`);

  useEffect(() => {
    if (load.data && filters.page > 1 && !load.data.items.length)
      setFilters((value) => ({
        ...value,
        page: Math.max(1, Math.ceil(load.data.total / value.pageSize)),
      }));
  }, [load.data, filters.page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((value) => ({
        ...value,
        search: draft.search.trim(),
        type: draft.type,
        page: 1,
      }));
    }, draft.search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [draft.search, draft.type]);

  useEffect(() => {
    const values = [draft.from, draft.to];
    if (values.some((value) => value && value.length !== 10)) {
      setFilterError(null);
      return;
    }
    const { from, to, error: dateError } = historicalDateRange(draft.from, draft.to);
    if (dateError) {
      setFilterError(new Error(dateError));
      return;
    }
    setFilterError(null);
    setFilters((value) => ({ ...value, from, to, page: 1 }));
  }, [draft.from, draft.to]);

  useEffect(() => {
    if (!notice?.undoIds?.length) return;
    const timer = setTimeout(() => setNotice(null), 8000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function mark(id) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.request(
        id
          ? `/api/hr/notifications/${id}/read`
          : "/api/hr/notifications/read-all",
        { method: "PATCH" },
      );
      setNotice(
        id
          ? { text: "Notification marked as read." }
          : {
              text: "All notifications marked as read.",
              undoIds: result?.notificationIds || [],
            },
      );
      load.reload();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  }

  async function undoMarkAll() {
    if (!notice?.undoIds?.length) return;
    setBusy(true);
    setError(null);
    try {
      await api.request("/api/hr/notifications/restore-unread", {
        method: "PATCH",
        body: { notificationIds: notice.undoIds },
      });
      setNotice({ text: "Unread notifications restored." });
      load.reload();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  }

  function clearFilters() {
    setDraft(initial);
    setFilters(initial);
    setFilterError(null);
    setShowDates(false);
  }

  function removeFilter(name) {
    setDraft((value) => ({ ...value, [name]: "" }));
  }

  const groups = useMemo(
    () => groupNotifications(load.data?.items || []),
    [load.data?.items],
  );
  const activeFilters = [
    filters.search && { name: "search", label: `Search: ${filters.search}` },
    filters.type && { name: "type", label: typeLabel(filters.type) },
    filters.from && { name: "from", label: `From ${draft.from}` },
    filters.to && { name: "to", label: `To ${draft.to}` },
  ].filter(Boolean);
  const hasListFilters = filters.read !== "all" || activeFilters.length > 0;
  const allCount = load.data?.all ?? (filters.read === "all" ? load.data?.total : null);
  const unreadCount = load.data?.unread;
  const summary =
    unreadCount == null
      ? "Loading notification summary"
      : `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`;

  return (
    <>
      <PageHeading
        eyebrow={null}
        title="Notification Center"
        description={summary}
        className="notification-page-heading"
      />
      <section className="surface notification-surface">
        <div className="notification-toolbar">
          <div className="filter-tabs" aria-label="Notification status">
            <button
              type="button"
              className={filters.read === "all" ? "active" : ""}
              onClick={() => setFilters((value) => ({ ...value, read: "all", page: 1 }))}
              aria-pressed={filters.read === "all"}
            >
              All <span>{allCount ?? "…"}</span>
            </button>
            <button
              type="button"
              className={filters.read === "unread" ? "active" : ""}
              onClick={() => setFilters((value) => ({ ...value, read: "unread", page: 1 }))}
              aria-pressed={filters.read === "unread"}
            >
              Unread <span>{unreadCount ?? "…"}</span>
            </button>
          </div>
          <div className="notification-tools">
            <label className="notification-search">
              <span className="visually-hidden">Search notifications</span>
              <input
                type="search"
                className="form-control"
                placeholder="Search notifications"
                value={draft.search}
                onChange={(event) =>
                  setDraft((value) => ({ ...value, search: event.target.value }))
                }
              />
            </label>
            <label className="notification-type">
              <span className="visually-hidden">Notification type</span>
              <select
                className="form-select"
                value={draft.type}
                onChange={(event) =>
                  setDraft((value) => ({ ...value, type: event.target.value }))
                }
              >
                <option value="">All types</option>
                <option value="NEW_APPLICATION">New application</option>
                <option value="STATUS_UPDATED">Status updated</option>
              </select>
            </label>
            <button
              type="button"
              className={`btn btn-light btn-sm notification-filter-toggle${showDates ? " active" : ""}`}
              aria-expanded={showDates}
              aria-controls="notification-date-filters"
              onClick={() => setShowDates((value) => !value)}
            >
              Date{draft.from || draft.to ? " · Active" : ""}
            </button>
            {activeFilters.length > 0 && (
              <button type="button" className="text-button clear-filters" onClick={clearFilters}>
                Clear
              </button>
            )}
            {Boolean(unreadCount) && (
              <button
                type="button"
                className="btn btn-outline-primary btn-sm mark-all-button"
                disabled={busy || load.busy}
                onClick={() => mark()}
              >
                Mark all as read
              </button>
            )}
          </div>
        </div>
        {showDates && (
          <div className="notification-date-panel" id="notification-date-filters">
            <DateFields
              values={draft}
              setValues={setDraft}
              showHelpWhenEmpty={false}
            />
          </div>
        )}
        {activeFilters.length > 0 && (
          <div className="active-filter-list" aria-label="Active filters">
            {activeFilters.map((filter) => (
              <button
                type="button"
                key={filter.name}
                onClick={() => removeFilter(filter.name)}
                aria-label={`Remove ${filter.label} filter`}
              >
                {filter.label} <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}
        <div className="surface-content notification-content">
          <ErrorBox error={filterError || error} />
          {notice && (
            <div className="notification-toast" role="status">
              <span>{notice.text}</span>
              {notice.undoIds?.length > 0 && (
                <button type="button" onClick={undoMarkAll} disabled={busy}>
                  Undo
                </button>
              )}
            </div>
          )}
          {load.busy ? (
            <NotificationSkeleton />
          ) : load.error ? (
            <ErrorBox error={load.error} retry={load.reload} />
          ) : (
            load.data && (
              <>
                {load.data.items.length ? (
                  <div className="notification-groups">
                    {groups.map((group) => (
                      <section className="notification-group" key={group.label}>
                        <h2>{group.label}</h2>
                        <ul className="notification-list">
                          {group.items.map((item) => (
                            <NotificationRow
                              key={item.notificationId}
                              item={item}
                              group={group.label}
                              busy={busy}
                              onOpen={setApplication}
                              onMark={mark}
                            />
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title={
                      filters.read === "unread" && activeFilters.length === 0
                        ? "You're all caught up"
                        : !hasListFilters && load.data.all === 0
                          ? "No notifications yet"
                          : "No notifications match these filters"
                    }
                  >
                    {!hasListFilters && load.data.all === 0
                      ? "New recruitment activity will appear here."
                      : "Remove a filter or check back when new activity arrives."}
                  </Empty>
                )}
                {load.data.total > load.data.pageSize && (
                  <Pagination
                    data={load.data}
                    onPage={(page) => setFilters((value) => ({ ...value, page }))}
                  />
                )}
              </>
            )
          )}
        </div>
      </section>
      {application && (
        <ApplicationSummary id={application} onClose={() => setApplication(null)} />
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
        <div className="loading-state" role="status">Loading…</div>
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
