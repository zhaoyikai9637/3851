// Full browser journey against the approved TEST database and real Express API.
// No intercepted API, SQLite, SMTP transport or production deployment.
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import sharp from "sharp";
import { createDatabase } from "../server/src/db.js";
import { defineModels } from "../server/src/models.js";
import { createServices } from "../server/src/services.js";
import { teamIdentityFixture } from "../server/tests/helpers/team-identity.js";
import { createApp } from "../server/src/app.js";
import { DatabaseSessionStore } from "../server/src/session-store.js";
import {
  assertDatabaseWriteAllowed,
  inspectMigrationTarget,
} from "../server/src/database-safety.js";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = fileURLToPath(new URL("../", import.meta.url));
const env = dotenv.parse(
  await fs.readFile(path.join(root, "server/.env.test")),
);
assertDatabaseWriteAllowed(env, "test");
const db = createDatabase(env),
  models = defineModels(db);
let server, browser, teamLanding;
const errors = [],
  checks = [],
  screenshots = [];
const redact = (text) =>
  [env.SEED_PASSWORD, env.DB_PASSWORD, env.SESSION_SECRET]
    .filter(Boolean)
    .reduce(
      (value, secret) => value.replaceAll(secret, "[redacted]"),
      String(text),
    );
const output = path.join(root, "work/browser-check");
await fs.mkdir(output, { recursive: true });
try {
  assert.equal((await inspectMigrationTarget(db)).initialized, true);
  // Add a distinct fictional record for this run. Retained SQL test data can move
  // the original seed onto later pages; Sequelize createdAt is not reset by update.
  const hrFixture = await models.HrUser.findOne({
    where: { employeeId: "DEMO-HR-001" },
  });
  const notificationSeed = await models.Notification.findOne({
    where: {
      eventKey: "demo:hr:1:notification:NEW_APPLICATION",
      recipientUserId: hrFixture.userId,
    },
  });
  assert.ok(notificationSeed);
  const browserEvent=crypto.randomUUID();
  const notificationFixture=await models.Notification.create({
    recipientUserId:hrFixture.userId,applicationId:notificationSeed.applicationId,
    notificationType:notificationSeed.notificationType,title:notificationSeed.title,
    message:notificationSeed.message,sourceModule:'Applications (Browser fixture '+browserEvent.slice(0,8)+')',
    eventKey:'test:browser:'+browserEvent,isRead:false,readAt:null,
  });

  // A separate test landing page verifies navigation only; it does not log in.
  teamLanding = createServer((req,res) => {
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
    res.end('<!doctype html><html lang="en"><title>Team navigation fixture</title><h1>Team sign-in navigation fixture</h1></html>');
  }).listen(0,'127.0.0.1');
  await new Promise(resolve => teamLanding.once('listening',resolve));
  const config = {
    production: false,
    secret: env.SESSION_SECRET,
    origin: "",
    mode: "standalone",
    teamLoginUrl: `http://127.0.0.1:${teamLanding.address().port}/sign-in`,
    companyName: "JRS",
    uploadDir: path.join(root, "server/uploads-test"),
  };
  const attachmentContents = 'Fictional browser attachment. No real offer is issued.';
  const attachmentStorageName = '33333333-3333-4333-8333-333333333333.txt';
  const sentFixture = await models.Log.findOne({where:{eventKey:'demo:hr:1:history:SENT',senderUserId:hrFixture.userId}});
  assert.ok(sentFixture);
  await fs.mkdir(config.uploadDir,{recursive:true});
  try { await fs.writeFile(path.join(config.uploadDir,attachmentStorageName),attachmentContents,{flag:'wx'}); }
  catch(e) { if(e.code!=='EEXIST')throw e; assert.equal(await fs.readFile(path.join(config.uploadDir,attachmentStorageName),'utf8'),attachmentContents); }
  const [attachmentFixture] = await models.Attachment.findOrCreate({where:{logId:sentFixture.logId,fileName:'Browser QA note.txt'},defaults:{fileUrl:attachmentStorageName,fileType:'text/plain'}});
  assert.equal(attachmentFixture.fileUrl,attachmentStorageName);
  const team = teamIdentityFixture();
  server = createApp({
    identity: team.adapter,
    services: createServices(models),
    config,
    sessionStore: new DatabaseSessionStore(models.Session),
    staticDir: path.join(root, "client/dist"),
  }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  config.origin = url;
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("status of 401"))
      errors.push(message.text());
  });
  page.setDefaultTimeout(10000);
  await page.goto(url);
  await page.getByRole('heading', {name:'Continue through team sign-in'}).waitFor();
  assert.equal(await page.locator('input[type="password"]').count(), 0);
  await page.getByRole('link', {name:'Go to team sign-in'}).click();
  await page.getByRole('heading', {name:'Team sign-in navigation fixture'}).waitFor();
  await page.goto(url);
  const loginRemoved = await context.request.post(url + '/api/auth/login', {data:{email:'ignored@example.test',password:'unused'}});
  assert.ok([403,404].includes(loginRemoved.status()));
  await page.getByRole('heading', {name:'Continue through team sign-in'}).waitFor();
  // Issue a trusted upstream fixture from the test process only. No HTTP login route.
  const issued = team.issue(hrFixture.userId);
  await context.addCookies([{...issued, url, httpOnly:true, sameSite:'Lax'}]);
  await page.getByRole('button', {name:'Check sign-in status'}).click();
  // Other retained integration fixtures may legitimately have the same title.
  await page.getByRole('heading',{name:notificationFixture.title,exact:true}).first().waitFor();
  const noticeCard = page.locator('.notification-card')
    .filter({hasText:notificationFixture.message})
    .filter({hasText:notificationFixture.sourceModule})
    .filter({has:page.getByRole('heading',{name:notificationFixture.title,exact:true})});
  await noticeCard.waitFor();
  checks.push("Test-only upstream identity and real MySQL notification list (team integration pending)");
  const screenshot = async (name) => {
    const target = path.join(output, `${name}.png`);
    await page.screenshot({ path: target, fullPage: true });
    screenshots.push(name);
  };
  await screenshot("notifications-1440");
  const read = noticeCard.getByRole("button", {
    name: "Mark New application received as read",
    exact: true,
  });
  assert.equal(await read.count(), 1);
  await read.click();
  await page
    .getByText("Notification marked as read.", { exact: true })
    .waitFor();
  await page.reload();
  await noticeCard.waitFor();
  assert.equal(
    await noticeCard
      .getByRole("button", {
        name: "Mark New application received as read",
        exact: true,
      })
      .count(),
    0,
  );
  checks.push("Read state survives browser refresh");
  await noticeCard
    .getByRole("button", {
      name: "View application for New application received",
    })
    .click();
  await page
    .getByRole("dialog")
    .getByText("Casey Taylor", { exact: true })
    .waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(
    await noticeCard
      .getByRole("button", {
        name: "View application for New application received",
      })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  checks.push("Read-only application summary and Escape focus return");
  const navigate = async (route, heading) => {
    await page.goto(url + route);
    await page.getByRole("heading", { name: heading, exact: true }).waitFor();
  };
  await navigate("/templates", "Email Templates");
  await page.getByLabel("Template name").waitFor();
  await screenshot("templates-1440");
  await page
    .getByRole("button", { name: "+ Create template", exact: true })
    .click();
  const name = `Browser QA ${Date.now()}`;
  await page.getByLabel("Template name").fill(name);
  await page.getByLabel("Email subject").fill("Hello [CandidateName]");
  await page
    .getByLabel("Email body")
    .fill("A fictional browser test for [JobTitle].");
  await page
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await page.getByText("Template saved.", { exact: true }).waitFor();
  await page.reload();
  await page.getByRole("button", { name: new RegExp(name) }).click();
  assert.equal(
    await page.getByLabel("Email body").inputValue(),
    "A fictional browser test for [JobTitle].",
  );
  await page.getByLabel("Email body").fill("Saved revision from browser QA.");
  await page
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await page.getByText("Template saved.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByText("Saved revision from browser QA.", { exact: true })
    .waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete template", exact: true })
    .click();
  await page.getByText("Template deleted.", { exact: false }).waitFor();
  await page.reload();
  await page.getByLabel("Template name").waitFor();
  assert.equal(
    await page.getByRole("button", { name: new RegExp(name) }).count(),
    0,
  );
  checks.push(
    "Template create/edit/reload/preview/delete confirmation with real SQL",
  );
  await navigate("/logs", "Notification Log");
  // Retained contract fixtures may span many pages; find the seeded sent record
  // through the real search UI rather than assuming it is in the first page.
  await page.getByLabel('Candidate or position').fill('Casey Taylor');
  await page.getByRole('button',{name:'Apply filters',exact:true}).click();
  await page
    .getByText("Simulated · No email sent", { exact: true })
    .first()
    .waitFor();
  await screenshot("logs-1440");
  await page
    .getByRole("button", { name: "View email to Casey Taylor", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByText("Original email snapshot", { exact: true })
    .waitFor();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button',{name:'Download Browser QA note.txt',exact:true}).click();
  const downloaded = await downloading;
  assert.equal(downloaded.suggestedFilename(),'Browser QA note.txt');
  const downloadedPath=path.join(output,'downloaded-qa-note.txt');
  await downloaded.saveAs(downloadedPath);
  assert.equal(await fs.readFile(downloadedPath,'utf8'),attachmentContents);
  checks.push('Authorized attachment downloads real stored bytes with the original filename');
  await screenshot("log-detail-1440");
  await page.keyboard.press("Escape");
  checks.push("Sent history, simulated labels and original email details");
  await navigate("/profile", "My Profile");
  await page.getByText("DEMO-HR-001", { exact: true }).waitFor();
  await screenshot("profile-1440");
  await page.getByRole("link", { name: "Edit profile", exact: true }).click();
  const originalOffice = await page.getByLabel("Office location").inputValue();
  await page.getByLabel("Office location").fill("Browser QA office");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByText("Profile changes saved.", { exact: true }).waitFor();
  await page.reload();
  await page.getByLabel("Office location").waitFor();
  assert.equal(
    await page.getByLabel("Office location").inputValue(),
    "Browser QA office",
  );
  await page.getByLabel("Office location").fill(originalOffice);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByText("Profile changes saved.", { exact: true }).waitFor();
  await screenshot("edit-profile-1440");
  checks.push(
    "Profile update persists across reload; restored original test location",
  );
  const photo = await sharp({
    create: { width: 80, height: 80, channels: 3, background: "#3268ee" },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel("Choose a photo")
    .setInputFiles({
      name: "avatar-test.png",
      mimeType: "image/png",
      buffer: photo,
    });
  await page.waitForFunction(() => {
    const img = document.querySelector(".photo-panel img");
    return img?.complete && img.naturalWidth > 0;
  });
  await page.getByRole("button", { name: "Upload photo", exact: true }).click();
  await page.getByText("Profile photo updated.", { exact: true }).waitFor();
  const photoOwner = await models.HrUser.findOne({
    where: { employeeId: "DEMO-HR-001" },
  });
  const previousPhoto = photoOwner.profilePhotoUrl;
  await page.reload();
  await page
    .getByLabel("Choose a photo")
    .setInputFiles({
      name: "second-avatar-test.png",
      mimeType: "image/png",
      buffer: photo,
    });
  await page.waitForFunction(() => {
    const img = document.querySelector(".photo-panel img");
    return img?.complete && img.naturalWidth > 0;
  });
  await page.getByRole("button", { name: "Upload photo", exact: true }).click();
  await page.getByText("Profile photo updated.", { exact: true }).waitFor();
  await assert.rejects(fs.access(path.join(config.uploadDir, previousPhoto)), {
    code: "ENOENT",
  });
  await page.reload();
  const photoResponse = await context.request.get(
    url + "/api/hr/profile/photo",
  );
  assert.equal(photoResponse.status(), 200);
  assert.match(photoResponse.headers()["content-type"], /image\/jpeg/);
  checks.push(
    "Avatar uploads normalize to JPEG, persist and remove the superseded file",
  );
  await page.goto("about:blank");
  const savedPort = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  server = createApp({
    identity: team.adapter,
    services: createServices(models),
    config,
    sessionStore: new DatabaseSessionStore(models.Session),
    staticDir: path.join(root, "client/dist"),
  }).listen(savedPort, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  await page.goto(url + "/profile/edit");
  await page.getByLabel("Full name").waitFor();
  checks.push(
    "Session survives a fresh Express instance using the MySQL session store",
  );
  for (const width of [390, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [route, heading] of [
      ["/notifications", "Notification Center"],
      ["/templates", "Email Templates"],
      ["/logs", "Notification Log"],
      ["/profile", "My Profile"],
      ["/profile/edit", "Edit Profile"],
    ]) {
      await navigate(route, heading);
      await page.locator(".loading-state").waitFor({ state: "hidden" });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      if (overflow) {
        await screenshot("overflow-debug");
        console.log(
          JSON.stringify(
            await page.evaluate(() =>
              [...document.querySelectorAll("body *")]
                .filter(
                  (el) => el.getBoundingClientRect().right > innerWidth + 1,
                )
                .map((el) => ({
                  tag: el.tagName,
                  class: el.className,
                  width: el.getBoundingClientRect().width,
                  right: el.getBoundingClientRect().right,
                }))
                .slice(0, 18),
            ),
          ),
        );
      }
      assert.equal(
        overflow,
        false,
        `${route} horizontal page overflow at ${width}`,
      );
      await screenshot(`${route.replaceAll("/", "-").slice(1)}-${width}`);
    }
    checks.push(`Five pages fit ${width}px without document overflow`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  const menu = page.getByRole("dialog");
  await menu
    .getByRole("link", { name: "Notification Center", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Notification Center", exact: true })
    .waitFor();
  await page.locator(".account-button").click();
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Logout", exact: true })
    .click();
  await page.getByRole('heading', {name:'Team sign-in navigation fixture'}).waitFor();
  const protectedResponse = await context.request.get(url + "/api/hr/profile");
  assert.equal(protectedResponse.status(), 401);
  await page.goto(url);
  await page.reload();
  await page.getByRole('heading', {name:'Continue through team sign-in'}).waitFor();
  await screenshot("team-entry-390");
  checks.push(
    "Mobile logout revokes upstream fixture, redirects to configured team page, and prevents return/replay",
  );
  await page.goto(url + "/api/docs/");
  await page.locator(".opblock").first().waitFor();
  assert.ok((await page.locator(".opblock").count()) >= 15);
  await page.getByText('Read own profile', {exact:true}).click();
  await page.locator('.opblock.is-open').getByText('Riley Morgan', {exact:false}).first().waitFor();
  await screenshot('swagger-profile-contract');
  checks.push(
    "Swagger UI renders the OpenAPI operations and fictional profile response example with the configured CSP",
  );
  assert.deepEqual(errors, []);
  await fs.writeFile(
    path.join(output, "results.json"),
    JSON.stringify(
      {
        database: env.DB_NAME,
        browser: await browser.version(),
        checks,
        screenshots,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      {
        result: "PASS",
        checks,
        screenshots: screenshots.length,
        browserErrors: errors.length,
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.error("Browser check failed:", redact(e.message));
  process.exitCode = 1;
  const failurePage=browser?.contexts()[0]?.pages()[0];
  if (failurePage) {
    await failurePage.screenshot({path:path.join(output,'failure-current.png'),fullPage:true}).catch(()=>{});
    await fs.writeFile(path.join(output,'failure-page.txt'),redact(await failurePage.locator('body').innerText().catch(()=>'')));
  }
  await fs.writeFile(
    path.join(output, "failure.json"),
    JSON.stringify(
      { message: redact(e.message), checks, errors: errors.map(redact) },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  if (teamLanding) await new Promise(resolve => teamLanding.close(resolve));
  await db.close();
}
