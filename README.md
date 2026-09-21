# COMP3851 Job Recruitment System

This repository contains two related systems developed by the project team:

1. **HR system** — internal recruitment and HR workflows.
2. **Applicant system** — applicant login, profile and job-seeking pages.

The repository is currently in a **parallel development stage**. Several codebases
are incomplete or have not yet been uploaded, so the existing implementations are
kept separate. They must not be merged prematurely.

## Team responsibilities

| System | Member | Responsibility | Current repository location |
| --- | --- | --- | --- |
| HR | Zhao Yikai | HR notification centre, templates, notification logs and HR profile | [`jrs-hr-module/`](jrs-hr-module/) |
| HR | Shen Junye | Independent HR/recruitment implementation | [`JRS-HR-Fullstack-Complete/`](JRS-HR-Fullstack-Complete/) |
| HR | Yan Yibo | HR-side development | Source code not yet identifiable in the current tree |
| Applicant | Si Huanjia | Applicant-side pages | Reports are in [`SiHuanjia/`](SiHuanjia/); source code is pending |
| Applicant | Zheng Chenjun | Applicant pages and login systems for both sides | [`JS employee page/`](JS%20employee%20page/) and [`ZhengChenjun/`](ZhengChenjun/) |

> Zheng Chenjun is responsible for the login entry points for both systems. The
> applicant login files are currently visible under `JS employee page/`. Any
> additional login implementation should remain separately identified until both
> systems agree on their authentication contract.

## Current codebases

### HR system

- [`jrs-hr-module/`](jrs-hr-module/) — Zhao Yikai's HR module.
- [`JRS-HR-Fullstack-Complete/`](JRS-HR-Fullstack-Complete/) — Shen Junye's HR implementation.
- Yan Yibo's HR source code — pending upload or identification.

These HR implementations are intentionally independent. Do not copy one into
another, combine their databases, or replace one authentication flow with another
while team code is still missing.

### Applicant system

- [`JS employee page/`](JS%20employee%20page/) — current applicant/login page implementation.
- [`SiHuanjia/`](SiHuanjia/) — Si Huanjia's report and presentation; source code is pending.
- [`ZhengChenjun/`](ZhengChenjun/) — Zheng Chenjun's report and presentation materials.

## Repository documents

- [`docs/repository/CODE_INVENTORY.md`](docs/repository/CODE_INVENTORY.md) — what is present and what is missing.
- [`docs/repository/TEAM_OWNERSHIP.md`](docs/repository/TEAM_OWNERSHIP.md) — ownership and boundaries.
- [`docs/repository/INTEGRATION_POLICY.md`](docs/repository/INTEGRATION_POLICY.md) — rules to follow before any future integration.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — how members should upload and update their work.

## Important working rule

For now, repository organisation means documenting ownership and keeping work easy
to locate. It does **not** mean merging the three current implementations. Future
integration should begin only after the missing code is uploaded and the team has
agreed on authentication, API and database contracts.

