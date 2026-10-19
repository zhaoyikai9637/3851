import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import { param } from "express-validator";
import multer from "multer";
import { validateRequest } from "../middleware/validate.js";

const uploadDirectory = fileURLToPath(new URL("../../uploads/", import.meta.url));
const allowedExtensions = new Set([".pdf", ".doc", ".docx"]);
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const storage = multer.diskStorage({
  destination: uploadDirectory,
  filename(req, file, callback) {
    callback(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase());
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.has(extension) || !allowedMimeTypes.has(file.mimetype)) {
      const error = new Error("Upload a PDF, DOC, or DOCX resume.");
      error.status = 400;
      return callback(error);
    }
    if (file.originalname.length > 180) {
      const error = new Error("Resume file names must be 180 characters or fewer.");
      error.status = 400;
      return callback(error);
    }
    callback(null, true);
  },
});

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    res.json({ resumes: await req.app.locals.data.listResumes(req.user.id) });
  } catch (error) {
    next(error);
  }
});

router.post("/", upload.single("resume"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Choose a resume file to upload." });
    const resume = await req.app.locals.data.createResume(req.user.id, req.file);
    res.status(201).json({ resume });
  } catch (error) {
    if (req.file) await fs.unlink(req.file.path).catch(() => {});
    next(error);
  }
});

router.delete(
  "/:resumeId",
  [param("resumeId").isInt({ min: 1 }).withMessage("Invalid resume identifier.")],
  validateRequest,
  async (req, res, next) => {
    try {
      const resume = await req.app.locals.data.deleteResume(req.user.id, req.params.resumeId);
      if (!resume) return res.status(404).json({ message: "Resume not found." });
      await fs.unlink(path.join(uploadDirectory, resume.storedName)).catch(() => {});
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);

export default router;
