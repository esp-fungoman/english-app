'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import type { PlayerProps } from './student-animation-player';

export type AnimationAsset =
  | 'friendly-owl'
  | 'star-celebration'
  | 'confetti-burst'
  | 'right-answer'
  | 'streak-fire'
  | 'reward-trophy';

type Props = {
  asset: AnimationAsset;
  trigger?: string | boolean;
  className?: string;
  fallback?: ReactNode;
  beforePlay?: () => boolean;
  durationMs?: number;
  completion?: 'still' | 'fallback';
};

export function StudentAnimation({
  asset,
  trigger = true,
  className = '',
  fallback = null,
  beforePlay,
  durationMs,
  completion,
}: Props) {
  // Render only a static fallback until the browser preference is known.
  const [reduced, setReduced] = useState(true);
  const [Player, setPlayer] = useState<ComponentType<PlayerProps> | null>(null);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (reduced || !trigger) return;
    let active = true;
    import('./student-animation-player')
      .then((module) => {
        if (active) setPlayer(() => module.default);
      })
      .catch(() => {
        /* Keep the static fallback if the chunk cannot load. */
      });
    return () => {
      active = false;
    };
  }, [reduced, trigger]);
  return (
    <span
      className={`student-animation student-animation--${asset} ${className}`}
      aria-hidden="true"
    >
      {!reduced && trigger && Player ? (
        <Player
          key={`${asset}:${trigger}`}
          asset={asset}
          fallback={fallback}
          beforePlay={beforePlay}
          durationMs={durationMs}
          completion={completion}
        />
      ) : (
        fallback
      )}
    </span>
  );
}

const INTRO_KEY = 'english-owl-intro-played';
let introPlayedInPage = false;

function introAlreadyPlayed() {
  try {
    return introPlayedInPage || sessionStorage.getItem(INTRO_KEY) === '1';
  } catch {
    return introPlayedInPage;
  }
}

export function StudentMascot({
  className = '',
  mode = 'intro',
}: {
  className?: string;
  mode?: 'intro' | 'result' | 'static';
}) {
  const [introEligible, setIntroEligible] = useState(false);
  const claimed = useRef(false);
  useEffect(() => {
    if (mode === 'intro') setIntroEligible(!introAlreadyPlayed());
  }, [mode]);
  const reserveIntro = useCallback(() => {
    if (claimed.current) return true;
    if (introAlreadyPlayed()) return false;
    introPlayedInPage = true;
    try {
      sessionStorage.setItem(INTRO_KEY, '1');
    } catch {
      // Module flag preserves once-per-page behavior when storage is unavailable.
    }
    claimed.current = true;
    return true;
  }, []);
  return (
    <StudentAnimation
      asset="friendly-owl"
      className={className}
      trigger={mode === 'result' || (mode === 'intro' && introEligible)}
      beforePlay={mode === 'intro' ? reserveIntro : undefined}
      fallback={
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/animations/friendly-owl.png" alt="" />
      }
    />
  );
}

export function StudentLoading({ children }: { children: ReactNode }) {
  const [showDots, setShowDots] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setShowDots(true), 300);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className="student-loading muted" role="status" aria-live="polite">
      <span className="student-loading-art" aria-hidden="true">
        {showDots ? (
          <span className="student-loading-dots">
            <span />
            <span />
            <span />
          </span>
        ) : null}
      </span>
      <span>{children}</span>
    </div>
  );
}

// Warm the module and same-origin HTTP cache, never the game start critical path.
let answerPreload: Promise<unknown> | undefined;
export function usePreloadAnswerAnimation(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const warm = () => {
      if (preference.matches || answerPreload) return;
      answerPreload = Promise.all([
        import('./student-animation-player'),
        fetch('/animations/dotlottie-player.wasm', {
          cache: 'force-cache',
        }).then((r) => {
          if (!r.ok) throw new Error('WASM preload failed');
          return r.arrayBuffer();
        }),
        fetch('/animations/right-answer.lottie', { cache: 'force-cache' }).then(
          (r) => {
            if (!r.ok) throw new Error('Answer asset preload failed');
            return r.arrayBuffer();
          },
        ),
      ]).catch(() => {
        answerPreload = undefined;
      });
    };
    warm();
    preference.addEventListener('change', warm);
    return () => preference.removeEventListener('change', warm);
  }, [active]);
}
