# API testing

Use the generated OpenAPI document and Postman collection under `docs`.

1. Start MySQL and the application.
2. Use the local development entry or complete team sign-in.
3. Retain the session cookie.
4. Read `/api/auth/me` and retain its CSRF token.
5. Send `X-CSRF-Token` for every mutation.

Protected data is scoped to the authenticated HR user. Mutation requests with an untrusted Origin are rejected. Attachment downloads require both authorization and matching log ownership.

Examples in generated documentation are illustrative and contain no reusable credentials.
