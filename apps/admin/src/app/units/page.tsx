'use client';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import {
  ACTIVITIES,
  errorText,
  fromLocalInput,
  request,
  toLocalInput,
  vietnamTime,
  type Activity,
  type Grade,
  type Unit,
} from '../../lib/admin';
function stateFor(unit: Unit) {
  return unit.manualLock
    ? 'Khóa tay'
    : !unit.opensAt
      ? 'Chưa đặt lịch'
      : new Date(unit.opensAt).getTime() > Date.now()
        ? 'Chờ mở'
        : 'Đang mở';
}
function UnitEditor({
  unit,
  gradeId,
  grades,
  onClose,
  onSaved,
}: {
  unit: Unit | null;
  gradeId: string;
  grades: Grade[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState({
    gradeId: unit?.gradeId ?? gradeId ?? grades[0]?.id ?? '',
    title: unit?.title ?? '',
    sortOrder: unit?.sortOrder ?? 1,
    groupMode: unit?.groupMode ?? 'single',
    opensAt: toLocalInput(unit?.opensAt ?? null),
    manualLock: unit?.manualLock ?? false,
    activityTypes:
      unit?.activities.map((item) => item.activityType) ??
      (Object.keys(ACTIVITIES) as Activity[]),
  });
  const initial = useRef(JSON.stringify(draft));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  const dirty = JSON.stringify(draft) !== initial.current;
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  function close() {
    if (!busy && (!dirty || window.confirm('Bỏ các thay đổi chưa lưu?')))
      onClose();
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const opensAt = fromLocalInput(draft.opensAt);
    const willClose =
      draft.manualLock || !opensAt || new Date(opensAt).getTime() > Date.now();
    if (
      unit &&
      stateFor(unit) === 'Đang mở' &&
      willClose &&
      !window.confirm(
        'Thay đổi này sẽ khóa unit đang mở, kể cả với học sinh đang chơi. Bạn muốn lưu?',
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await request(`/admin/units${unit ? `/${unit.id}` : ''}`, {
        method: unit ? 'PATCH' : 'POST',
        body: JSON.stringify({ ...draft, opensAt }),
      });
      onSaved();
    } catch (error) {
      setError(errorText(error));
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="word-drawer unit-drawer"
      aria-labelledby="unit-editor-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <form className="drawer-inner" onSubmit={(event) => void save(event)}>
        <header className="drawer-header">
          <div>
            <p className="eyebrow">BÀI HỌC & LỊCH MỞ</p>
            <h2 id="unit-editor-title">
              {unit ? 'Chỉnh sửa unit' : 'Tạo unit mới'}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            disabled={busy}
            onClick={close}
            aria-label="Đóng"
          >
            ×
          </button>
        </header>
        <fieldset className="drawer-body form-stack" disabled={busy}>
          <label>
            Khối
            <select
              disabled={!!unit}
              value={draft.gradeId}
              onChange={(event) =>
                setDraft({ ...draft, gradeId: event.target.value })
              }
              required
            >
              <option value="">Chọn khối</option>
              {grades.map((grade) => (
                <option value={grade.id} key={grade.id}>
                  {grade.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tên unit
            <input
              autoFocus
              required
              maxLength={120}
              value={draft.title}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
              placeholder="Ví dụ: Unit 1 · Animals"
            />
          </label>
          <label>
            Thứ tự unit
            <input
              type="number"
              min={1}
              max={10}
              required
              value={draft.sortOrder}
              onChange={(event) =>
                setDraft({ ...draft, sortOrder: Number(event.target.value) })
              }
            />
          </label>
          <label>
            Mở từ · Giờ Việt Nam
            <input
              type="datetime-local"
              value={draft.opensAt}
              onChange={(event) =>
                setDraft({ ...draft, opensAt: event.target.value })
              }
            />
          </label>
          <p className="notice">
            Để trống ngày mở: học sinh chưa được học. Đến ngày giờ đã đặt, unit
            tự mở nếu không bị khóa tay.
          </p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={draft.manualLock}
              onChange={(event) =>
                setDraft({ ...draft, manualLock: event.target.checked })
              }
            />
            Khóa tay unit này
          </label>
          <section className="drawer-section">
            <h3>Hoạt động trong unit</h3>
            {Object.entries(ACTIVITIES).map(([type, label]) => (
              <label className="check-label" key={type}>
                <input
                  type="checkbox"
                  checked={draft.activityTypes.includes(type as Activity)}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      activityTypes: event.target.checked
                        ? [...draft.activityTypes, type as Activity]
                        : draft.activityTypes.filter((item) => item !== type),
                    })
                  }
                />
                {label}
              </label>
            ))}
          </section>
          <label>
            Chế độ ghép từ theo nhóm
            <select
              value={draft.groupMode}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  groupMode: event.target.value as 'single' | 'board',
                })
              }
            >
              <option value="single">Từng từ</option>
              <option value="board">Bảng phân nhóm</option>
            </select>
          </label>
          {draft.groupMode === 'board' && (!unit || !unit.boardAvailable) ? (
            <p className="notice notice-warning">
              Bảng phân nhóm chưa đủ nội dung: cần ít nhất hai nhóm, từ phù hợp
              cho từng nhóm và lựa chọn sai. Bổ sung từ/category trong kho từ.
            </p>
          ) : null}
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
              onClick={close}
              disabled={busy}
            >
              Hủy
            </button>
            <button className="button button-primary" disabled={busy}>
              {busy ? 'Đang lưu…' : 'Lưu unit'}
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
export default function UnitsPage() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [gradeId, setGradeId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [schedule, setSchedule] = useState('');
  const [preview, setPreview] = useState(false);
  const [editor, setEditor] = useState<{ unit: Unit | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [, setTick] = useState(0);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setGrades(await request<Grade[]>('/admin/grades'));
    } catch (error) {
      setError(errorText(error));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const interval = setInterval(() => setTick((value) => value + 1), 30_000);
    return () => clearInterval(interval);
  }, [load]);
  const visibleGrades = grades.filter(
    (grade) => !gradeId || grade.id === gradeId,
  );
  const visibleUnits = visibleGrades.flatMap((grade) => grade.units);
  async function bulkSchedule(event: FormEvent) {
    event.preventDefault();
    if (busy || !selected.length) return;
    const opensAt = fromLocalInput(schedule);
    const locksOpen =
      (!opensAt || new Date(opensAt).getTime() > Date.now()) &&
      grades
        .flatMap((grade) => grade.units)
        .some(
          (unit) => selected.includes(unit.id) && stateFor(unit) === 'Đang mở',
        );
    if (
      locksOpen &&
      !window.confirm(
        'Lịch mới sẽ khóa một số unit đang mở, kể cả phiên đang chơi. Bạn muốn tiếp tục?',
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await request('/admin/units/schedule', {
        method: 'POST',
        body: JSON.stringify({ unitIds: selected, opensAt }),
      });
      setStatus(`Đã cập nhật lịch cho ${selected.length} unit.`);
      setSelected([]);
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
          <p className="eyebrow">TỔ CHỨC BÀI HỌC</p>
          <h1>Unit & lịch học</h1>
          <p className="muted">
            Mở đúng thời điểm. Giữ hành trình học theo kế hoạch.
          </p>
        </div>
        <button
          className="button button-primary"
          onClick={() => setEditor({ unit: null })}
          disabled={loading || !grades.length}
        >
          ＋ Tạo unit
        </button>
      </header>
      <section className="filter-panel filter-row">
        <label className="compact-field">
          Khối
          <select
            value={gradeId}
            onChange={(event) => {
              setGradeId(event.target.value);
              setSelected([]);
            }}
          >
            <option value="">Tất cả khối</option>
            {grades.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.title}
              </option>
            ))}
          </select>
        </label>
        <button
          className={`button ${preview ? 'button-secondary' : ''}`}
          aria-pressed={preview}
          onClick={() => setPreview(!preview)}
        >
          {preview ? '← Quay lại quản lý' : '◉ Xem trước phía học sinh'}
        </button>
        <span className="timezone-label">Asia/Ho_Chi_Minh · UTC+7</span>
      </section>
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
      {!preview ? (
        <form
          className="bulk-schedule"
          onSubmit={(event) => void bulkSchedule(event)}
        >
          <label className="check-label">
            <input
              type="checkbox"
              disabled={!visibleUnits.length || busy}
              checked={
                visibleUnits.length > 0 &&
                visibleUnits.every((unit) => selected.includes(unit.id))
              }
              onChange={(event) =>
                setSelected(
                  event.target.checked
                    ? visibleUnits.map((unit) => unit.id)
                    : [],
                )
              }
            />
            Chọn tất cả
          </label>
          <strong>{selected.length} unit đã chọn</strong>
          <label className="compact-field">
            Mở từ · Giờ Việt Nam
            <input
              type="datetime-local"
              value={schedule}
              disabled={busy}
              onChange={(event) => setSchedule(event.target.value)}
            />
          </label>
          <button
            className="button button-secondary"
            disabled={busy || !selected.length}
          >
            {busy
              ? 'Đang lưu…'
              : schedule
                ? 'Đặt lịch cho unit đã chọn'
                : 'Xóa lịch · khóa unit đã chọn'}
          </button>
        </form>
      ) : (
        <p className="notice">
          Xem trước quyền truy cập hiện tại, chưa bao gồm đăng nhập hoặc bắt đầu
          chơi. Unit khóa vẫn hiện mốc mở; unit mở nhưng thiếu nội dung chưa
          chơi được.
        </p>
      )}
      {loading ? (
        <p role="status">Đang tải lịch học…</p>
      ) : (
        visibleGrades.map((grade) => (
          <section className="unit-grade-section" key={grade.id}>
            <header className="section-heading">
              <h2>{grade.title}</h2>
              <span className="muted">
                {grade.units.length} unit ·{' '}
                {
                  grade.units.filter((unit) => stateFor(unit) === 'Đang mở')
                    .length
                }{' '}
                đang mở
              </span>
            </header>
            {!grade.units.length ? (
              <div className="empty-state compact-empty">
                <h3>Khối này chưa có unit</h3>
                <p>Tạo unit hoặc nhập nội dung từ Excel.</p>
              </div>
            ) : (
              <div className={preview ? 'unit-preview-grid' : 'unit-list'}>
                {grade.units.map((unit) => {
                  const state = stateFor(unit);
                  return preview ? (
                    <article
                      className={`unit-preview-card ${state !== 'Đang mở' ? 'is-locked' : ''}`}
                      key={unit.id}
                    >
                      <span className="unit-number">
                        {String(unit.sortOrder).padStart(2, '0')}
                      </span>
                      <h3>{unit.title}</h3>
                      <span
                        className={`status-badge ${state === 'Đang mở' ? 'is-open' : ''}`}
                      >
                        {state}
                      </span>
                      <p>
                        {unit.opensAt
                          ? `Mở từ ${vietnamTime(unit.opensAt)}`
                          : 'Chưa có ngày mở'}
                      </p>
                      <small>
                        {unit.wordCount} từ · {unit.activities.length} hoạt động
                      </small>
                    </article>
                  ) : (
                    <article className="unit-list-row" key={unit.id}>
                      <label className="check-label">
                        <input
                          type="checkbox"
                          aria-label={`Chọn ${grade.title} ${unit.title}`}
                          checked={selected.includes(unit.id)}
                          disabled={busy}
                          onChange={(event) =>
                            setSelected(
                              event.target.checked
                                ? [...selected, unit.id]
                                : selected.filter((id) => id !== unit.id),
                            )
                          }
                        />
                        <span className="unit-number">
                          {String(unit.sortOrder).padStart(2, '0')}
                        </span>
                      </label>
                      <div>
                        <h3>{unit.title}</h3>
                        <small className="muted">
                          {unit.wordCount} từ · {unit.activities.length} hoạt
                          động ·{' '}
                          {unit.groupMode === 'board'
                            ? 'Bảng phân nhóm'
                            : 'Từng từ'}
                        </small>
                        {unit.groupMode === 'board' && !unit.boardAvailable ? (
                          <p className="inline-warning">
                            Chưa đủ từ/nhóm cho bảng phân nhóm
                          </p>
                        ) : null}
                      </div>
                      <div>
                        <span
                          className={`status-badge ${state === 'Đang mở' ? 'is-open' : ''}`}
                        >
                          {state}
                        </span>
                        <small className="schedule-date">
                          {vietnamTime(unit.opensAt)}
                        </small>
                      </div>
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() => setEditor({ unit })}
                      >
                        Chỉnh sửa
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ))
      )}
      {editor ? (
        <UnitEditor
          unit={editor.unit}
          gradeId={gradeId || grades[0]?.id || ''}
          grades={grades}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            setStatus('Đã lưu unit.');
            void load();
          }}
        />
      ) : null}
    </>
  );
}
