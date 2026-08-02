import type { Metadata, Viewport } from "next";
import { Newsreader } from "next/font/google";

import "./globals.css";

const policeTitre = Newsreader({
  subsets: ["latin"],
  weight: ["300", "400"],
  style: ["normal", "italic"],
  variable: "--police-titre",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Questline",
  description: "Progression de vie par arcs longs.",
  applicationName: "Questline",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Questline",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icones/icone-192.png",
    apple: "/icones/icone-180.png",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0b0d",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={policeTitre.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
