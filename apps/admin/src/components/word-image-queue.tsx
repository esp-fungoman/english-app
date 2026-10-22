'use client';

import { useEffect, useRef, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

type MissingImageWord = {
  id: string;
  lemma: string;
  meaningVi: string | null;
  imageKey: string | null;
  unitId: string;
  unitTitle: string;
  gradeLevel: number;
};
type ImageDraft = { file: File | null; uploadedKey?: string; error: string };
type Props = {
  refreshVersion: number;
  onImageSaved: (unitId: string, wordId: string, imageKey: string) => void;
};

async function apiError(response: Response, fallback: string) {
  if (response.status === 501)
    return 'Kho ảnh chưa được cấu hình (501). Cần thiết lập BUCKET_NAME, BUCKET_ENDPOINT, BUCKET_ACCESS_KEY_ID và BUCKET_SECRET_ACCESS_KEY trên API.';
  if (response.status === 401 || response.status === 403)
    return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập admin lại.';
  const payload = await response.json().catch(() => null);
  const message = Array.isArray(payload?.message)
    ? payload.message.join(', ')
    : payload?.message;
  return typeof message === 'string' ? message : fallback;
}

function SelectedImage({ file, lemma }: { file: File; lemma: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return url ? (
    // Local files need no Next image optimization or remote bucket credentials.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="content-admin-image-preview"
      src={url}
      alt={`Ảnh đã chọn cho ${lemma}`}
    />
  ) : null;
}

export function WordImageQueue({ refreshVersion, onImageSaved }: Props) {
  const [words, setWords] = useState<MissingImageWord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ImageDraft>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);
  const [uploadingId, setUploadingId] = useState('');
  const [status, setStatus] = useState('');
  const [focusTarget, setFocusTarget] = useState('');
  const uploadBusy = useRef(false);

  useEffect(() => {
    if (uploadingId) return;
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    fetch(`${API}/api/admin/words/missing-images`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            await apiError(
              response,
              'Không tải được danh sách từ chưa có ảnh.',
            ),
          );
        return response.json() as Promise<MissingImageWord[]>;
      })
      .then((entries) => {
        if (controller.signal.aborted) return;
        setWords(entries);
        setDrafts((current) =>
          Object.fromEntries(
            entries
              .filter((word) => current[word.id])
              .map((word) => [word.id, current[word.id]]),
          ),
        );
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setLoadError(
            reason instanceof Error && !(reason instanceof TypeError)
              ? reason.message
              : 'Không kết nối được API để tải danh sách ảnh. Hãy thử làm mới.',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refreshVersion, refreshCount, uploadingId]);

  useEffect(() => {
    if (!focusTarget || loading || uploadingId) return;
    const input = document.getElementById(`word-image-${focusTarget}`);
    (input ?? document.getElementById('image-queue-refresh'))?.focus();
    setFocusTarget('');
  }, [focusTarget, loading, uploadingId]);

  function selectFile(wordId: string, file: File | null) {
    setDrafts((current) => ({
      ...current,
      [wordId]:
        file &&
        (!IMAGE_TYPES.includes(file.type) || file.size > 5 * 1024 * 1024)
          ? {
              file: null,
              error: 'Hãy chọn ảnh JPG, PNG, WebP hoặc GIF không quá 5 MiB.',
            }
          : { file, error: '' },
    }));
    setStatus('');
  }

  async function uploadImage(word: MissingImageWord) {
    const draft = drafts[word.id];
    if (!draft?.file || uploadBusy.current || loading) return;
    uploadBusy.current = true;
    setUploadingId(word.id);
    setStatus(`Đang thêm ảnh cho ${word.lemma}...`);
    setDrafts((current) => ({
      ...current,
      [word.id]: { ...draft, error: '' },
    }));
    let fallback = 'Không kết nối được kho ảnh. Hãy thử lại.';
    try {
      let key = draft.uploadedKey;
      if (!key) {
        const presign = await fetch(`${API}/api/admin/uploads/presign`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-App-Request': '1' },
          body: JSON.stringify({
            filename: draft.file.name,
            contentType: draft.file.type,
          }),
        });
        if (!presign.ok)
          throw new Error(
            await apiError(presign, 'Không tạo được đường dẫn tải ảnh.'),
          );
        const ticket = await presign.json();
        if (
          typeof ticket.url !== 'string' ||
          typeof ticket.key !== 'string' ||
          !ticket.key.startsWith('uploads/') ||
          ticket.key.includes('..') ||
          typeof ticket.contentType !== 'string'
        )
          throw new Error('Đường dẫn tải ảnh không hợp lệ. Hãy thử lại.');
        fallback =
          'Không tải được ảnh lên kho. Hãy kiểm tra kết nối và cấu hình CORS của bucket, rồi thử lại.';
        const uploaded = await fetch(ticket.url, {
          method: 'PUT',
          credentials: 'omit',
          headers: { 'Content-Type': ticket.contentType },
          body: draft.file,
        });
        if (!uploaded.ok) throw new Error(fallback);
        key = ticket.key as string;
        // Retain the uploaded key so a failed save retries PATCH, not PUT.
        setDrafts((current) => ({
          ...current,
          [word.id]: { ...draft, uploadedKey: key, error: '' },
        }));
      }
      fallback =
        'Ảnh đã tải lên nhưng chưa gắn được với từ. Bấm Lưu lại ảnh để thử lại.';
      const saved = await fetch(`${API}/api/admin/words/${word.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-App-Request': '1' },
        body: JSON.stringify({ imageKey: key }),
      });
      if (!saved.ok) throw new Error(await apiError(saved, fallback));
      const savedWord = await saved.json();
      if (savedWord.imageKey !== key) throw new Error(fallback);
      const index = words.findIndex((entry) => entry.id === word.id);
      setFocusTarget((words[index + 1] ?? words[index - 1])?.id ?? 'refresh');
      setWords((current) => current.filter((entry) => entry.id !== word.id));
      setDrafts((current) => {
        const remaining = { ...current };
        delete remaining[word.id];
        return remaining;
      });
      onImageSaved(word.unitId, word.id, key);
      setStatus(
        `Đã thêm ảnh cho ${word.lemma}. ${words.length > 1 ? 'Có thể chọn ảnh cho từ tiếp theo.' : 'Danh sách ảnh đã hoàn tất.'}`,
      );
    } catch (reason) {
      setStatus('');
      setDrafts((current) => ({
        ...current,
        [word.id]: {
          ...current[word.id],
          error:
            reason instanceof Error && !(reason instanceof TypeError)
              ? reason.message
              : fallback,
        },
      }));
    } finally {
      setLoading(true);
      setRefreshCount((current) => current + 1);
      setUploadingId('');
      uploadBusy.current = false;
    }
  }

  const busy = loading || !!uploadingId;
  return (
    <section
      className="content-admin-image-queue"
      aria-labelledby="image-queue-heading"
    >
      <div className="content-admin-image-heading">
        <h2 id="image-queue-heading">
          Từ chưa có ảnh{' '}
          {!loading && !loadError ? <span>({words.length})</span> : null}
        </h2>
        <button
          id="image-queue-refresh"
          type="button"
          disabled={busy}
          onClick={() => setRefreshCount((current) => current + 1)}
        >
          Làm mới
        </button>
      </div>
      <p className="content-admin-image-note">
        Chọn ảnh vuông, nền trơn, sáng, một đối tượng và không có chữ; phù hợp
        học sinh tiểu học. Ảnh được thêm riêng sau khi nhập Excel.
      </p>
      {loading ? <p role="status">Đang tải danh sách...</p> : null}
      {loadError ? (
        <p className="content-admin-error" role="alert">
          {loadError}
        </p>
      ) : null}
      {status ? (
        <p className="content-admin-image-status" role="status">
          {status}
        </p>
      ) : null}
      {!loading && !loadError && words.length === 0 ? (
        <p>Không còn từ nào thiếu ảnh.</p>
      ) : null}
      <ul className="content-admin-image-list">
        {words.map((word) => {
          const draft = drafts[word.id];
          return (
            <li className="content-admin-image-row" key={word.id}>
              <div className="content-admin-image-word">
                {draft?.file ? (
                  <SelectedImage file={draft.file} lemma={word.lemma} />
                ) : null}
                <div>
                  <h3>{word.lemma}</h3>
                  <p>{word.meaningVi || 'Chưa có nghĩa tiếng Việt'}</p>
                  <p className="content-admin-image-context">
                    Khối {word.gradeLevel} · {word.unitTitle}
                  </p>
                </div>
              </div>
              <div className="content-admin-image-controls">
                <label htmlFor={`word-image-${word.id}`}>
                  Ảnh cho {word.lemma}
                </label>
                <input
                  id={`word-image-${word.id}`}
                  type="file"
                  accept={IMAGE_TYPES.join(',')}
                  disabled={busy}
                  aria-describedby={
                    draft?.error ? `image-error-${word.id}` : undefined
                  }
                  onChange={(event) =>
                    selectFile(word.id, event.target.files?.[0] ?? null)
                  }
                />
                <button
                  type="button"
                  disabled={busy || !draft?.file}
                  onClick={() => void uploadImage(word)}
                >
                  {uploadingId === word.id
                    ? 'Đang tải ảnh...'
                    : draft?.uploadedKey
                      ? 'Lưu lại ảnh'
                      : 'Tải ảnh lên'}
                </button>
              </div>
              {draft?.error ? (
                <p
                  id={`image-error-${word.id}`}
                  className="content-admin-error"
                  role="alert"
                >
                  {draft.error}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
