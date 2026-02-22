'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import type { SexPosition } from '@/types/valentine';

const POSES_API = '/api/valentine/poses';
const PROGRESS_API = '/api/valentine/progress';
const IMAGE_API = '/api/valentine/poses/image';

function getImageUrl(filename: string): string {
  return `${IMAGE_API}?name=${encodeURIComponent(filename)}`;
}

export default function PositionsBoard() {
  const [positions, setPositions] = useState<SexPosition[]>([]);
  const [experiencedIds, setExperiencedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [randomDrawing, setRandomDrawing] = useState<string | null>(null);
  const [randomCountdown, setRandomCountdown] = useState<number | null>(null);
  const [revealAll, setRevealAll] = useState(false);
  const [uncheckConfirmPositionId, setUncheckConfirmPositionId] = useState<string | null>(null);
  const [largeModePositionId, setLargeModePositionId] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    const res = await fetch(POSES_API);
    if (!res.ok) return;
    const data = await res.json();
    setPositions(data);
  }, []);

  const fetchProgress = useCallback(async () => {
    const res = await fetch(PROGRESS_API);
    if (!res.ok) return;
    const data = await res.json();
    setExperiencedIds(new Set(data.experiencedPositionIds ?? []));
  }, []);

  const markExperienced = useCallback(async (positionId: string) => {
    setExperiencedIds((prev) => new Set(prev).add(positionId));
    await fetch(PROGRESS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positionId }),
    });
  }, []);

  const uncheckExperienced = useCallback(async (positionId: string) => {
    setExperiencedIds((prev) => {
      const next = new Set(prev);
      next.delete(positionId);
      return next;
    });
    await fetch(PROGRESS_API, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positionId }),
    });
  }, []);

  useEffect(() => {
    Promise.all([fetchPositions(), fetchProgress()]).finally(() =>
      setLoading(false)
    );
  }, [fetchPositions, fetchProgress]);

  const handleCardClick = useCallback(
    (pos: SexPosition) => {
      if (experiencedIds.has(pos.id)) {
        setLargeModePositionId(pos.id);
        return;
      }
      markExperienced(pos.id);
    },
    [markExperienced, experiencedIds]
  );

  const handleUncheckClick = useCallback((e: React.MouseEvent, positionId: string) => {
    e.stopPropagation();
    setUncheckConfirmPositionId(positionId);
  }, []);

  const confirmUncheck = useCallback(() => {
    if (uncheckConfirmPositionId) {
      uncheckExperienced(uncheckConfirmPositionId);
      setUncheckConfirmPositionId(null);
    }
  }, [uncheckConfirmPositionId, uncheckExperienced]);

  const handleRandom = useCallback(() => {
    if (positions.length === 0) return;
    const chosen = positions[Math.floor(Math.random() * positions.length)];
    setRandomDrawing(chosen.id);
    setRandomCountdown(3);
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const left = Math.max(0, Math.ceil(3 - elapsed));
      setRandomCountdown(left);
      if (left <= 0) {
        clearInterval(interval);
        setExperiencedIds((prev) => new Set(prev).add(chosen.id));
        markExperienced(chosen.id);
        setTimeout(() => {
          setRandomDrawing(null);
          setRandomCountdown(null);
        }, 2500);
      }
    }, 100);
  }, [positions, markExperienced]);

  if (loading) {
    return (
      <div className="sex-positions-page">
        <p className="text-[#f8bbd9]">Loading…</p>
      </div>
    );
  }

  const total = positions.length;
  const experienced = positions.filter((p) => experiencedIds.has(p.id)).length;

  return (
    <div className="sex-positions-page">
      <header className="sex-positions-header">
        <Link href="/sex" className="sex-positions-back">
          ← Back
        </Link>
        <h1 className="sex-positions-title">Positions board</h1>
        <div className="sex-positions-stats">
          {experienced} / {total} experienced
        </div>
        <div className="sex-positions-actions">
          <button
            type="button"
            className="sex-positions-random-btn"
            onClick={() => setRevealAll((prev) => !prev)}
          >
            {revealAll ? 'Hide all' : 'Reveal all'}
          </button>
          <button
            type="button"
            className="sex-positions-random-btn"
            onClick={handleRandom}
            disabled={positions.length === 0}
          >
            Random position
          </button>
        </div>
      </header>

      <div className="sex-positions-grid">
        {positions.map((pos) => {
          const isExperienced = experiencedIds.has(pos.id);
          const displayedRevealed = revealAll || isExperienced;
          return (
            <motion.div
              key={pos.id}
              layout
              className={`sex-position-card ${displayedRevealed ? 'revealed' : ''} ${isExperienced ? 'experienced' : ''}`}
              onClick={() => handleCardClick(pos)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleCardClick(pos);
                }
              }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div
                className={`sex-position-card-face ${displayedRevealed ? 'revealed' : 'hidden'}`}
              >
                {displayedRevealed ? (
                  <Image
                    src={getImageUrl(pos.filename)}
                    alt=""
                    fill
                    sizes="(max-width: 400px) 160px, 200px"
                    style={{ objectFit: 'contain' }}
                    unoptimized
                  />
                ) : (
                  <span>?</span>
                )}
              </div>
              {isExperienced && (
                <button
                  type="button"
                  className="sex-position-card-uncheck"
                  onClick={(e) => handleUncheckClick(e, pos.id)}
                  aria-label="Uncheck position"
                  title="Uncheck"
                >
                  ✓
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {largeModePositionId !== null && (
          <motion.div
            key="large-mode-overlay"
            className="sex-large-mode-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setLargeModePositionId(null)}
          >
            <motion.div
              className="sex-large-mode-container"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={getImageUrl(
                  positions.find((p) => p.id === largeModePositionId)?.filename ?? ''
                )}
                alt=""
                fill
                sizes="(max-width: 900px) 92vw, 900px"
                style={{ objectFit: 'contain' }}
                unoptimized
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {uncheckConfirmPositionId !== null && (
          <motion.div
            key="uncheck-modal"
            className="sex-uncheck-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setUncheckConfirmPositionId(null)}
          >
            <motion.div
              className="sex-uncheck-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="sex-uncheck-modal-text">Are you sure you want to uncheck this position?</p>
              <div className="sex-uncheck-modal-actions">
                <button
                  type="button"
                  className="sex-positions-random-btn"
                  onClick={() => setUncheckConfirmPositionId(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="sex-uncheck-confirm-btn"
                  onClick={confirmUncheck}
                >
                  Uncheck
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {randomDrawing !== null && (
          <motion.div
            key="random-overlay"
            className="sex-random-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {randomCountdown !== null && randomCountdown > 0 ? (
              <>
                <motion.div
                  className="sex-random-card-preview"
                  style={{ background: 'linear-gradient(145deg, #fafafa, #f0f0f0)' }}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                />
                <p className="sex-random-label">Drawing…</p>
                <p className="sex-random-timer">{randomCountdown}</p>
              </>
            ) : (
              <>
                <motion.div
                  className="sex-random-card-preview"
                  key={randomDrawing}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', damping: 20 }}
                >
                  <Image
                    src={getImageUrl(
                      positions.find((p) => p.id === randomDrawing)?.filename ?? ''
                    )}
                    alt=""
                    fill
                    sizes="280px"
                    style={{ objectFit: 'contain' }}
                    unoptimized
                  />
                </motion.div>
                <p className="sex-random-label">Try this one</p>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
