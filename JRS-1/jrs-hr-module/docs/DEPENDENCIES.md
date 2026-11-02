# Dependency Maintenance

Use Node.js 24 and the committed package manifests/lockfile.
Check engines and peer dependencies before a targeted version update; use npm ci for reproducibility.
Do not delete the lockfile or use force downgrades to silence an audit report.

The earlier review upgraded Vitest to 4.1.11, Nodemailer to 10.0.1 and Sharp to 0.35.4.
These are historical project decisions, not a claim that they are the latest available versions.
Swagger Parser, Ajv and ajv-formats validate API contracts and are not browser business dependencies.

The recorded audit retained moderate Sequelize/uuid findings.
The inspected Sequelize paths used UUID v1/v4 without caller-provided output buffers,
which narrowed the observed applicability but did not prove every transitive path safe.
Review upstream fixes or a separately tested override before release.
Rerun the audit for current evidence; do not describe a nonzero audit exit as clean.
Keep dependency installation artifacts and credentials outside Git.
