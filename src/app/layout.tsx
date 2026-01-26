import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Chat Hub',
  description: 'Multiple AI wisdom in one conversation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
