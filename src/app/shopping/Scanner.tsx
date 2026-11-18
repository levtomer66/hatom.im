'use client';

// Camera barcode scanner for /shopping. Uses the browser's own
// BarcodeDetector where there is one (Chrome, Android) and otherwise loads
// @zxing/browser on demand (iPhone Safari has no BarcodeDetector), so the
// decoder only downloads when someone opens the scanner without one.
// getUserMedia needs https or localhost.

import React, { useEffect, useRef, useState } from 'react';
import { FaTimes } from 'react-icons/fa';

interface DetectedBarcode { rawValue: string }
interface BarcodeDetectorLike { detect(source: HTMLVideoElement): Promise<DetectedBarcode[]> }
interface BarcodeDetectorCtor {
  new (opts: { formats: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

/** Retail barcodes only: what's printed on groceries. */
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

type Status = 'starting' | 'scanning' | 'denied' | 'nocamera' | 'insecure' | 'error';

const STATUS_TEXT: Record<Status, string> = {
  starting: 'פותח את המצלמה…',
  scanning: 'כוונו את המצלמה לברקוד שעל המוצר',
  denied: 'אין גישה למצלמה. אפשר לאשר אותה בהגדרות הדפדפן, או להקליד את הברקוד.',
  nocamera: 'לא נמצאה מצלמה במכשיר. אפשר להקליד את הברקוד.',
  insecure: 'המצלמה עובדת רק בכתובת מאובטחת (https). אפשר להקליד את הברקוד.',
  error: 'המצלמה לא נפתחה. אפשר לנסות שוב או להקליד את הברקוד.',
};

export default function Scanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>('starting');
  const [typed, setTyped] = useState('');
  // The parent passes a new arrow each render; keep the camera running across those.
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer = 0;
    let controls: { stop(): void } | null = null;
    const cleanup = () => {
      window.clearTimeout(timer);
      controls?.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
    const found = (raw: string) => {
      const code = raw.replace(/\D/g, '');
      if (stopped || !code) return;
      stopped = true;
      cleanup();
      navigator.vibrate?.(40);
      onCodeRef.current(code);
    };

    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setStatus('insecure');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      } catch (e) {
        const name = (e as DOMException).name;
        setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied'
          : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'nocamera' : 'error');
        return;
      }
      if (stopped || !video.current) {
        cleanup();
        return;
      }
      const v = video.current;
      v.srcObject = stream;
      await v.play().catch(() => {});
      setStatus('scanning');

      const Native = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
      const supported = Native ? await Native.getSupportedFormats?.().catch(() => []) : [];
      if (Native && supported?.includes('ean_13')) {
        const detector = new Native({ formats: FORMATS.filter((f) => supported.includes(f)) });
        const tick = async () => {
          if (stopped) return;
          try {
            const [hit] = await detector.detect(v);
            if (hit?.rawValue) return found(hit.rawValue);
          } catch {
            /* a frame that isn't ready yet */
          }
          timer = window.setTimeout(tick, 200);
        };
        tick();
        return;
      }
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ]);
        if (stopped) return;
        const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
        ]]]);
        const reader = new BrowserMultiFormatReader(hints);
        controls = await reader.decodeFromStream(stream, v, (res) => {
          if (res) found(res.getText());
        });
        if (stopped) controls.stop();
      } catch {
        if (!stopped) setStatus('error');
      }
    })();

    return () => {
      stopped = true;
      cleanup();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submitTyped = (e: React.FormEvent) => {
    e.preventDefault();
    const code = typed.replace(/\D/g, '');
    if (code.length >= 8) onCodeRef.current(code);
  };

  return (
    <div className="sh-scan" role="dialog" aria-modal="true" aria-label="סריקת ברקוד">
      <video ref={video} className="sh-scan-video" playsInline muted aria-hidden />
      {status === 'scanning' && <div className="sh-scan-frame" aria-hidden />}
      <button type="button" className="sh-scan-close" onClick={onClose} aria-label="סגירת הסורק"><FaTimes /></button>
      <div className="sh-scan-panel">
        <p className={status === 'scanning' || status === 'starting' ? '' : 'sh-scan-problem'} role="status">{STATUS_TEXT[status]}</p>
        <form className="sh-scan-type" onSubmit={submitTyped}>
          <input type="text" inputMode="numeric" pattern="[0-9]*" value={typed} onChange={(e) => setTyped(e.target.value)}
            placeholder="או הקלידו ברקוד" aria-label="הקלדת ברקוד" autoComplete="off" />
          <button type="submit" className="sh-btn" disabled={typed.replace(/\D/g, '').length < 8}>חיפוש</button>
        </form>
      </div>
    </div>
  );
}
