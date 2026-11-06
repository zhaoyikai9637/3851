import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { Interviews, interviewCalendar } from "../../pages/interviews/Interviews";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
const NOW = new Date("2026-11-06T06:00:00Z").getTime(); // 14:00 in Singapore

function workspace(overrides = {}) {
  return {
    revision: 7,
    jobs: [{ id: "job-a", title: "Software Developer", status: "Active" }],
    candidates: [
      { id: "c-1", name: "Alex Tan", email: "alex@example.test" },
      { id: "c-2", name: "Sarah Lim", email: "sarah@example.test" },
      { id: "c-3", name: "Daniel Wong", email: "daniel@example.test" },
    ],
    applications: [
      { id: "app-1", candidateId: "c-1", jobId: "job-a", stage: "Interview" },
      { id: "app-2", candidateId: "c-2", jobId: "job-a", stage: "Interview" },
      { id: "app-3", candidateId: "c-3", jobId: "job-a", stage: "Interview" },
    ],
    interviews: [
      { id: "int-1", applicationId: "app-1", date: "2026-11-06", time: "10:00", duration: 45, format: "Video", location: "Meet link", interviewer: "Casey Wong", notes: "", status: "Scheduled" },
      { id: "int-2", applicationId: "app-2", date: "2026-11-20", time: "09:30", duration: 60, format: "On-site", location: "Room 3", interviewer: "Riley Morgan", notes: "", status: "Scheduled" },
      { id: "int-3", applicationId: "app-2", date: "2026-10-01", time: "09:30", duration: 30, format: "Phone", location: "Phone", interviewer: "Riley Morgan", notes: "", status: "Cancelled" },
    ],
    tasks: [],
    ...overrides,
  };
}

function Location() {
  const location = useLocation();
  return <output aria-label="Current location">{location.pathname + location.search}</output>;
}

