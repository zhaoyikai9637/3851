# Team integration contract

The complete shared-backend inventory, table ownership and adoption checklist are in `docs/TEAM_BACKEND_BASELINE.md`.

## Identity

The server loads a trusted adapter configured by `TEAM_AUTH_ADAPTER`. Browser headers, query strings and local storage never establish identity. The adapter must return a verified HR user ID, subject and upstream session ID.

## Recruitment data

`CANDIDATE`, `JOB_POSITION` and `APPLICATION` are the boundary with the recruitment module. Application events are recorded server-to-server with unique event keys.

## Email history

Only records with `delivery_status = SENT` and a non-null `sent_at` appear in Logs. Sent means accepted by the provider, not confirmed inbox delivery. The original subject, body, recipient, template name and attachments remain an immutable snapshot.

## Production gate

Production rejects standalone mode. Configure the team adapter, team sign-in URL, HTTPS origin, persistent session store and approved mail settings before deployment.
