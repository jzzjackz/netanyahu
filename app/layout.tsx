import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Discord Clone",
  description: "Realtime chat and voice built with Next.js and Supabase",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-[#1e1f22] text-white antialiased">
        <div className="flex h-screen overflow-hidden">{children}</div>
      </body>
    </html>
  );
}

