import {useRef} from "react";
import {useViewportRows} from "../../src/useViewportRows";
import {CommunicationContext} from '../../src/features/communication/ApplicationContext';
import { ApplicationSummary } from "../../src/features/notifications/ApplicationSummary";
import {
  NotificationGroup,
  NotificationSkeleton,
} from "../../src/features/notifications/NotificationList";
import { NotificationToolbar } from "../../src/features/notifications/NotificationToolbar";
import { MarkAllReadToast } from "../../src/features/notifications/MarkAllReadToast";
import { groupNotifications } from "../../src/features/notifications/notificationUtils";
import { useNotificationCenter } from "../../src/features/notifications/useNotificationCenter";
import "../../src/features/notifications/notifications.css";
import { Empty, ErrorBox, PageHeading, Pagination } from "../../src/shared";

export { groupNotifications };

export function Notifications() {
  const host=useRef(null),loaded=useRef(null);
  const fit=useViewportRows(host,loaded.current,20);
  const { state, actions } = useNotificationCenter(fit);
  loaded.current=state.load.data;
  const {
    context,
    activeFilters,
    allCount,
    application,
    busy,
    draft,
    error,
    filterError,
    filters,
    groups,
    hasListFilters,
    load,
    showDates,
    summary,
    undoAvailable,
    unreadCount,
  } = state;

  return (
    <>
      <CommunicationContext context={context}/>
      <PageHeading
        eyebrow={null}
        title="Notification Center"
        description={summary}
        className="workspace-page-heading"
      />
      <section className="surface notification-surface fit-panel" ref={host}>
        <NotificationToolbar
          activeFilters={activeFilters}
          allCount={allCount}
          busy={busy}
          draft={draft}
          filters={filters}
          loading={load.busy}
          onClear={actions.clearFilters}
          onMarkAll={actions.markAll}
          onRemoveFilter={actions.removeFilter}
          onSelectStatus={actions.selectStatus}
          onToggleDates={actions.toggleDates}
          setDraft={actions.setDraft}
          showDates={showDates}
          unreadCount={unreadCount}
        />
        <div className="surface-content notification-content fit-body">
          <ErrorBox error={filterError || error} />
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
                      <NotificationGroup
                        key={group.label}
                        group={group}
                        busy={busy}
                        onOpen={actions.openNotification}
                        onToggleRead={actions.toggleRead}
                      />
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
                  <Pagination data={load.data} onPage={actions.setPage} />
                )}
              </>
            )
          )}
        </div>
      </section>
      {undoAvailable && <MarkAllReadToast busy={busy} onUndo={actions.undoMarkAll} />}
      {application && <ApplicationSummary id={application} onClose={actions.closeApplication} />}
    </>
  );
}
