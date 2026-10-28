import { Router } from "express";
import { body, param } from "express-validator";
import { validateRequest } from "../middleware/validate.js";
import { experienceError, cleanText } from "../../shared/applicantFields.js";
import { canonicalPhone, canonicalSkills } from "../../shared/contactFields.js";
import { canonicalLocation } from "../data/locationFields.js";

const router = Router();

const applicationValidators = [
  body("phone").custom((value) => { canonicalPhone(value); return true; }),
  body("location").custom((value) => { canonicalLocation(value); return true; }),
  body("jobId").isInt({ min: 1 }).withMessage("Select a valid job."),
  body("resumeId").isInt({ min: 1 }).withMessage("Select a valid resume."),
  body("phone").isString().trim().isLength({ min: 3, max: 30 }).withMessage("Phone number must contain 3 to 30 characters."),
  body("location").isString().trim().isLength({ min: 2, max: 255 }).withMessage("Select a valid location."),
  body("coverLetter").optional().isString().trim().isLength({ max: 1500 }).withMessage("Cover note must be 1,500 characters or fewer."),
  body("experiences").isArray({ min: 1, max: 5 }).withMessage("Add between one and five work experiences."),
  body("experiences.*.companyName").isString().trim().isLength({ min: 1, max: 120 }).withMessage("Company name is required and must be 120 characters or fewer."),
  body("experiences.*.jobTitle").isString().trim().isLength({ min: 1, max: 120 }).withMessage("Job title is required and must be 120 characters or fewer."),
  body("experiences.*.startDate").matches(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/).withMessage("Enter a valid employment start month."),
  body("experiences.*.endDate").optional({ checkFalsy: true }).matches(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/).withMessage("Enter a valid employment end month."),
  body("experiences.*.currentRole").custom((value) => typeof value === "boolean").withMessage("Current role must be true or false."),
  body("experiences.*.responsibilities").isString().trim().isLength({ min: 10, max: 1200 }).withMessage("Responsibilities must contain 10 to 1,200 characters."),
  body("experiences.*.achievements").optional().isString().trim().isLength({ max: 1000 }).withMessage("Achievements must be 1,000 characters or fewer."),
  body("experiences.*.skills").custom((value) => { canonicalSkills(value); return true; }),
  body("experiences").custom((experiences) => {
    const error = experienceError(experiences);
    if (error) throw new Error(error);
    if (!Array.isArray(experiences) || experiences.some((experience) => !experience)) return false;
    const invalidEndDate = experiences.some((experience) => !experience.currentRole && !experience.endDate);
    if (invalidEndDate) throw new Error("Add an end month or mark the position as your current role.");
    if (experiences.some((experience) => experience.currentRole ? Boolean(experience.endDate) : experience.endDate < experience.startDate)) {
      throw new Error("End month must follow the start month; current roles must have no end month.");
    }
    return true;
  }),
  body("roleAnswers").isObject().withMessage("Role-specific answers are required.").custom((answers) => {
    const tooLong = Object.values(answers).some((answer) => typeof answer !== "string" || answer.length > 600);
    if (tooLong) throw new Error("Each role-specific answer must be 600 characters or fewer.");
    return true;
  }),
  body("declarationAccepted").custom((value) => value === true).withMessage("Accept the applicant declaration before submitting."),
];

router.get("/me", async (req, res, next) => {
  try {
    res.json({ application: await req.app.locals.data.getCurrentApplication(req.user.id) });
  } catch (error) {
    next(error);
  }
});

router.post("/", applicationValidators, validateRequest, async (req, res, next) => {
  try {
    const job = await req.app.locals.data.getJob(Number(req.body.jobId));
    if (!job) return res.status(404).json({ message: "Job not found." });
    const questions = job.roleQuestions || [];
    const unknown = Object.keys(req.body.roleAnswers).some((key) => !questions.some((question) => question.id === key));
    const invalid = questions.some((question) => {
      const answer = req.body.roleAnswers[question.id] || "";
      return (question.required && !answer.trim()) || answer.length > question.maxLength
        || (question.type === "select" && answer !== "" && !question.options.includes(answer));
    });
    if (unknown || invalid) return res.status(422).json({ message: "A required role answer is missing or invalid. Check the highlighted question." });
    const application = await req.app.locals.data.createApplication(req.user.id, {
      jobId: Number(req.body.jobId),
      resumeId: Number(req.body.resumeId),
      phone: canonicalPhone(req.body.phone),
      location: canonicalLocation(req.body.location),
      coverLetter: req.body.coverLetter || "",
      experiences: req.body.experiences.map((row) => ({
        companyName: cleanText(row.companyName), jobTitle: cleanText(row.jobTitle),
        startDate: row.startDate, endDate: row.currentRole ? null : row.endDate,
        currentRole: row.currentRole, responsibilities: row.responsibilities,
        achievements: row.achievements || "", skills: canonicalSkills(row.skills),
      })),
      roleAnswers: req.body.roleAnswers,
      declarationAccepted: true,
    });
    res.status(201).json({ application });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/:applicationId/withdraw",
  [param("applicationId").isInt({ min: 1 }).withMessage("Invalid application identifier.")],
  validateRequest,
  async (req, res, next) => {
    try {
      const application = await req.app.locals.data.withdrawApplication(req.user.id, req.params.applicationId);
      if (!application) return res.status(404).json({ message: "Application not found." });
      res.json({ application });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
