import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PLUCK — Card Game",
  description: "A trick-taking card game with a unique plucking mechanic",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-950 text-white">{children}</body>
    </html>
  );
}
