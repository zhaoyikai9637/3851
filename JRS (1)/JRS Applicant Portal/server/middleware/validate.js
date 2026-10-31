import { validationResult } from "express-validator";

export function validateRequest(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(422).json({
      message: "Please correct the highlighted information.",
      errors: result.array({ onlyFirstError: true }),
    });
  }
  next();
}
