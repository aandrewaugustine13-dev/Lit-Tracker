import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Classroom Factbook',
  description: 'Printable one-page country fact sheets for classroom activities.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
