// Génère l'icône : cerveau en traits blancs + « CMP » à l'intérieur,
// sur un fond dégradé bleu turquoise (bas) → bleu plus foncé (haut).
// Produit le SVG source (public/favicon.svg) puis les PNG via sharp.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const pub = join(here, '..', 'public');

const TURQUOISE = '#5FC9C6'; // bas
const BLEU = '#3E6DB2'; // haut
const BLANC = '#FFFFFF';
const SERIF =
  "'Iowan Old Style','Palatino Linotype',Palatino,Georgia,'Times New Roman',serif";

// Contour du cerveau (bosses arrondies + creux au sommet), calculé une fois.
function brainOutline(cx, cy, rx, ry, amp) {
  const bumps = 8;
  const steps = 240;
  const pts = [];
  for (let i = 0; i < steps; i += 1) {
    const t = (i / steps) * Math.PI * 2;
    let wob = amp * Math.sin(bumps * t) + amp * 0.4 * Math.sin(3 * t + 1.2);
    const dTop = Math.min(t, Math.PI * 2 - t);
    wob -= amp * 2.4 * Math.exp(-(dTop * dTop) / 0.05); // creux central au sommet
    const dBot = Math.abs(t - Math.PI);
    wob -= amp * Math.exp(-(dBot * dBot) / 0.06); // encoche du cervelet
    const xScale = 1 - 0.12 * ((1 - Math.cos(t)) / 2);
    pts.push([
      cx + Math.sin(t) * (rx + wob) * xScale,
      cy - Math.cos(t) * (ry + wob),
    ]);
  }
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const f = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  let d = `M${f(mid(pts[pts.length - 1], pts[0]))}`;
  for (let i = 0; i < pts.length; i += 1) {
    d += ` Q${f(pts[i])} ${f(mid(pts[i], pts[(i + 1) % pts.length]))}`;
  }
  return `${d} Z`;
}

// `scale` réduit le motif (cerveau + texte) pour la version maskable.
const svg = ({ size = 512, scale = 1 } = {}) => {
  const cx = size / 2;
  const cy = size / 2;
  const rx = size * 0.4 * scale;
  const ry = size * 0.36 * scale;
  const amp = size * 0.032 * scale;
  const stroke = Math.max(2, size * 0.02 * scale);
  const outline = brainOutline(cx, cy, rx, ry, amp);
  const fs = Math.round(size * 0.2 * scale);
  // Plis internes (haut du cerveau), pour rester lisible même petit.
  const foldY = cy - ry * 0.55;
  const folds = [
    `M${cx},${cy - ry * 0.85} C${cx - rx * 0.05},${foldY} ${cx + rx * 0.05},${foldY} ${cx},${cy - ry * 0.2}`,
    `M${cx - rx * 0.5},${cy - ry * 0.45} q${rx * 0.12},${ry * 0.18} 0,${ry * 0.34}`,
    `M${cx + rx * 0.5},${cy - ry * 0.45} q${-rx * 0.12},${ry * 0.18} 0,${ry * 0.34}`,
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="${size}" x2="0" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${TURQUOISE}"/>
      <stop offset="1" stop-color="${BLEU}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <g fill="none" stroke="${BLANC}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" opacity="0.9">
    ${folds.map((d) => `<path d="${d}"/>`).join('\n    ')}
  </g>
  <path d="${outline}" fill="none" stroke="${BLANC}" stroke-width="${stroke * 1.15}" stroke-linejoin="round"/>
  <text x="50%" y="${cy + ry * 0.28}" text-anchor="middle" dominant-baseline="middle"
    font-family="${SERIF}" font-size="${fs}" font-weight="600" letter-spacing="${size * 0.006}"
    fill="${BLANC}">CMP</text>
</svg>`;
};

const png = (svgStr, size) =>
  sharp(Buffer.from(svgStr)).resize(size, size).png().toBuffer();

async function main() {
  const source = svg({ size: 512, scale: 1 });
  await writeFile(join(pub, 'favicon.svg'), source, 'utf8');
  await writeFile(join(pub, 'icon-192.png'), await png(svg({ size: 512 }), 192));
  await writeFile(join(pub, 'icon-512.png'), await png(svg({ size: 512 }), 512));
  // Maskable : motif réduit pour rester dans la zone de sécurité (~80 %).
  await writeFile(
    join(pub, 'icon-maskable-512.png'),
    await png(svg({ size: 512, scale: 0.78 }), 512),
  );
  await writeFile(join(pub, 'apple-touch-icon.png'), await png(svg({ size: 512 }), 180));
  console.log('Icônes générées dans public/.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
