import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getConfiguredPublicSiteUrl, siteMetadata } from '@/lib/site/metadata';

const siteUrl = getConfiguredPublicSiteUrl();

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: siteUrl, alternates: { canonical: '/' } } : {}),
  title: {
    default: siteMetadata.title,
    template: `%s | ${siteMetadata.name}`,
  },
  description: siteMetadata.description,
  applicationName: siteMetadata.name,
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48', type: 'image/x-icon' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    locale: siteMetadata.locale,
    title: siteMetadata.title,
    description: siteMetadata.description,
    images: [{ url: '/icons/og-jk-copycenter.png', width: 1200, height: 630, alt: 'JK Copycenter' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteMetadata.title,
    description: siteMetadata.description,
    images: ['/icons/og-jk-copycenter.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#0d2b5c',
  colorScheme: 'light',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
