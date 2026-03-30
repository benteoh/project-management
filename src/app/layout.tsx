import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AppChrome } from "@/components/layout/AppChrome";
import { listEngineersFromDb } from "@/lib/engineers/engineerDb";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DSP Project Intelligence",
  description: "Project management platform for DSP",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const engineersResult = await listEngineersFromDb(createServerSupabaseClient());
  const initialEngineers = "engineers" in engineersResult ? engineersResult.engineers : [];

  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <AppChrome initialEngineers={initialEngineers}>{children}</AppChrome>
      </body>
    </html>
  );
}
