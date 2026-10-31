import { Router } from "express";
import { param, query } from "express-validator";
import { validateRequest } from "../middleware/validate.js";
import { employmentCode, experienceCode, workModeCode } from "../data/jobOptions.js";

const router = Router();

router.get(
  "/",
  [
    query("search").optional().trim().isLength({ max: 100 }).withMessage("Search text must be 100 characters or fewer."),
    query("department").optional().trim().isLength({ max: 80 }),
    query("location").optional().trim().isLength({ max: 100 }),
    query("workMode").optional().customSanitizer(workModeCode).isIn(["HYBRID", "REMOTE", "ON_SITE"]),
    query("employmentType").optional().customSanitizer(employmentCode).isIn(["FULL_TIME", "PART_TIME"]),
    query("experienceLevel").optional().customSanitizer(experienceCode).isIn(["YEARS_1_3", "YEARS_3_5", "YEARS_5_7"]),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      res.json(await req.app.locals.data.listJobs(req.query));
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/:jobId",
  [param("jobId").isInt({ min: 1 }).withMessage("Invalid job identifier.")],
  validateRequest,
  async (req, res, next) => {
    try {
      const job = await req.app.locals.data.getJob(req.params.jobId);
      if (!job) return res.status(404).json({ message: "Job not found." });
      res.json({ job });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
