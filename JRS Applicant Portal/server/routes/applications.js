import { Router } from "express";
import { body, param } from "express-validator";
import { validateRequest } from "../middleware/validate.js";

const router = Router();

const applicationValidators = [
  body("jobId").isInt({ min: 1 }).withMessage("Select a valid job."),
  body("resumeId").isInt({ min: 1 }).withMessage("Select a valid resume."),
  body("phone").isString().trim().isLength({ min: 3, max: 30 }).withMessage("Phone number must contain 3 to 30 characters."),
  body("location").isString().trim().isLength({ min: 2, max: 100 }).withMessage("Location must contain 2 to 100 characters."),
  body("coverLetter").optional().isString().trim().isLength({ max: 1500 }).withMessage("Cover note must be 1,500 characters or fewer."),
  body("experiences").isArray({ min: 1, max: 5 }).withMessage("Add between one and five work experiences."),
  body("experiences.*.companyName").isString().trim().isLength({ min: 1, max: 120 }).withMessage("Company name is required and must be 120 characters or fewer."),
  body("experiences.*.jobTitle").isString().trim().isLength({ min: 1, max: 120 }).withMessage("Job title is required and must be 120 characters or fewer."),
  body("experiences.*.startDate").matches(/^\d{4}-\d{2}$/).withMessage("Enter a valid employment start month."),
  body("experiences.*.endDate").optional({ checkFalsy: true }).matches(/^\d{4}-\d{2}$/).withMessage("Enter a valid employment end month."),
  body("experiences.*.currentRole").isBoolean().withMessage("Current role must be true or false."),
  body("experiences.*.responsibilities").isString().trim().isLength({ min: 10, max: 1200 }).withMessage("Responsibilities must contain 10 to 1,200 characters."),
  body("experiences.*.achievements").optional().isString().trim().isLength({ max: 1000 }).withMessage("Achievements must be 1,000 characters or fewer."),
  body("experiences.*.skills").optional().isString().trim().isLength({ max: 600 }).withMessage("Skills must be 600 characters or fewer."),
  body("experiences").custom((experiences) => {
    const invalidEndDate = experiences.some((experience) => !experience.currentRole && !experience.endDate);
    if (invalidEndDate) throw new Error("Add an end month or mark the position as your current role.");
    return true;
  }),
  body("roleAnswers").isObject().withMessage("Role-specific answers are required.").custom((answers) => {
    const tooLong = Object.values(answers).some((answer) => typeof answer !== "string" || answer.length > 600);
    if (tooLong) throw new Error("Each role-specific answer must be 600 characters or fewer.");
    return true;
  }),
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
    const application = await req.app.locals.data.createApplication(req.user.id, {
      jobId: Number(req.body.jobId),
      resumeId: Number(req.body.resumeId),
      phone: req.body.phone,
      location: req.body.location,
      coverLetter: req.body.coverLetter || "",
      experiences: req.body.experiences,
      roleAnswers: req.body.roleAnswers,
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
