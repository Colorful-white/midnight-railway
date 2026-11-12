import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const files = [
  'index.html', 'railway.css', 'railway.js', 'world.js', 'app-install.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
  'assets/cabin/bellflowers.png', 'assets/cabin/book-and-tea.png'
];
const hash = createHash('sha256');
for (const file of [...files, 'sw.js']) {
  hash.update(file);
  hash.update(await readFile(path.join(root, file)));
}
const version = hash.digest('hex').slice(0, 16);
for (const file of files) {
  const target = path.join(root, 'dist', file);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(root, file), target);
}
const worker = (await readFile(path.join(root, 'sw.js'), 'utf8')).replace('__ASSET_VERSION__', version);
await writeFile(path.join(root, 'dist', 'sw.js'), worker, 'utf8');
console.log('Built offline railway ' + version);
