import { createApp } from "./app.js";

const port = Number(process.env.PORT || 3001);
const { app, data } = await createApp();

const server = app.listen(port, "127.0.0.1", () => {
  console.log("JRS API running at http://127.0.0.1:" + port + " (" + data.mode + " database mode)");
});

async function shutdown() {
  server.close(async () => {
    await data.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
