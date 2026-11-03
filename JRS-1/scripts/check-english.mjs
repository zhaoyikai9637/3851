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

function checkSourceDirectory(directory) {
  const entries = [];
  const excluded = new Set(['.git', '.local', 'node_modules', 'uploads', 'reference', 'work', 'coverage', 'test-results']);
  function walk(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if (excluded.has(entry.name) || entry.isSymbolicLink()) continue;
      const filename = path.join(folder, entry.name);
      const relative = path.relative(directory, filename).split(path.sep).join('/');
      if (entry.isDirectory()) {
        if (entry.name === 'dist' && !['JRS HR/dist', 'JRS Login and profile/integrations/hr/dist'].includes(relative)) continue;
        walk(filename);
      } else if (entry.isFile()) {
        if ((/(^\.env|\.env(?:\.|$))/.test(entry.name) && !entry.name.endsWith('.example')) || /\.(log|sqlite|db)$/.test(entry.name)) continue;
        entries.push({ path: relative, content: fs.readFileSync(filename) });
      }
    }
  }
  walk(directory);
  return { files: entries.length, issues: findLanguageIssues(entries) };
}

export function checkRepository(ref, { cwd = process.cwd() } = {}) {
  let repo;
  try { repo = execFileSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], { stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').trim(); }
  catch {
    if (ref) throw new Error('Git history is required to check a specific ref.');
    return checkSourceDirectory(cwd);
  }
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
  if (!result.files) console.error('No source files were found.');
  process.exitCode = result.issues.length || !result.files ? 1 : 0;
}
