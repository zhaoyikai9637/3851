import assert from "node:assert/strict";
import { test } from "node:test";
import mysql from "mysql2/promise";
import { loadSettings } from "../server/config.mjs";
import repository from "../JRS HR/server/repository.cjs";
import { namespacePool } from "../server/sql-namespace.mjs";
import { importDemoData } from "../scripts/import-demo-data.mjs";

const enrichment = await import("../scripts/enrich-demo-data.mjs").catch((error) => {
  if (error.code === "ERR_MODULE_NOT_FOUND") return {};
  throw error;
});

test("demo enrichment gives every job an application, varied roles and workflow cases without changing real or edited records", async () => {
  assert.equal(
    typeof enrichment.enrichDemoData,
    "function",
    "Meaningful demo enrichment is missing",
  );
  const settings = loadSettings(),
    pool = mysql.createPool({ ...settings.db, database: "jrs_integrated_test_20261019" });
  const connection = await pool.getConnection(),
    repo = repository.createRepository(namespacePool(pool));
  try {
    await connection.beginTransaction();
    await importDemoData(connection);
    await connection.execute(
      "UPDATE recruiting_job_position SET title='My edited demo' WHERE id='demo-20261021-job-100'",
    );
    const before = await repo.load(namespacePool(connection));
    const result = await enrichment.enrichDemoData(connection);
    assert.equal(result.jobsUpdated, 99);
    const after = await repo.load(namespacePool(connection));
    assert.equal(
      after.jobs.find((row) => row.id === "demo-20261021-job-100").title,
      "My edited demo",
    );
    for (const key of ["jobs", "candidates", "applications", "interviews"]) {
      const real = before[key].filter((row) => !row.id.startsWith("demo-20261021-"));
      assert.deepEqual(
        after[key].filter((row) => !row.id.startsWith("demo-20261021-")),
        real,
      );
    }
    const jobs = after.jobs.filter((row) => row.id.startsWith("demo-20261021-"));
    assert.equal(new Set(jobs.map((row) => row.title)).size, 100);
    assert.ok(new Set(jobs.map((row) => row.department)).size >= 8);
    for (const job of jobs)
      assert.ok(
        after.applications.some((row) => row.jobId === job.id),
        `${job.title} has no application`,
      );
    const demoApps = after.applications.filter((row) => row.id.startsWith("demo-20261021-"));
    assert.deepEqual(
      new Set(demoApps.map((row) => row.stage)),
      new Set(["Pending Review", "Interview", "Interview Results", "Offer", "Rejected", "Hired"]),
    );
    assert.equal(demoApps.length, 101);
    assert.equal(
      after.interviews.find((row) => row.id === "demo-20261021-interview-completed").feedback
        .rating,
      2,
    );
    assert.ok(after.tasks.some((row) => row.id.startsWith("demo-20261021-")));
    const [[canonical]] = await connection.query(
      "SELECT j.title FROM JOB_POSITION j JOIN JRS_JOB_LINK l ON l.canonical_id=j.position_id WHERE l.recruiting_id='demo-20261021-job-002'",
    );
    assert.equal(
      canonical.title,
      after.jobs.find((row) => row.id === "demo-20261021-job-002").title,
    );
    const again = await enrichment.enrichDemoData(connection);
    assert.deepEqual(again, {
      jobsUpdated: 0,
      candidates: 0,
      applications: 0,
      interviews: 0,
      tasks: 0,
    });
    assert.equal((await repo.load(namespacePool(connection))).revision, after.revision);
  } finally {
    await connection.rollback();
    connection.release();
    await pool.end();
  }
});
