import type { ProblemeInstallation } from "@/lib/erreurs";

const TEXTES: Record<ProblemeInstallation, { titre: string; corps: string[] }> = {
  "tables-absentes": {
    titre: "Base pas encore installée",
    corps: [
      "La connexion à Postgres fonctionne, mais les tables n'existent pas encore.",
      "Ouvre l'adresse d'installation avec sa clé — elle crée les tables et charge le catalogue, puis se met d'elle-même en sommeil.",
    ],
  },
  "base-absente": {
    titre: "Configuration incomplète",
    corps: [
      "La variable DATABASE_URL n'est pas renseignée sur le serveur.",
      "Ajoute-la dans Vercel, pour l'environnement Production comme pour Preview, puis relance le déploiement.",
    ],
  },
};

/**
 * Écran de repli quand la base n'est pas prête. Même registre calme que le
 * reste : on explique, on ne réprimande pas.
 */
export function EcranInstallation({ probleme }: { probleme: ProblemeInstallation }) {
  const { titre, corps } = TEXTES[probleme];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-5 px-7 pb-[env(safe-area-inset-bottom)]">
      <div className="apparait flex flex-col gap-5">
        <span
          aria-hidden
          className="block h-9 w-px bg-linear-to-b from-transparent to-bordure-vive"
        />
        <h1 className="police-titre text-[30px] leading-tight">{titre}</h1>
        {corps.map((paragraphe) => (
          <p key={paragraphe} className="text-[15px] leading-relaxed text-doux">
            {paragraphe}
          </p>
        ))}
        <p className="text-[13px] leading-relaxed text-tres-doux">
          Rien n'est perdu : cet écran remplace une erreur serveur, il ne signale
          aucune donnée abîmée.
        </p>
      </div>
    </main>
  );
}
