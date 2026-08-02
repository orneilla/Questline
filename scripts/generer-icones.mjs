/**
 * Génère les icônes PWA sans dépendance externe.
 *
 * Le motif : trois points qui montent le long d'une ligne — un fil de quêtes
 * qui progresse. Rendu en supersampling 3×3 pour un anticrénelage propre.
 *
 *   node scripts/generer-icones.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const SORTIE = join(RACINE, "public", "icones");

const FOND = [0x0a, 0x0b, 0x0d];
const LIGNE = [0x33, 0x39, 0x42];
const POINT = [0xec, 0xe9, 0xe3];

const A = { x: 0.27, y: 0.75 };
const B = { x: 0.73, y: 0.25 };
const EPAISSEUR = 0.021;
const POINTS = [
  { t: 0, r: 0.052, a: 0.5 },
  { t: 0.5, r: 0.072, a: 0.78 },
  { t: 1, r: 0.094, a: 1 },
];

const SUPER = 3;

function distanceCapsule(px, py, a, b, demiEpaisseur) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const longueur2 = dx * dx + dy * dy;
  let t = ((px - a.x) * dx + (py - a.y) * dy) / longueur2;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * dx;
  const cy = a.y + t * dy;
  return Math.hypot(px - cx, py - cy) - demiEpaisseur;
}

function couverture(distance, lissage) {
  return Math.max(0, Math.min(1, 0.5 - distance / lissage));
}

function composer(fond, couleur, alpha) {
  return [
    fond[0] * (1 - alpha) + couleur[0] * alpha,
    fond[1] * (1 - alpha) + couleur[1] * alpha,
    fond[2] * (1 - alpha) + couleur[2] * alpha,
  ];
}

/** @param {number} taille @param {number} echelle facteur du motif (zone de sécurité maskable) */
function rendre(taille, echelle) {
  const pixels = Buffer.alloc(taille * taille * 4);
  const lissage = 1.5 / taille;

  const recentrer = (p) => ({
    x: 0.5 + (p.x - 0.5) * echelle,
    y: 0.5 + (p.y - 0.5) * echelle,
  });
  const a = recentrer(A);
  const b = recentrer(B);

  for (let y = 0; y < taille; y += 1) {
    for (let x = 0; x < taille; x += 1) {
      let r = 0;
      let g = 0;
      let bl = 0;

      for (let sy = 0; sy < SUPER; sy += 1) {
        for (let sx = 0; sx < SUPER; sx += 1) {
          const px = (x + (sx + 0.5) / SUPER) / taille;
          const py = (y + (sy + 0.5) / SUPER) / taille;

          let couleur = FOND;
          couleur = composer(
            couleur,
            LIGNE,
            couverture(
              distanceCapsule(px, py, a, b, (EPAISSEUR * echelle) / 2),
              lissage,
            ),
          );

          for (const point of POINTS) {
            const cx = a.x + (b.x - a.x) * point.t;
            const cy = a.y + (b.y - a.y) * point.t;
            const d = Math.hypot(px - cx, py - cy) - point.r * echelle;
            couleur = composer(couleur, POINT, couverture(d, lissage) * point.a);
          }

          r += couleur[0];
          g += couleur[1];
          bl += couleur[2];
        }
      }

      const n = SUPER * SUPER;
      const i = (y * taille + x) * 4;
      pixels[i] = Math.round(r / n);
      pixels[i + 1] = Math.round(g / n);
      pixels[i + 2] = Math.round(bl / n);
      pixels[i + 3] = 255;
    }
  }

  return pixels;
}

const TABLE_CRC = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const octet of buffer) c = TABLE_CRC[(c ^ octet) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function morceau(type, donnees) {
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(donnees.length);
  const corps = Buffer.concat([Buffer.from(type, "ascii"), donnees]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corps));
  return Buffer.concat([longueur, corps, crc]);
}

function encoderPng(taille, pixels) {
  const brut = Buffer.alloc(taille * (taille * 4 + 1));
  for (let y = 0; y < taille; y += 1) {
    brut[y * (taille * 4 + 1)] = 0; // filtre « none »
    pixels.copy(brut, y * (taille * 4 + 1) + 1, y * taille * 4, (y + 1) * taille * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(taille, 0);
  ihdr.writeUInt32BE(taille, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    morceau("IHDR", ihdr),
    morceau("IDAT", deflateSync(brut, { level: 9 })),
    morceau("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(SORTIE, { recursive: true });

const ICONES = [
  { nom: "icone-192.png", taille: 192, echelle: 1 },
  { nom: "icone-512.png", taille: 512, echelle: 1 },
  { nom: "icone-180.png", taille: 180, echelle: 1 },
  { nom: "icone-maskable-512.png", taille: 512, echelle: 0.62 },
];

for (const { nom, taille, echelle } of ICONES) {
  writeFileSync(join(SORTIE, nom), encoderPng(taille, rendre(taille, echelle)));
  console.log(`✓ ${nom} (${taille}×${taille})`);
}
