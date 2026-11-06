import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { Applications, attention, stageForView, stagePath } from "../../pages/applications/Applications";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

function workspace(overrides = {}) {
  return {
    revision: 3,
    currentUser: { name: "Casey Wong", role: "HR_MANAGER" },
    jobs: [
      { id: "job-a", title: "Software Developer", status: "Active" },
      { id: "job-b", title: "Data Analyst", status: "Closed" },
    ],
    candidates: [
      { id: "candidate-1", name: "Alex Tan", email: "alex@example.test" },
      { id: "candidate-2", name: "Sarah Lim", email: "sarah@example.test" },
      { id: "candidate-3", name: "Daniel Wong", email: "daniel@example.test" },
    ],
    applications: [
      { id: "app-1", candidateId: "candidate-1", jobId: "job-a", stage: "Pending Review", priority: "High", appliedDate: "2026-11-01" },
      { id: "app-2", candidateId: "candidate-2", jobId: "job-a", stage: "Interview", priority: "Normal", appliedDate: "2026-10-20" },
      { id: "app-3", candidateId: "candidate-3", jobId: "job-b", stage: "Offer", priority: "Normal", appliedDate: "2026-10-02",
        offer: { salary: 5200, startDate: "2099-12-01", expiry: "2099-11-20", terms: "Full-time position.", approval: "Pending", status: "Pending" } },
    ],
    interviews: [],
    notifications: [],
    templates: [],
    tasks: [],
    ...overrides,
  };
}

function fetcherFor(db, commands = {}) {
  return vi.fn((url, options = {}) => {
    if (url === "/recruitment/api/auth/me") return json({ user: { id: "hr" }, csrfToken: "csrf-1" });
    if (url === "/recruitment/api/hr/workspace") return json(db);
    const match = /^\/recruitment\/api\/hr\/commands\/(.+)$/.exec(url);
    if (match && options.method === "POST") {
      const name = decodeURIComponent(match[1]);
      const result = commands[name]?.(JSON.parse(options.body)) || {};
      return json({ db: { ...db, revision: db.revision + 1 }, result });
    }
    return json({ error: { message: "Unexpected " + url } }, 404);
  });
}

function Location() {
  const location = useLocation();
  return <output aria-label="Current location">{location.pathname + location.search}</output>;
}

function mount(fetcher, entry = "/applications", stage = "") {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Location />
      <Routes>
        <Route path="/applications" element={<Applications fetcher={fetcher} stage={stage} />} />
      </Routes>
    </MemoryRouter>,
  );
  return userEvent.setup();
}

it("maps queue views to stages and leaves detail views to the embedded workspace", () => {
  expect(stageForView(null)).toBe("");
  expect(stageForView("applications")).toBe("");
  expect(stageForView("applications/pending-review")).toBe("Pending Review");
  expect(stageForView("applications/applications-review")).toBe("Pending Review");
  expect(stageForView("applications/interview-results")).toBe("Interview Results");
  expect(stageForView("applications/unknown")).toBeUndefined();
  expect(stageForView("review/app-1")).toBeUndefined();
  expect(stageForView("candidate/candidate-1/app-1")).toBeUndefined();
  expect(stagePath("Interview Results")).toBe("applications/interview-results");
});

it("describes what each application needs, as the embedded queue does", () => {
  const db = workspace();
  expect(attention(db, db.applications[0], "2026-11-06")).toEqual(["Resume waiting 5 days", "High priority"]);
  expect(attention(db, db.applications[1], "2026-11-06")).toEqual(["Schedule required", "Awaiting interview"]);
  expect(attention(db, db.applications[2], "2026-11-06")).toEqual(["Offer expires 20 11 2099", "Approval required"]);
});

it("renders the legacy queue markup with stage badges, row actions and detail links", async () => {
  mount(fetcherFor(workspace()));
  const table = await screen.findByRole("table", { name: "Applications" });
  expect(table.closest(".hr-legacy")).not.toBeNull();
  const rows = within(table).getAllByRole("row");
  expect(rows).toHaveLength(4);
  expect(within(rows[1]).getByText("Pending Review")).toHaveClass("badge", "amber");
  expect(within(rows[1]).getByRole("button", { name: "Move to Interview" })).toBeEnabled();
  expect(within(rows[1]).getByRole("link", { name: "View resume for Alex Tan" })).toHaveAttribute("href", "/applications?view=review/app-1");
  expect(within(rows[1]).getByRole("link", { name: "Details" })).toHaveAttribute("href", "/applications?view=candidate/candidate-1/app-1");
  expect(within(rows[2]).getByRole("button", { name: "Schedule Interview" })).toBeEnabled();
  expect(within(rows[3]).getByRole("button", { name: "Review Offer" })).toBeVisible();
  expect(screen.getByText("Showing 1–3 of 3 applications")).toBeVisible();
});

it("hides the status column on a stage queue and opens stage queues from the status filter", async () => {
  const ui = mount(fetcherFor(workspace()), "/applications?q=a", "Interview");
  const table = await screen.findByRole("table", { name: "Applications" });
  expect(within(table).queryByRole("columnheader", { name: "STATUS" })).not.toBeInTheDocument();
  expect(within(table).getAllByRole("row")).toHaveLength(2);
  await ui.selectOptions(screen.getByRole("combobox", { name: "Filter application status" }), "Offer");
  expect(screen.getByLabelText("Current location")).toHaveTextContent("/applications?q=a&view=applications%2Foffer");
});

