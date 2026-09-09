import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '📟 פייג׳ר',
};

export default function PagingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
