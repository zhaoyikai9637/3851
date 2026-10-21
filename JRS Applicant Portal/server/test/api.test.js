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
      skills: ["REACT", "JAVASCRIPT", "NODE_JS", "MYSQL"],
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
  assert.equal(response.body.application.phone, "+6581234567");
  assert.equal(response.body.application.location, '["SG","",""]');
  assert.deepEqual(response.body.application.experiences[0].skills, ["JAVASCRIPT", "MYSQL", "NODE_JS", "REACT"]);

  const nextJob = await agent.get("/api/jobs/2");
  const nextAnswers = Object.fromEntries(nextJob.body.job.roleQuestions.map((question) => [question.id, question.type === "select" ? question.options[0] : "Test answer"]));
  const secondResponse = await agent.post("/api/applications").send({ ...application, jobId: 2, roleAnswers: nextAnswers });
  assert.equal(secondResponse.status, 409);
  const invalidAnswer = await agent.post("/api/applications").send({ ...application, roleAnswers: { ...application.roleAnswers, work_authorisation: "random value" } });
  assert.equal(invalidAnswer.status, 422);
  const invalidSkill = await agent.post("/api/applications").send({
    ...application,
    experiences: [{ ...application.experiences[0], skills: ["react developer"] }],
  });
  assert.equal(invalidSkill.status, 422);
});

test("current application status is available to the signed-in applicant", async () => {
  const response = await agent.get("/api/applications/me");
  assert.equal(response.status, 200);
  assert.equal(response.body.application.status, "Submitted");
  assert.equal(response.body.application.resume.originalName, "Sarah_Mitchell_CV.pdf");
});

test("partial profile updates preserve privacy and education", async () => {
  const education = [{ institution: "Example University", qualification: "Degree", qualificationLevel: "BACHELOR", startYear: 2020, graduationYear: 2024 }];
  assert.equal((await agent.put("/api/profile").send({ availabilityStatus: "CLOSED", education })).status, 200);
  const response = await agent.put("/api/profile").send({ phone: "+65 8123 4567" });
  assert.equal(response.status, 200);
  assert.equal(response.body.profile.availabilityStatus, "CLOSED");
  assert.deepEqual(response.body.profile.education, education);
});

test("education rejects reversed years", async () => {
  const response = await agent.put("/api/profile").send({ education: [{ startYear: 2025, graduationYear: 2020 }] });
  assert.equal(response.status, 422);
});

test("location catalogs load in stages and reject invalid parents", async () => {
  const countries = await request(app).get("/api/options/locations");
  assert.ok(countries.body.options.some((item) => item.code === "SG"));
  const states = await request(app).get("/api/options/locations").query({ country: "US" });
  assert.ok(states.body.options.some((item) => item.code === "CA"));
  const cities = await request(app).get("/api/options/locations").query({ country: "US", state: "CA" });
  assert.ok(cities.body.options.some((item) => item.code === "Los Angeles"));
  assert.equal((await request(app).get("/api/options/locations").query({ country: "SG", state: "CA" })).status, 422);
});

test("profile contact validation rejects malformed data and stores canonical values", async () => {
  assert.equal((await agent.put("/api/profile").send({ phone: "123" })).status, 422);
  assert.equal((await agent.put("/api/profile").send({ location: '["US","CA","Invented"]' })).status, 422);
  const response = await agent.put("/api/profile").send({ phone: "+65 8123 4567", location: '["US","CA","Los Angeles"]' });
  assert.equal(response.status, 200);
  assert.equal(response.body.profile.phone, "+6581234567");
  assert.equal(response.body.profile.location, '["US","CA","Los Angeles"]');
});

test("job filters accept canonical codes and ignore casing and surrounding whitespace", async () => {
  const response = await request(app).get("/api/jobs").query({ employmentType: " full TIME ", experienceLevel: "YEARS_3_5", search: " SOFTWARE ", location: " singapore " });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.jobs.map((job) => job.id), [1]);
  const invalid = await request(app).get("/api/jobs").query({ experienceLevel: "anything" });
  assert.equal(invalid.status, 422);
  const partTime = await request(app).get("/api/jobs").query({ employmentType: "PART_TIME" });
  assert.equal(partTime.status, 200);
  assert.equal(partTime.body.jobs.length, 0);
});

test("employment validation rejects invalid months, reversed dates and string booleans", async () => {
  for (const fields of [
    { startDate: "2023-99" },
    { endDate: "2022-01" },
    { currentRole: "false" },
    { currentRole: true, endDate: "2024-01" },
  ]) {
    const response = await agent.post("/api/applications").send({
      jobId: 1, resumeId: 1, phone: "+6581234567", location: "Singapore", roleAnswers: {},
      experiences: [{ companyName: "Example", jobTitle: "Developer", startDate: "2023-01", endDate: "2024-01", currentRole: false, skills: [], responsibilities: "Developed business applications", ...fields }],
    });
    assert.equal(response.status, 422);
  }
});
