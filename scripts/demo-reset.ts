import { rm } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export function resolveSafeDemoDataDir(repoRoot: string, dataDir: string): string {
  const root = resolve(repoRoot);
  const candidate = resolve(root, dataDir);
  const relativePath = relative(root, candidate);
  const allowed = relativePath === '.data' || relativePath.startsWith(`.data${sep}`);
  if (!allowed) {
    throw new Error('Demo reset may remove only paths inside .data.');
  }
  return candidate;
}

export async function resetDemoData(repoRoot: string, dataDir: string): Promise<string> {
  const safePath = resolveSafeDemoDataDir(repoRoot, dataDir);
  await rm(safePath, { recursive: true, force: true });
  return safePath;
}

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const dataDir = process.env.VERIREMIT_DATA_DIR ?? '.data';
  const removed = await resetDemoData(repoRoot, dataDir);
  console.log(`Reset local demo state: ${relative(repoRoot, removed) || '.data'}`);
}

const entryPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (entryPath === import.meta.url) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Demo reset failed.');
    process.exitCode = 1;
  });
}
