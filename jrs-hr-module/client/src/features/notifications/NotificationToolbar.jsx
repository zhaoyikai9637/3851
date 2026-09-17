import { DateFields } from "../../shared";

export function NotificationToolbar({
  activeFilters,
  allCount,
  busy,
  draft,
  filters,
  loading,
  onClear,
  onMarkAll,
  onRemoveFilter,
  onSelectStatus,
  onToggleDates,
  setDraft,
  showDates,
  unreadCount,
}) {
  return (
    <>
      <div className="notification-toolbar">
        <fieldset className="filter-tabs">
          <legend className="visually-hidden">Notification status</legend>
          <button
            type="button"
            className={filters.read === "all" ? "active" : ""}
            onClick={() => onSelectStatus("all")}
            aria-pressed={filters.read === "all"}
          >
            All <span>{allCount ?? "…"}</span>
          </button>
          <button
            type="button"
            className={filters.read === "unread" ? "active" : ""}
            onClick={() => onSelectStatus("unread")}
            aria-pressed={filters.read === "unread"}
          >
            Unread <span>{unreadCount ?? "…"}</span>
          </button>
        </fieldset>
        <div className="notification-tools">
          <label className="notification-search">
            <span className="visually-hidden">Search notifications</span>
            <input
              type="search"
              className="form-control"
              placeholder="Search notifications"
              value={draft.search}
              onChange={(event) => setDraft((value) => ({ ...value, search: event.target.value }))}
            />
          </label>
          <label className="notification-type">
            <span className="visually-hidden">Notification type</span>
            <select
              className="form-select"
              value={draft.type}
              onChange={(event) => setDraft((value) => ({ ...value, type: event.target.value }))}
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
            onClick={onToggleDates}
          >
            Date{draft.from || draft.to ? " · Active" : ""}
          </button>
          {activeFilters.length > 0 ? (
            <button type="button" className="text-button clear-filters" onClick={onClear}>
              Clear
            </button>
          ) : null}
          {unreadCount ? (
            <button
              type="button"
              className="btn btn-outline-primary btn-sm mark-all-button"
              disabled={busy || loading}
              onClick={onMarkAll}
            >
              Mark all as read
            </button>
          ) : null}
        </div>
      </div>
      {showDates ? (
        <div className="notification-date-panel" id="notification-date-filters">
          <DateFields values={draft} setValues={setDraft} showHelpWhenEmpty={false} />
        </div>
      ) : null}
      <ActiveFilterChips filters={activeFilters} onRemove={onRemoveFilter} />
    </>
  );
}

export function ActiveFilterChips({ filters, onRemove }) {
  if (!filters.length) return null;
  return (
    <fieldset className="active-filter-list">
      <legend className="visually-hidden">Active filters</legend>
      {filters.map((filter) => (
        <button
          type="button"
          key={filter.name}
          onClick={() => onRemove(filter.name)}
          aria-label={`Remove ${filter.label} filter`}
        >
          {filter.label} <span aria-hidden="true">×</span>
        </button>
      ))}
    </fieldset>
  );
}
