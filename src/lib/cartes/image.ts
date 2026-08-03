/**
 * Compression des images, dans le navigateur.
 *
 * Ce travail est fait avant l'envoi, pas après : une base Neon gratuite n'a
 * pas de place pour des captures d'écran brutes, et l'envoi depuis une tablette
 * en 4G n'a pas de temps pour elles non plus.
 *
 * Deux traitements, choisis d'après l'image elle-même :
 *
 * — un schéma au trait (export ChemDraw, formule, figure) reste en PNG, seul
 *   format qui garde la transparence et les arêtes nettes. Quand le tracé est
 *   gris ou noir, on ramène toutes les couleurs au noir en conservant l'alpha :
 *   l'antialiasing est intact, le dessin identique, et le PNG bien plus léger
 *   parce qu'il n'a plus qu'un canal utile à coder ;
 * — une photographie passe en WebP, dont la qualité descend par paliers
 *   jusqu'à tenir dans le poids visé.
 */

export type ImageCompressee = {
  base64: string;
  typeMime: "image/png" | "image/webp";
  largeur: number;
  hauteur: number;
  octets: number;
  /** Ce que la conversion a décidé, pour pouvoir le dire à l'écran. */
  nature: "trait" | "photo";
};

/** Au-delà, une image est redimensionnée : c'est déjà large pour une carte. */
export const COTE_MAX = 1200;

/** Poids recherché. Au-dessus, on insiste ; c'est un objectif, pas un mur. */
export const POIDS_VISE = 150 * 1024;

/** Poids refusé. Celui-là est un mur. */
export const POIDS_MAX = 400 * 1024;

export class ImageRefusee extends Error {}

function contexte(largeur: number, hauteur: number): {
  toile: HTMLCanvasElement;
  pinceau: CanvasRenderingContext2D;
} {
  const toile = document.createElement("canvas");
  toile.width = largeur;
  toile.height = hauteur;
  const pinceau = toile.getContext("2d", { willReadFrequently: true });
  if (!pinceau) throw new ImageRefusee("Ce navigateur ne sait pas retailler l'image.");
  return { toile, pinceau };
}

function encoder(
  toile: HTMLCanvasElement,
  typeMime: string,
  qualite?: number,
): Promise<Blob> {
  return new Promise((resoudre, rejeter) => {
    toile.toBlob(
      (blob) =>
        blob ? resoudre(blob) : rejeter(new ImageRefusee("L'encodage a échoué.")),
      typeMime,
      qualite,
    );
  });
}

async function versBase64(blob: Blob): Promise<string> {
  const lecteur = new FileReader();
  const url = await new Promise<string>((resoudre, rejeter) => {
    lecteur.onload = () => resoudre(String(lecteur.result));
    lecteur.onerror = () => rejeter(new ImageRefusee("Lecture impossible."));
    lecteur.readAsDataURL(blob);
  });
  return url.slice(url.indexOf(",") + 1);
}

async function charger(source: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(source);
    } catch {
      // Safari refuse certains SVG et TIFF : on retombe sur <img>.
    }
  }

  const url = URL.createObjectURL(source);
  try {
    return await new Promise<HTMLImageElement>((resoudre, rejeter) => {
      const image = new Image();
      image.onload = () => resoudre(image);
      image.onerror = () => rejeter(new ImageRefusee("Image illisible."));
      image.src = url;
    });
  } finally {
    // L'image est déjà décodée ; l'URL peut partir.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/**
 * Reconnaît un schéma au trait : peu de couleurs, ou de la transparence, ou
 * une image essentiellement claire avec un tracé sombre.
 */
function analyser(pixels: Uint8ClampedArray): {
  trait: boolean;
  monochrome: boolean;
} {
  const teintes = new Set<number>();
  let transparents = 0;
  let colores = 0;
  let examines = 0;

  // Un pixel sur seize suffit à juger, et reste rapide sur une grande image.
  const pas = 4 * 16;
  for (let i = 0; i < pixels.length; i += pas) {
    const r = pixels[i];
    const v = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];
    examines += 1;

    if (a < 16) {
      transparents += 1;
      continue;
    }
    if (Math.max(r, v, b) - Math.min(r, v, b) > 24) colores += 1;
    if (teintes.size < 600) teintes.add((r >> 3) * 1024 + (v >> 3) * 32 + (b >> 3));
  }

  if (examines === 0) return { trait: false, monochrome: false };

  const partTransparente = transparents / examines;
  const partColoree = colores / Math.max(1, examines - transparents);
  const trait = partTransparente > 0.15 || teintes.size < 48;

  return { trait, monochrome: trait && partColoree < 0.04 };
}

/** Ramène le tracé au noir pur en gardant l'alpha : même dessin, PNG plus léger. */
function aplatirEnNoir(pixels: Uint8ClampedArray): void {
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 0;
    pixels[i + 1] = 0;
    pixels[i + 2] = 0;
  }
}

export async function compresser(source: Blob): Promise<ImageCompressee> {
  const image = await charger(source);
  const largeurSource = "width" in image ? image.width : 0;
  const hauteurSource = "height" in image ? image.height : 0;

  if (!largeurSource || !hauteurSource) {
    throw new ImageRefusee("Image sans dimensions lisibles.");
  }

  const facteur = Math.min(1, COTE_MAX / Math.max(largeurSource, hauteurSource));
  const largeur = Math.max(1, Math.round(largeurSource * facteur));
  const hauteur = Math.max(1, Math.round(hauteurSource * facteur));

  const { toile, pinceau } = contexte(largeur, hauteur);
  pinceau.imageSmoothingQuality = "high";
  pinceau.drawImage(image as CanvasImageSource, 0, 0, largeur, hauteur);

  const donnees = pinceau.getImageData(0, 0, largeur, hauteur);
  const { trait, monochrome } = analyser(donnees.data);

  if (monochrome) {
    aplatirEnNoir(donnees.data);
    pinceau.putImageData(donnees, 0, 0);
  }

  const candidats: { blob: Blob; typeMime: "image/png" | "image/webp" }[] = [];

  if (trait) {
    candidats.push({ blob: await encoder(toile, "image/png"), typeMime: "image/png" });
    // Le WebP sans perte bat souvent le PNG sur un aplat de trait ; on garde
    // le plus léger des deux, à condition qu'il conserve la transparence.
    const sansPerte = await encoder(toile, "image/webp", 1);
    if (sansPerte.type === "image/webp") {
      candidats.push({ blob: sansPerte, typeMime: "image/webp" });
    }
  } else {
    for (const qualite of [0.82, 0.7, 0.6, 0.5, 0.42]) {
      const essai = await encoder(toile, "image/webp", qualite);
      candidats.push({
        blob: essai,
        typeMime: essai.type === "image/webp" ? "image/webp" : "image/png",
      });
      if (essai.size <= POIDS_VISE) break;
    }
  }

  const retenu = candidats.reduce((meilleur, candidat) =>
    candidat.blob.size < meilleur.blob.size ? candidat : meilleur,
  );

  if (retenu.blob.size > POIDS_MAX) {
    throw new ImageRefusee(
      `Image trop lourde même après compression : ${formaterPoids(retenu.blob.size)}. ` +
        `La limite est de ${formaterPoids(POIDS_MAX)}. Recadre-la ou réduis-la avant.`,
    );
  }

  return {
    base64: await versBase64(retenu.blob),
    typeMime: retenu.typeMime,
    largeur,
    hauteur,
    octets: retenu.blob.size,
    nature: trait ? "trait" : "photo",
  };
}

export function formaterPoids(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}
