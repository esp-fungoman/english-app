'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return `${words[0]?.[0] ?? '?'}${words.length > 1 ? (words.at(-1)?.[0] ?? '') : ''}`.toUpperCase();
}

export function StudentAvatar({
  avatarKey,
  displayName,
  fallback,
}: {
  avatarKey: string | null;
  displayName: string;
  fallback?: ReactNode;
}) {
  const [image, setImage] = useState<{ key: string; url: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setImage(null);
    if (avatarKey?.startsWith('uploads/avatars/') && !avatarKey.includes('..'))
      api<{ url: string }>(`/media?key=${encodeURIComponent(avatarKey)}`, {
        signal: controller.signal,
      })
        .then(({ url }) => {
          if (!controller.signal.aborted && /^https?:\/\//.test(url))
            setImage({ key: avatarKey, url });
        })
        .catch(() => {});
    return () => controller.abort();
  }, [avatarKey]);

  if (!image || image.key !== avatarKey)
    return fallback ?? initials(displayName);
  return <img src={image.url} alt="" onError={() => setImage(null)} />;
}
