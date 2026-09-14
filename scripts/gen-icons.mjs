// Génère l'icône : monogramme CMP en sérif crème sur fond vert profond.
// Produit le SVG source (public/favicon.svg) puis les PNG via sharp.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const pub = join(here, '..', 'public');

const GREEN = '#2A5D4E';
const CREAM = '#F2EFE6';
const SERIF =
  "'Iowan Old Style','Palatino Linotype',Palatino,Georgia,'Times New Roman',serif";

// fontScale : proportion de la largeur occupée par le monogramme.
// Plus petit pour la version maskable (zone de sécurité de ~80 %).
const svg = ({ size = 512, fontScale = 0.42, rounded = false } = {}) => {
  const r = rounded ? size * 0.18 : 0;
  const fs = Math.round(size * fontScale);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${GREEN}"/>
  <text x="50%" y="50%" dy="0.02em" text-anchor="middle" dominant-baseline="central"
    font-family="${SERIF}" font-size="${fs}" font-weight="500"
    letter-spacing="${Math.round(size * 0.01)}" fill="${CREAM}">CMP</text>
</svg>`;
};

const png = (svgStr, size) =>
  sharp(Buffer.from(svgStr)).resize(size, size).png().toBuffer();

async function main() {
  const source = svg({ size: 512, fontScale: 0.42 });
  await writeFile(join(pub, 'favicon.svg'), source, 'utf8');

  await writeFile(join(pub, 'icon-192.png'), await png(svg({ fontScale: 0.42 }), 192));
  await writeFile(join(pub, 'icon-512.png'), await png(svg({ fontScale: 0.42 }), 512));
  // Maskable : monogramme plus petit pour rester dans la zone de sécurité.
  await writeFile(
    join(pub, 'icon-maskable-512.png'),
    await png(svg({ fontScale: 0.32 }), 512),
  );
  // Icône iOS (coins gérés par le système, fond plein).
  await writeFile(
    join(pub, 'apple-touch-icon.png'),
    await png(svg({ fontScale: 0.4 }), 180),
  );

  console.log('Icônes générées dans public/.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
