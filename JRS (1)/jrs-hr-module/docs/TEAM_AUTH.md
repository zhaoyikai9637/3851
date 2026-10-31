# Team Authentication Boundary

The communication module does not own a password login form or POST /api/auth/login.
It reads GET /api/auth/config and GET /api/auth/me.
A verified team identity must map to an ACTIVE HR profile before protected pages and APIs are available.
Changing a browser HR ID, role or redirect must never grant access.

## Adapter contract

Supply trusted resolve(req) and logout(req,res) methods through the documented identity adapter.
Resolve the canonical account, verify active HR status and map the stable upstream ID to the local HR user.
Do not trust client-supplied identity values or silently create a fictional HR profile.
Logout must revoke the upstream session as well as the module's own CSRF session.
See INTEGRATION.md for the complete service contract.

The integrated main runtime implements a shared-cookie adapter and supplies the actual sign-in URL.
Standalone team configuration still requires its own adapter implementation.
The module session cookie alone is not a login credential.

## Local development and writes

DEV_HR_USER_ID may enable the explicit local-only development entry for an existing active HR.
That endpoint must remain unavailable in production/team mode.
There is no automatic login or browser role-switch bypass.
Run frontend and API together; an HTML response from Vite is not a valid authentication API response.

Use CSRF tokens from the correct API boundary and keep APP_ORIGIN consistent with the browser origin.
Cross-origin, missing-token, candidate-role and inactive-HR requests must be rejected.
Never publish private environment values or test identity fixtures.
