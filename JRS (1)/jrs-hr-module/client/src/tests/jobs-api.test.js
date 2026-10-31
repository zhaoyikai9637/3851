import { expect, it } from "vitest";
import { createJobsClient } from "../../pages/jobs/api";

it("retries an uncertain create with the same request key rather than creating a second job", async () => {
  const records = new Map();
  let interrupted = false;
  const client = createJobsClient(async (url, options = {}) => {
    const json = (body) => ({ ok: true, status: 200, json: async () => body });
    if (url.endsWith("/auth/me")) return json({ csrfToken: "shared-token" });
    if (!options.method) return json({ revision: 0, items: [], templates: [] });
    const key = options.headers["Idempotency-Key"];
    if (!records.has(key)) records.set(key, JSON.parse(options.body));
    if (!interrupted) {
      interrupted = true;
      throw new Error("Connection lost after commit");
    }
    return json({ revision: 1, items: [...records.values()], templates: [] });
  });
  await client.load();
  await expect(client.save({ title: "New job" }, 0)).rejects.toThrow("Unable to reach");
  const saved = await client.save({ title: "New job" }, 0);
  expect(records.size).toBe(1);
  expect(saved.items).toEqual([{ title: "New job" }]);
});
