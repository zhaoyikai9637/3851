import { createRuntime } from './runtime.mjs';
try {
  const site = await createRuntime();
  const server = site.app.listen(site.settings.port, site.settings.host, () => {
    console.log(`JRS ready: ${site.settings.origin}/`);
    console.log(`Shared sign-in: ${site.settings.origin}/pages/login/login.html`);
    console.log(`HR workspace: ${site.settings.origin}/hr/`);
    console.log(['team','production'].includes(site.settings.DB_MODE) ? 'Connected to the configured cloud database with verified TLS.' : 'Connected to the isolated local integration database.');
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(async () => { await site.close(); process.exit(0); }));
} catch (error) { console.error('JRS startup stopped:', error.code || error.message); process.exitCode = 1; }
