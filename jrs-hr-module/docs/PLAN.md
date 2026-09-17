# Delivery plan

## Completed

- Standardized navigation labels as nouns.
- Removed the browser-only data adapter and its access path.
- Added a local-only development entry backed by the real MySQL HR profile.
- Added a reviewed data-baseline migration and removed retired seeded activity.
- Split navigation and workspace layout from route definitions.
- Split log filtering, grouping and presentation into focused feature modules.
- Rebuilt Logs as grouped email activity aligned with Notifications.
- Preserved loading, empty, error, pagination, date validation and attachment states.

## Required before production

- Install the team authentication adapter.
- Configure the agreed team sign-in URL.
- Run migrations with the deployment database role.
- Enable SMTP only after sender-domain and operational approval.
