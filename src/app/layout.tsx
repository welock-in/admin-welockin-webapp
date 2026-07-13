import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WeLockin Admin",
  description: "Live sessions, profiles and statistics.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
