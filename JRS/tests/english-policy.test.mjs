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
    assert.ok(result.files > 300, 'The package command must inspect the repository instead of passing an empty scan');
  } finally { process.chdir(previous); }
});
