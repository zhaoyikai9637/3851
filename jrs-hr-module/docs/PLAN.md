# Delivery plan

## Completed

- Removed two redundant UI explanations while preserving conditional unsaved-edit feedback and existing sent-email history.

- Replaced Templates/Logs explanatory subtitles with data-backed counts, including pluralization, filtered totals, creation/deletion refresh and load-failure regression coverage.

- Added 18 Jest regressions: 64 local tests and 65 in GitHub, with the existing extra runtime test preserved. Refreshed the generated report with the current five-file coverage scope.

- Aligned Templates and Logs headings with Notification Center, retaining per-page content and responsive actions.

- Unified template usage configuration across client, validation and OpenAPI; added unknown-type preservation and extension regression tests.

- Aligned page, asset, configuration, route and entry directories with the team's convention without merging member modules.
- Inspected the cloud database read-only; no useful business rows were present to import.
- Added five original templates and an idempotent local-only installer with regression tests.

- Standardized navigation labels as nouns.
- Removed the browser-only data adapter and its access path.
- Added a local-only development entry backed by the real MySQL HR profile.
- Added a reviewed data-baseline migration and removed retired seeded activity.
- Split navigation and workspace layout from route definitions.
- Split log filtering, grouping and presentation into focused feature modules.
- Rebuilt Logs as grouped email activity aligned with Notifications.
- Preserved loading, empty, error, pagination, date validation and attachment states.
- Added explicit notification regression coverage for counts, time groups, filters, keyboard actions and mark-all Undo.
- Reduced `Notifications.jsx` from 510 lines to a 119-line route composition boundary.
- Separated notification state/actions, pure utilities, UI sections and feature-local responsive styles.
- Added scoped Biome lint and formatting checks without reformatting unrelated project history.

## Required before production

- Install the team authentication adapter.
- Configure the agreed team sign-in URL.
- Run migrations with the deployment database role.
- Enable SMTP only after sender-domain and operational approval.
