import { noterCarte, terminerSession } from "@/app/(app)/cartes/actions";

/**
 * File d'écriture des notations.
 *
 * L'écran ne doit jamais attendre le réseau : la carte suivante s'affiche
 * aussitôt et la notation part derrière. En cas d'échec — réseau coupé, base
 * indisponible — l'entrée reste en file et sera rejouée, soit au prochain
 * envoi, soit au retour de la connexion. Une session déjà chargée reste donc
 * pleinement utilisable hors ligne.
 */

export type EntreeEcriture = {
  carteId: number;
  note: 1 | 2 | 3 | 4;
  dureeMs: number;
};

const ATTENTE_MAX_MS = 30_000;

export class FileEcriture {
  private attente: EntreeEcriture[] = [];
  private enCours = false;
  private echecs = 0;
  private minuteur: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => void this.vider());
    }
  }

  ajouter(entree: EntreeEcriture): void {
    this.attente.push(entree);
    void this.vider();
  }

  get enAttente(): number {
    return this.attente.length;
  }

  /** Envoie tout ce qui reste, en préservant l'ordre. */
  async vider(): Promise<void> {
    if (this.enCours) return;
    this.enCours = true;

    try {
      while (this.attente.length > 0) {
        const entree = this.attente[0];
        try {
          await noterCarte(entree.carteId, entree.note, entree.dureeMs);
          this.attente.shift();
          this.echecs = 0;
        } catch (erreur) {
          console.warn("[file-ecriture] echec", erreur);
          // On garde l'entrée et on réessaie plus tard, en espaçant.
          this.echecs += 1;
          this.planifierReprise();
          break;
        }
      }
    } finally {
      this.enCours = false;
    }
  }

  private planifierReprise(): void {
    if (this.minuteur) clearTimeout(this.minuteur);
    const delai = Math.min(ATTENTE_MAX_MS, 1000 * 2 ** Math.min(this.echecs, 5));
    this.minuteur = setTimeout(() => void this.vider(), delai);
  }

  async cloreSession(entree: {
    paquetId: number | null;
    cartesVues: number;
    dureeSecondes: number;
  }): Promise<void> {
    try {
      await terminerSession(entree.paquetId, entree.cartesVues, entree.dureeSecondes);
    } catch {
      // Une session non consignée ne coûte qu'une statistique.
    }
  }
}
