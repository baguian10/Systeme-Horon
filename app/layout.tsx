import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import DemoBanner from "@/components/demo/DemoBanner";
import { IS_DEMO_MODE } from "@/lib/demo-mode";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Titles differ between the real deployment and the demonstration one so that a
// browser tab, a bookmark or a shared link never misrepresents which is which.
export const metadata: Metadata = IS_DEMO_MODE
  ? {
      title: 'SIGEP — Démonstration | Burkina Faso',
      description:
        "Démonstration du Système Intégré de Gestion des Peines et de surveillance électronique — présentation aux autorités. Données fictives.",
    }
  : {
      title: 'Système Horon — Burkina Faso',
      description:
        "Programme national de surveillance électronique — Ministère de la Justice et des Droits Humains du Burkina Faso.",
    };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <DemoBanner />
        {children}
      </body>
    </html>
  );
}
