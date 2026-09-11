import type { Metadata } from 'next';
import QuickOrderClient from './QuickOrderClient';
import './quick.css';

// appleWebApp → iOS emits apple-mobile-web-app-capable etc., so adding THIS
// page to the home screen opens it chrome-less. The home-screen glyph is the
// per-favorite ./apple-icon (this route's own icon supersedes the parent
// /coffee-order/apple-icon), so each favorite installs with its capsule photo.
export const metadata: Metadata = {
  title: '☕ הקפה שלי',
  appleWebApp: { capable: true, title: 'קפה', statusBarStyle: 'black-translucent' },
};

export default async function QuickOrderPage({
  params,
}: {
  params: Promise<{ favoriteId: string }>;
}) {
  const { favoriteId } = await params;
  return <QuickOrderClient favoriteId={favoriteId} />;
}
