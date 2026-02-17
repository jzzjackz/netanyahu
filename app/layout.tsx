import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Commz",
  description: "discord alternative",
};

export const viewport: Viewport = {
  themeColor: '#1e1f22',
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

