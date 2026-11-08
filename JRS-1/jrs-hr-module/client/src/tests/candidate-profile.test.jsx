import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { CandidateProfile } from "../../pages/applications/Profile";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

function workspace(overrides = {}) {
  return {
    revision: 9,
    currentUser: { name: "Casey Wong", role: "HR_STAFF" },
    jobs: [
      { id: "job-a", title: "Software Developer", status: "Active" },
      { id: "job-b", title: "Data Analyst", status: "Active" },
    ],
    candidates: [{ id: "candidate-4", name: "Alex Tan", email: "alex@example.test", phone: "+65 8000 0000", location: "Singapore", experience: 3, skills: ["React", "SQL"], notes: "" }],
    applications: [
      { id: "app-1", candidateId: "candidate-4", jobId: "job-a", stage: "Interview", priority: "Normal", appliedDate: "2026-11-01" },
      { id: "app-2", candidateId: "candidate-4", jobId: "job-b", stage: "Pending Review", priority: "Normal", appliedDate: "2026-11-03" },
    ],
    interviews: [],
    notifications: [],
    templates: [],
    tasks: [{ id: "task-1", applicationId: "app-1", title: "Prepare questions", assignee: "Casey Wong", due: "2099-11-10", notes: "", status: "Open" }],
    activity: [{ id: "event-1", applicationId: "app-1", summary: "Alex Tan moved to Interview", actor: "Casey Wong", at: "2026-11-02T02:00:00Z", notes: "" }],
    ...overrides,
  };
}

function fetcherFor(db, commands = {}) {
  return vi.fn((url, options = {}) => {
    if (url === "/recruitment/api/auth/me") return json({ user: { id: "hr" }, csrfToken: "csrf-3" });
    if (url === "/recruitment/api/hr/workspace") return json(db);
    const match = /^\/recruitment\/api\/hr\/commands\/(.+)$/.exec(url);
    if (match && options.method === "POST") {
      commands[decodeURIComponent(match[1])]?.(JSON.parse(options.body));
      return json({ db, result: {} });
    }
    return json({ error: { message: "Unexpected " + url } }, 404);
  });
}

function Location() {
  const location = useLocation();
  return <output aria-label="Current location">{location.pathname + location.search}</output>;
}

function mount(fetcher, entry = "/candidates?candidate=candidate-4") {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Location />
      <Routes>
        <Route path="/candidates" element={<Profiled fetcher={fetcher} />} />
      </Routes>
    </MemoryRouter>,
  );
  return userEvent.setup();
}

function Profiled({ fetcher }) {
  const params = new URLSearchParams(useLocation().search);
  return <CandidateProfile candidateId="candidate-4" applicationId={params.get("application") || undefined} applicationLink={(id) => "/candidates?candidate=candidate-4&application=" + id} fetcher={fetcher} />;
}

it("shows the candidate details for the first application and switches between applications", async () => {
  const ui = mount(fetcherFor(workspace()));
  expect(await screen.findByRole("heading", { name: "Alex Tan", level: 2 })).toBeVisible();
  expect(screen.getByText("Software Developer Applicant")).toBeVisible();
  expect(screen.getByText("app-1")).toBeVisible();
  expect(screen.getByRole("link", { name: "Assess application" })).toHaveAttribute("href", "/applications?view=review/app-1");
  const tabs = screen.getByRole("navigation", { name: "Candidate applications" });
  expect(within(tabs).getByRole("link", { name: "Software Developer · Interview" })).toHaveClass("active");
  await ui.click(within(tabs).getByRole("link", { name: "Data Analyst · Pending Review" }));
  expect(await screen.findByText("Data Analyst Applicant")).toBeVisible();
  expect(screen.getByLabelText("Current location")).toHaveTextContent("application=app-2");
});

it("keeps tasks and history in their own section and completes tasks", async () => {
  const completed = vi.fn();
  const ui = mount(fetcherFor(workspace(), { "complete-task": completed }));
  await screen.findByRole("heading", { name: "Alex Tan", level: 2 });
  expect(screen.getByText("Prepare questions")).not.toBeVisible();
  await ui.click(screen.getByRole("button", { name: "Tasks & history" }));
  expect(screen.getByText("Prepare questions")).toBeVisible();
  expect(screen.getByText("Alex Tan moved to Interview")).toBeVisible();
  expect(screen.getByLabelText("Current location")).toHaveTextContent("section=history");
  await ui.click(screen.getByRole("button", { name: "Complete" }));
  await waitFor(() => expect(completed).toHaveBeenCalledWith({ id: "task-1" }));
  expect(await screen.findByText("Task completed.")).toBeVisible();
});

it("creates a follow-up task and saves the private note and contact details", async () => {
  const task = vi.fn(), note = vi.fn(), save = vi.fn();
  const ui = mount(fetcherFor(workspace(), { task, "candidate-notes": note, "candidate-save": save }), "/candidates?candidate=candidate-4&section=history");
  await ui.click(await screen.findByRole("button", { name: "Create Task" }));
  let dialog = screen.getByRole("dialog", { name: "Create Follow-up Task" });
  await ui.type(within(dialog).getByRole("textbox", { name: "Task title" }), "Call referee");
  await ui.click(within(dialog).getByRole("button", { name: "Create Task" }));
  await waitFor(() => expect(task).toHaveBeenCalledWith(expect.objectContaining({ applicationId: "app-1", title: "Call referee", assignee: "Casey Wong" })));

  await ui.click(screen.getByRole("button", { name: "Candidate details" }));
  await ui.click(screen.getByRole("button", { name: "Edit note" }));
  dialog = screen.getByRole("dialog", { name: "Private Candidate Note" });
  await ui.type(within(dialog).getByRole("textbox", { name: "Note" }), "Strong referee");
  await ui.click(within(dialog).getByRole("button", { name: "Save Note" }));
  await waitFor(() => expect(note).toHaveBeenCalledWith({ applicationId: "app-1", notes: "Strong referee" }));

  await ui.click(screen.getByRole("button", { name: "Edit Contact Details" }));
  dialog = screen.getByRole("dialog", { name: "Edit Contact Details" });
  await ui.clear(within(dialog).getByRole("textbox", { name: "Phone" }));
  await ui.type(within(dialog).getByRole("textbox", { name: "Phone" }), "+65 9000 0000");
  await ui.click(within(dialog).getByRole("button", { name: "Save Changes" }));
  await waitFor(() => expect(save).toHaveBeenCalledWith({ id: "candidate-4", name: "Alex Tan", email: "alex@example.test", phone: "+65 9000 0000", location: "Singapore", experience: "3", skills: "React, SQL" }));
});

it("reports an unknown candidate", async () => {
  mount(fetcherFor(workspace({ candidates: [] })));
  expect(await screen.findByRole("heading", { name: "Candidate not found" })).toBeVisible();
});
