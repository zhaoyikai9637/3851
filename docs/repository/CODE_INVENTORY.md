# Current Code Inventory

This inventory describes the current `main` tree. It deliberately distinguishes
source code from reports and presentations.

## Source-code directories present

| Directory | System | Current interpretation | Integration status |
| --- | --- | --- | --- |
| `jrs-hr-module/` | HR | Zhao Yikai's HR notification/profile module | Keep independent |
| `JRS-HR-Fullstack-Complete/` | HR | Shen Junye's HR/recruitment implementation | Keep independent |
| `JS employee page/` | Applicant/Auth | Zheng Chenjun's applicant and login work | Keep independent |

## Member-material directories present

| Directory | Contents currently visible |
| --- | --- |
| `ZhaoYikai/` | report, presentation, use-case document and video |
| `ShenJunye/` | report, presentation, use-case document and testing notes |
| `SiHuanjia/` | report and applicant-side presentation |
| `ZhengChenjun/` | report and presentation materials |

## Missing or unclear items

- Yan Yibo's HR source code is not clearly identifiable in the current tree.
- Si Huanjia's applicant-side source code is not currently present.
- Zheng Chenjun owns two login systems, but only the login/applicant files under
  `JS employee page/` are currently easy to identify. The second login entry point
  should be labelled when it is uploaded or confirmed.
- There is no agreed cross-system authentication contract yet.
- There is no agreed shared database schema or API contract yet.

## What this repository organisation changes

- adds a root repository guide;
- records ownership and system boundaries;
- records missing code explicitly;
- defines a safe future integration process;
- adds repository-wide ignore rules.

## What it does not change

- no existing source file is moved;
- no existing source file is edited;
- no HR implementations are merged;
- the applicant implementation is not merged into an HR implementation;
- no database, API or login contract is imposed prematurely.

