import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import mysql from "mysql2/promise";
import { root, loadSettings, assertLocalDatabase } from "../server/config.mjs";
import { namespacePool } from "../server/sql-namespace.mjs";
import { createRecruitmentBridge } from "../server/recruitment-bridge.mjs";
import { loadAssessments, saveAssessments } from "../server/interview-assessments.mjs";
import { importDemoData } from "./import-demo-data.mjs";
import repository from "../JRS HR/server/repository.cjs";
import M from "../JRS HR/dist/state.js";

const prefix = "demo-20261021-";
const teams = [
  "Product",
  "Operations",
  "Customer Platform",
  "Internal Systems",
  "Regional Services",
  "Growth",
  "Service Delivery",
  "Business Enablement",
  "Digital Experience",
  "Enterprise",
];
const stages = ["Pending Review", "Interview", "Interview Results", "Offer", "Rejected", "Hired"];

function unchangedPlaceholder(job, base, index) {
  const original = {
    ...base,
    id: job.id,
    title: `Demo Role ${String(index + 1).padStart(3, "0")} - Platform and Recruitment Systems Engineer`,
    department: index % 2 ? "Operations" : "Engineering",
    status: index % 2 ? "Draft" : "Active",
    description:
      "Fictional demonstration role for local layout, filtering and pagination checks. Not a real vacancy.",
    createdAt: job.createdAt,
  };
  return Object.entries(original).every(
    ([key, value]) => JSON.stringify(job[key]) === JSON.stringify(value),
  );
}

