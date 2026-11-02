import { expect, it, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MemoryRouter, Routes, Route, Outlet } from "react-router-dom";
import { DateField } from "../../pages/jobs/DateField";
import { Recruitment } from "../../pages/recruitment/Recruitment";
import { historicalDateRange } from "../shared";

function Dates() {
  const [value, setValue] = useState("21 10 2026");
  return (
    <DateField
      label="Meeting date"
      value={value}
      onChange={setValue}
      min="2020-01-01"
      max="2030-12-31"
    />
  );
}
it("navigates English days to months to years and back without committing until a day is chosen", async () => {
  const ui = userEvent.setup();
  render(<Dates />);
  await ui.click(screen.getByRole("button", { name: "Open Meeting date calendar" }));
  await ui.click(screen.getByRole("button", { name: "Choose month" }));
  await ui.click(screen.getByRole("button", { name: "Choose year" }));
  expect(screen.getByText("2020–2029")).toBeVisible();
  await ui.click(screen.getByRole("button", { name: "2024", exact: true }));
  expect(screen.getByLabelText("Meeting date")).toHaveValue("21 10 2026");
  await ui.click(screen.getByRole("button", { name: "February", exact: true }));
  await ui.click(screen.getByRole("button", { name: "29 February 2024" }));
  expect(screen.getByLabelText("Meeting date")).toHaveValue("29 02 2024");
  await ui.click(screen.getByRole("button", { name: "Open Meeting date calendar" }));
  await ui.click(screen.getByRole("button", { name: "Choose month" }));
  await ui.click(screen.getByRole("button", { name: "Choose year" }));
  await ui.click(screen.getByRole("button", { name: "Next decade" }));
  await ui.click(screen.getByRole("button", { name: "2031", exact: true }));
  await ui.click(screen.getByRole("button", { name: "January", exact: true }));
  expect(screen.getByRole("button", { name: "1 January 2031" })).toBeDisabled();
});
it("parses day-month-year history dates while keeping ISO and no-future rules", () => {
  expect(historicalDateRange("13 10 2026", "21 10 2026", "2026-10-21")).toEqual({
    from: "2026-10-13",
    to: "2026-10-21",
    error: null,
  });
  expect(historicalDateRange("", "22 10 2026", "2026-10-21").error).toMatch(/Future/);
});
it("finds candidates beyond the old first-100 cap and retains the list after profile return", async () => {
  const records = Array.from({ length: 121 }, (_, index) => ({
    id: "person-" + (index + 1),
    name: "Person " + (index + 1),
    email: "person" + (index + 1) + "@example.test",
    location: "Singapore",
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) => {
      const p = new URL(url, "http://localhost").searchParams,
        page = Number(p.get("page") || 1),
        limit = Number(p.get("limit") || 20);
      const items = records.filter(
        (row) => !p.get("q") || row.name.toLowerCase().includes(p.get("q").toLowerCase()),
      );
      return {
        ok: true,
        json: async () => ({
          items: items.slice((page - 1) * limit, page * limit),
          total: items.length,
          page,
          limit,
        }),
      };
    }),
  );
  const ui = userEvent.setup();
  render(
    <MemoryRouter>
      <Routes>
        <Route element={<Outlet context={{ setTrail: () => {} }} />}>
          <Route index element={<Recruitment page="candidates" title="Candidates" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  expect(await screen.findByText("Person 1")).toBeVisible();
  expect(screen.getByRole("searchbox", { name: "Search candidates" })).toBeVisible();
  await ui.click(screen.getByRole("button", { name: "Next", exact: true }));
  expect(await screen.findByText("Person 11")).toBeVisible();
  await ui.click(screen.getByRole("button", { name: "View profile for Person 11" }));
  await ui.click(screen.getByRole("button", { name: "Back to candidates" }));
  expect(await screen.findByText("Person 11")).toBeVisible();
  await ui.type(screen.getByRole("searchbox", { name: "Search candidates" }), "Person 121");
  expect(await screen.findByText("Person 121")).toBeVisible();
  expect(screen.queryByText("Person 11")).not.toBeInTheDocument();
});
it("opens an empty calendar in the current UTC+08 business month",()=>{
 vi.useFakeTimers();try {
  vi.setSystemTime(new Date("2026-09-30T16:30:00Z"));
  render(<DateField label="Boundary date" value="" onChange={()=>{}}/>);
  fireEvent.click(screen.getByRole("button",{name:"Open Boundary date calendar"}));
  expect(screen.getByRole("button",{name:"Choose month"})).toHaveTextContent("October 2026");
 }finally{vi.useRealTimers();}
});
