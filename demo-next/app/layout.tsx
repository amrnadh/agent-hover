import type { Metadata } from 'next';
import { AgentHover } from '@agent-hover/next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sorrel · Invoicing for studios and agencies',
  description: 'Sorrel sends your invoices, follows up on late payments, and shows where your cash stands. A fictional product: the Agent Hover demo app.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div id="root">{children}</div>
        <AgentHover />
      </body>
    </html>
  );
}
