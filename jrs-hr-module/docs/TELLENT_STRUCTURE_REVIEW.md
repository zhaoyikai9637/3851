# Tellent HR structure review

Date: 16 September 2026

## Purpose

This review uses the authenticated Tellent HR interface as a structural reference for the JRS notification module. It does not copy Tellent branding, private employee data, source code, or product content.

## Observed product structure

Tellent separates the workspace into three stable layers:

1. A global navigation rail for product-wide destinations.
2. A contextual navigation panel for the current module and its related views.
3. A content canvas with a breadcrumb header, page title, actions, filters, and results.

The Analytics area keeps standard reports together in the contextual panel while the content canvas changes independently. The profile area uses the same global shell but replaces the contextual panel with profile-specific sections. On narrow screens, global navigation becomes a compact control and module navigation becomes a horizontal strip.

## Adaptation for JRS

- Preserve the Figma-derived JRS primary sidebar, routes, English labels, navy/cobalt brand, account menu, and existing authorization boundaries.
- Move Notification Center, Email Templates, and Notification Log out of the global top bar and into a dedicated Communication module panel.
- Use the top bar for a breadcrumb and the account control only, clarifying global context versus module navigation.
- Collapse the Communication panel into a horizontally scrollable strip below 650px.
- Keep profile access in the avatar menu and do not add unrelated Tellent modules, analytics features, search, payroll, attendance, or employee-management capabilities.

## Result

The desktop hierarchy is now: primary workspace sidebar, Communication module navigation, then page content. The mobile hierarchy is: compact top bar, Communication strip, then page content. Existing notification filters, template editing, logs, profile routes, demo isolation, and team-auth boundary are unchanged.

## Privacy boundary

No Tellent credentials, authentication codes, employee records, screenshots, or account identifiers were written to this repository. The external page was used only for a read-only structural review.
