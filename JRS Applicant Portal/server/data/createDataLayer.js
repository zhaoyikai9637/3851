import { Op } from "sequelize";
import { createSequelize } from "../config/database.js";
import { defineModels } from "../models/index.js";
import { demoJobs, demoProfile } from "./seedData.js";

function plain(record) {
  return record?.toJSON ? record.toJSON() : structuredClone(record);
}

function publicUser(user) {
  if (!user) return null;
  const value = plain(user);
  delete value.passwordHash;
  return value;
}

function jobFilters(jobs) {
  const unique = (key) => [...new Set(jobs.map((job) => job[key]))].sort();
  return {
    departments: unique("department"),
    locations: unique("location"),
    workModes: unique("workMode"),
    experienceLevels: unique("experienceLevel"),
  };
}

function matchesJob(job, filters) {
  const search = String(filters.search || "").trim().toLowerCase();
  const searchText = [
    job.title,
    job.department,
    job.summary,
    ...(job.requirements || []),
  ].join(" ").toLowerCase();

  return (!search || searchText.includes(search))
    && (!filters.department || job.department === filters.department)
    && (!filters.location || job.location === filters.location)
    && (!filters.workMode || job.workMode === filters.workMode)
    && (!filters.experienceLevel || job.experienceLevel === filters.experienceLevel);
}

class DemoDataLayer {
  constructor() {
    const now = new Date().toISOString();
    this.mode = "demo";
    this.users = [{
      id: 1,
      fullName: "Sarah Mitchell",
      email: "sarah.mitchell@example.com",
      role: "applicant",
      createdAt: now,
      updatedAt: now,
    }];
    this.jobs = structuredClone(demoJobs).map((job) => ({ ...job, createdAt: now, updatedAt: now }));
    this.profiles = { 1: { id: 1, userId: 1, ...structuredClone(demoProfile), createdAt: now, updatedAt: now } };
    this.resumes = [];
    this.applications = [];
    this.resumeId = 1;
    this.applicationId = 1;
  }

  async close() {}

  async getUserById(id) {
    return publicUser(this.users.find((user) => user.id === Number(id)) || null);
  }

  async listJobs(filters) {
    const openJobs = this.jobs.filter((job) => job.isOpen);
    return {
      jobs: openJobs.filter((job) => matchesJob(job, filters)).map(plain),
      filters: jobFilters(openJobs),
    };
  }

  async getJob(id) {
    return plain(this.jobs.find((job) => job.id === Number(id)) || null);
  }

  async getProfile(userId) {
    return plain(this.profiles[userId]);
  }

  async updateProfile(userId, values) {
    const current = this.profiles[userId];
    this.profiles[userId] = { ...current, ...values, updatedAt: new Date().toISOString() };
    return plain(this.profiles[userId]);
  }

  async listResumes(userId) {
    return this.resumes
      .filter((resume) => resume.userId === Number(userId))
      .sort((a, b) => b.id - a.id)
      .map(plain);
  }

  async createResume(userId, file) {
    const now = new Date().toISOString();
    const resume = {
      id: this.resumeId++,
      userId: Number(userId),
      originalName: file.originalname,
      storedName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      createdAt: now,
      updatedAt: now,
    };
    this.resumes.push(resume);
    return plain(resume);
  }

  async deleteResume(userId, resumeId) {
    const resume = this.resumes.find((item) => item.id === Number(resumeId) && item.userId === Number(userId));
    if (!resume) return null;
    const inUse = this.applications.some((application) => application.resumeId === resume.id);
    if (inUse) {
      const error = new Error("A resume attached to an application cannot be deleted.");
      error.status = 409;
      throw error;
    }
    this.resumes = this.resumes.filter((item) => item.id !== resume.id);
    return plain(resume);
  }

  enrichApplication(application) {
    if (!application) return null;
    return {
      ...plain(application),
      job: plain(this.jobs.find((job) => job.id === application.jobId)),
      resume: plain(this.resumes.find((resume) => resume.id === application.resumeId)),
    };
  }

  async getCurrentApplication(userId) {
    const application = this.applications
      .filter((item) => item.userId === Number(userId))
      .sort((a, b) => b.id - a.id)[0];
    return this.enrichApplication(application);
  }

  async createApplication(userId, values) {
    const active = this.applications.find((application) => (
      application.userId === Number(userId)
      && !["Withdrawn", "Rejected"].includes(application.status)
    ));
    if (active) {
      const error = new Error("You already have an active application with this company. Withdraw it before applying for another role.");
      error.status = 409;
      throw error;
    }

    const job = this.jobs.find((item) => item.id === Number(values.jobId) && item.isOpen);
    if (!job) {
      const error = new Error("This role is not available for applications.");
      error.status = 404;
      throw error;
    }

    const resume = this.resumes.find((item) => item.id === Number(values.resumeId) && item.userId === Number(userId));
    if (!resume) {
      const error = new Error("Select a resume that belongs to your account.");
      error.status = 400;
      throw error;
    }

    const unanswered = job.roleQuestions.find((question) => question.required && !String(values.roleAnswers[question.id] || "").trim());
    if (unanswered) {
      const error = new Error("Please answer every required question for this role.");
      error.status = 400;
      throw error;
    }

    const now = new Date().toISOString();
    const application = {
      id: this.applicationId++,
      userId: Number(userId),
      ...values,
      jobId: Number(values.jobId),
      resumeId: Number(values.resumeId),
      status: "Submitted",
      statusMessage: "Your application has been received by the recruitment team.",
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    this.applications.push(application);
    await this.updateProfile(userId, { phone: values.phone, location: values.location });
    return this.enrichApplication(application);
  }

  async withdrawApplication(userId, applicationId) {
    const application = this.applications.find((item) => item.id === Number(applicationId) && item.userId === Number(userId));
    if (!application) return null;
    if (["Accepted", "Rejected", "Withdrawn"].includes(application.status)) {
      const error = new Error("This application can no longer be withdrawn.");
      error.status = 409;
      throw error;
    }
    application.status = "Withdrawn";
    application.statusMessage = "You withdrew this application.";
    application.updatedAt = new Date().toISOString();
    return this.enrichApplication(application);
  }
}

class MySqlDataLayer {
  constructor(sequelize, models) {
    this.mode = "mysql";
    this.sequelize = sequelize;
    this.models = models;
  }

