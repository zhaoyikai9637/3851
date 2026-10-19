# Email Template Usage Types

shared/template-types.json is the single registry used by the dropdown, backend validation and OpenAPI rules.
Legacy types remain compatible. Stage-specific closure types are:

| Code | Label | Intended event |
| --- | --- | --- |
| APPLICATION_REJECTION | Application Rejection | Application Review to Rejected |
| INTERVIEW_REJECTION | Interview Rejection | Interview Review to Rejected |
| OFFER_WITHDRAWAL | Offer Withdrawal | Company withdraws an offer |
| OFFER_DECLINED_ACKNOWLEDGEMENT | Offer Declined Acknowledgement | Candidate declines an offer |

Original English content is in server/data/original-content.json and uses the four existing variables.
The local installer adds missing names without overwriting team edits or historical email snapshots.
Use an actual active HR ID and review the target first. Installation does not send mail.
Company-withdrawal wording requires HR review; do not invent withdrawal reasons.

These labels do not implement automatic event routing.
The business caller selects a templateId and must supply the original stage and decision owner.
Rejected or Closed alone cannot distinguish these events.
Never infer an event from a template name or treat an applicant's decision as a company rejection.

To extend the registry, add a unique nonempty code of at most 50 characters, preferably uppercase with underscores.
Run tests, docs export and the production build, then restart/redeploy both client and server.
Database-only changes do not add options to old browser bundles.

Unknown stored types remain visible as Unsupported with their original code.
Saving is blocked until the user explicitly selects a supported type.
Reads preserve legacy values; writes reject unknown values rather than silently choosing the first option.
Tests cover extension, preservation and explicit replacement without adding test-only types to real configuration.
