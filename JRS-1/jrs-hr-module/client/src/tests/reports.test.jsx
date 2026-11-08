import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { Reports, reportCsv } from "../../pages/reports/Reports";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

function workspace(overrides = {}) {
  return {
    revision: 4,
    jobs: [
      { id: "job-a", title: "Software Developer", status: "Active" },
      { id: "job-b", title: "=Data Analyst", status: "Closed" },
    ],
    applications: [
      { id: "app-1", jobId: "job-a", stage: "Pending Review" },
      { id: "app-2", jobId: "job-a", stage: "Hired" },
      { id: "app-3", jobId: "job-b", stage: "Offer" },
      { id: "app-4", jobId: "job-b", stage: "Rejected" },
    ],
    interviews: [{ id: "int-1", status: "Scheduled" }, { id: "int-2", status: "Completed" }],
    tasks: [
      { id: "task-1", title: "Call back Alex", assignee: "Junye Shen", due: "2026-11-10", status: "Open" },
      { id: "task-2", title: "Archive file", assignee: "Junye Shen", due: "2026-11-01", status: "Done" },
    ],
    ...overrides,
  };
}

function Location() {
  const location = useLocation();
  return <output aria-label="Current search">{location.search}</output>;
}

function mount(fetcher, entry = "/reports") {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Location />
      <Reports fetcher={fetcher} />
    </MemoryRouter>,
  );
  return userEvent.setup();
}

function standardFetcher(db = workspace()) {
  return vi.fn((url) => {
    if (url === "/recruitment/api/auth/me") return json({ user: { id: "hr" }, csrfToken: "csrf-1" });
    if (url === "/recruitment/api/hr/workspace") return json(db);
    return json({ error: { message: "Unexpected" } }, 404);
  });
}

it("shows the same overview totals as the previous embedded page", async () => {
  mount(standardFetcher());
  expect(await screen.findByRole("button", { name: "Export Report" })).toBeVisible();
  const card = (name) => screen.getByText(name, { selector: "p" }).closest("section");
  expect(within(card("Applications")).getByText("4")).toBeVisible();
  expect(within(card("Active jobs")).getByText("1")).toBeVisible();
  expect(within(card("Scheduled interviews")).getByText("1")).toBeVisible();
  expect(within(card("Hired")).getByText("1")).toBeVisible();
  expect(screen.getByRole("heading", { name: "Applications by stage" })).toBeVisible();
});

it("keeps the selected section in the address so Back and refresh reopen it", async () => {
  const ui = mount(standardFetcher());
  await ui.click(await screen.findByRole("button", { name: "Job performance" }));
  expect(screen.getByLabelText("Current search")).toHaveTextContent("?section=jobs");
  const row = screen.getByRole("cell", { name: "Software Developer" }).closest("tr");
  expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Software Developer", "2", "1", "0", "1"]);
});

it("opens a section directly from the address", async () => {
  mount(standardFetcher(), "/reports?section=tasks");
  expect(await screen.findByText("Call back Alex")).toBeVisible();
  expect(screen.queryByText("Archive file")).not.toBeInTheDocument();
});

it("completes a follow-up task through the workspace command with revision and CSRF headers", async () => {
  const db = workspace();
  const fetcher = standardFetcher(db);
  fetcher.mockImplementation((url, options = {}) => {
    if (url === "/recruitment/api/auth/me") return json({ user: { id: "hr" }, csrfToken: "csrf-1" });
    if (url === "/recruitment/api/hr/workspace") return json(db);
    if (url === "/recruitment/api/hr/commands/complete-task") {
      return json({ db: workspace({ revision: 5, tasks: db.tasks.map((task) => ({ ...task, status: "Done" })) }), result: {} });
    }
    return json({}, 404);
  });
  const ui = mount(fetcher, "/reports?section=tasks");
  await ui.click(await screen.findByRole("button", { name: "Complete" }));
  const call = fetcher.mock.calls.find(([url]) => url === "/recruitment/api/hr/commands/complete-task");
  expect(call[1].method).toBe("POST");
  expect(call[1].headers["X-CSRF-Token"]).toBe("csrf-1");
  expect(call[1].headers["If-Match"]).toBe("4");
  expect(call[1].headers["Idempotency-Key"]).toMatch(/^request-/);
  expect(JSON.parse(call[1].body)).toEqual({ id: "task-1" });
  expect(await screen.findByText("No open tasks")).toBeVisible();
});

it("exports the same CSV columns and guards spreadsheet formulas", () => {
  const csv = reportCsv(workspace());
  const lines = csv.replace(/^﻿/, "").split("\r\n");
  expect(lines[0]).toBe('"Position","Total applications","Pending Review","Interview","Interview Results","Offer","Rejected","Hired"');
  expect(lines[1]).toBe('"Software Developer","2","1","0","0","0","0","1"');
  expect(lines[2]).toBe('"\'=Data Analyst","2","0","0","0","1","1","0"');
});

it("shows an error with a retry when the workspace cannot be loaded", async () => {
  const fetcher = vi.fn(() => json({ error: { message: "Database unavailable." } }, 503));
  mount(fetcher);
  expect(await screen.findByRole("alert")).toHaveTextContent("Database unavailable.");
  expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
});
