// Icône : cerveau vu de dessus (deux hémisphères) en traits blancs + « CMP »
// au centre, sur fond dégradé bleu turquoise (bas) → bleu plus foncé (haut).
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const pub = join(here, '..', 'public');

const TURQUOISE = '#5FC9C6';
const BLEU = '#3E6DB2';
const BLANC = '#FFFFFF';
const SERIF =
  "'Iowan Old Style','Palatino Linotype',Palatino,Georgia,'Times New Roman',serif";

// Lissage d'une boucle fermée (Catmull-Rom → Bézier).
function smoothClosed(pts) {
  const n = pts.length;
  const p = (i) => pts[((i % n) + n) % n];
  const f = (v) => v.toFixed(1);
  let d = `M${f(p(0)[0])},${f(p(0)[1])}`;
  for (let i = 0; i < n; i += 1) {
    const a = p(i - 1), b = p(i), c = p(i + 1), e = p(i + 2);
    d += ` C${f(b[0] + (c[0] - a[0]) / 6)},${f(b[1] + (c[1] - a[1]) / 6)} ${f(c[0] - (e[0] - b[0]) / 6)},${f(c[1] - (e[1] - b[1]) / 6)} ${f(c[0])},${f(c[1])}`;
  }
  return `${d} Z`;
}

// Demi-contour droit (du sommet central vers le bas), puis miroir pour la symétrie.
const rightHalf = [
  [256, 150],
  [300, 120], [346, 116],
  [394, 128], [426, 158],
  [446, 198],
  [452, 244],
  [438, 290],
  [404, 328],
  [352, 354],
  [300, 368],
  [256, 372],
];
const leftHalf = rightHalf.slice(1, -1).reverse().map(([x, y]) => [512 - x, y]);
const OUTLINE = smoothClosed([...rightHalf, ...leftHalf]);

// Fissure centrale (haut + bas, avec un vide au centre pour CMP) + volutes des hémisphères.
const FOLDS_MID = [
  'M256,152 C248,186 264,210 256,242',
  'M256,336 C250,350 262,360 256,370',
];
const FOLDS_R = [
  'M312,160 C352,170 364,206 330,226',
  'M384,178 C410,198 407,232 378,246',
];
const foldsL = FOLDS_R.map((d) =>
  d.replace(/-?\d+(\.\d+)?,/g, (m) => `${512 - parseFloat(m)},`),
);

const svg = ({ size = 512, scale = 1 } = {}) => {
  const off = (512 * (1 - scale)) / 2;
  const s = 15;
  const inner = `
    <g fill="none" stroke="${BLANC}" stroke-linecap="round" stroke-linejoin="round">
      <path d="${OUTLINE}" stroke-width="${s}"/>
      <g stroke-width="${s * 0.7}" opacity="0.9">
        ${[...FOLDS_MID, ...FOLDS_R, ...foldsL].map((d) => `<path d="${d}"/>`).join('\n        ')}
      </g>
    </g>
    <text x="256" y="292" text-anchor="middle" dominant-baseline="middle"
      font-family="${SERIF}" font-size="98" font-weight="600" letter-spacing="2"
      fill="${BLANC}">CMP</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="${size}" x2="0" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${TURQUOISE}"/>
      <stop offset="1" stop-color="${BLEU}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <g transform="translate(${(off / 512) * size},${(off / 512) * size}) scale(${(size / 512) * scale})">
    ${inner}
  </g>
</svg>`;
};

const png = (svgStr, size) =>
  sharp(Buffer.from(svgStr)).resize(size, size).png().toBuffer();

async function main() {
  await writeFile(join(pub, 'favicon.svg'), svg({ size: 512 }), 'utf8');
  await writeFile(join(pub, 'icon-192.png'), await png(svg({ size: 512 }), 192));
  await writeFile(join(pub, 'icon-512.png'), await png(svg({ size: 512 }), 512));
  await writeFile(
    join(pub, 'icon-maskable-512.png'),
    await png(svg({ size: 512, scale: 0.8 }), 512),
  );
  await writeFile(join(pub, 'apple-touch-icon.png'), await png(svg({ size: 512 }), 180));
  console.log('Icônes générées dans public/.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
