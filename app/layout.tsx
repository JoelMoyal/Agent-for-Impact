import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Genomic Cancer Analysis Agent",
  description: "Upload a genomic report and chat with an AI agent powered by NVIDIA Nemotron",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full bg-gray-950 text-gray-100`}>
        {children}
      </body>
    </html>
  );
}