it("filters by search text and position, and clears every filter", async () => {
  const ui = mount(fetcherFor(workspace()));
  await screen.findByRole("table", { name: "Applications" });
  await ui.type(screen.getByRole("searchbox", { name: "Search applications" }), "sarah");
  expect(screen.getAllByRole("row")).toHaveLength(2);
  await ui.clear(screen.getByRole("searchbox", { name: "Search applications" }));
  await ui.selectOptions(screen.getByRole("combobox", { name: "Filter by position" }), "job-b");
  expect(screen.getAllByRole("row")).toHaveLength(2);
  await ui.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(screen.getAllByRole("row")).toHaveLength(4);
});

it("rejects an application with an Other reason and prepares the notification", async () => {
  const reject = vi.fn(() => ({}));
  const ui = mount(fetcherFor(workspace(), { reject }));
  const table = await screen.findByRole("table", { name: "Applications" });
  await ui.click(within(within(table).getAllByRole("row")[1]).getByRole("button", { name: "Reject" }));
  const dialog = screen.getByRole("dialog", { name: "Reject Application" });
  await ui.selectOptions(within(dialog).getByRole("combobox", { name: /Rejection Reason/ }), "Other");
  await ui.click(within(dialog).getByRole("button", { name: "Confirm Rejection" }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("Specify the rejection reason.");
  await ui.type(within(dialog).getByRole("textbox", { name: "Specify reason" }), "Role paused");
  await ui.click(within(dialog).getByRole("button", { name: "Confirm Rejection" }));
  await waitFor(() => expect(reject).toHaveBeenCalledWith({ applicationId: "app-1", reason: "Other: Role paused", notes: "", notify: true }));
  expect(await screen.findByText("Application rejected.")).toBeVisible();
});

it("blocks scheduling for closed jobs and approves offers after confirmation", async () => {
  const approve = vi.fn(() => ({}));
  const ui = mount(fetcherFor(workspace({ applications: [
    { id: "app-4", candidateId: "candidate-1", jobId: "job-b", stage: "Interview", priority: "Normal", appliedDate: "2026-11-01" },
    workspace().applications[2],
  ] }), { "approve-offer": approve }));
  const table = await screen.findByRole("table", { name: "Applications" });
  const rows = within(table).getAllByRole("row");
  expect(within(rows[1]).getByRole("button", { name: "Schedule Interview" })).toBeDisabled();
  await ui.click(within(rows[2]).getByRole("button", { name: "Review Offer" }));
  const dialog = screen.getByRole("dialog", { name: "Review Offer" });
  expect(within(dialog).getByText("SGD 5,200")).toBeVisible();
  await ui.click(within(dialog).getByRole("button", { name: "Approve Offer" }));
  expect(approve).not.toHaveBeenCalled();
  await ui.click(within(dialog).getByRole("button", { name: "Confirm approval" }));
  await waitFor(() => expect(approve).toHaveBeenCalledWith({ applicationId: "app-3" }));
});

it("receives an application for a new candidate and opens its resume review", async () => {
  const create = vi.fn(() => ({ application: { id: "APP-9" } }));
  const ui = mount(fetcherFor(workspace(), { "application-create": create }));
  await screen.findByRole("table", { name: "Applications" });
  await ui.click(screen.getByRole("button", { name: "Receive Application" }));
  const dialog = screen.getByRole("dialog", { name: "Receive Application" });
  await ui.type(within(dialog).getByRole("textbox", { name: "Full name" }), "Morgan Lee");
  await ui.type(within(dialog).getByRole("textbox", { name: "Email" }), "morgan@example.test");
  await ui.type(within(dialog).getByRole("textbox", { name: "Phone" }), "+65 8000 0000");
  await ui.type(within(dialog).getByRole("textbox", { name: "Skills (comma separated)" }), "SQL, Python");
  await ui.click(within(dialog).getByRole("button", { name: "Create Application" }));
  await waitFor(() => expect(create).toHaveBeenCalledWith({
    jobId: "job-a",
    priority: "Normal",
    candidate: { name: "Morgan Lee", email: "morgan@example.test", phone: "+65 8000 0000", location: "Singapore", experience: "0", skills: "SQL, Python" },
  }));
  expect(screen.getByLabelText("Current location")).toHaveTextContent("/applications?view=review/APP-9");
});

it("exports the matching applications as CSV", async () => {
  const created = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:applications");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const ui = mount(fetcherFor(workspace()));
  await screen.findByRole("table", { name: "Applications" });
  await ui.click(screen.getByRole("button", { name: "Export" }));
  const text = await created.mock.calls[0][0].text();
  expect(text.split("\r\n")).toHaveLength(4);
  expect(text).toContain('"app-2","Sarah Lim","sarah@example.test","Software Developer","Interview","Normal","2026-10-20"');
  expect(screen.getByText("Exported 3 matching applications.")).toBeVisible();
});
