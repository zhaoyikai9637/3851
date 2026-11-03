import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const policy = await import('../scripts/check-english.mjs').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});

test('English-only policy rejects Han text and full-width punctuation in filenames and text', () => {
  assert.equal(typeof policy.findLanguageIssues, 'function', 'English-only repository check is missing');
  assert.deepEqual(policy.findLanguageIssues([
    { path: 'client/\u767b\u5f55.js', content: Buffer.from('export {};') },
    { path: 'README.md', content: Buffer.from('Title: \u6d4b\u8bd5') },
    { path: 'client/example.js', content: Buffer.from('const value = "\uFF0C";') },
  ]), [
    { path: 'client/\u767b\u5f55.js', kind: 'filename' },
    { path: 'README.md', kind: 'text' },
    { path: 'client/example.js', kind: 'text' },
  ]);
});

test('English-only check accepts English, Unicode escapes and non-text assets', () => {
  assert.equal(typeof policy.findLanguageIssues, 'function', 'English-only repository check is missing');
  assert.deepEqual(policy.findLanguageIssues([
    { path: 'README.md', content: Buffer.from('JRS recruitment workspace') },
    { path: 'example.js', content: Buffer.from('const separator = "\\uFF0C";') },
    { path: 'asset.bin', content: Buffer.from([0, 255, 12]) },
  ]), []);
});

test('repository scanning from the package subdirectory cannot silently inspect zero files', () => {
  const previous = process.cwd();
  try {
    process.chdir(fileURLToPath(new URL('../', import.meta.url)));
    const result = policy.checkRepository();
    assert.ok(result.files > 0, 'The package command must inspect the repository instead of passing an empty scan');
  } finally { process.chdir(previous); }
});

test('a downloaded source archive scans source without Git and omits private or generated data', async () => {
  const fs = await import('node:fs/promises'), os = await import('node:os'), path = await import('node:path');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'jrs-english-archive-'));
  try {
    await fs.mkdir(path.join(directory, 'src'));
    await fs.writeFile(path.join(directory, 'README.md'), 'Source review guide');
    await fs.writeFile(path.join(directory, 'src/app.js'), 'export {};');
    await fs.writeFile(path.join(directory, '.env.example'), 'DB_PASSWORD=replace-me');
    await fs.writeFile(path.join(directory, '.env'), '\u79c1\u6709');
    for (const folder of ['node_modules', '.local', 'uploads', 'test-results']) {
      await fs.mkdir(path.join(directory, folder));
      await fs.writeFile(path.join(directory, folder, 'ignored.txt'), '\u79c1\u6709');
    }
    assert.deepEqual(policy.checkRepository(undefined, { cwd: directory }), { files: 3, issues: [] });
    await fs.writeFile(path.join(directory, 'src/app.js'), '\u6d4b\u8bd5');
    assert.deepEqual(policy.checkRepository(undefined, { cwd: directory }).issues, [{ path: 'src/app.js', kind: 'text' }]);
  } finally {
    assert.equal(path.dirname(directory), os.tmpdir());
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('source archives cannot silently substitute their working tree for a requested Git ref', () => {
  assert.throws(() => policy.checkRepository('HEAD', { cwd: fileURLToPath(new URL('./missing-git-fixture/', import.meta.url)) }), /Git history is required/);
});
