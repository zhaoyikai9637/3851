# Future Integration Policy

## Current decision

Integration is deferred because member code is incomplete. The three current
implementations remain separate:

1. `jrs-hr-module/`
2. `JRS-HR-Fullstack-Complete/`
3. `JS employee page/`

Repository documentation may describe relationships between them, but no codebase
should be used as a replacement for another yet.

## Entry conditions for future integration

Do not begin merging until all of the following are available:

- Yan Yibo's HR source code;
- Si Huanjia's applicant source code;
- both login systems owned by Zheng Chenjun are identifiable;
- each codebase has reproducible installation and test instructions;
- each owner has listed their required APIs and database entities;
- the team has chosen who owns authentication and session management.

## Decisions required before code is combined

### Authentication

- Which module validates credentials?
- Are HR and applicant accounts stored together or separately?
- What Cookie/session/token format is shared?
- How are HR and applicant roles verified by the backend?
- Which password-reset implementation is authoritative?

### API

- What is the common base path?
- What is the error response format?
- How are pagination, dates and identifiers represented?
- Which endpoints may cross the HR/applicant boundary?
- Is an OpenAPI document required before implementation?

### Database

- Which module owns each table?
- What naming convention is used?
- How are schema changes migrated?
- Which data may be read by both systems?
- How are test and development databases isolated?

### Frontend

- Do the systems share one application shell or remain separately deployed?
- Which navigation and design tokens are shared?
- How are the HR and applicant login entry points presented?
- Which components may be shared without importing another module's internals?

## Safe work before integration

The following work may continue independently:

- completing member-owned pages and services;
- adding tests;
- documenting APIs;
- documenting database entities;
- fixing security defects within a member-owned codebase;
- adding adapters behind stable interfaces;
- recording screenshots and acceptance criteria.

## Integration deliverable

When the entry conditions are met, create a separate integration branch. The first
integration change should contain contracts and adapters, not a bulk copy of all
three directories. Existing implementations should remain recoverable until the
integrated system has passed agreed end-to-end tests.

