# Contributing to the COMP3851 Repository

## 1. Keep the two systems separate

The project contains an HR system and an applicant system. Do not place applicant
business code inside an HR codebase, or HR business code inside an applicant
codebase.

## 2. Do not merge incomplete implementations

Until all member code is available:

- do not merge `jrs-hr-module/`, `JRS-HR-Fullstack-Complete/` and
  `JS employee page/` into one application;
- do not rename or move those directories;
- do not make one codebase depend directly on another codebase's internal files;
- do not unify or overwrite database tables without a reviewed migration plan;
- do not replace another member's implementation merely to make a demo run.

Documentation, interface proposals and compatibility adapters may be added without
changing the original codebases.

## 3. Uploading missing work

Each member should add a clearly named directory or submit a branch/PR containing:

- source code;
- a README explaining ownership and scope;
- dependency manifests and lockfiles;
- `.env.example` files without real credentials;
- database schema or migrations, when applicable;
- test files and exact test commands;
- a short list of incomplete items;
- the API endpoints or shared data required from the other system.

Do not upload `node_modules`, real `.env` files, passwords, API keys, database
backups or generated build output unless the team has explicitly agreed to track it.

## 4. Suggested branch names

Use one branch per member or feature, for example:

```text
hr/zhaoyikai-notifications
hr/shenjunye-recruitment
hr/yanyibo-feature-name
applicant/sihuanjia-feature-name
applicant/zhengchenjun-auth
```

## 5. Commit and pull-request information

Every change should state:

1. which system it belongs to;
2. which member owns it;
3. what was added or changed;
4. how it was tested;
5. whether it changes an API, database table or login flow;
6. what remains incomplete.

Avoid commit messages such as `Add files via upload`. Prefer messages such as:

```text
Add applicant password reset page and unit tests
Document HR notification API dependency
Upload Yan Yibo HR module baseline
```

## 6. Future integration

Integration work should be proposed through documentation first. Code may be
combined only after the checklist in
[`docs/repository/INTEGRATION_POLICY.md`](docs/repository/INTEGRATION_POLICY.md)
has been reviewed by the affected owners.

