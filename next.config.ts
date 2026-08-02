import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // La route /api/setup lit les fichiers SQL à l'exécution : sans cela, ils ne
  // seraient pas embarqués dans la fonction déployée.
  outputFileTracingIncludes: {
    "/api/setup": ["./drizzle/**/*"],
  },
};

export default nextConfig;
