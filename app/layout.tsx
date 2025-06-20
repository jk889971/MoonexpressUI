import type { Metadata } from "next";
import "./globals.css";

import SiteNavbar from "@/components/site-navbar";
import SiteFooter from "@/components/site-footer";
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: "Moonexpress | Pump your coin to the moon",
  description: "moonexpress is a platform for launching tokens",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Basic app metadata */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        {/* Manifest */}
        <link rel="manifest" href="/site.webmanifest" />

        {/* Favicons */}
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />
        <link rel="shortcut icon" href="/favicon.ico" />

        <meta name="theme-color" content="#132043" />
      </head>
      <body className="flex flex-col bg-[#000025] text-white max-[1023px]:pb-16">
        <Providers>
          <SiteNavbar />

          <main className="flex-1 overflow-y-auto">{children}</main>

          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}