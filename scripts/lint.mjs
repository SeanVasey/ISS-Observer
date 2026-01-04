import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL('..', import.meta.url));

const ignore = new Set(['node_modules', 'dist', '.git']);

const listFiles = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignore.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path)));
    } else {
      files.push(path);
    }
  }
  return files;
};

const run = async () => {
  const files = await listFiles(root);
  const targets = files.filter((file) => file.endsWith('.js'));

  if (!targets.length) {
    console.log('No JavaScript files to lint.');
    return;
  }

  for (const file of targets) {
    await execFileAsync('node', ['--check', file]);
  }

  console.log(`Linted ${targets.length} JavaScript files.`);
};

run();
