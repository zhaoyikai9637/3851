import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import service from "../JRS HR/server/service.cjs";
async function setup() {
  const dom = new JSDOM('<main id="content"></main>', {
    runScripts: "outside-only",
    url: "http://localhost/recruitment/",
  });
  dom.window.icon = () => "";
  for (const file of ["job-requirements.js", "screening.js", "state.js", "views.js", "review.js"])
    dom.window.eval(await readFile(new URL("../JRS HR/dist/" + file, import.meta.url), "utf8"));
  const db = dom.window.HRModel.seed();
  db.currentUser = { name: "Example HR", role: "HR_MANAGER" };
  db.systemNotifications = [];
  db.mailLogs = [];
  return { dom, db, doc: dom.window.document };
}
test("HR dashboard keeps application and interview links while Applications uses one status selector", async () => {
  const { dom, db, doc } = await setup();
  try {
    const V = dom.window.HRViews,
      ui = { page: 1, pageSize: 10, period: "today" };
    doc.querySelector("main").innerHTML = V.render(["dashboard"], db, ui);
    assert.ok(doc.querySelector('a[href="#/interviews"]'));
    assert.ok(doc.querySelector('a[href="#/applications"]'));

    doc.querySelector("main").innerHTML = V.render(["applications"], db, ui);
    assert.equal(doc.querySelectorAll('[aria-label="Application stages"] a').length, 0);
    assert.ok(doc.querySelector('select[aria-label="Filter application status"]'));
    assert.ok(doc.querySelector('[data-action="move-interview"]'));
  } finally {
    dom.window.close();
  }
});
test("interview status filtering shows only the selected meeting status", async () => {
  const { dom, db, doc } = await setup();
  try {
    const application = db.applications[0];
    application.stage = "Interview";
    db.interviews = [
      {
        id: "past",
        applicationId: application.id,
        date: "2020-01-01",
        time: "09:00",
        duration: 45,
        format: "Video",
        interviewer: "Example HR",
        status: "Completed",
      },
      {
        id: "future",
        applicationId: application.id,
        date: "2090-01-01",
        time: "09:00",
        duration: 45,
        format: "Video",
        interviewer: "Example HR",
        status: "Scheduled",
      },
    ];
    const V = dom.window.HRViews;
    doc.querySelector("main").innerHTML = V.render(["interviews"], db, {
      page: 1,
      pageSize: 10,
      interviewStatus: "Completed",
      q: "",
    });
    assert.ok(doc.querySelector('select[aria-label="Filter interview status"]'));
    assert.ok(doc.body.textContent.includes("2020"));
    assert.ok(!doc.body.textContent.includes("2090"));
    doc.querySelector("main").innerHTML = V.render(["interviews"], db, {
      page: 1,
      pageSize: 10,
      interviewStatus: "Scheduled",
      q: "",
    });
    assert.ok(doc.body.textContent.includes("2090"));
    assert.ok(!doc.body.textContent.includes("2020"));
  } finally {
    dom.window.close();
  }
});

test("a single complete review confirmation books the interview while keeping the current queue", async () => {
  const dom = new JSDOM(
      await readFile(new URL("../JRS HR/dist/index.html", import.meta.url), "utf8"),
      {
        runScripts: "outside-only",
        url: "http://localhost/recruitment/#/applications/applications-review",
        pretendToBeVisual: true,
      },
    ),
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
    const actor = { id: "test-hr", name: "Example HR", role: "HR_MANAGER" };
    let db = w.HRModel.seed();
    db.currentUser = actor;
    db.systemNotifications = [];
    db.mailLogs = [];
    const id = db.applications[0].id;
    w.HRRemote = {
      boot: async () => ({
        get db() {
          return db;
        },
        user: actor,
        error: "",
        async commit(command, payload) {
          const next = w.HRModel.clone(db),
            result = service.applyCommand(next, command, payload, actor);
          db = next;
          return result;
        },
      }),
    };
    await w.eval(await readFile(new URL("../JRS HR/dist/app.js", import.meta.url), "utf8"));
    assert.equal(w.document.querySelector("#boot-error"), null);
    w.document.querySelector('[data-action="move-interview"]').click();
    await new Promise((resolve) => setImmediate(resolve));
    const form = w.document.querySelector("#modal form");
    form.elements.notify.checked = false;
    form.elements.date.value=w.HRModel.day(300);
    form.elements.time.value="10:00";
    form.elements.location.value="Integration room";
    form.elements.interviewer.value="Integration panel";

    form.dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(db.applications.find((row) => row.id === id).stage, "Interview");
    assert.equal(w.location.hash, "#/applications/pending-review");
    assert.equal(db.interviews.filter(row=>row.applicationId===id&&row.status==="Scheduled").length,1);
    assert.ok(!w.document.body.textContent.includes("Application status updated successfully"));
  } finally {
    w.close();
  }
});
test("candidate information remains accessible without an application",async()=>{
 const {dom,db,doc}=await setup();try{
  db.candidates.push({...db.candidates[0],id:"unassigned-person",name:"Unassigned Example",email:"unassigned@example.test"});
  doc.querySelector("main").innerHTML=dom.window.HRViews.render(["candidate","unassigned-person"],db,{});
  assert.ok(doc.body.textContent.includes("unassigned@example.test"));
  assert.ok(doc.body.textContent.includes("No applications recorded"));
 }finally{dom.window.close();}
});
