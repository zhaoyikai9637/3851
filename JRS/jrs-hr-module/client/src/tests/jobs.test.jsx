import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { App } from "../App";
import { user } from "./fixtures";

const endpoint = "/recruitment/api/hr/job-postings";
const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
let data, failure, fetcher;
beforeEach(() => {
  const criteria = Array.from({ length: 8 }, (_, i) => `Required professional skill ${i + 1}`);
  data = {
    revision: 4,
    templates: [{ title: "Software Developer", requirements: criteria }],
    items: [
      {
        id: "job-a",
        title: "Software Developer",
        department: "Engineering",
        type: "Full-time",
        mode: "Hybrid",
        location: "Singapore",
        experience: "2+ years",
        description: "Build reliable software for our recruitment platform.",
        requirements: criteria,
        skills: ["JavaScript", "SQL"],
        status: "Active",
        applications: 12,
        salaryRange: "SGD 5,000 - 6,000",
        closingDate: "2030-12-31",
        publishDate: null,
        unpublishDate: null,
      },
    ],
  };
  failure = null;
  fetcher = vi.fn(async (url, options = {}) => {
    if (url === "/api/auth/config") return json({ loginUrl: null });
    if (url === "/api/auth/me") return json({ user, csrfToken: "hr-token", mode: "team" });
    if (url === "/recruitment/api/auth/me")
      return json({ user: { id: "hr-a", role: "HR_MANAGER" }, csrfToken: "shared-token" });
    if (url === endpoint && (!options.method || options.method === "GET"))
      return json(structuredClone(data));
    if (url === endpoint && options.method === "POST") {
      if (failure) return json({ error: { message: failure } }, 409);
      const body = JSON.parse(options.body),
        previous = data.items.find((row) => row.id === body.id);
      const item = {
        ...previous,
        ...body,
        id: body.id || "job-new",
        applications: previous?.applications || 0,
        skills: body.skills.split(","),
        requirements: body.requirements.split("\n"),
      };
      if (previous) Object.assign(previous, item);
      else data.items.push(item);
      data.revision++;
      return json(structuredClone(data));
    }
    if (url === endpoint + "/job-a/status") {
      data.items[0].status = JSON.parse(options.body).status;
      data.revision++;
      return json(structuredClone(data));
    }
    return json({ error: { message: "Unexpected endpoint: " + url } }, 404);
  });
  vi.stubGlobal("fetch", fetcher);
});
function mount() {
  render(
    <MemoryRouter initialEntries={["/job-postings"]}>
      <App />
    </MemoryRouter>,
  );
  return userEvent.setup();
}

it("explains closed intake separately from stopped processing and saves the stopped status", async () => {
  const ui=mount();
  await edit(ui);
  const status=screen.getByLabelText('Recruitment status');
  await ui.selectOptions(status,'Closed');
  expect(screen.getByText('Closed: new applications are stopped; existing applications can continue.')).toBeVisible();
  await ui.selectOptions(status,'Stopped');
  expect(screen.getByText('Stopped: new applications and application progression are stopped.')).toBeVisible();
  await ui.click(screen.getByRole('button',{name:'Save job',exact:true}));
  expect(await screen.findByText('Stopped',{selector:'.job-status'})).toBeVisible();
});
async function edit(ui) {
  await ui.click(await screen.findByRole("button", { name: "View Software Developer" }));
  await ui.click(screen.getByRole("button", { name: "Edit job" }));
}

