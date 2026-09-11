# 当前依赖补充 — 2026-09-09 P7

Node 24.16.0/npm 11.13.0。当前后端/前端 Vitest 都是 4.1.11；Vite 仍为 7.3.6。
新增开发依赖 @apidevtools/swagger-parser 13.0.0、Ajv 8.20.0、ajv-formats 3.0.1。
用于离线检查 OpenAPI/JSON 示例与 HTTP 响应，不进入前端业务 bundle。
全部版本均在安装前核对 engines/peerDependencies，清单和锁文件先备份再由 npm 更新。

本次联网审计发现原 Vitest 3.2.7/mocker 的新已知问题：
[官方公告 GHSA-82fw-gwwq-j7x9](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9)。
公告修复版本包括 4.1.11，旧 3.x 不计划回补。核对当前 Node/Vite 兼容后定向升级到
4.1.11，没有直接追随 npm audit 推荐的 5.0.0。参考 [迁移指南](https://vitest.dev/guide/migration/)。

最终 npm test 157+38、MySQL 12、build 和浏览器通过。隔离目录仅复制清单/锁文件，
npm ci --offline 安装 373 包，npm ls --depth=0 成功，不含环境凭据。
安装有 dottie/lodash.get/lodash.isequal/whatwg-encoding/uuid 弃用提示；没有安装失败。

最终审计保留 2 moderate：Sequelize/uuid，0 high/critical，exit 1。
该遗留项的分析与未采取 force 降级的理由保留在下文；没有宣称所有依赖安全。

---

# Historical dependency verification

Verified on Windows on 2026-09-08. Node 24.16.0, npm 11.13.0, Git 2.53.0.windows.3.
The MySQL267 service was Running; this is not evidence of SQL authentication or migration success.

## Reproducibility

All dependency/devDependency/engine entries in the original three manifests matched
the v3 lockfile by key and value. The first raw JSON comparison differed only because
of property order; a per-key comparison confirmed there was no version mismatch.
There was no node_modules directory. Original-lock `npm ci` completed, installing
365 packages. Original app import failed with ERR_MODULE_NOT_FOUND for openapi.js.

Direct versions after review: React/React DOM 19.2.8, React Router 7.18.3, Bootstrap
5.3.8, Vite 7.3.6, React plugin 5.2.0, Vitest 3.2.7, Express 5.2.1, Sequelize
6.37.8, mysql2 3.24.4, Zod 4.5.4, Supertest 7.2.2. Node 24 satisfies the checked
direct package engine ranges. npm ls --depth=0 reported no missing/invalid packages.

## Deliberate security updates

Original npm audit reported 2 high and 2 moderate package findings. Only Nodemailer
and Sharp were updated with exact versions; the original lockfile was preserved
under work/baseline and the live lockfile was updated by npm, not recreated by hand.

- Nodemailer 7.0.13 → 10.0.1, to address the reported advisories affecting <=9.0.0.
  Adapter tests use mocked SMTP and the real memory-only MIME transport. Only
  to/subject/text can reach sendMail; file/URL access is disabled. Real SMTP also
  requires MAIL_ALLOW_SMTP=true and user authorization.
- Sharp 0.34.5 → 0.35.4, to address the reported libvips findings affecting <0.35.0.
  Supertest exercises a real PNG → 384x384 JPEG conversion with this installed version.

Sources: [Nodemailer releases](https://github.com/nodemailer/nodemailer/releases/tag/v10.0.1),
[Sharp changelog](https://sharp.pixelplumbing.com/changelog/v0.35.4).

## Open risk retained explicitly

The new audit reports 0 high, 0 critical and **2 moderate package findings**:
uuid 8.3.2 and its dependent Sequelize 6.37.8. Both concern one underlying advisory,
[GHSA-w5hq-g745-h8pq](https://github.com/uuidjs/uuid/security/advisories/GHSA-w5hq-g745-h8pq).
The advisory concerns v3/v5/v6 with caller-provided output buffers. Inspection of
the installed Sequelize utils and query-generator found v1/v4 calls, with no
external output buffer. This reduces the assessed applicability of that issue to
the inspected paths; it does not prove all transitive code is safe.

No force downgrade to Sequelize 3 or untested cross-major uuid override was applied.
Keep this risk visible and review an upstream Sequelize fix or a separately tested
override before release. npm audit still exits 1; do not call the audit clean.

## Local source protection

The project is not a Git repository yet. work/baseline is a local pre-edit copy,
not Git history. .gitignore excludes reference/, .env files, uploads/, work/,
node_modules and builds. If initializing Git later, inspect staged filenames and
content before committing; ignore rules do not remove already-tracked secrets.
No remote repository, commit, push or upload was created in this stage.
