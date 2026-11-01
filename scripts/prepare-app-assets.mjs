import { readFile, writeFile } from 'node:fs/promises';

const sizes = [48, 72, 96, 128, 192, 256, 512];
const manifest = {
  id: '/',
  name: 'Hermes',
  short_name: 'Hermes',
  description: 'The Bridge Between Languages and Stories',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#111315',
  theme_color: '#111315',
  icons: sizes.map(size => ({
    src: `assets/icons/icon-${size}.webp`,
    type: 'image/webp',
    sizes: `${size}x${size}`,
    purpose: 'any',
  })),
};

await writeFile(new URL('../public/manifest.webmanifest', import.meta.url), `${JSON.stringify(manifest, null, 2)}\n`);

for (const file of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
  const path = new URL(`../android/app/src/main/res/mipmap-anydpi-v26/${file}`, import.meta.url);
  const xml = await readFile(path, 'utf8');
  const expanded = xml.replaceAll('android:inset="16.7%"', 'android:inset="0%"');
  if (expanded === xml && !xml.includes('android:inset="0%"')) {
    throw new Error(`Không nhận diện được tỉ lệ adaptive icon trong ${file}.`);
  }
  await writeFile(path, expanded);
}