it("presents a table-first jobs workspace without the standalone publishing form or artificial root breadcrumb", async () => {
  mount();
  const table = await screen.findByRole("table", { name: "Job postings" });
  for (const name of ["Position", "Status", "Applications", "Salary range", "Application deadline"])
    expect(within(table).getByRole("columnheader", { name })).toBeVisible();
  expect(within(table).getByText("31/12/2030")).toBeVisible();
  expect(screen.queryByText("Publishing settings")).not.toBeInTheDocument();
  expect(screen.queryByTitle("Job Postings")).not.toBeInTheDocument();
  expect(screen.getAllByRole("heading", { name: "Job Postings", level: 1 })).toHaveLength(1);
  expect(
    within(screen.getByRole("main")).queryByRole("heading", { name: "Job Postings" }),
  ).not.toBeInTheDocument();
  const toolbar = screen.getByRole("toolbar", { name: "Job filters and actions" });
  expect(within(toolbar).getByRole("button", { name: "Create job" })).toBeVisible();
  expect(within(toolbar).getByRole("combobox", { name: "Filter by department" })).toBeVisible();
  expect(
    within(toolbar).getByRole("combobox", { name: "Filter by recruitment status" }),
  ).toBeVisible();
  expect(screen.queryByText(/drafts$/)).not.toBeInTheDocument();
  expect(
    within(screen.getByRole("navigation", { name: "Current location" })).queryByText(
      "HR Workspace",
    ),
  ).not.toBeInTheDocument();
});

it("edits basic and publishing fields together and sends ISO dates with the existing revision and identity", async () => {
  const ui = mount();
  await edit(ui);
  await ui.clear(screen.getByLabelText("Job title"));
  await ui.type(screen.getByLabelText("Job title"), "Senior Developer");
  await ui.click(screen.getByRole("tab", { name: "Publishing" }));
  expect(screen.getByLabelText("Application deadline")).toHaveValue("31/12/2030");
  expect(document.querySelector('input[type="date"]')).toBeNull();
  await ui.clear(screen.getByLabelText("Application deadline"));
  await ui.type(screen.getByLabelText("Application deadline"), "30/11/2030");
  await ui.click(screen.getByRole("button", { name: "Save job" }));
  expect(await screen.findByRole("button", { name: "View Senior Developer" })).toBeVisible();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  const [, options] = fetcher.mock.calls.find(
    ([url, options]) => url === endpoint && options.method === "POST",
  );
  expect(JSON.parse(options.body)).toMatchObject({
    id: "job-a",
    title: "Senior Developer",
    closingDate: "2030-11-30",
    salaryRange: "SGD 5,000 - 6,000",
  });
  expect(options.headers).toMatchObject({ "If-Match": "4", "X-CSRF-Token": "shared-token" });
});

it("keeps unsaved edits until the user explicitly discards them", async () => {
  const ui = mount();
  await edit(ui);
  await ui.type(screen.getByLabelText("Job title"), " revised");
  await ui.click(screen.getByRole("button", { name: "Close job drawer" }));
  expect(screen.getByRole("alertdialog", { name: "Discard unsaved changes?" })).toBeVisible();
  await ui.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(screen.getByLabelText("Job title")).toHaveValue("Software Developer revised");
  await ui.click(screen.getByRole("button", { name: "Cancel editing" }));
  await ui.click(screen.getByRole("button", { name: "Discard changes" }));
  expect(screen.queryByRole("dialog", { name: "Edit job" })).not.toBeInTheDocument();
});

function backdropGesture(dialog, startX = 100, endX = startX) {
  vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
    left: 400,
    right: 900,
    top: 0,
    bottom: 800,
  });
  fireEvent(
    dialog,
    new MouseEvent("pointerdown", { bubbles: true, clientX: startX, clientY: 100 }),
  );
  fireEvent.click(dialog, { clientX: endX, clientY: 100 });
}

it("returns to the same job list when the drawer backdrop is clicked", async () => {
  const ui = mount();
  await ui.click(await screen.findByRole("button", { name: "View Software Developer" }));
  backdropGesture(screen.getByRole("dialog"));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("table", { name: "Job postings" })).toBeVisible();
});

it("does not close for internal blank space or dragging from the drawer to its backdrop", async () => {
  const ui = mount();
  await ui.click(await screen.findByRole("button", { name: "View Software Developer" }));
  const dialog = screen.getByRole("dialog");
  backdropGesture(dialog, 500);
  expect(dialog).toBeVisible();
  backdropGesture(dialog, 500, 100);
  expect(dialog).toBeVisible();
});