function mount(fetcher, entry = "/interviews") {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Location />
      <Routes>
        <Route path="/interviews" element={<Interviews fetcher={fetcher} now={NOW} />} />
        <Route path="/applications" element={<p>Applications page</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return userEvent.setup();
}

function fetcherFor(db, commands = {}) {
  return vi.fn((url, options = {}) => {
    if (url === "/recruitment/api/auth/me") return json({ user: { id: "hr" }, csrfToken: "csrf-9" });
    if (url === "/recruitment/api/hr/workspace") return json(db);
    const command = url.match(/\/recruitment\/api\/hr\/commands\/(.+)$/)?.[1];
    if (command && commands[command]) return commands[command](JSON.parse(options.body), options);
    return json({ error: { message: "Unexpected request" } }, 404);
  });
}

it("lists scheduled interviews by default, in date order, with the waiting count", async () => {
  mount(fetcherFor(workspace()));
  const table = await screen.findByRole("table", { name: "Interviews" });
  const rows = within(table).getAllByRole("row").slice(1);
  expect(rows).toHaveLength(2);
  expect(rows[0]).toHaveTextContent("Alex Tan");
  expect(rows[1]).toHaveTextContent("Sarah Lim");
  expect(screen.getByText(/awaiting scheduling/).closest("div")).toHaveTextContent("1 application awaiting scheduling");
  expect(screen.getByText("Showing 1–2 of 2 interviews")).toBeVisible();
});

it("keeps filters in the address and clears them to all statuses", async () => {
  const ui = mount(fetcherFor(workspace()));
  await screen.findByRole("table", { name: "Interviews" });
  await ui.selectOptions(screen.getByLabelText("Filter interview status"), "Cancelled");
  expect(screen.getByLabelText("Current location")).toHaveTextContent("status=Cancelled");
  expect(within(screen.getByRole("table", { name: "Interviews" })).getAllByRole("row")).toHaveLength(2);
  await ui.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(within(screen.getByRole("table", { name: "Interviews" })).getAllByRole("row")).toHaveLength(4);
});

it("searches by candidate name", async () => {
  const ui = mount(fetcherFor(workspace()));
  await ui.type(await screen.findByRole("searchbox", { name: "Search interviews" }), "sarah");
  const rows = within(screen.getByRole("table", { name: "Interviews" })).getAllByRole("row").slice(1);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toHaveTextContent("Sarah Lim");
});

it("schedules a waiting candidate with the same command payload as before", async () => {
  const schedule = vi.fn(() => json({ db: workspace({ revision: 8 }), result: {} }));
  const fetcher = fetcherFor(workspace(), { schedule });
  const ui = mount(fetcher);
  await ui.click(await screen.findByRole("button", { name: "Choose candidate" }));
  const chooser = screen.getByRole("dialog", { name: "Choose Candidate" });
  expect(within(chooser).getByText("Daniel Wong")).toBeVisible();
  await ui.click(within(chooser).getByRole("button", { name: "Schedule" }));
  const form = screen.getByRole("dialog", { name: "Schedule Interview" });
  await ui.type(within(form).getByLabelText("Interview date"), "20 11 2030");
  fireEvent.change(within(form).getByLabelText("Interview time"), { target: { value: "14:30" } });
  await ui.type(within(form).getByLabelText("Interview venue or meeting link"), "Room 5");
  await ui.type(within(form).getByLabelText("Interviewer"), "Casey Wong");
  await ui.click(within(form).getByRole("button", { name: "Confirm Interview" }));
  expect(schedule).toHaveBeenCalledTimes(1);
  const [payload, options] = schedule.mock.calls[0];
  expect(payload).toEqual({ date: "2030-11-20", time: "14:30", location: "Room 5", interviewer: "Casey Wong", duration: "45", format: "Video", notes: "", notify: true, applicationId: "app-3" });
  expect(options.headers["If-Match"]).toBe("7");
  expect(options.headers["X-CSRF-Token"]).toBe("csrf-9");
  expect(options.headers["Idempotency-Key"]).toMatch(/^request-/);
  expect(await screen.findByText("Interview schedule saved.")).toBeVisible();
});

it("only offers feedback after the interview has ended and sends the assessment", async () => {
  const feedback = vi.fn(() => json({ db: workspace({ revision: 8 }), result: {} }));
  const ui = mount(fetcherFor(workspace(), { feedback }));
  const table = await screen.findByRole("table", { name: "Interviews" });
  const [first, second] = within(table).getAllByRole("row").slice(1);
  await ui.click(within(second).getByRole("button", { name: "View" }));
  expect(within(screen.getByRole("dialog", { name: "Interview details" })).getByRole("button", { name: "Record Feedback" })).toBeDisabled();
  await ui.click(within(screen.getByRole("dialog", { name: "Interview details" })).getByRole("button", { name: "Close dialog" }));
  await ui.click(within(first).getByRole("button", { name: "View" }));
  await ui.click(within(screen.getByRole("dialog", { name: "Interview details" })).getByRole("button", { name: "Record Feedback" }));
  const form = screen.getByRole("dialog", { name: "Record Interview Feedback" });
  for (const select of within(form).getAllByLabelText("Rating")) await ui.selectOptions(select, "4");
  await ui.selectOptions(within(form).getByLabelText("Overall rating"), "4");
  await ui.selectOptions(within(form).getByLabelText("Recommendation"), "Proceed");
  await ui.type(within(form).getByLabelText("Interview feedback"), "Clear communicator.");
  await ui.click(within(form).getByRole("button", { name: "Complete Interview" }));
  const [payload] = feedback.mock.calls[0];
  expect(payload).toMatchObject({ rating: "4", recommendation: "Proceed", notes: "Clear communicator.", applicationId: "app-1", interviewId: "int-1" });
  expect(JSON.parse(payload.assessment)).toEqual([
    { label: "Relevant experience", rating: 4 },
    { label: "Technical skills", rating: 4 },
    { label: "Communication", rating: 4 },
    { label: "Teamwork", rating: 4 },
  ]);
});

it("cancels with a reason and opens the resume from the applicant cell", async () => {
  const cancel = vi.fn(() => json({ db: workspace({ revision: 8 }), result: {} }));
  const ui = mount(fetcherFor(workspace(), { "cancel-interview": cancel }));
  const table = await screen.findByRole("table", { name: "Interviews" });
  await ui.click(within(within(table).getAllByRole("row")[2]).getByRole("button", { name: "View" }));
  await ui.click(within(screen.getByRole("dialog", { name: "Interview details" })).getByRole("button", { name: "Cancel interview" }));
  const form = screen.getByRole("dialog", { name: "Cancel Interview" });
  await ui.type(within(form).getByLabelText("Cancellation reason"), "Candidate asked to move");
  await ui.click(within(form).getByRole("button", { name: "Cancel Interview" }));
  expect(cancel.mock.calls[0][0]).toEqual({ reason: "Candidate asked to move", applicationId: "app-2", interviewId: "int-2" });
  expect(await screen.findByText("Interview cancelled.")).toBeVisible();
  await ui.click(screen.getAllByTitle("View resume")[0]);
  expect(screen.getByLabelText("Current location")).toHaveTextContent("/applications?view=review/app-1");
});

it("produces the same calendar event as the embedded workspace", () => {
  const db = workspace();
  const ics = interviewCalendar(db, db.interviews[0], new Date("2026-11-01T00:00:00Z"));
  expect(ics.split("\r\n")).toEqual([
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//JRS//HR Workspace//EN",
    "BEGIN:VEVENT",
    "UID:int-1@jrs.local",
    "DTSTAMP:20261101T000000Z",
    "DTSTART:20261106T020000Z",
    "DTEND:20261106T024500Z",
    "SUMMARY:Interview: Alex Tan — Software Developer",
    "LOCATION:Meet link",
    "DESCRIPTION:Interviewer: Casey Wong\\n",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ]);
});
