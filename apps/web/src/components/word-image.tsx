'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export function WordImage({
  imageKey,
  alt,
  className = 'wordbook-image',
}: {
  imageKey: string | null;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    let active = true;
    setUrl('');
    if (imageKey?.startsWith('uploads/'))
      api<{ url: string }>(`/media?key=${encodeURIComponent(imageKey)}`)
        .then((value) => {
          if (active && /^https?:\/\//.test(value.url)) setUrl(value.url);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [imageKey]);

  if (!url) return null;
  return <img className={className} src={url} alt={alt} />;
}