it("protects unsaved edits when closing through the backdrop", async () => {
  const ui = mount();
  await edit(ui);
  await ui.type(screen.getByLabelText("Job title"), " revised");
  backdropGesture(screen.getByRole("dialog"));
  expect(screen.getByRole("alertdialog", { name: "Discard unsaved changes?" })).toBeVisible();
  await ui.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(screen.getByLabelText("Job title")).toHaveValue("Software Developer revised");
  backdropGesture(screen.getByRole("dialog"));
  await ui.click(screen.getByRole("button", { name: "Discard changes" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("rejects impossible day-first dates without sending a save request", async () => {
  const ui = mount();
  await edit(ui);
  await ui.click(screen.getByRole("tab", { name: "Publishing" }));
  await ui.clear(screen.getByLabelText("Application deadline"));
  await ui.type(screen.getByLabelText("Application deadline"), "31/02/2030");
  await ui.click(screen.getByRole("button", { name: "Save job" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("valid date");
  expect(
    fetcher.mock.calls.filter(([url, options]) => url === endpoint && options.method === "POST"),
  ).toHaveLength(0);
});

it("uses an English calendar and writes the chosen date in day/month/year order", async () => {
  const ui = mount();
  await edit(ui);
  await ui.click(screen.getByRole("tab", { name: "Publishing" }));
  await ui.click(screen.getByRole("button", { name: "Open Application deadline calendar" }));
  expect(screen.getByText("December 2030")).toBeVisible();
  await ui.click(screen.getByRole("button", { name: "Next month" }));
  await ui.click(screen.getByRole("button", { name: "15 January 2031" }));
  expect(screen.getByLabelText("Application deadline")).toHaveValue("15/01/2031");
});

it("preserves edits and displays server conflicts instead of claiming a successful save", async () => {
  const ui = mount();
  await edit(ui);
  failure =
    "Another user changed this workspace. Refresh and review the latest data before saving.";
  await ui.type(screen.getByLabelText("Job title"), " revised");
  await ui.click(screen.getByRole("button", { name: "Save job" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Another user changed");
  expect(screen.getByLabelText("Job title")).toHaveValue("Software Developer revised");
  expect(screen.queryByText("Job saved.")).not.toBeInTheDocument();
});

it("creates a job from the same drawer with requirement templates and publishing fields", async () => {
  const ui = mount();
  await screen.findByRole("table", { name: "Job postings" });
  await ui.click(screen.getByRole("button", { name: "Create job" }));
  for (const [label, value] of [
    ["Job title", "New Developer"],
    ["Department", "Engineering"],
    ["Location", "Singapore"],
    ["Experience", "2+ years"],
    ["Required skills", "JavaScript, SQL"],
  ])
    await ui.type(screen.getByLabelText(label), value);
  await ui.click(screen.getByRole("tab", { name: "Requirements" }));
  await ui.type(screen.getByLabelText("Job description"), "Develop reliable applications.");
  await ui.selectOptions(screen.getByLabelText("Requirement template"), "Software Developer");
  await ui.click(screen.getByRole("button", { name: "Use template" }));
  await ui.click(screen.getByRole("button", { name: "Save job" }));
  expect(await screen.findByRole("button", { name: "View New Developer" })).toBeVisible();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(data.items.find((row) => row.id === "job-new")).toMatchObject({
    title: "New Developer",
    status: "Draft",
  });
});

it("requires confirmation to close a job and retains the existing status-change command semantics", async () => {
  const ui = mount();
  await ui.click(await screen.findByRole("button", { name: "View Software Developer" }));
  await ui.click(screen.getByRole("button", { name: "Close recruitment" }));
  const confirmation = screen.getByRole("alertdialog", { name: "Close recruitment?" });
  await ui.click(within(confirmation).getByRole("button", { name: "Confirm close" }));
  expect(await screen.findByText("Closed", { selector: ".job-status" })).toBeVisible();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(data.items[0].status).toBe("Closed");
  await ui.click(screen.getByRole("button", { name: "View Software Developer" }));
  await ui.click(screen.getByRole("button", { name: "Reopen recruitment" }));
  await ui.click(screen.getByRole("button", { name: "Confirm reopen" }));
  expect(await screen.findByText("Active", { selector: ".job-status" })).toBeVisible();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

it("opens applications filtered to the selected job", async () => {
  const ui = mount();
  await ui.click(
    await screen.findByRole("button", { name: "View 12 applications for Software Developer" }),
  );
  expect(await screen.findByTitle("Applications")).toHaveAttribute(
    "src",
    "/recruitment/?job=job-a#/applications",
  );
});

it("blocks an unpublish date that ends before the deadline day has finished", async () => {
  const ui = mount();
  await edit(ui);
  await ui.click(screen.getByRole("tab", { name: "Publishing" }));
  await ui.type(screen.getByLabelText("Unpublish date"), "31/12/2030");
  await ui.click(screen.getByRole("button", { name: "Save job" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("after the application deadline");
  expect(screen.getByLabelText("Unpublish date")).toHaveValue("31/12/2030");
});

it("keeps 100 jobs usable across paging, filtering and returning from edits", async () => {
  const base = structuredClone(data.items[0]);
  data.items = Array.from({ length: 100 }, (_, i) => ({
    ...base,
    id: `job-${i}`,
    title: `Role ${String(i + 1).padStart(3, "0")} with a long specialist position title`,
    department: i % 2 ? "Operations" : "Engineering",
    status: i % 2 ? "Draft" : "Active",
    applications: i,
    salaryRange: i % 3 ? "" : "SGD 5,000 - 6,000",
  }));
  const ui = mount();
  const table = await screen.findByRole("table", { name: "Job postings" });
  expect(within(table).getAllByRole("row")).toHaveLength(11);
  expect(screen.getByText("1–10 of 100 jobs")).toBeVisible();
  await ui.click(screen.getByRole("button", { name: "Next", exact: true }));
  await ui.click(
    screen.getByRole("button", { name: "View Role 011 with a long specialist position title" }),
  );
  await ui.click(screen.getByRole("button", { name: "Edit job" }));
  await ui.type(screen.getByLabelText("Job title"), " revised");
  await ui.click(screen.getByRole("button", { name: "Save job" }));
  expect(
    await screen.findByRole("button", {
      name: "View Role 011 with a long specialist position title revised",
    }),
  ).toBeVisible();
  expect(screen.getByText("11–20 of 100 jobs")).toBeVisible();
  await ui.selectOptions(
    screen.getByRole("combobox", { name: "Filter by recruitment status" }),
    "Draft",
  );
  expect(screen.getByText("1–10 of 50 jobs")).toBeVisible();
  await ui.type(screen.getByRole("searchbox", { name: "Search jobs" }), "Role 100");
  expect(screen.getByText("1–1 of 1 jobs")).toBeVisible();
  await ui.clear(screen.getByRole("searchbox", { name: "Search jobs" }));
  expect(screen.getByText("1–10 of 50 jobs")).toBeVisible();
});

it("combines department, status and search and clears all filters from an empty result", async () => {
  const base = structuredClone(data.items[0]);
  data.items = [
    base,
    {
      ...base,
      id: "job-b",
      title: "Operations Analyst",
      department: "Operations",
      status: "Draft",
    },
    { ...base, id: "job-c", title: "Operations Lead", department: "Operations", status: "Active" },
  ];
  const ui = mount();
  await screen.findByRole("table", { name: "Job postings" });
  await ui.selectOptions(
    screen.getByRole("combobox", { name: "Filter by department" }),
    "Operations",
  );
  expect(screen.getByText("1–2 of 2 jobs")).toBeVisible();
  await ui.selectOptions(
    screen.getByRole("combobox", { name: "Filter by recruitment status" }),
    "Draft",
  );
  expect(screen.getByRole("button", { name: "View Operations Analyst" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "View Operations Lead" })).not.toBeInTheDocument();
  await ui.type(screen.getByRole("searchbox", { name: "Search jobs" }), "missing");
  await ui.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(screen.getByRole("combobox", { name: "Filter by department" })).toHaveValue("");
  expect(screen.getByRole("combobox", { name: "Filter by recruitment status" })).toHaveValue("All");
  expect(screen.getByText("1–3 of 3 jobs")).toBeVisible();
});
