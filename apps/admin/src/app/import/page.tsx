'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { API, errorText } from '../../lib/admin';
type Report = {
  ok: boolean;
  committed: boolean;
  counts: {
    unitsCreated: number;
    categoriesCreated: number;
    wordsCreated: number;
    wordsSkipped: number;
    linksCreated: number;
  };
  warnings: string[];
  errors: { sheet: string; row: number; field: string; message: string }[];
};
export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState<'preview' | 'commit' | ''>('');
  const [error, setError] = useState('');
  async function run(event: FormEvent, mode: 'preview' | 'commit') {
    event.preventDefault();
    if (!file || busy || (mode === 'commit' && !report?.ok)) return;
    setBusy(mode);
    setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch(
        `${API}/api/admin/word-import?mode=${mode}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-App-Request': '1' },
          body,
        },
      );
      const result = await response.json();
      if (response.status === 401) {
        window.location.assign('/');
        return;
      }
      if (result.errors && result.counts) {
        setReport(result);
        if (!response.ok && !result.errors.length)
          throw new Error(result.message ?? 'Không nhập được dữ liệu.');
      } else if (!response.ok)
        throw new Error(result.message ?? 'Không nhập được dữ liệu.');
      else setReport(result);
    } catch (error) {
      setError(
        error instanceof TypeError
          ? 'Không kết nối được máy chủ. Hãy thử lại.'
          : errorText(error),
      );
      if (mode === 'commit')
        setReport((current) => (current ? { ...current, ok: false } : null));
    } finally {
      setBusy('');
    }
  }
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">CHUẨN BỊ NỘI DUNG HÀNG LOẠT</p>
          <h1>Nhập Excel</h1>
          <p className="muted">
            Xem trước toàn bộ thay đổi trước khi đưa vào kho từ.
          </p>
        </div>
        <a
          className="button"
          href="/templates/vocabulary-import-v1.xlsx"
          download
        >
          ↓ Tải file mẫu
        </a>
      </header>
      <div className="import-layout">
        <section className="panel">
          <h2>Chọn file nội dung</h2>
          <p className="muted">
            File .xlsx, tối đa 2 MiB. Điền lần lượt các tab Units, Categories và
            Words.
          </p>
          <form
            className="form-stack"
            onSubmit={(event) => void run(event, 'preview')}
          >
            <label className="upload-zone">
              <span aria-hidden>↑</span>
              <strong>{file?.name ?? 'Chọn file Excel'}</strong>
              <small>Các dòng mẫu là dữ liệu nhập thật nếu giữ nguyên.</small>
              <input
                type="file"
                accept=".xlsx"
                disabled={!!busy}
                onChange={(event) => {
                  const selected = event.target.files?.[0] ?? null;
                  setReport(null);
                  setError('');
                  if (
                    selected &&
                    (selected.size > 2 * 1024 * 1024 ||
                      !selected.name.toLowerCase().endsWith('.xlsx'))
                  ) {
                    setFile(null);
                    setError('Hãy chọn file .xlsx không quá 2 MiB.');
                    return;
                  }
                  setFile(selected);
                }}
              />
            </label>
            <div className="button-row">
              <button className="button" disabled={!file || !!busy}>
                {busy === 'preview' ? 'Đang xem trước…' : '1. Xem trước'}
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={!file || !!busy || !report?.ok || report.committed}
                onClick={(event) => void run(event, 'commit')}
              >
                {busy === 'commit' ? 'Đang nhập…' : '2. Xác nhận nhập'}
              </button>
            </div>
          </form>
          {error ? (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          ) : null}
          {report ? (
            <section className="import-report" aria-live="polite">
              <h3>
                {report.committed
                  ? 'Đã nhập nội dung'
                  : report.ok
                    ? 'Nội dung hợp lệ'
                    : 'Cần sửa file trước khi nhập'}
              </h3>
              <div className="import-counts">
                {[
                  ['Unit mới', report.counts.unitsCreated],
                  ['Category mới', report.counts.categoriesCreated],
                  ['Hồ sơ từ mới', report.counts.wordsCreated],
                  ['Hồ sơ dùng lại', report.counts.wordsSkipped],
                  ['Liên kết unit mới', report.counts.linksCreated],
                ].map(([title, count]) => (
                  <div key={String(title)}>
                    <strong>{count}</strong>
                    <span>{title}</span>
                  </div>
                ))}
              </div>
              {report.warnings.map((warning, index) => (
                <p className="notice notice-warning" key={index}>
                  {warning}
                </p>
              ))}
              {report.errors.length ? (
                <div className="import-errors">
                  {report.errors.map((issue, index) => (
                    <p key={index}>
                      <strong>
                        {issue.sheet} · Dòng {issue.row || '—'} · {issue.field}
                      </strong>
                      <span>{issue.message}</span>
                    </p>
                  ))}
                </div>
              ) : null}
              {report.committed ? (
                <p className="notice notice-success">
                  Nội dung đã được lưu. <Link href="/content">Mở kho từ</Link>{' '}
                  hoặc <Link href="/units">đặt lịch mở unit</Link>.
                </p>
              ) : null}
            </section>
          ) : null}
        </section>
        <aside className="panel import-guide">
          <p className="eyebrow">CÁCH DỮ LIỆU ĐƯỢC LƯU</p>
          <h2>Một hồ sơ, nhiều bài học</h2>
          <ol>
            <li>
              <strong>Cùng từ và nghĩa</strong>
              <p>
                Dùng lại hồ sơ chung và gắn thêm unit. Nghĩa, loại từ và ảnh đã
                có được giữ nguyên.
              </p>
            </li>
            <li>
              <strong>Khác nghĩa</strong>
              <p>
                Tạo hồ sơ riêng. Điền nghĩa khi có nhiều hồ sơ cùng cách viết.
              </p>
            </li>
            <li>
              <strong>Category theo unit</strong>
              <p>
                category_1 đến category_4 dùng riêng cho unit của dòng đó; liên
                kết cũ giữ nguyên category.
              </p>
            </li>
            <li>
              <strong>Đặt lịch sau khi nhập</strong>
              <p>
                Unit mới chưa có ngày mở sẽ bị khóa. Vào Unit & lịch học để cấu
                hình.
              </p>
            </li>
          </ol>
          <p className="notice">
            Từ/cụm từ vẫn được lưu khi chưa phù hợp với trò chơi. Bổ sung ảnh và
            xem khả năng sử dụng tại kho từ.
          </p>
        </aside>
      </div>
    </>
  );
}
