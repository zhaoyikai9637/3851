import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Review } from "../../pages/applications/Review";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
const REQUIREMENTS = Array.from({ length: 8 }, (_, index) => "Requirement " + (index + 1));

function workspace(overrides = {}) {
  return {
    revision: 5,
    mailEnabled: false,
    currentUser: { name: "Casey Wong", role: "HR_STAFF" },
    jobs: [{ id: "job-a", title: "Software Developer", status: "Active", description: "Build product features.", requirements: REQUIREMENTS, department: "Engineering", type: "Full-time", mode: "Hybrid", location: "Singapore" }],
    candidates: [{ id: "candidate-7", name: "Alex Tan", email: "alex@example.test", phone: "+65 8000 0000", location: "Singapore", experience: 3, skills: ["React", "SQL"] }],
    applications: [{ id: "app-1", candidateId: "candidate-7", jobId: "job-a", stage: "Pending Review", priority: "Normal", appliedDate: "2026-11-01" }],
    interviews: [],
    notifications: [],
    templates: [],
    tasks: [],
    ...overrides,
  };
}

function fetcherFor(db, handlers = {}) {
  return vi.fn((url, options = {}) => {
    if (url === "/recruitment/api/auth/me") return json({ user: { id: "hr" }, csrfToken: "csrf-2" });
    if (url === "/recruitment/api/hr/workspace") return json(db);
    for (const [path, handler] of Object.entries(handlers)) if (url === path) return json(handler(options));
    return json({ error: { message: "Unexpected " + url } }, 404);
  });
}

function mount(fetcher, props = {}, entry = "/applications?view=review/app-1") {
  render(<MemoryRouter initialEntries={[entry]}><Review id="app-1" fetcher={fetcher} {...props} /></MemoryRouter>);
  return userEvent.setup();
}

