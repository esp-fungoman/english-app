'use client';

import {
  DotLottieReact,
  setWasmUrl,
  type DotLottie,
} from '@lottiefiles/dotlottie-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AnimationAsset } from './student-animation';

setWasmUrl('/animations/dotlottie-player.wasm');

export type PlayerProps = {
  asset: AnimationAsset;
  fallback: ReactNode;
  beforePlay?: () => boolean;
  durationMs?: number;
  completion?: 'still' | 'fallback';
};

export default function StudentAnimationPlayer({
  asset,
  fallback,
  beforePlay,
  durationMs,
  completion,
}: PlayerProps) {
  const [player, setPlayer] = useState<DotLottie | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [finished, setFinished] = useState(false);
  const beforePlayRef = useRef(beforePlay);
  beforePlayRef.current = beforePlay;
  const playbackGranted = useRef(false);
  const mascot = asset === 'friendly-owl';
  const maxDuration = durationMs ?? (mascot ? 3000 : undefined);
  const keepStill = (completion ?? (mascot ? 'still' : 'fallback')) === 'still';

  useEffect(() => {
    if (!player) return;
    let done = false;
    let limit: ReturnType<typeof setTimeout> | undefined;
    let startedAt = 0;
    let remaining = maxDuration ?? 0;
    const stop = () => {
      done = true;
      clearTimeout(limit);
      player.pause();
      setFinished(true);
    };
    const visibility = () => {
      if (done || !player.isLoaded) return;
      clearTimeout(limit);
      if (document.hidden) {
        player.pause();
        if (maxDuration !== undefined && startedAt)
          remaining -= performance.now() - startedAt;
        startedAt = 0;
      } else {
        if (!playbackGranted.current) {
          if (beforePlayRef.current && !beforePlayRef.current()) {
            done = true;
            player.pause();
            setFailed(true);
            return;
          }
          playbackGranted.current = true;
        }
        player.play();
        if (maxDuration !== undefined) {
          startedAt = performance.now();
          limit = setTimeout(stop, Math.max(0, remaining));
        }
      }
    };
    const onLoad = () => {
      clearTimeout(timeout);
      setLoaded(true);
      visibility();
    };
    const onError = () => {
      done = true;
      clearTimeout(limit);
      clearTimeout(timeout);
      player.pause();
      setFailed(true);
    };
    const timeout = setTimeout(onError, 5000);
    player.addEventListener('load', onLoad);
    player.addEventListener('complete', stop);
    player.addEventListener('loadError', onError);
    player.addEventListener('renderError', onError);
    document.addEventListener('visibilitychange', visibility);
    if (player.isLoaded) onLoad();
    return () => {
      done = true;
      clearTimeout(timeout);
      clearTimeout(limit);
      player.removeEventListener('load', onLoad);
      player.removeEventListener('complete', stop);
      player.removeEventListener('loadError', onError);
      player.removeEventListener('renderError', onError);
      document.removeEventListener('visibilitychange', visibility);
      player.pause();
      // DotLottieReact destroys its own instance on unmount.
    };
  }, [player, maxDuration]);

  if (failed || (finished && !keepStill)) return <>{fallback}</>;
  return (
    <>
      {!loaded ? (
        <span className="student-animation-fallback">{fallback}</span>
      ) : null}
      <DotLottieReact
        src={`/animations/${asset}.lottie`}
        autoplay={false}
        loop={false}
        dotLottieRefCallback={setPlayer}
        aria-hidden="true"
        style={{ opacity: loaded ? 1 : 0 }}
        layout={{ fit: 'contain' }}
      />
    </>
  );
}
