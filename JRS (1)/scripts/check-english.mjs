import fs from 'node:fs';
import path from 'node:path';
import { isUtf8 } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const disallowed = /[\p{Script=Han}\u3000-\u303f\uff01-\uff60]/u;

export function findLanguageIssues(entries) {
  const issues = [];
  for (const { path: filename, content } of entries) {
    if (disallowed.test(filename)) issues.push({ path: filename, kind: 'filename' });
    if (!content.includes(0) && isUtf8(content) && disallowed.test(content.toString('utf8'))) {
      issues.push({ path: filename, kind: 'text' });
    }
  }
  return issues;
}

export function checkRepository(ref) {
  const repo = execFileSync('git', ['rev-parse', '--show-toplevel']).toString('utf8').trim();
  const git = args => execFileSync('git', ['-C', repo, ...args], { maxBuffer: 32 * 1024 * 1024 });
  const filenames = git(ref ? ['ls-tree', '-rz', '--name-only', ref] : ['ls-files', '-z', '--cached', '--others', '--exclude-standard']).toString('utf8').split('\0').filter(Boolean);
  const entries = filenames.flatMap(filename => {
    if (!ref && !fs.existsSync(path.join(repo, filename))) return [];
    return [{ path: filename, content: ref ? git(['show', `${ref}:${filename}`]) : fs.readFileSync(path.join(repo, filename)) }];
  });
  return { files: entries.length, issues: findLanguageIssues(entries) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ref = process.argv.find(value => value.startsWith('--ref='))?.slice(6);
  const result = checkRepository(ref);
  for (const issue of result.issues) console.error(`${issue.kind}: ${issue.path}`);
  console.log(`${ref || 'Working tree'}: ${result.files} files checked; ${result.issues.length} language issues.`);
  process.exitCode = result.issues.length ? 1 : 0;
}
