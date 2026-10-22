'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ACTIVITIES,
  errorText,
  POS_OPTIONS,
  request,
  type Category,
  type Grade,
  type WordDraft,
  type WordEntry,
  type WordList,
} from '../lib/admin';
import { AdminImage } from './admin-image';

type Props = {
  entry: WordEntry | null;
  grades: Grade[];
  categories: Category[];
  onClose: () => void;
  onSaved: (word: WordEntry, next: boolean) => Promise<void>;
  onOpenExisting: (id: string) => void;
};
function draftFor(entry: WordEntry | null): WordDraft {
  return {
    lemma: entry?.lemma ?? '',
    meaningVi: entry?.meaningVi ?? '',
    partOfSpeech: entry?.partOfSpeech ?? '',
    imageKey: entry?.imageKey ?? null,
    audioKey: entry?.audioKey ?? null,
    categoryIds: entry?.categoryIds ?? [],
    units:
      entry?.units.map((link) => ({
        unitId: link.unitId,
        categoryIds: link.categoryIds,
      })) ?? [],
  };
}
export function WordDrawer({
  entry,
  grades,
  categories,
  onClose,
  onSaved,
  onOpenExisting,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const initial = useRef(JSON.stringify(draftFor(entry)));
  const [draft, setDraft] = useState<WordDraft>(() => draftFor(entry));
  const [gradeFilter, setGradeFilter] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [uploadedKey, setUploadedKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [duplicates, setDuplicates] = useState<WordEntry[]>([]);
  const [duplicateError, setDuplicateError] = useState('');
  const dirty = JSON.stringify(draft) !== initial.current || file !== null;
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (dirty) event.preventDefault();
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);
  useEffect(() => {
    const controller = new AbortController();
    setDuplicates([]);
    setDuplicateError('');
    if (!draft.lemma.trim()) return;
    const timer = setTimeout(() => {
      request<WordList>(
        `/admin/words?lemma=${encodeURIComponent(draft.lemma)}`,
        { signal: controller.signal },
      )
        .then((result) => {
          if (!controller.signal.aborted)
            setDuplicates(result.items.filter((word) => word.id !== entry?.id));
        })
        .catch((error) => {
          if (!controller.signal.aborted) setDuplicateError(errorText(error));
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [draft.lemma, entry?.id]);
  function close() {
    if (
      !saving.current &&
      (!dirty ||
        window.confirm(
          'Bạn có thay đổi chưa lưu. Đóng và bỏ các thay đổi này?',
        ))
    )
      onClose();
  }
  function openExisting(id: string) {
    if (!dirty || window.confirm('Bỏ thay đổi chưa lưu và mở hồ sơ có sẵn?'))
      onOpenExisting(id);
  }
  function setField<K extends keyof WordDraft>(field: K, value: WordDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }
  function toggleCategory(id: string, checked: boolean) {
    setField(
      'categoryIds',
      checked
        ? [...draft.categoryIds, id]
        : draft.categoryIds.filter((value) => value !== id),
    );
  }
  async function save(event: FormEvent, next: boolean) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      if (file && file.size > 5 * 1024 * 1024)
        throw new Error('Ảnh vượt quá 5 MiB. Hãy chọn ảnh nhỏ hơn.');
      let imageKey = draft.imageKey;
      if (file) {
        imageKey = uploadedKey;
        if (!imageKey) {
          const ticket = await request<{
            url: string;
            key: string;
            contentType: string;
          }>('/admin/uploads/presign', {
            method: 'POST',
            body: JSON.stringify({
              filename: file.name,
              contentType: file.type,
            }),
          });
          let result: Response;
          try {
            result = await fetch(ticket.url, {
              method: 'PUT',
              credentials: 'omit',
              headers: { 'Content-Type': ticket.contentType },
              body: file,
            });
          } catch {
            throw new Error(
              'Không kết nối được kho ảnh. Hãy thử lại hoặc liên hệ người quản lý.',
            );
          }
          if (!result.ok)
            throw new Error(
              'Chưa tải được ảnh lên kho. Hãy thử lại hoặc liên hệ người quản lý.',
            );
          imageKey = ticket.key;
          setUploadedKey(ticket.key);
        }
      }
      const word = await request<WordEntry>(
        `/admin/words${entry ? `/${entry.id}` : ''}`,
        {
          method: entry ? 'PATCH' : 'POST',
          body: JSON.stringify({ ...draft, imageKey }),
        },
      );
      initial.current = JSON.stringify({ ...draft, imageKey });
      setFile(null);
      setUploadedKey(null);
      setField('imageKey', imageKey);
      await onSaved(word, next);
    } catch (error) {
      setError(errorText(error));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const unitOptions = grades.flatMap((grade) =>
    grade.units.map((unit) => ({ ...unit, grade })),
  );
  return (
    <dialog
      ref={dialog}
      className="word-drawer"
      aria-labelledby="drawer-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <form
        onSubmit={(event) => void save(event, false)}
        className="drawer-inner"
      >
        <header className="drawer-header">
          <div>
            <p className="eyebrow">HỒ SƠ TỪ VỰNG</p>
            <h2 id="drawer-title">{entry ? entry.lemma : 'Thêm từ mới'}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Đóng chỉnh sửa"
            disabled={busy}
            onClick={close}
          >
            ×
          </button>
        </header>
        <fieldset className="drawer-body" disabled={busy}>
          <section className="drawer-section form-stack">
            <h3>Thông tin từ</h3>
            <label>
              Từ / cụm từ tiếng Anh
              <input
                autoFocus
                required
                maxLength={120}
                value={draft.lemma}
                onChange={(event) => setField('lemma', event.target.value)}
                placeholder="Ví dụ: apple, ice cream"
              />
            </label>
            {duplicates.length ? (
              <div className="notice">
                <strong>Đã có {duplicates.length} hồ sơ cùng cách viết</strong>
                <p>Chọn dùng lại hoặc điền nghĩa khác để tạo hồ sơ riêng.</p>
                {duplicates.map((word) => (
                  <button
                    type="button"
                    className="duplicate-link"
                    key={word.id}
                    onClick={() => openExisting(word.id)}
                  >
                    {word.lemma} — {word.meaningVi || 'Chưa có nghĩa'}{' '}
                    <small>{word.partOfSpeech || 'Chưa chọn loại từ'} ↗</small>
                  </button>
                ))}
              </div>
            ) : null}
            {duplicateError ? (
              <p className="notice notice-warning">
                Chưa kiểm tra được từ đã tồn tại: {duplicateError}
              </p>
            ) : null}
            <label>
              Nghĩa tiếng Việt
              <input
                required={duplicates.length > 0}
                maxLength={120}
                value={draft.meaningVi}
                onChange={(event) => setField('meaningVi', event.target.value)}
                placeholder="Ví dụ: quả táo"
              />
            </label>
            <label>
              Loại từ
              <select
                value={draft.partOfSpeech}
                onChange={(event) =>
                  setField('partOfSpeech', event.target.value)
                }
              >
                <option value="">Chưa chọn loại từ</option>
                {POS_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {value} · {label}
                  </option>
                ))}
              </select>
            </label>
          </section>
          <section className="drawer-section">
            <h3>Ảnh minh họa</h3>
            <div className="image-editor">
              <AdminImage
                imageKey={draft.imageKey}
                preview={preview}
                alt={`Ảnh của ${draft.lemma}`}
              />
              <div>
                <label className="file-label">
                  Chọn ảnh JPG, PNG, WebP hoặc GIF
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(event) => {
                      const selected = event.target.files?.[0];
                      if (!selected) return;
                      if (
                        ![
                          'image/jpeg',
                          'image/png',
                          'image/webp',
                          'image/gif',
                        ].includes(selected.type)
                      ) {
                        setError('Chỉ nhận ảnh JPG, PNG, WebP hoặc GIF.');
                        return;
                      }
                      setFile(selected);
                      setUploadedKey(null);
                      setError('');
                    }}
                  />
                </label>
                {file ? (
                  <small className="muted">Ảnh sẽ tải lên khi lưu.</small>
                ) : null}
                <button
                  type="button"
                  className="text-button"
                  disabled={!file && !draft.imageKey}
                  onClick={() => {
                    setFile(null);
                    setUploadedKey(null);
                    setField('imageKey', null);
                  }}
                >
                  Gỡ ảnh
                </button>
              </div>
            </div>
          </section>
          <section className="drawer-section">
            <h3>Category mặc định</h3>
            <p className="muted">
              Dùng làm lựa chọn ban đầu khi gắn từ vào unit mới.
            </p>
            <div className="choice-grid">
              {categories.map((category) => (
                <label className="check-label" key={category.id}>
                  <input
                    type="checkbox"
                    checked={draft.categoryIds.includes(category.id)}
                    onChange={(event) =>
                      toggleCategory(category.id, event.target.checked)
                    }
                  />
                  {category.titleVi}
                </label>
              ))}
            </div>
            {!categories.length ? (
              <p className="muted">
                Chưa có category. Tạo category tại mục Category trước.
              </p>
            ) : null}
          </section>
          <section className="drawer-section">
            <h3>
              Unit sử dụng{' '}
              <span className="count-pill">{draft.units.length}</span>
            </h3>
            <p className="muted">
              Nghĩa, loại từ và ảnh dùng chung. Category bên dưới áp dụng riêng
              cho từng unit.
            </p>
            <label className="compact-field">
              Lọc khối
              <select
                value={gradeFilter}
                onChange={(event) => setGradeFilter(event.target.value)}
              >
                <option value="">Tất cả khối</option>
                {grades.map((grade) => (
                  <option key={grade.id} value={grade.id}>
                    {grade.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="unit-picker">
              {unitOptions
                .filter((unit) => !gradeFilter || unit.grade.id === gradeFilter)
                .map((unit) => {
                  const usage = draft.units.find(
                    (link) => link.unitId === unit.id,
                  );
                  return (
                    <div className="unit-choice" key={unit.id}>
                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={!!usage}
                          onChange={(event) =>
                            setField(
                              'units',
                              event.target.checked
                                ? [
                                    ...draft.units,
                                    {
                                      unitId: unit.id,
                                      categoryIds: [...draft.categoryIds],
                                    },
                                  ]
                                : draft.units.filter(
                                    (link) => link.unitId !== unit.id,
                                  ),
                            )
                          }
                        />
                        <strong>
                          {unit.grade.title} · {unit.title}
                        </strong>
                      </label>
                      {usage ? (
                        <div className="unit-categories">
                          {categories.map((category) => (
                            <label className="check-label" key={category.id}>
                              <input
                                type="checkbox"
                                checked={usage.categoryIds.includes(
                                  category.id,
                                )}
                                onChange={(event) =>
                                  setField(
                                    'units',
                                    draft.units.map((link) =>
                                      link.unitId === unit.id
                                        ? {
                                            ...link,
                                            categoryIds: event.target.checked
                                              ? [
                                                  ...link.categoryIds,
                                                  category.id,
                                                ]
                                              : link.categoryIds.filter(
                                                  (id) => id !== category.id,
                                                ),
                                          }
                                        : link,
                                    ),
                                  )
                                }
                              />
                              {category.titleVi}
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
            </div>
            {!unitOptions.length ? (
              <p className="muted">
                Chưa có unit. Lưu hồ sơ trước, sau đó tạo unit trong Unit & lịch
                học.
              </p>
            ) : null}
            {draft.units.length ? (
              <p className="notice">
                Thay đổi nghĩa, loại từ và ảnh sẽ áp dụng cho:{' '}
                {draft.units
                  .map((link) => {
                    const unit = unitOptions.find(
                      (unit) => unit.id === link.unitId,
                    );
                    return unit ? `${unit.grade.title} / ${unit.title}` : '';
                  })
                  .join(', ')}
                .
              </p>
            ) : null}
          </section>
          <section className="drawer-section">
            <h3>Khả năng dùng trong trò chơi</h3>
            <p className="muted">
              Trạng thái theo dữ liệu đã lưu. Lưu để cập nhật sau khi thay đổi.
            </p>
            {entry ? (
              entry.units.length ? (
                entry.units.map((link) => (
                  <div className="activity-check" key={link.unitId}>
                    <strong>
                      Khối {link.gradeLevel} · {link.title}
                    </strong>
                    {Object.entries(link.activities).map(([key, status]) => (
                      <p key={key}>
                        <span
                          className={
                            status.usable
                              ? 'status-dot ok'
                              : 'status-dot warning'
                          }
                        />
                        {ACTIVITIES[key as keyof typeof ACTIVITIES]}:{' '}
                        {status.usable ? 'Có thể sử dụng' : status.reason}
                      </p>
                    ))}
                  </div>
                ))
              ) : (
                <p className="notice">
                  Chưa gắn unit.{' '}
                  {Object.values(entry.activities).find(
                    (value) =>
                      value.reason?.includes('A–Z') ||
                      value.reason?.includes('12 chữ'),
                  )?.reason ?? 'Gắn vào unit để kiểm tra đầy đủ các hoạt động.'}
                </p>
              )
            ) : (
              <p className="muted">
                Từ/cụm từ vẫn lưu được dù chưa phù hợp với trò chơi hiện tại.
              </p>
            )}
          </section>
        </fieldset>
        <footer className="drawer-footer">
          {error ? (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="button-row">
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={close}
            >
              Hủy
            </button>
            <button className="button button-primary" disabled={busy}>
              {busy ? 'Đang lưu…' : 'Lưu'}
            </button>
            <button
              type="submit"
              className="button button-secondary"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                if (event.currentTarget.form?.reportValidity())
                  void save(event, true);
              }}
            >
              Lưu và mở từ tiếp theo →
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
