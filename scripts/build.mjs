import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const copyTargets = ['index.html', 'src', 'public'];

for (const target of copyTargets) {
  const source = join(root, target);
  try {
    await cp(source, join(dist, target), { recursive: true });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

console.log('Build complete: dist/');
