import { createRuntime } from './runtime.mjs';
try {
  const site = await createRuntime();
  const server = site.app.listen(site.settings.port, '127.0.0.1', () => {
    console.log(`JRS ready: ${site.settings.origin}/`);
    console.log(`Shared sign-in: ${site.settings.origin}/pages/login/login.html`);
    console.log(`HR workspace: ${site.settings.origin}/hr/`);
    console.log('Isolated integration database only. Original projects and cloud database are not modified.');
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(async () => { await site.close(); process.exit(0); }));
} catch (error) { console.error('JRS startup stopped:', error.code || error.message); process.exitCode = 1; }
