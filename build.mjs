import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const files = [
  'index.html', 'railway.css', 'launch.js', 'railway.js', 'world.js', 'mint-sea.js', 'cabin.js', 'app-install.js', 'manifest.webmanifest',
  'icons/journey-192.png', 'icons/journey-512.png', 'icons/journey-maskable-512.png', 'icons/journey-apple-180.png'
];
const hash = createHash('sha256');
for (const file of [...files, 'sw.js']) {
  hash.update(file);
  hash.update(await readFile(path.join(root, file)));
}
const version = hash.digest('hex').slice(0, 16);
const output = path.resolve(root, 'dist');
if (path.dirname(output) !== root) throw new Error('Build output must stay inside the project.');
await rm(output, { recursive: true, force: true });
for (const file of files) {
  const target = path.join(root, 'dist', file);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(root, file), target);
}
const worker = (await readFile(path.join(root, 'sw.js'), 'utf8')).replace('__ASSET_VERSION__', version);
await writeFile(path.join(root, 'dist', 'sw.js'), worker, 'utf8');
console.log('Built offline railway ' + version);
