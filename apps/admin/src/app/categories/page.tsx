'use client';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { errorText, request, type Category } from '../../lib/admin';
export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ slug: '', titleVi: '' });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCategories(await request<Category[]>('/admin/categories'));
    } catch (error) {
      setError(errorText(error));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await request(`/admin/categories${editing ? `/${editing}` : ''}`, {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(draft),
      });
      setEditing(null);
      setDraft({ slug: '', titleVi: '' });
      setStatus('Đã lưu category.');
      await load();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">SẮP XẾP THEO CHỦ ĐỀ</p>
          <h1>
            Category <span className="heading-count">{categories.length}</span>
          </h1>
          <p className="muted">
            Tạo các nhóm để tổ chức từ và xây dựng trò phân nhóm.
          </p>
        </div>
      </header>
      {error ? (
        <p className="notice notice-error" role="alert">
          {error}{' '}
          <button className="text-button" onClick={() => void load()}>
            Thử lại
          </button>
        </p>
      ) : null}
      {status ? (
        <p className="notice notice-success" role="status">
          {status}
        </p>
      ) : null}
      <div className="settings-columns">
        <section className="panel">
          <div className="section-heading">
            <h2>Danh sách category</h2>
          </div>
          <input
            aria-label="Tìm category"
            placeholder="Tìm category…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {loading ? (
            <p role="status">Đang tải…</p>
          ) : (
            <div className="category-list">
              {categories
                .filter((category) =>
                  `${category.titleVi} ${category.slug}`
                    .toLocaleLowerCase('vi')
                    .includes(query.toLocaleLowerCase('vi')),
                )
                .map((category) => (
                  <button
                    className={`category-row ${editing === category.id ? 'is-selected' : ''}`}
                    key={category.id}
                    disabled={busy}
                    onClick={() => {
                      setEditing(category.id);
                      setDraft({
                        slug: category.slug,
                        titleVi: category.titleVi,
                      });
                      setError('');
                    }}
                  >
                    <span className="category-icon" aria-hidden>
                      ⌗
                    </span>
                    <span>
                      <strong>{category.titleVi}</strong>
                      <small>{category.slug}</small>
                    </span>
                    <span aria-hidden>↗</span>
                  </button>
                ))}
              {!categories.length ? (
                <p className="empty-state compact-empty">
                  Chưa có category. Tạo nhóm đầu tiên bên cạnh.
                </p>
              ) : null}
            </div>
          )}
        </section>
        <section className="panel">
          <h2>{editing ? 'Chỉnh sửa category' : 'Thêm category mới'}</h2>
          <p className="muted">
            Mã category dùng trong file Excel. Tên hiển thị bằng tiếng Việt.
          </p>
          <form className="form-stack" onSubmit={(event) => void save(event)}>
            <label>
              Tên category
              <input
                required
                maxLength={80}
                value={draft.titleVi}
                disabled={busy}
                onChange={(event) =>
                  setDraft({ ...draft, titleVi: event.target.value })
                }
                placeholder="Ví dụ: Động vật"
              />
            </label>
            <label>
              Mã category
              <input
                required
                pattern="[a-z][a-z0-9-]*"
                maxLength={50}
                value={draft.slug}
                disabled={busy}
                onChange={(event) =>
                  setDraft({ ...draft, slug: event.target.value.toLowerCase() })
                }
                placeholder="Ví dụ: animals"
              />
            </label>
            <div className="button-row">
              <button className="button button-primary" disabled={busy}>
                {busy ? 'Đang lưu…' : 'Lưu category'}
              </button>
              {editing ? (
                <button
                  className="button"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setEditing(null);
                    setDraft({ slug: '', titleVi: '' });
                  }}
                >
                  ＋ Tạo mới
                </button>
              ) : null}
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
