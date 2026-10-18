// npm start: build if needed, then serve and open the browser.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (!existsSync(path.join(root, 'dist', 'index.html'))) {
  const build = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const serve = spawnSync('node', [path.join(root, 'bin', 'lectrical-billboard.mjs')], {
  cwd: root,
  stdio: 'inherit',
});
process.exit(serve.status ?? 0);
