import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ReelsFlow - Workspace de Criação de Vídeos",
  description: "Crie vídeos virais para o Instagram Reels em segundos a partir de ideias, textos ou links de blogs usando Inteligência Artificial.",
  authors: [{ name: "Aether Network" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${outfit.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#030712] text-slate-200">
        {children}
      </body>
    </html>
  );
}