// The caller owns the transaction. Only untouched original placeholders are rewritten.
export async function enrichDemoData(connection) {
  const [[target]] = await connection.query("SELECT DATABASE() AS name,@@port AS port");
  if (
    Number(target.port) !== 3307 ||
    !["jrs_integrated_dev_20261019", "jrs_integrated_test_20261019"].includes(target.name)
  )
    throw new Error(
      "Demo enrichment is restricted to the isolated local development/test databases on port 3307.",
    );
  await connection.query("SELECT revision FROM recruiting_workspace WHERE id=1 FOR UPDATE");
  const repo = repository.createRepository(namespacePool(connection));
  const before = await loadAssessments(connection, await repo.load(namespacePool(connection)));
  const after = M.clone(before),
    source = M.seed(),
    now = new Date().toISOString();
  const delta = {
    jobs: [],
    candidates: [],
    applications: [],
    interviews: [],
    tasks: [],
    systemNotifications: [],
  };
  const counts = { jobsUpdated: 0, candidates: 0, applications: 0, interviews: 0, tasks: 0 };
  const ids = Object.fromEntries(
    ["candidates", "applications", "interviews", "tasks"].map((key) => [
      key,
      new Set(after[key].map((row) => row.id)),
    ]),
  );
  const append = (key, row) => {
    if (ids[key].has(row.id)) return;
    after[key].push(row);
    delta[key].push(row);
    ids[key].add(row.id);
    counts[key]++;
  };
  for (let index = 0; index < 100; index++) {
    const id = `${prefix}job-${String(index + 1).padStart(3, "0")}`;
    const job = after.jobs.find((row) => row.id === id);
    if (!job) throw new Error("Import the original demo batch before enriching it.");
    const base = source.jobs[index % 10],
      team = teams[Math.floor(index / 10)];
    if (unchangedPlaceholder(job, source.jobs[0], index)) {
      Object.assign(job, {
        ...base,
        id,
        createdAt: job.createdAt,
        title: `Demo ${base.title} - ${team}`,
        location: ["Singapore", "Jurong East", "Tampines", "Woodlands", "Paya Lebar"][
          Math.floor(index / 10) % 5
        ],
        mode: ["Hybrid", "On-site", "Remote"][index % 3],
        type: index % 10 === 3 ? "Contract" : index % 10 === 8 ? "Internship" : "Full-time",
        experience:
          index % 10 === 8 ? "Entry level" : Math.floor(index / 10) % 2 ? "4+ years" : "2+ years",
        status: index % 10 === 9 ? "Closed" : index % 10 === 8 ? "Draft" : "Active",
        description: `Fictional ${base.title.toLowerCase()} role in the ${team} team. ${base.description} Own ${team.toLowerCase()} delivery, document decisions and collaborate with cross-functional colleagues. Demonstration data only; not a real vacancy.`,
      });
      delta.jobs.push(job);
      counts.jobsUpdated++;
      // The original fixture settings are recognized exactly; user-edited publication values stay intact.
      await connection.execute(
        "UPDATE JRS_JOB_PUBLICATION SET salary_range=? WHERE recruiting_id=? AND salary_range=? AND closing_date=? AND publish_date=? AND unpublish_date IS NULL",
        [
          `SGD ${3500 + (index % 10) * 300} - ${4500 + (index % 10) * 400}`,
          id,
          index % 3 ? "SGD 5,000 - 6,000" : "",
          "2031-01-31",
          "2031-01-01",
        ],
      );
    }
    if (index === 0) continue; // Keep the two original feedback examples unchanged.
    const applicationId = `${prefix}case-${String(index + 1).padStart(3, "0")}`;
    if (ids.applications.has(applicationId)) continue;
    const candidateId = `${applicationId}-candidate`,
      person = source.candidates[index + 1];
    const stage = job.status === "Active" ? stages[index % 6] : "Pending Review";
    const candidate = {
      ...person,
      id: candidateId,
      name: `Demo ${person.name}`,
      email: `demo-case-${String(index + 1).padStart(3, "0")}@example.test`,
      phone: "",
      location: job.location,
      skills: [...job.skills],
      experience: 1 + (index % 8),
      notes: `Fictional ${base.title.toLowerCase()} applicant for ${team}. Demonstrates the ${stage} workflow; no real contact or uploaded resume.`,
      createdAt: now,
    };
    const completed = ["Interview Results", "Offer", "Hired"].includes(stage);
    const feedback = completed
      ? {
          rating: 3 + (index % 3),
          recommendation: index % 3 === 0 ? "Hold" : "Proceed",
          notes: `Demo interview: discussed ${job.skills.slice(0, 2).join(" and ")} through a ${team.toLowerCase()} work example. ${index % 3 === 0 ? "Request a focused follow-up before deciding." : "Relevant evidence recorded; the final hiring decision remains manual."}`,
          recordedAt: now,
          assessment: [
            { label: "Role knowledge", rating: 3 + (index % 3) },
            { label: "Practical problem solving", rating: 2 + (index % 4) },
            { label: "Communication", rating: 3 + (index % 3) },
          ],
        }
      : null;
    const offer = ["Offer", "Hired"].includes(stage)
      ? {
          salary: 4000 + (index % 10) * 350,
          currency: "SGD",
          startDate: M.day(30),
          expiry: M.day(stage === "Hired" ? -1 : 7),
          approval: stage === "Hired" || index % 2 ? "Approved" : "Awaiting approval",
          status: stage === "Hired" ? "Accepted" : "Draft",
          terms: `Fictional offer for the ${team} team. Standard working hours and benefits; no real employment agreement.`,
          createdAt: now,
        }
      : null;
    append("candidates", candidate);
    append("applications", {
      id: applicationId,
      candidateId,
      jobId: id,
      stage,
      appliedDate: M.day(-3 - (index % 18)),
      priority: index % 4 === 0 ? "High" : "Normal",
      retentionStartedAt: ["Offer", "Rejected"].includes(stage) ? now : null,
      rejectionReason:
        stage === "Rejected"
          ? "Demonstration: current work examples do not match the role requirements."
          : "",
      rejectionConfirmed: stage === "Rejected",
      notes: [
        {
          text: `Demo scenario: ${stage}. Fictional local data, not a real hiring outcome.`,
          actor: "Demo data import",
          at: now,
        },
      ],
      feedback,
      offer,
      createdAt: now,
    });
    if (stage === "Interview" || completed)
      append("interviews", {
        id: `${applicationId}-interview`,
        applicationId,
        date: M.day(completed ? -2 - (index % 5) : 2 + (index % 5)),
        time: `${String(9 + (index % 8)).padStart(2, "0")}:00`,
        duration: [30, 45, 60][index % 3],
        format: index % 2 ? "Video" : "On-site",
        location: index % 2 ? "Demo video meeting" : `Demo ${team} meeting room`,
        interviewer: `Demo interviewer ${1 + (index % 5)}`,
        notes: `Fictional ${base.title.toLowerCase()} interview. Review a relevant work example and discuss role expectations.`,
        status: completed ? "Completed" : "Scheduled",
        feedback,
      });
    if (stage === "Interview Results")
      append("tasks", {
        id: `${applicationId}-task`,
        applicationId,
        title: `Review ${base.title} interview evidence`,
        assignee: "Demo HR reviewer",
        due: M.day(2 + (index % 4)),
        notes:
          "Fictional follow-up. Compare documented interview evidence before making a manual decision.",
        status: "Open",
        createdAt: now,
      });
  }
  if (!Object.values(counts).some(Boolean)) return counts;
  M.validate(after);
  after.revision++;
  after.updatedAt = now;
  await repo.save(namespacePool(connection), before, after);
  await saveAssessments(connection, before, after);
  await createRecruitmentBridge(connection).mirror(connection, { systemNotifications: [] }, delta);
  return counts;
}

async function main() {
  if (!process.argv.includes("--apply"))
    throw new Error("Pass --apply to explicitly enrich the local Demo records.");
  const settings = loadSettings();
  assertLocalDatabase(settings);
  const pool = mysql.createPool(settings.db),
    connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query("SELECT revision FROM recruiting_workspace WHERE id=1 FOR UPDATE");
    const repo = repository.createRepository(namespacePool(connection));
    const snapshot = await loadAssessments(connection, await repo.load(namespacePool(connection)));
    const backup = path.join(root, ".local", `before-demo-enrichment-${Date.now()}.json`);
    await fs.mkdir(path.dirname(backup), { recursive: true });
    await fs.writeFile(backup, JSON.stringify(snapshot), { flag: "wx" });
    await importDemoData(connection);
    const result = await enrichDemoData(connection);
    await connection.commit();
    console.log(JSON.stringify({ database: settings.DB_NAME, ...result, backup }, null, 2));
  } catch (error) {
    await connection.rollback();
    console.error("Demo enrichment rolled back:", error.code || error.name);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  await main();
