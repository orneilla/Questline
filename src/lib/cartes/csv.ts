/**
 * CSV pour l'aller-retour avec Anki.
 *
 * Le format suivi est celui de la RFC 4180 : séparateur virgule, guillemets
 * doublés, champs multilignes entre guillemets. C'est ce qu'Anki accepte quand
 * on lui indique la virgule comme séparateur, et ce qu'un tableur ouvre sans
 * réglage. Rien ici ne dépend d'une bibliothèque : le format est trop simple
 * pour en mériter une, et trop important pour dépendre de la sienne.
 */

export type LigneCsv = string[];

function echapper(valeur: string): string {
  const propre = valeur.replace(/\r\n/g, "\n");
  return /[",\n]/.test(propre) ? `"${propre.replaceAll('"', '""')}"` : propre;
}

export function versCsv(lignes: LigneCsv[]): string {
  return lignes.map((ligne) => ligne.map(echapper).join(",")).join("\r\n");
}

/**
 * Lit un CSV. Tolérant par choix : un fichier exporté d'ailleurs a souvent des
 * fins de ligne mélangées et un point-virgule pour séparateur.
 */
export function depuisCsv(texte: string): LigneCsv[] {
  const separateur = deviner(texte);
  const lignes: LigneCsv[] = [];

  let champ = "";
  let ligne: string[] = [];
  let dansGuillemets = false;

  const contenu = texte.replace(/^﻿/, "");

  for (let i = 0; i < contenu.length; i += 1) {
    const caractere = contenu[i];

    if (dansGuillemets) {
      if (caractere === '"') {
        if (contenu[i + 1] === '"') {
          champ += '"';
          i += 1;
        } else {
          dansGuillemets = false;
        }
      } else {
        champ += caractere;
      }
      continue;
    }

    if (caractere === '"' && champ === "") {
      dansGuillemets = true;
    } else if (caractere === separateur) {
      ligne.push(champ);
      champ = "";
    } else if (caractere === "\n" || caractere === "\r") {
      if (caractere === "\r" && contenu[i + 1] === "\n") i += 1;
      ligne.push(champ);
      champ = "";
      if (ligne.some((c) => c.trim() !== "")) lignes.push(ligne);
      ligne = [];
    } else {
      champ += caractere;
    }
  }

  ligne.push(champ);
  if (ligne.some((c) => c.trim() !== "")) lignes.push(ligne);

  return lignes;
}

/** Le séparateur le plus fréquent hors guillemets sur les premières lignes. */
function deviner(texte: string): string {
  const debut = texte.slice(0, 4_000);
  const compter = (caractere: string) =>
    debut.split("").filter((c) => c === caractere).length;

  const virgules = compter(",");
  const pointsVirgules = compter(";");
  const tabulations = compter("\t");

  if (tabulations >= virgules && tabulations >= pointsVirgules && tabulations > 0) {
    return "\t";
  }
  return pointsVirgules > virgules ? ";" : ",";
}

/**
 * Reconnaît les colonnes d'un fichier importé. Anki exporte sans en-tête ;
 * un tableur en met presque toujours un.
 */
export function lireCartesCsv(
  texte: string,
): { recto: string; verso: string; tags: string[] }[] {
  const lignes = depuisCsv(texte);
  if (lignes.length === 0) return [];

  const premiere = lignes[0].map((c) => c.trim().toLowerCase());
  const entetes = ["recto", "verso", "question", "réponse", "reponse", "front", "back"];
  const avecEntete = premiere.some((c) => entetes.includes(c));

  const indice = (noms: string[], defaut: number): number => {
    if (!avecEntete) return defaut;
    const trouve = premiere.findIndex((c) => noms.includes(c));
    return trouve === -1 ? defaut : trouve;
  };

  const iRecto = indice(["recto", "question", "front"], 0);
  const iVerso = indice(["verso", "réponse", "reponse", "back"], 1);
  const iTags = indice(["tags", "étiquettes", "etiquettes"], 2);

  return lignes
    .slice(avecEntete ? 1 : 0)
    .map((ligne) => ({
      recto: (ligne[iRecto] ?? "").trim(),
      verso: (ligne[iVerso] ?? "").trim(),
      tags: (ligne[iTags] ?? "")
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter(Boolean),
    }))
    .filter((l) => l.recto !== "");
}
