# Team Ownership and System Boundaries

## System A: HR system

### Zhao Yikai

Current codebase: [`../../jrs-hr-module/`](../../jrs-hr-module/)

Current documented scope:

- HR Notification Center;
- email templates;
- notification history/logs;
- HR personal profile;
- related API, database and automated tests.

This remains Zhao Yikai's independent implementation while team integration is
pending.

### Shen Junye

Current codebase: [`../../JRS-HR-Fullstack-Complete/`](../../JRS-HR-Fullstack-Complete/)

Current code includes a separate HR/recruitment application, backend, database
schema and tests. It remains an independent implementation and must not be folded
into Zhao Yikai's module at this stage.

### Yan Yibo

Responsibility: HR-side development.

Current status: no clearly attributable source-code directory is present in the
current `main` tree. Yan Yibo's source should be uploaded under a clearly named
location before architecture or integration decisions are made.

## System B: Applicant system

### Si Huanjia

Current materials: [`../../SiHuanjia/`](../../SiHuanjia/)

Responsibility: applicant-side pages. The current directory contains report and
presentation material, but no source code that can yet be reviewed or integrated.

### Zheng Chenjun

Current code/materials:

- [`../../JS employee page/`](../../JS%20employee%20page/)
- [`../../ZhengChenjun/`](../../ZhengChenjun/)

Responsibilities:

- applicant-side pages;
- login system for the HR side;
- login system for the applicant side.

The two login entry points should remain explicitly labelled. Authentication code
must not be silently copied into either HR implementation before the team agrees on
the login/session contract.

## Shared ownership rule

Ownership identifies who should review a change; it does not prevent collaboration.
However, a member should not restructure or replace another member's codebase
without review from its owner.