it("shows the applicant, the sample resume, the job requirements and the review decisions", async () => {
  mount(fetcherFor(workspace()));
  expect(await screen.findByRole("heading", { name: "Alex Tan", level: 2 })).toBeVisible();
  expect(screen.getByText("Software Developer · app-1")).toBeVisible();
  const viewer = screen.getByRole("region", { name: "Applicant resume" });
  expect(within(viewer).getByText("Alex_Tan_Resume.pdf")).toBeVisible();
  expect(viewer.querySelectorAll(".resume-paper")).toHaveLength(2);
  expect(within(viewer).getByRole("button", { name: "Download" })).toBeEnabled();
  expect(screen.getAllByRole("listitem").filter((item) => item.closest(".job-requirements-list"))).toHaveLength(8);
  expect(screen.queryByText(/This position needs 8–12 requirements/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Move to Interview" })).toBeEnabled();
  expect(screen.getByText("Email sending is off. Drafts are saved for later.")).toBeVisible();
  expect(screen.getByText("No emails for this application.")).toBeVisible();
});

it("flags incomplete requirements and blocks progress on inactive jobs", async () => {
  const db = workspace();
  db.jobs[0] = { ...db.jobs[0], status: "Closed", requirements: ["Only one"] };
  mount(fetcherFor(db));
  expect(await screen.findByText(/This position needs 8–12 requirements/)).toBeVisible();
  expect(screen.getByRole("link", { name: "Complete in Job Postings" })).toHaveAttribute("href", "/job-postings");
  expect(screen.getByRole("button", { name: "Move to Interview" })).toBeDisabled();
  expect(screen.getByText("Activate this job before progressing applicants.")).toBeVisible();
});

it("shows interview results with the assessment and allows preparing an offer", async () => {
  const db = workspace({
    applications: [{ id: "app-1", candidateId: "candidate-7", jobId: "job-a", stage: "Interview Results", priority: "Normal", appliedDate: "2026-11-01",
      feedback: { rating: 4, recommendation: "Proceed", notes: "Strong answers.", recordedAt: "2026-11-05T03:00:00Z", assessment: [{ label: "Communication", rating: 5 }] } }],
    interviews: [{ id: "int-1", applicationId: "app-1", date: "2026-11-05", time: "10:00", duration: 45, format: "Video", location: "Meet link", interviewer: "Riley Morgan", notes: "", status: "Completed" }],
  });
  mount(fetcherFor(db), { results: true });
  expect(await screen.findByText("Proceed")).toBeVisible();
  expect(screen.getByText("Communication")).toBeVisible();
  expect(screen.getByText("Strong answers.")).toBeVisible();
  expect(screen.getByText("Riley Morgan · Video · 45 min")).toBeVisible();
  expect(screen.getByRole("button", { name: "Prepare Offer" })).toBeEnabled();
});

it("uploads a PDF resume with the revision and file name", async () => {
  let request;
  const db = workspace();
  const ui = mount(fetcherFor(db, { "/recruitment/api/hr/candidates/candidate-7/resume": (options) => { request = options; return { db: { ...db, revision: 6 } }; } }));
  await ui.click(await screen.findByRole("button", { name: "Upload" }));
  const dialog = screen.getByRole("dialog", { name: "Upload Resume" });
  await ui.click(within(dialog).getByRole("button", { name: "Upload Resume" }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("Choose a PDF resume up to 5 MB.");
  await ui.upload(within(dialog).getByLabelText("Resume file"), new File(["%PDF-1.4"], "alex.pdf", { type: "application/pdf" }));
  await ui.click(within(dialog).getByRole("button", { name: "Upload Resume" }));
  expect(await screen.findByText("Resume uploaded.")).toBeVisible();
  expect(request.method).toBe("PUT");
  expect(request.headers).toMatchObject({ "Content-Type": "application/pdf", "If-Match": "5", "X-CSRF-Token": "csrf-2", "X-Filename": "alex.pdf" });
});

it("edits a saved draft and keeps sending disabled while email is off", async () => {
  const draft = { id: "note-1", applicationId: "app-1", status: "Draft", subject: "Next steps — Software Developer", body: "Hello Alex", to: "alex@example.test", createdAt: "2026-11-05T03:00:00Z" };
  const commands = [];
  const db = workspace({ notifications: [draft] });
  const ui = mount(fetcherFor(db, { "/recruitment/api/hr/commands/message": (options) => { commands.push(JSON.parse(options.body)); return { db, result: {} }; } }));
  await ui.click(await screen.findByRole("button", { name: "Preview & send" }));
  expect(within(screen.getByRole("dialog", { name: "Send Candidate Email" })).getByRole("button", { name: "Send Email" })).toBeDisabled();
  await ui.click(within(screen.getByRole("dialog", { name: "Send Candidate Email" })).getByRole("button", { name: "Cancel" }));
  await ui.click(screen.getByRole("button", { name: "Edit draft" }));
  const dialog = screen.getByRole("dialog", { name: "Candidate Message" });
  expect(within(dialog).getByRole("textbox", { name: "Message" })).toHaveValue("Hello Alex");
  await ui.type(within(dialog).getByRole("textbox", { name: "Message" }), ", see you soon.");
  await ui.click(within(dialog).getByRole("button", { name: "Save Email Draft" }));
  await waitFor(() => expect(commands).toHaveLength(1));
  expect(commands[0]).toMatchObject({ applicationId: "app-1", notificationId: "note-1", body: "Hello Alex, see you soon.", to: "alex@example.test" });
});

it("reports an application that no longer exists", async () => {
  mount(fetcherFor(workspace({ applications: [] })));
  expect(await screen.findByRole("heading", { name: "Application not found" })).toBeVisible();
});

it("returns to the list it was opened from, or to the full queue", async () => {
  mount(fetcherFor(workspace()), {}, { pathname: "/applications", search: "?view=review/app-1", state: { from: "/applications?view=applications%2Fpending-review&page=2" } });
  expect(await screen.findByRole("link", { name: "Back to Applications" })).toHaveAttribute("href", "/applications?view=applications%2Fpending-review&page=2");
  cleanup();
  mount(fetcherFor(workspace()), {}, { pathname: "/applications", search: "?view=review/app-1", state: { from: "/interviews?status=" } });
  expect(await screen.findByRole("link", { name: "Back to Interviews" })).toHaveAttribute("href", "/interviews?status=");
  cleanup();
  mount(fetcherFor(workspace()), {}, { pathname: "/applications", search: "?view=review/app-1", state: { from: "https://evil.test" } });
  expect(await screen.findByRole("link", { name: "Back to Applications" })).toHaveAttribute("href", "/applications");
});

it('keeps protected Word preview and applicant-owned resume readonly',async()=>{
 const db=workspace();Object.assign(db.candidates[0],{canUploadResume:false,canEditProfile:false});db.applications[0].submission={resumeName:'candidate.docx',resumeUrl:'/recruitment/api/hr/applications/app-1/submitted-resume',candidate:{name:'Submitted Alex',email:'submitted@example.test'}};
 mount(fetcherFor(db));
 const viewer=await screen.findByTitle('Submitted Alex submitted Word resume');
 expect(viewer).toHaveAttribute('src','/recruitment/api/hr/applications/app-1/submitted-resume/preview');
 expect(viewer).toHaveAttribute('sandbox','');
 expect(screen.queryByRole('button',{name:'Upload',exact:true})).not.toBeInTheDocument();
 expect(screen.getByRole('navigation',{name:'Application review actions'})).toBeVisible();
 expect(screen.getByRole('button',{name:'Next application'})).toBeDisabled();
});
