import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { JSDOM } from "jsdom";

test("English HR date controls retain ISO form values, constraints and filter change events", async () => {
  const dom = new JSDOM(
    '<form><label>Meeting date<input type="date" name="date" data-filter="interviewDate" required min="2030-01-01" value="2030-12-31"></label></form>',
    { runScripts: "outside-only" },
  );
  try {
    dom.window.eval(
      await readFile(new URL("../JRS HR/dist/date-inputs.js", import.meta.url), "utf8").catch(
        (error) => {
          if (error.code === "ENOENT") return "";
          throw error;
        },
      ),
    );
    assert.equal(typeof dom.window.HRDateInputs, "object");
    dom.window.HRDateInputs.enhance(dom.window.document);
    const doc = dom.window.document,
      visible = doc.querySelector('input[type="text"]'),
      hidden = doc.querySelector('input[name="date"]');
    assert.equal(visible.value, "31/12/2030");
    assert.equal(visible.placeholder, "DD/MM/YYYY");
    let changed = "";
    hidden.addEventListener("change", () => (changed = hidden.value));
    visible.value = "31/02/2030";
    visible.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    assert.equal(visible.checkValidity(), false);
    visible.value = "01/01/2029";
    visible.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    assert.equal(visible.checkValidity(), false);
    visible.value = "15/01/2031";
    visible.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    visible.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    assert.equal(changed, "2031-01-15");
    assert.equal(new dom.window.FormData(doc.querySelector("form")).get("date"), "2031-01-15");
    doc.querySelector('[aria-label="Open Meeting date calendar"]').click();
    assert.ok(doc.body.textContent.includes("January 2031"));
    assert.equal(doc.querySelector('input[type="date"]'), null);
    doc.querySelector('[aria-label="16 January 2031"]').click();
    assert.equal(visible.value, "16/01/2031");
    assert.equal(hidden.value, "2031-01-16");
  } finally {
    dom.window.close();
  }
});
