import express from "express";
import service from "../JRS HR/server/service.cjs";
import model from "../JRS HR/dist/state.js";
import { publicationSchema } from "./job-publications.mjs";

// Adapt the existing command transaction; do not duplicate recruitment rules.
export function jobEditorRouter({ recruitment, pool, requireUser }) {
  const router = express.Router();
  router.use(express.json({ limit: "32kb" }), requireUser);
  async function listing(user) {
    const state = await recruitment.snapshot(user.id);
    const [publications] = await pool.query(
      "SELECT recruiting_id AS id,salary_range AS salaryRange,closing_date AS closingDate,publish_date AS publishDate,unpublish_date AS unpublishDate FROM JRS_JOB_PUBLICATION",
    );
    const published = new Map(publications.map((row) => [row.id, row]));
    return {
      revision: state.revision,
      items: state.jobs.map((job) => ({
        ...job,
        status:job.status === "Stopped" ? "Closed" : job.status,
        salaryRange: "",
        closingDate: null,
        publishDate: null,
        unpublishDate: null,
        ...published.get(job.id),
        applications: state.applications.filter((row) => row.jobId === job.id).length,
      })),
      templates: model.requirements.titles.map((title) => ({
        title,
        requirements: model.requirements.forTitle(title),
      })),
    };
  }
  router.get("/", async (req, res) => res.json(await listing(req.user)));
  router.post("/", async (req, res) => {
    const publication = publicationSchema.parse(
      Object.fromEntries(
        ["salaryRange", "closingDate", "publishDate", "unpublishDate"].map((key) => [
          key,
          req.body[key] ?? "",
        ]),
      ),
    );
    const commands = service.createService({
      ...recruitment,
      async save(connection, before, after) {
        const previous = new Set(before.jobs.map((job) => job.id));
        const job = req.body.id
          ? after.jobs.find((job) => job.id === req.body.id)
          : after.jobs.find((job) => !previous.has(job.id));
        await connection.execute(
          "INSERT INTO JRS_JOB_PUBLICATION(recruiting_id,salary_range,closing_date,publish_date,unpublish_date) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE salary_range=VALUES(salary_range),closing_date=VALUES(closing_date),publish_date=VALUES(publish_date),unpublish_date=VALUES(unpublish_date)",
          [
            job.id,
            publication.salaryRange,
            publication.closingDate || null,
            publication.publishDate || null,
            publication.unpublishDate || null,
          ],
        );
        await recruitment.save(connection, before, after);
      },
    });
    const result = await commands.execute(
      "job-save",
      { ...req.body, ...publication },
      req.user,
      Number(req.get("If-Match")),
      req.get("Idempotency-Key"),
    );
    res.json({ ...result, ...(await listing(req.user)) });
  });
  router.post("/:id/status", async (req, res) => {
    const result = await service
      .createService(recruitment)
      .execute(
        "job-status",
        { id: req.params.id, status: req.body.status },
        req.user,
        Number(req.get("If-Match")),
        req.get("Idempotency-Key"),
      );
    res.json({ ...result, ...(await listing(req.user)) });
  });
  router.use((error, req, res, next) => {
    const status = error.name === "ZodError" ? 422 : error.status || 500;
    res.status(status).json({
      error: {
        code: error.code || "JOB_EDITOR_ERROR",
        message:
          status >= 500
            ? "The job could not be saved. Retry the same operation to check its saved state."
            : error.issues?.[0]?.message || error.message,
      },
    });
  });
  return router;
}
