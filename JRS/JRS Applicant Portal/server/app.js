import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import session from "express-session";
import helmet from "helmet";
import { createDataLayer } from "./data/createDataLayer.js";
import { requireApplicant } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import applicationRoutes from "./routes/applications.js";
import authRoutes from "./routes/auth.js";
import jobRoutes from "./routes/jobs.js";
import profileRoutes from "./routes/profile.js";
import resumeRoutes from "./routes/resumes.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDirectory, "../.env") });

export async function createApp() {
  const app = express();
  const data = await createDataLayer();
  const allowedOrigins = new Set([
    process.env.FRONTEND_URL || "http://127.0.0.1:5173",
    process.env.AUTH_FRONTEND_URL || "http://127.0.0.1:3002",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3002",
    "http://127.0.0.1:3002",
  ]);

  app.locals.data = data;
  app.set("trust proxy", process.env.NODE_ENV === "production" ? 1 : 0);
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      callback(new Error("This website origin is not allowed to use the API."));
    },
  }));
  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ extended: false, limit: "100kb" }));
  app.use(session({
    name: "jrs.sid",
    secret: process.env.SESSION_SECRET || "development-only-jrs-session-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000,
    },
  }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", databaseMode: data.mode });
  });
  app.use("/api/auth", authRoutes);
  app.use("/api/jobs", jobRoutes);
  app.use("/api/profile", requireApplicant, profileRoutes);
  app.use("/api/resumes", requireApplicant, resumeRoutes);
  app.use("/api/applications", requireApplicant, applicationRoutes);
  app.use(notFound);
  app.use(errorHandler);

  return { app, data };
}
