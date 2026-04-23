import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flowmind | AI-Native Workflows",
  description: "Visual workflow builder where primitives are AI reasoning systems. Connect DeepSeek, Gemini, NotebookLM, and ChatGPT in thinking workflows that validate and gap-fill.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
