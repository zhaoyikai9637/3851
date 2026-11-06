import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { Dashboard, businessDay } from "../../pages/dashboard/Dashboard";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
const NOW = new Date("2026-11-06T01:00:00Z").getTime(); // 09:00 on 6 Nov in Singapore

function workspace() {
  const candidates = Array.from({ length: 9 }, (_, index) => ({ id: "c-" + index, name: "Person " + index, email: `p${index}@example.test` }));
  return {
    revision: 3,
    jobs: [
      { id: "job-a", title: "Software Developer", department: "Engineering", type: "Full-time", status: "Active" },
      { id: "job-b", title: "Data Analyst", department: "Analytics", type: "Contract", status: "Active" },
      { id: "job-c", title: "UI Designer", department: "Design", type: "Full-time", status: "Active" },
      { id: "job-d", title: "Not Shown", department: "Ops", type: "Full-time", status: "Active" },
    ],
    candidates,
    applications: candidates.map((person, index) => ({
      id: "app-" + index,
      candidateId: person.id,
      jobId: index < 5 ? "job-a" : "job-b",
      stage: index === 0 ? "Interview" : "Pending Review",
      createdAt: `2026-10-${String(10 + index).padStart(2, "0")}T00:00:00Z`,
    })),
    interviews: [
      { id: "int-today", applicationId: "app-0", date: "2026-11-06", time: "14:00", duration: 45, format: "Video", location: "Meet", interviewer: "Casey", status: "Scheduled" },
      { id: "int-week", applicationId: "app-1", date: "2026-11-10", time: "10:00", duration: 30, format: "Phone", location: "Phone", interviewer: "Casey", status: "Scheduled" },
      { id: "int-later", applicationId: "app-2", date: "2026-12-01", time: "10:00", duration: 30, format: "Phone", location: "Phone", interviewer: "Casey", status: "Scheduled" },
      { id: "int-cancelled", applicationId: "app-3", date: "2026-11-06", time: "11:00", duration: 30, format: "Phone", location: "Phone", interviewer: "Casey", status: "Cancelled" },
    ],
    tasks: [],
  };
}

function Location() {
  const location = useLocation();
  return <output aria-label="Current location">{location.pathname + location.search}</output>;
}

function mount(db = workspace()) {
  const fetcher = vi.fn((url) => {
    if (url === "/recruitment/api/auth/me") return json({ user: { id: "hr" }, csrfToken: "csrf" });
    if (url === "/recruitment/api/hr/workspace") return json(db);
    return json({}, 404);
  });
  render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Location />
      <Routes>
        <Route path="*" element={<Dashboard fetcher={fetcher} now={NOW} />} />
      </Routes>
    </MemoryRouter>,
  );
  return userEvent.setup();
}

it("uses Singapore business days", () => {
  expect(businessDay(0, NOW)).toBe("2026-11-06");
  expect(businessDay(6, NOW)).toBe("2026-11-12");
});

it("shows the first three jobs with their application counts", async () => {
  mount();
  const panel = (await screen.findByRole("heading", { name: "Job Post Performance" })).closest("section");
  expect(within(panel).getByText("Software Developer")).toBeVisible();
  expect(within(panel).getByText("5 applications")).toBeVisible();
  expect(within(panel).getByText("4 applications")).toBeVisible();
  expect(within(panel).getByText("0 applications")).toBeVisible();
  expect(within(panel).queryByText("Not Shown")).not.toBeInTheDocument();
});

it("summarises today, the next seven days and the next interview", async () => {
  mount();
  const panel = (await screen.findByRole("heading", { name: "Interview Overview" })).closest("section");
  expect(within(panel).getByText("TODAY").nextSibling).toHaveTextContent("1");
  expect(within(panel).getByText("NEXT 7 DAYS").nextSibling).toHaveTextContent("2");
  expect(within(panel).getByText("14:00")).toBeVisible();
  expect(within(panel).getByText("Person 0")).toBeVisible();
});

it("lists recent applications newest first with paging kept in the address", async () => {
  const ui = mount();
  const table = await screen.findByRole("table", { name: "Recent applications" });
  const rows = within(table).getAllByRole("row").slice(1);
  expect(rows).toHaveLength(7);
  expect(rows[0]).toHaveTextContent("Person 8");
  expect(screen.getByText("Showing 1–7 of 9 recent applications")).toBeVisible();
  await ui.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByLabelText("Current location")).toHaveTextContent("/dashboard?page=2");
  expect(within(screen.getByRole("table", { name: "Recent applications" })).getAllByRole("row")).toHaveLength(3);
});

it("links to the application, the interview and job creation", async () => {
  const ui = mount();
  await ui.click(await screen.findByRole("button", { name: "View application from Person 8" }));
  expect(screen.getByLabelText("Current location")).toHaveTextContent("/applications?view=candidate/c-8/app-8");
  cleanup();
  const ui2 = mount();
  const schedule = (await screen.findByRole("heading", { name: "Interview Schedule" })).closest("section");
  await ui2.click(within(schedule).getByRole("button", { name: /Person 0/ }));
  expect(screen.getByLabelText("Current location")).toHaveTextContent("/interviews?status=&interview=int-today");
  cleanup();
  const ui3 = mount();
  await ui3.click(await screen.findByRole("button", { name: "Create Job Posting" }));
  expect(screen.getByLabelText("Current location")).toHaveTextContent("/job-postings?create=1");
});

it("switches the schedule between today and the next seven days", async () => {
  const ui = mount();
  const schedule = (await screen.findByRole("heading", { name: "Interview Schedule" })).closest("section");
  expect(within(schedule).getAllByRole("button", { name: /Person/ })).toHaveLength(1);
  await ui.click(within(schedule).getByRole("button", { name: "Next 7 days · 2" }));
  expect(within(schedule).getAllByRole("button", { name: /Person/ })).toHaveLength(2);
});
