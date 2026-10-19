import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { after, before, test } from "node:test";
import request from "supertest";
import { createApp } from "../app.js";

let app;
let data;
let agent;
let uploadedFileName;

before(async () => {
  ({ app, data } = await createApp());
  agent = request.agent(app);
});

after(async () => {
  await data.close();
  if (uploadedFileName) {
    const uploadPath = path.resolve("../uploads", uploadedFileName);
    await fs.unlink(uploadPath).catch(() => {});
  }
});

test("public visitors can browse the company's jobs", async () => {
  const response = await request(app).get("/api/jobs");
  assert.equal(response.status, 200);
  assert.ok(response.body.jobs.length > 0);
});

test("applicant data routes require an applicant session", async () => {
  const response = await request(app).get("/api/profile");
  assert.equal(response.status, 401);
});

test("credential login is reserved for the team's authentication module", async () => {
  const response = await request(app).post("/api/auth/login").send({});
  assert.equal(response.status, 404);
});

test("local demo mode can preview an authenticated applicant session", async () => {
  const response = await agent.post("/api/auth/demo-session");
  assert.equal(response.status, 200);
  assert.equal(response.body.user.role, "applicant");
  assert.ok(response.headers["set-cookie"][0].includes("HttpOnly"));
});

test("jobs API supports the applicant search flow", async () => {
  const response = await agent.get("/api/jobs").query({ department: "Engineering" });
  assert.equal(response.status, 200);
  assert.equal(response.body.jobs.length, 2);
  assert.equal(response.body.jobs[0].department, "Engineering");
});

test("applicant can upload a resume and submit one focused application", async () => {
  const uploadResponse = await agent
    .post("/api/resumes")
    .attach("resume", Buffer.from("%PDF-1.4 demo resume"), {
      filename: "Sarah_Mitchell_CV.pdf",
      contentType: "application/pdf",
    });
  assert.equal(uploadResponse.status, 201);
  uploadedFileName = uploadResponse.body.resume.storedName;

  const application = {
    jobId: 1,
    resumeId: uploadResponse.body.resume.id,
    phone: "+65 8123 4567",
    location: "Singapore",
    coverLetter: "I am applying for this focused software engineering position.",
    experiences: [{
      companyName: "Example Technology",
      jobTitle: "Software Engineer",
      startDate: "2023-01",
      endDate: "",
      currentRole: true,
      responsibilities: "Built and maintained responsive web applications for business users.",
      achievements: "Improved release quality through code review and automated testing.",
      skills: "React, JavaScript, Node.js, MySQL",
    }],
    roleAnswers: {
      availability: "Four weeks after accepting an offer.",
      technical_project: "I led a recruitment portal prototype and connected the interface to REST APIs.",
      work_authorisation: "Yes",
    },
  };

  const response = await agent.post("/api/applications").send(application);
  assert.equal(response.status, 201);
  assert.equal(response.body.application.status, "Submitted");
  assert.equal(response.body.application.job.title, "Senior Software Engineer");

  const secondResponse = await agent.post("/api/applications").send({ ...application, jobId: 2 });
  assert.equal(secondResponse.status, 409);
});

test("current application status is available to the signed-in applicant", async () => {
  const response = await agent.get("/api/applications/me");
  assert.equal(response.status, 200);
  assert.equal(response.body.application.status, "Submitted");
  assert.equal(response.body.application.resume.originalName, "Sarah_Mitchell_CV.pdf");
});
