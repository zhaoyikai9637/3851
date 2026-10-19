# Authentication Integration Contract

## Responsibility boundary

The applicant portal owns:

- Public vacancy pages and public job APIs.
- Signed-in applicant pages for eligibility checks, applications, resumes, and status.
- Authorisation checks that reject requests without a valid applicant session.

The team's authentication module owns:

- Registration and sign-in screens.
- Email/password validation and password security.
- Account recovery and account administration.
- Creating the authenticated server session after successful sign-in.

## Local ports

| Service | Default address |
| --- | --- |
| Applicant React interface | `http://127.0.0.1:5173` |
| Applicant and business API | `http://127.0.0.1:3001` |
| Team authentication interface | `http://127.0.0.1:3002/login` |

Set the authentication page address in the root `.env` file:

    VITE_AUTH_LOGIN_URL=http://127.0.0.1:3002/login

Set its allowed origin in the same root `.env` file:

    AUTH_FRONTEND_URL=http://127.0.0.1:3002

Use `127.0.0.1` consistently during integration instead of mixing it with `localhost`.

## Browser flow

1. A visitor browses `/jobs` and `/jobs/:jobId` without a session.
2. Selecting **Sign in to apply** opens the team login page and supplies a `returnTo` URL.
3. The team module verifies the account and creates an applicant session.
4. It redirects the browser to the supplied `/auth/complete` URL.
5. The applicant portal calls `GET /api/auth/me` and opens the requested `/applicant/...` page.

The `returnTo` value must be treated as an allowed local URL. The applicant portal already rejects values that do not begin with `/applicant/`.

## Session contract

After successful login, the shared Express session must contain:

```js
req.session.userId = authenticatedUser.id;
```

The matching user record must provide:

```json
{
  "id": 1,
  "fullName": "Applicant Name",
  "email": "applicant@example.com",
  "role": "applicant"
}
```

This portal provides these session-facing endpoints:

| Method and endpoint | Result |
| --- | --- |
| `GET /api/auth/me` | Returns `{ "user": ... }`, or `401` without an applicant session |
| `POST /api/auth/logout` | Destroys the shared session |
| `POST /api/auth/demo-session` | Local demo adapter only; disabled in production and MySQL mode |

The portal deliberately does not provide `POST /api/auth/login`.

## Recommended team integration

The simplest integration is to mount the teammate's authentication router in the same Express application after the existing `express-session` middleware. Both modules then use the same session object and user IDs.

If authentication runs in a separate Node process, both servers must use the same cookie name, session secret, and shared persistent session store. The default in-memory session store cannot share sessions between processes. The browser requests must include credentials, and both interfaces must use the same hostname.

Do not accept a user ID sent directly by the browser as proof of login. The authentication module must establish the server-side session only after it verifies the account.
