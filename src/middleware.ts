import { NextResponse, type NextRequest } from "next/server";

import { NOM_COOKIE, jetonValide } from "@/lib/auth";

const PUBLIQUES = ["/connexion"];

export async function middleware(requete: NextRequest) {
  const chemin = requete.nextUrl.pathname;
  const publique = PUBLIQUES.some((p) => chemin === p || chemin.startsWith(`${p}/`));
  const connecte = await jetonValide(requete.cookies.get(NOM_COOKIE)?.value);

  if (!connecte && !publique) {
    const url = requete.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (connecte && publique) {
    const url = requete.nextUrl.clone();
    url.pathname = "/jour";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Les routes techniques portent leurs propres secrets et doivent rester
    // atteignables sans session : /api/setup avant même que les tables
    // existent, /api/cron pour Vercel, /api/telegram pour le webhook.
    "/((?!api/setup|api/cron|api/telegram|_next/static|_next/image|favicon.ico|icones|manifest.webmanifest).*)",
  ],
};
