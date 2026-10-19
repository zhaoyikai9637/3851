import { Router } from "express";
import { body } from "express-validator";
import { validateRequest } from "../middleware/validate.js";

const router = Router();

const profileValidators = [
  body("phone").optional().isString().trim().isLength({ max: 30 }).withMessage("Phone number must be 30 characters or fewer."),
  body("location").optional().isString().trim().isLength({ max: 100 }).withMessage("Location must be 100 characters or fewer."),
  body("availabilityStatus").optional().isIn(["AVAILABLE", "CLOSED"]).withMessage("Select a valid visibility setting."),
  body("education").optional().isArray({ max: 5 }).withMessage("Add no more than five education records."),
  body("education.*.institution").optional().isString().trim().isLength({ max: 150 }),
  body("education.*.qualification").optional().isString().trim().isLength({ max: 150 }),
  body("education.*.startYear").optional({ checkFalsy: true }).isInt({ min: 1950, max: 2100 }).withMessage("Enter a valid education start year."),
  body("education.*.graduationYear").optional({ checkFalsy: true }).isInt({ min: 1950, max: 2100 }).withMessage("Enter a valid graduation year."),
  body("languages").optional().isArray({ max: 8 }).withMessage("Add no more than eight languages."),
  body("languages.*.language").optional().isString().trim().isLength({ max: 60 }),
  body("languages.*.readingLevel").optional({ checkFalsy: true }).isIn(["Basic", "Intermediate", "Advanced", "Native"]),
  body("languages.*.writingLevel").optional({ checkFalsy: true }).isIn(["Basic", "Intermediate", "Advanced", "Native"]),
];

router.get("/", async (req, res, next) => {
  try {
    res.json({ profile: await req.app.locals.data.getProfile(req.user.id) });
  } catch (error) {
    next(error);
  }
});

router.put("/", profileValidators, validateRequest, async (req, res, next) => {
  try {
    const values = {
      phone: req.body.phone ?? "",
      location: req.body.location ?? "",
      availabilityStatus: req.body.availabilityStatus || "AVAILABLE",
      education: req.body.education || [],
      languages: req.body.languages || [],
    };
    res.json({ profile: await req.app.locals.data.updateProfile(req.user.id, values) });
  } catch (error) {
    next(error);
  }
});

export default router;
