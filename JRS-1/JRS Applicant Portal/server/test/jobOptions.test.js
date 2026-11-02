import assert from "node:assert/strict";
import { test } from "node:test";
import { Sequelize } from "sequelize";
import { normaliseJobStorage } from "../data/jobOptions.js";
import { defineModels } from "../models/index.js";
import { demoJobs } from "../data/seedData.js";

test("storage normalization separates fixed codes from free text", () => {
  const job = normaliseJobStorage({ title: "Senior Developer", employmentType: " FULL time ", experienceLevel: "3-5 years", workMode: "on-site" });
  assert.equal(job.employmentType, "FULL_TIME");
  assert.equal(job.experienceLevel, "YEARS_3_5");
  assert.equal(job.workMode, "ON_SITE");
  assert.equal(job.title, "Senior Developer");
});

test("ambiguous historical experience is rejected rather than reclassified", () => {
  assert.throws(() => normaliseJobStorage({ employmentType: "Full-time", workMode: "Hybrid", experienceLevel: "3+ years" }), /experienceLevel/);
});

test("all demo jobs use approved stored codes", () => {
  for (const job of demoJobs) assert.deepEqual(normaliseJobStorage(job), job);
});

test("Sequelize setters normalize creates and updates without a database connection", async () => {
  const db = new Sequelize("test", "test", "test", { dialect: "mysql", logging: false });
  try {
    const { Job } = defineModels(db);
    const job = Job.build(demoJobs[0]);
    job.employmentType = " part-time ";
    job.workMode = "Remote";
    assert.equal(job.getDataValue("employmentType"), "PART_TIME");
    assert.equal(job.getDataValue("workMode"), "REMOTE");
    await job.validate();
    assert.throws(() => { job.experienceLevel = "3+ years"; }, /experienceLevel/);
  } finally {
    await db.close();
  }
});
