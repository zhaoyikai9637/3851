# Notification Center Redesign

Date: 2026-09-16

## Purpose

The Notification Center was refined so an HR user can understand the unread workload, scan recent events, and choose the next action without scrolling through a large filter form. The change is a targeted evolution of the existing JRS workspace, not a replacement of its navigation, brand, routes, or data model.

## Interface changes

- The page header now reports the real unread count.
- Compact \`All\` and \`Unread\` controls display counts from the API.
- \`Mark all as read\` is a secondary toolbar action and is hidden when there is nothing unread.
- Bulk `Mark all as read` updates the inbox directly without adding a confirmation panel or Undo banner.
- Per-notification read state is managed from an accessible overflow menu, keeping the row focused on its primary recruitment action.
- Search and type filters apply automatically. Historical dates live in a collapsible date panel and apply when a complete valid date is entered.
- Active search, type, and date conditions appear as removable filter chips.
- Notifications are grouped dynamically as \`Today\`, \`Yesterday\`, or \`Earlier\` using the Asia/Singapore business date.
- Existing JRS icons communicate application and candidate-status events. Action labels now describe the next step, such as \`Review application\` and \`View candidate\`.
- Primary action labels do not use decorative arrow suffixes.
- Unread rows use one status dot and stronger title weight. The previous tinted row, side rule, and \`Unread\` badge combination was removed.
- Pagination is hidden when the result set fits within the 20-item page size.
- The notification-specific loading state is a row skeleton. Empty states distinguish a new inbox, an unread inbox with no remaining items, and filters with no matches.

## API support

- \`GET /api/hr/notifications\` accepts an optional \`search\` query and returns both \`all\` and \`unread\` totals independently of list filters.
- \`PATCH /api/hr/notifications/read-all\` returns the notification IDs changed by the operation.
- \`PATCH /api/hr/notifications/restore-unread\` restores only the authenticated HR user's supplied notification IDs.
- Search and undo preserve the existing HR ownership, CSRF, origin, date, and team-identity protections.

## Scope and limitations

- The current backend produces two notification types: \`NEW_APPLICATION\` and \`STATUS_UPDATED\`. The presentation map has safe fallbacks, but no interview, message, offer, or system-event producer was invented.
- Notification actions continue to open the existing read-only application summary because the recruitment team's final candidate and application routes are still pending integration.
- The restore endpoint remains available for the per-notification `Mark as unread` menu action and accepts at most 5,000 IDs within the existing 100 KB JSON request limit.
- Team sign-in and real upstream workflow integration remain outside this change.

## Verification

See [VERIFICATION.md](VERIFICATION.md) for automated and browser results.
