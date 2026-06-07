import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProofOfSynergy — AI Skill Passport on Monad",
  description:
    "Upload a resume, answer questions in any Indian language, get AI skill attestations, and mint a portable Skill Passport on Monad.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="text-ink antialiased">{children}</body>
    </html>
  );
}
