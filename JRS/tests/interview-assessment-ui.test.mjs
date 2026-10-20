import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import service from "../JRS HR/server/service.cjs";

test("HR can add and remove criteria, explicitly score them and retain the results after submitting", async () => {
  const html = await readFile(new URL("../JRS HR/dist/index.html", import.meta.url), "utf8");
  const dom = new JSDOM(html, {
      url: "http://localhost/recruitment/#/interviews",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    }),
    w = dom.window;
  try {
    w.scrollTo = () => {};
    w.HTMLElement.prototype.scrollIntoView = function () {};
    w.HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    w.HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
    for (const file of [
      "job-requirements.js",
      "screening.js",
      "state.js",
      "icons.js",
      "resume.js",
      "views.js",
      "review.js",
      "hr-extra.js",
      "layout.js",
    ])
      w.eval(await readFile(new URL("../JRS HR/dist/" + file, import.meta.url), "utf8"));
    const actor = { id: "assessment-hr", name: "Example HR", role: "HR_MANAGER" };
    let db = w.HRModel.seed();
    db.currentUser = actor;
    db.systemNotifications = [];
    db.mailLogs = [];
    const application = db.applications[0];
    application.stage = "Interview";
    db.interviews = [
      {
        id: "assessment-ui",
        applicationId: application.id,
        date: w.HRModel.day(-2),
        time: "10:00",
        duration: 45,
        format: "Video",
        location: "Test room",
        interviewer: actor.name,
        notes: "",
        status: "Scheduled",
        feedback: null,
      },
    ];
    const store = {
      get db() {
        return db;
      },
      get user() {
        return actor;
      },
      error: "",
      async commit(command, payload) {
        const next = w.HRModel.clone(db),
          result = service.applyCommand(next, command, payload, actor);
        db = next;
        return result;
      },
    };
    w.HRRemote = {
      async boot() {
        w.document.querySelector("#app-shell").hidden = false;
        return store;
      },
    };
    await w.eval(await readFile(new URL("../JRS HR/dist/app.js", import.meta.url), "utf8"));
    assert.equal(w.document.querySelector("#boot-error")?.textContent, undefined);
    w.document.querySelector('[data-action="interview"]').click();
    await new Promise((resolve) => setImmediate(resolve));
    w.document.querySelector('[data-action="interview-feedback"]').click();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(w.document.querySelector('#modal [name="rating"]').value, "");
    w.document.querySelector('[data-action="assessment-add"]').click();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(w.document.querySelectorAll("[data-assessment-row]").length, 5);
    w.document.querySelector('[data-action="assessment-remove"]').click();
    await new Promise((resolve) => setImmediate(resolve));
    const rows = [...w.document.querySelectorAll("[data-assessment-row]")];
    assert.equal(rows.length, 4);
    rows.at(-1).querySelector("input").value = "Problem solving";
    rows.forEach((row) => (row.querySelector("select").value = "5"));
    const form = w.document.querySelector("#modal form");
    form.elements.rating.value = "2";
    form.elements.recommendation.value = "Hold";
    form.elements.notes.value = "Explicit assessment by a human reviewer.";
    const navigated = new Promise((resolve) =>
      w.addEventListener("hashchange", resolve, { once: true }),
    );
    form.dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    await navigated;
    assert.equal(db.applications[0].feedback.rating, 2);
    assert.equal(db.applications[0].feedback.recommendation, "Hold");
    assert.equal(db.applications[0].feedback.assessment.at(-1).label, "Problem solving");
    assert.equal(db.applications[0].feedback.assessment.at(-1).rating, 5);
    assert.equal(
      w.document.querySelector(".assessment-results").textContent.includes("Problem solving"),
      true,
    );
  } finally {
    w.close();
  }
});
