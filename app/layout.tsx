import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Travel Intelligence · Plataforma de inteligencia turística",
  description:
    "Convierte señales de demanda en decisiones comerciales, propuestas y contenido vertical listo para activar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
