import { useEffect, useMemo, useState } from "react";
import { api, query } from "../../api";
import { historicalDateRange, useLoad } from "../../shared";
import {
  INITIAL_NOTIFICATION_FILTERS,
  groupNotifications,
  notificationTypeLabel,
} from "./notificationUtils";

export function useNotificationCenter() {
  const [filters, setFilters] = useState(INITIAL_NOTIFICATION_FILTERS);
  const [draft, setDraft] = useState(INITIAL_NOTIFICATION_FILTERS);
  const [showDates, setShowDates] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [filterError, setFilterError] = useState(null);
  const [application, setApplication] = useState(null);
  const [undoIds, setUndoIds] = useState([]);
  const load = useLoad(`/api/hr/notifications?${query(filters)}`);

  useEffect(() => {
    if (load.data && filters.page > 1 && !load.data.items.length)
      setFilters((value) => ({
        ...value,
        page: Math.max(1, Math.ceil(load.data.total / value.pageSize)),
      }));
  }, [load.data, filters.page]);

  useEffect(() => {
    const timer = setTimeout(
      () => {
        setFilters((value) => ({
          ...value,
          search: draft.search.trim(),
          type: draft.type,
          page: 1,
        }));
      },
      draft.search ? 250 : 0,
    );
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

  async function markAll() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.request("/api/hr/notifications/read-all", {
        method: "PATCH",
      });
      setUndoIds(result.notificationIds || []);
      load.reload();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  }

  async function undoMarkAll() {
    setBusy(true);
    setError(null);
    try {
      await api.request("/api/hr/notifications/restore-unread", {
        method: "PATCH",
        body: { notificationIds: undoIds },
      });
      setUndoIds([]);
      load.reload();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  }

  async function toggleRead(item) {
    setBusy(true);
    setError(null);
    try {
      if (item.isRead) {
        await api.request("/api/hr/notifications/restore-unread", {
          method: "PATCH",
          body: { notificationIds: [item.notificationId] },
        });
      } else {
        await api.request(`/api/hr/notifications/${item.notificationId}/read`, {
          method: "PATCH",
        });
      }
      load.reload();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  }

  function openNotification(item) {
    setApplication(item.applicationId);
    if (!item.isRead) void toggleRead(item);
  }

  function clearFilters() {
    setDraft(INITIAL_NOTIFICATION_FILTERS);
    setFilters(INITIAL_NOTIFICATION_FILTERS);
    setFilterError(null);
    setShowDates(false);
  }

  function removeFilter(name) {
    setDraft((value) => ({ ...value, [name]: "" }));
  }

  const groups = useMemo(() => groupNotifications(load.data?.items || []), [load.data?.items]);
  const activeFilters = useMemo(
    () =>
      [
        filters.search && { name: "search", label: `Search: ${filters.search}` },
        filters.type && {
          name: "type",
          label: notificationTypeLabel(filters.type),
        },
        filters.from && { name: "from", label: `From ${draft.from}` },
        filters.to && { name: "to", label: `To ${draft.to}` },
      ].filter(Boolean),
    [draft.from, draft.to, filters.from, filters.search, filters.to, filters.type],
  );
  const unreadCount = load.data?.unread;
  const allCount = load.data?.all ?? (filters.read === "all" ? load.data?.total : null);

  return {
    state: {
      activeFilters,
      allCount,
      application,
      busy,
      draft,
      error,
      filterError,
      filters,
      groups,
      hasListFilters: filters.read !== "all" || activeFilters.length > 0,
      load,
      showDates,
      summary:
        unreadCount == null
          ? "Loading notification summary"
          : `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`,
      undoAvailable: undoIds.length > 0,
      unreadCount,
    },
    actions: {
      clearFilters,
      closeApplication: () => setApplication(null),
      markAll,
      openNotification,
      removeFilter,
      selectStatus: (read) => setFilters((value) => ({ ...value, read, page: 1 })),
      setDraft,
      setPage: (page) => setFilters((value) => ({ ...value, page })),
      toggleDates: () => setShowDates((value) => !value),
      toggleRead,
      undoMarkAll,
    },
  };
}
