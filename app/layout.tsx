import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OYS",
  description: "Çoklu Otel Yönetim Sistemi"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
