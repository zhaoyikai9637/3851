import { beforeEach, describe, expect, it } from "vitest";
import { createDemoApi } from "../demo-api";

describe("local fictional demo adapter", () => {
  beforeEach(() => sessionStorage.clear());

  it("persists demo-only notification, template and profile changes", async () => {
    const demo = createDemoApi();
    await demo.request("/api/hr/notifications/101/read", { method: "PATCH" });
    const notifications = await demo.request("/api/hr/notifications?read=unread&page=1&pageSize=8");
    expect(notifications.unread).toBe(1);
    expect(notifications.items.map((item) => item.notificationId)).toEqual([102]);

    const created = await demo.request("/api/hr/templates", {
      method: "POST",
      body: JSON.stringify({ templateName: "Demo follow-up", subject: "Hello", body: "Fictional", usageType: "IN_PROGRESS" }),
    });
    expect(created.templateId).toBe(206);
    expect((await demo.request("/api/hr/templates")).items).toHaveLength(6);

    await demo.request("/api/hr/profile", {
      method: "PATCH",
      body: JSON.stringify({ fullName: "Riley Demo", phone: "+65 6000 0000", officeLocation: "Preview Room" }),
    });
    expect((await createDemoApi().me()).user).toMatchObject({ fullName: "Riley Demo", officeLocation: "Preview Room" });
  });

  it("filters fictional history and restores the original seed on reset", async () => {
    const demo = createDemoApi();
    const filtered = await demo.request("/api/hr/logs?search=Jordan&trigger=Status%20Updated&page=1&pageSize=10");
    expect(filtered.items).toHaveLength(1);
    expect(filtered.items[0]).toMatchObject({ candidateName: "Jordan Lee", isDemo: true });
    await demo.request("/api/hr/notifications/read-all", { method: "PATCH" });
    demo.reset();
    expect((await demo.request("/api/hr/notifications?page=1&pageSize=8")).unread).toBe(2);
  });
});
