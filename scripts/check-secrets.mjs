import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const PATTERNS = [
  { type: 'openai-project-key', regex: /sk-proj-[A-Za-z0-9_-]{24,}/g },
  { type: 'github-fine-grained-token', regex: /github_pat_[A-Za-z0-9_]{30,}/g },
  { type: 'cloudflare-api-token', regex: /cfut_[A-Za-z0-9_-]{24,}/g },
];

export function scanTextForSecrets(text) {
  const findings = [];
  for (const pattern of PATTERNS) {
    pattern.regex.lastIndex = 0;
    for (const match of text.matchAll(pattern.regex)) {
      const before = text.slice(0, match.index ?? 0);
      findings.push({
        type: pattern.type,
        line: before.split('\n').length,
      });
    }
  }
  return findings.sort((a, b) => a.line - b.line || a.type.localeCompare(b.type));
}

function trackedFiles(root) {
  const result = spawnSync('git', ['-C', root, 'ls-files', '-z'], {
    encoding: 'buffer',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error('Could not enumerate tracked files for secret scanning.');
  }
  return result.stdout.toString('utf8').split('\0').filter(Boolean);
}

export function scanTrackedFiles(root = process.cwd()) {
  const findings = [];
  for (const file of trackedFiles(root)) {
    let bytes;
    try {
      bytes = readFileSync(`${root}/${file}`);
    } catch {
      continue;
    }
    if (bytes.includes(0)) continue;
    const text = bytes.toString('utf8');
    for (const finding of scanTextForSecrets(text)) {
      findings.push({ file, ...finding });
    }
  }
  return findings;
}

function runCli() {
  const findings = scanTrackedFiles(process.cwd());
  if (findings.length === 0) {
    console.log('Secret scan clean.');
    return;
  }
  for (const finding of findings) {
    console.error(`Potential ${finding.type} at ${finding.file}:${finding.line}`);
  }
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
