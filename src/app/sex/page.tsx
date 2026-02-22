'use client';

import Link from 'next/link';

export default function SexHubPage() {
  return (
    <main className="sex-hub">
      <h1 className="sex-hub-title">Valentine</h1>
      <p className="sex-hub-subtitle">Choose a game</p>
      <div className="sex-hub-games">
        <Link href="/sex/positions" className="sex-game-btn">
          Positions board
        </Link>
        <Link href="/sex/expectations" className="sex-game-btn">
          בין הציפיות
        </Link>
      </div>
    </main>
  );
}