  async initialise() {
    await this.sequelize.authenticate();
    await this.sequelize.sync();

    const { User, ApplicantProfile, Job } = this.models;
    let user = await User.findOne({ where: { email: "sarah.mitchell@example.com" } });
    if (!user) {
      user = await User.create({
        fullName: "Sarah Mitchell",
        email: "sarah.mitchell@example.com",
        role: "applicant",
      });
    }

    await ApplicantProfile.findOrCreate({
      where: { userId: user.id },
      defaults: { ...demoProfile, userId: user.id },
    });

    if (await Job.count() === 0) {
      await Job.bulkCreate(demoJobs.map(({ id, ...job }) => job));
    }
  }

  async close() {
    await this.sequelize.close();
  }

  async getUserById(id) {
    const user = await this.models.User.findByPk(id);
    return publicUser(user);
  }

  async listJobs(filters) {
    const records = await this.models.Job.findAll({ where: { isOpen: true }, order: [["closingDate", "ASC"]] });
    const jobs = records.map(plain);
    return {
      jobs: jobs.filter((job) => matchesJob(job, filters)),
      filters: jobFilters(jobs),
    };
  }

  async getJob(id) {
    return plain(await this.models.Job.findByPk(id));
  }

  async getProfile(userId) {
    let profile = await this.models.ApplicantProfile.findOne({ where: { userId } });
    if (!profile) profile = await this.models.ApplicantProfile.create({ userId });
    return plain(profile);
  }

  async updateProfile(userId, values) {
    const [profile] = await this.models.ApplicantProfile.findOrCreate({ where: { userId }, defaults: { userId } });
    await profile.update(values);
    return plain(profile);
  }

  async listResumes(userId) {
    const records = await this.models.Resume.findAll({ where: { userId }, order: [["createdAt", "DESC"]] });
    return records.map(plain);
  }

  async createResume(userId, file) {
    return plain(await this.models.Resume.create({
      userId,
      originalName: file.originalname,
      storedName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
    }));
  }

  async deleteResume(userId, resumeId) {
    const resume = await this.models.Resume.findOne({ where: { id: resumeId, userId } });
    if (!resume) return null;
    if (await this.models.Application.count({ where: { resumeId } })) {
      const error = new Error("A resume attached to an application cannot be deleted.");
      error.status = 409;
      throw error;
    }
    const result = plain(resume);
    await resume.destroy();
    return result;
  }

  async getCurrentApplication(userId) {
    const record = await this.models.Application.findOne({
      where: { userId },
      include: [
        { model: this.models.Job, as: "job" },
        { model: this.models.Resume, as: "resume" },
      ],
      order: [["createdAt", "DESC"]],
    });
    return plain(record);
  }

  async createApplication(userId, values) {
    const active = await this.models.Application.findOne({
      where: {
        userId,
        status: { [Op.notIn]: ["Withdrawn", "Rejected"] },
      },
    });
    if (active) {
      const error = new Error("You already have an active application with this company. Withdraw it before applying for another role.");
      error.status = 409;
      throw error;
    }

    const job = await this.models.Job.findOne({ where: { id: values.jobId, isOpen: true } });
    if (!job) {
      const error = new Error("This role is not available for applications.");
      error.status = 404;
      throw error;
    }

    const resume = await this.models.Resume.findOne({ where: { id: values.resumeId, userId } });
    if (!resume) {
      const error = new Error("Select a resume that belongs to your account.");
      error.status = 400;
      throw error;
    }

    const jobValue = plain(job);
    const unanswered = jobValue.roleQuestions.find((question) => question.required && !String(values.roleAnswers[question.id] || "").trim());
    if (unanswered) {
      const error = new Error("Please answer every required question for this role.");
      error.status = 400;
      throw error;
    }

    const application = await this.models.Application.create({ userId, ...values });
    await this.updateProfile(userId, { phone: values.phone, location: values.location });
    return this.getCurrentApplication(userId);
  }

  async withdrawApplication(userId, applicationId) {
    const application = await this.models.Application.findOne({ where: { id: applicationId, userId } });
    if (!application) return null;
    if (["Accepted", "Rejected", "Withdrawn"].includes(application.status)) {
      const error = new Error("This application can no longer be withdrawn.");
      error.status = 409;
      throw error;
    }
    await application.update({
      status: "Withdrawn",
      statusMessage: "You withdrew this application.",
    });
    return this.getCurrentApplication(userId);
  }
}

export async function createDataLayer() {
  if ((process.env.DB_MODE || "demo").toLowerCase() !== "mysql") {
    return new DemoDataLayer();
  }

  const sequelize = createSequelize();
  const layer = new MySqlDataLayer(sequelize, defineModels(sequelize));
  await layer.initialise();
  return layer;
}
