import { Router } from "express";
import { body } from "express-validator";
import { validateRequest } from "../middleware/validate.js";
import { educationRecords, languageRecords } from "../data/profileFields.js";
import { canonicalPhone } from "../../shared/contactFields.js";
import { canonicalLocation } from "../data/locationFields.js";

const router = Router();

const profileValidators = [
  body("phone").optional().custom((value) => { if (value !== "") canonicalPhone(value); return true; }).customSanitizer((value) => { try { return value === "" ? "" : canonicalPhone(value); } catch { return value; } }),
  body("location").optional().custom((value) => { if (value !== "") canonicalLocation(value); return true; }).customSanitizer((value) => { try { return value === "" ? "" : canonicalLocation(value); } catch { return value; } }),
  body("phone").optional().isString().trim().isLength({ max: 30 }).withMessage("Phone number must be 30 characters or fewer."),
  body("location").optional().isString().trim().isLength({ max: 255 }).withMessage("Selected location is too long."),
  body("availabilityStatus").optional().isIn(["AVAILABLE", "CLOSED"]).withMessage("Select a valid visibility setting."),
  body("education").optional().isArray({ max: 5 }).withMessage("Add no more than five education records."),
  body("education").optional().custom((rows) => { educationRecords(rows); return true; }),
  body("education.*.institution").optional().isString().trim().isLength({ max: 150 }),
  body("education.*.qualification").optional().isString().trim().isLength({ max: 150 }),
  body("education.*.startYear").optional({ checkFalsy: true }).isInt({ min: 1950, max: 2100 }).withMessage("Enter a valid education start year."),
  body("education.*.graduationYear").optional({ checkFalsy: true }).isInt({ min: 1950, max: 2100 }).withMessage("Enter a valid graduation year."),
  body("languages").optional().isArray({ max: 8 }).withMessage("Add no more than eight languages."),
  body("languages").optional().custom((rows) => { languageRecords(rows); return true; }),
  body("languages.*.language").optional().isString().trim().isLength({ max: 60 }),
  body("languages.*.readingLevel").optional({ checkFalsy: true }).isIn(["Basic", "Intermediate", "Advanced", "Native"]),
  body("languages.*.writingLevel").optional({ checkFalsy: true }).isIn(["Basic", "Intermediate", "Advanced", "Native"]),
  body("education").optional().custom((records) => {
    if (!Array.isArray(records)) return false;
    return records.every((record) => record && (!record.startYear || !record.graduationYear || Number(record.graduationYear) >= Number(record.startYear)));
  }).withMessage("Graduation year cannot be earlier than the start year."),
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
    const values = {};
    for (const field of ["phone", "location", "availabilityStatus", "education", "languages"]) {
      if (Object.hasOwn(req.body, field)) values[field] = req.body[field];
    }
    if (values.education) values.education = educationRecords(values.education);
    if (values.languages) values.languages = languageRecords(values.languages);
    res.json({ profile: await req.app.locals.data.updateProfile(req.user.id, values) });
  } catch (error) {
    next(error);
  }
});

export default router;
