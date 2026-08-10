import type { Metadata } from 'next';

import { AuthProvider } from '../components/auth-provider';

import './globals.css';

export const metadata: Metadata = {
  title: 'FlowMind AI',
  description: 'AI-powered workflow automation',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
