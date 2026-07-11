import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "MagnaKeys - Loja de Chaves e Ativadores",
  description: "Compre chaves e ativadores com entrega instantanea via PIX",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col">
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            style: {
              background: 'oklch(0.17 0.015 280)',
              border: '1px solid oklch(0.28 0.02 280)',
              color: 'oklch(0.95 0.01 280)',
            },
          }}
        />
      </body>
    </html>
  );
}