'use client';
import { useEffect, useState } from 'react';
import { request } from '../lib/admin';
export function AdminImage({
  imageKey,
  alt,
  preview,
}: {
  imageKey: string | null;
  alt: string;
  preview?: string;
}) {
  const [source, setSource] = useState('');
  useEffect(() => {
    setSource('');
    if (!imageKey || preview) return;
    const controller = new AbortController();
    request<{ url: string }>(`/media?key=${encodeURIComponent(imageKey)}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setSource(result.url);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [imageKey, preview]);
  return preview || source ? (
    <img
      className="word-image"
      src={preview || source}
      alt={alt}
      onError={() => setSource('')}
    />
  ) : (
    <span className="word-image image-empty" aria-label="Chưa có ảnh">
      ▧
    </span>
  );
}
