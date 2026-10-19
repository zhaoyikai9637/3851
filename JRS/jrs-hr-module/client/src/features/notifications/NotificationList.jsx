import { useEffect, useRef, useState } from "react";
import { Icon } from "../../icons";
import { NOTIFICATION_PRESENTATION, notificationTime } from "./notificationUtils";

export function NotificationSkeleton() {
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

export function NotificationGroup({ group, busy, onOpen, onToggleRead }) {
  return (
    <section className="notification-group">
      <h2>{group.label}</h2>
      <ul className="notification-list">
        {group.items.map((item) => (
          <NotificationItem
            key={item.notificationId}
            item={item}
            group={group.label}
            busy={busy}
            onOpen={onOpen}
            onToggleRead={onToggleRead}
          />
        ))}
      </ul>
    </section>
  );
}

function NotificationItem({ item, group, busy, onOpen, onToggleRead }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const presentation =
    NOTIFICATION_PRESENTATION[item.notificationType] || NOTIFICATION_PRESENTATION.SYSTEM;

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOutside = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const closeWithEscape = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [menuOpen]);

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
      {item.applicationId ? (
        <span className="notification-cta" aria-hidden="true">
          {presentation.action}
        </span>
      ) : null}
    </>
  );

  return (
    <li className={`notification-card${item.isRead ? "" : " unread"}`}>
      {item.applicationId ? (
        <button
          type="button"
          className="notification-card-main"
          onClick={() => onOpen(item)}
          aria-label={`${presentation.action}: ${item.title}`}
        >
          {details}
        </button>
      ) : (
        <div className="notification-card-main">{details}</div>
      )}
      <NotificationActions
        item={item}
        busy={busy}
        menuOpen={menuOpen}
        menuRef={menuRef}
        onToggleMenu={() => setMenuOpen((value) => !value)}
        onToggleRead={() => {
          setMenuOpen(false);
          onToggleRead(item);
        }}
      />
    </li>
  );
}

function NotificationActions({ item, busy, menuOpen, menuRef, onToggleMenu, onToggleRead }) {
  return (
    <div className="notification-more" ref={menuRef}>
      <button
        type="button"
        className="notification-more-trigger"
        disabled={busy}
        aria-label={`More actions for ${item.title}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={onToggleMenu}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {menuOpen ? (
        <div className="notification-more-menu" role="menu">
          <button type="button" role="menuitem" disabled={busy} onClick={onToggleRead}>
            {item.isRead ? "Mark as unread" : "Mark as read"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
