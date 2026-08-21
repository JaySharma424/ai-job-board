import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Job Board',
  description: 'AI-Powered Job Board for AlmaBetter',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-slate-800">{children}</body>
    </html>
  );
}