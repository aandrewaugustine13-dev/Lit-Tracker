import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'THE COUNTRY FACTBOOK — Reference Edition 2026',
  description: 'Structured, comparable reference profiles for UN member states.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
