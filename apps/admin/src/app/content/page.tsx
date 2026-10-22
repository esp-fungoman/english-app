'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminImage } from '../../components/admin-image';
import { MultiSelect } from '../../components/multi-select';
import { WordDrawer } from '../../components/word-drawer';
import {
  errorText,
  POS_OPTIONS,
  request,
  type Category,
  type Grade,
  type WordEntry,
  type WordList,
} from '../../lib/admin';
const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'];
const QUICK = [
  ['missing-image', 'Thiếu ảnh'],
  ['missing-meaning', 'Thiếu nghĩa'],
  ['unassigned', 'Chưa gắn unit'],
  ['unplayable', 'Chưa dùng được trong trò chơi'],
];
type Filters = {
  q: string;
  grades: string[];
  units: string[];
  categories: string[];
  quick: string[];
};
const blankFilters: Filters = {
  q: '',
  grades: [],
  units: [],
  categories: [],
  quick: [],
};
function readFilters(): Filters {
  const params = new URLSearchParams(window.location.search);
  return {
    q: params.get('q') ?? '',
    grades: (params.get('grades') ?? '').split(',').filter(Boolean),
    units: (params.get('units') ?? '').split(',').filter(Boolean),
    categories: (params.get('categories') ?? '').split(',').filter(Boolean),
    quick: (params.get('quick') ?? '').split(',').filter(Boolean),
  };
}
function queryFor(filters: Filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    const text = Array.isArray(value) ? value.join(',') : value.trim();
    if (text) params.set(key, text);
  }
  return params.toString();
}
export default function VocabularyPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(blankFilters);
  const [initialized, setInitialized] = useState(false);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [groups, setGroups] = useState<Record<string, WordEntry[]>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [activeLetter, setActiveLetter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [editor, setEditor] = useState<{
    key: number;
    entry: WordEntry | null;
  } | null>(null);
  const nextOrder = useRef<string[]>([]);
  const returnFocus = useRef<HTMLElement | null>(null);
  const requestVersion = useRef(0);
  const editorCounter = useRef(0);
  const [query, setQuery] = useState('');
  useEffect(() => {
    function restore() {
      setFilters(readFilters());
      setInitialized(true);
    }
    restore();
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  const serialized = queryFor(filters);
  useEffect(() => {
    if (!initialized) return;
    const timer = setTimeout(() => {
      setQuery(serialized);
      router.replace(`/content${serialized ? `?${serialized}` : ''}`, {
        scroll: false,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [serialized, initialized, router]);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      request<Grade[]>('/admin/grades', { signal: controller.signal }),
      request<Category[]>('/admin/categories', { signal: controller.signal }),
    ])
      .then(([grades, categories]) => {
        setGrades(grades);
        setCategories(categories);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(errorText(error));
      });
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => {
    if (!initialized) return;
    const controller = new AbortController();
    requestVersion.current += 1;
    setLoading(true);
    setError('');
    request<WordList>(`/admin/words?${query}`, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setGroups(result.groups ?? {});
        setCounts(result.counts);
        setTotal(result.total);
        setOrderedIds(result.orderedIds);
        setActiveLetter(LETTERS.find((letter) => result.counts[letter]) ?? '');
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(errorText(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, refresh, initialized]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0])
          setActiveLetter(visible[0].target.getAttribute('data-letter') ?? '');
      },
      { rootMargin: '-130px 0px -55% 0px', threshold: 0 },
    );
    document
      .querySelectorAll('[data-letter]')
      .forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [groups]);
  const openExisting = useCallback(async (id: string) => {
    try {
      const entry = await request<WordEntry>(`/admin/words/${id}`);
      editorCounter.current += 1;
      setEditor({ key: editorCounter.current, entry });
    } catch (error) {
      setError(errorText(error));
    }
  }, []);
  function openEditor(entry: WordEntry | null) {
    returnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    nextOrder.current = [...orderedIds];
    editorCounter.current += 1;
    setEditor({ key: editorCounter.current, entry });
  }
  function closeEditor() {
    setEditor(null);
    requestAnimationFrame(() => returnFocus.current?.focus());
  }
  async function saved(word: WordEntry, next: boolean) {
    setStatus(`Đã lưu ${word.lemma}.`);
    setRefresh((value) => value + 1);
    if (next) {
      const index = nextOrder.current.indexOf(word.id);
      const nextId = index >= 0 ? nextOrder.current[index + 1] : null;
      if (nextId) {
        const entry = await request<WordEntry>(`/admin/words/${nextId}`);
        editorCounter.current += 1;
        setEditor({ key: editorCounter.current, entry });
        return;
      }
      setStatus('Đã lưu. Bạn đã hoàn tất danh sách này.');
    }
    closeEditor();
  }
  async function loadMore(letter: string) {
    const version = requestVersion.current;
    setLoadingMore(letter);
    setError('');
    try {
      const result = await request<WordList>(
        `/admin/words?${query}&initial=${encodeURIComponent(letter)}&offset=${groups[letter]?.length ?? 0}`,
      );
      if (version === requestVersion.current)
        setGroups((current) => ({
          ...current,
          [letter]: [...(current[letter] ?? []), ...result.items],
        }));
    } catch (error) {
      if (version === requestVersion.current) setError(errorText(error));
    } finally {
      setLoadingMore('');
    }
  }
  const availableUnits = grades
    .filter(
      (grade) => !filters.grades.length || filters.grades.includes(grade.id),
    )
    .flatMap((grade) =>
      grade.units.map((unit) => ({
        id: unit.id,
        title: `${grade.title} · ${unit.title}`,
      })),
    );
  const activeFilters =
    filters.q ||
    filters.grades.length ||
    filters.units.length ||
    filters.categories.length ||
    filters.quick.length;
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">THƯ VIỆN NỘI DUNG</p>
          <h1>
            Kho từ vựng{' '}
            <span className="heading-count">{loading ? '…' : total}</span>
          </h1>
          <p className="muted">
            Một nơi chăm chút từng từ. Dùng chung cho nhiều bài học.
          </p>
        </div>
        <button
          className="button button-primary"
          onClick={() => openEditor(null)}
        >
          ＋ Thêm từ mới
        </button>
      </header>
      <section className="filter-panel" aria-label="Tìm kiếm và lọc từ">
        <label className="search-field">
          <span aria-hidden>⌕</span>
          <input
            aria-label="Tìm từ tiếng Anh hoặc nghĩa tiếng Việt"
            placeholder="Tìm từ tiếng Anh hoặc nghĩa tiếng Việt…"
            value={filters.q}
            onChange={(event) =>
              setFilters((current) => ({ ...current, q: event.target.value }))
            }
          />
        </label>
        <div className="filter-row">
          <MultiSelect
            label="Khối"
            value={filters.grades}
            options={grades.map((grade) => ({
              id: grade.id,
              title: grade.title,
            }))}
            onChange={(selected) =>
              setFilters((current) => ({
                ...current,
                grades: selected,
                units: current.units.filter((id) =>
                  grades.some(
                    (grade) =>
                      (!selected.length || selected.includes(grade.id)) &&
                      grade.units.some((unit) => unit.id === id),
                  ),
                ),
              }))
            }
          />
          <MultiSelect
            label="Unit"
            value={filters.units}
            options={availableUnits}
            onChange={(units) =>
              setFilters((current) => ({ ...current, units }))
            }
          />
          <MultiSelect
            label="Category"
            value={filters.categories}
            options={categories.map((category) => ({
              id: category.id,
              title: category.titleVi,
            }))}
            onChange={(categories) =>
              setFilters((current) => ({ ...current, categories }))
            }
          />
          {activeFilters ? (
            <button
              className="text-button"
              onClick={() => setFilters(blankFilters)}
            >
              Xóa bộ lọc
            </button>
          ) : null}
        </div>
        <div className="quick-filters">
          {QUICK.map(([id, label]) => (
            <button
              key={id}
              aria-pressed={filters.quick.includes(id)}
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  quick: current.quick.includes(id)
                    ? current.quick.filter((value) => value !== id)
                    : [...current.quick, id],
                }))
              }
            >
              {label}
            </button>
          ))}
        </div>
      </section>
      {status ? (
        <p className="notice notice-success" role="status">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="notice notice-error" role="alert">
          {error}{' '}
          <button
            className="text-button"
            onClick={() => setRefresh((value) => value + 1)}
          >
            Thử lại
          </button>
        </p>
      ) : null}
      <div className="vocabulary-layout">
        <nav className="alphabet-toc" aria-label="Nhóm chữ cái">
          <span className="toc-title">A — Z</span>
          {LETTERS.map((letter) => (
            <button
              key={letter}
              disabled={loading || !counts[letter]}
              aria-current={activeLetter === letter ? 'location' : undefined}
              onClick={() => {
                setActiveLetter(letter);
                document
                  .getElementById(`letter-${letter === '#' ? 'other' : letter}`)
                  ?.scrollIntoView({
                    behavior: window.matchMedia(
                      '(prefers-reduced-motion: reduce)',
                    ).matches
                      ? 'instant'
                      : 'smooth',
                    block: 'start',
                  });
              }}
            >
              <span>{letter === '#' ? 'Khác' : letter}</span>
              <small>{counts[letter] ?? 0}</small>
            </button>
          ))}
        </nav>
        <div className="vocabulary-groups" aria-busy={loading}>
          {loading ? (
            <div className="empty-state" role="status">
              <span>◌</span>
              <h2>Đang mở kho từ…</h2>
            </div>
          ) : !total && !error ? (
            <div className="empty-state">
              <span>Aa</span>
              <h2>
                {activeFilters ? 'Chưa có từ phù hợp' : 'Bắt đầu từ một từ mới'}
              </h2>
              <p>
                {activeFilters
                  ? 'Thử đổi từ khóa hoặc xóa bộ lọc.'
                  : 'Thêm từ đầu tiên hoặc nhập danh sách từ Excel để chuẩn bị bài học.'}
              </p>
              <button
                className="button"
                onClick={() =>
                  activeFilters ? setFilters(blankFilters) : openEditor(null)
                }
              >
                {activeFilters ? 'Xóa bộ lọc' : '＋ Thêm từ mới'}
              </button>
            </div>
          ) : (
            LETTERS.filter((letter) => counts[letter]).map((letter) => (
              <section
                key={letter}
                data-letter={letter}
                id={`letter-${letter === '#' ? 'other' : letter}`}
                className="letter-group"
              >
                <header className="letter-group-heading">
                  <h2>{letter === '#' ? 'Khác' : letter}</h2>
                  <span>{counts[letter]} hồ sơ từ</span>
                </header>
                <div className="word-table-head" aria-hidden>
                  <span>TỪ VỰNG</span>
                  <span>NGHĨA & LOẠI TỪ</span>
                  <span>PHÂN LOẠI & SỬ DỤNG</span>
                </div>
                {(groups[letter] ?? []).map((word) => (
                  <button
                    className="word-row"
                    key={word.id}
                    onClick={() => openEditor(word)}
                    aria-label={`Chỉnh sửa ${word.lemma}, ${word.meaningVi || 'chưa có nghĩa'}`}
                  >
                    <div className="word-title-cell">
                      <AdminImage imageKey={word.imageKey} alt="" />
                      <span>
                        <strong>{word.lemma}</strong>
                        <small className="muted">
                          {word.units.length} unit ·{' '}
                          {new Set(word.units.map((unit) => unit.gradeId)).size}{' '}
                          khối
                        </small>
                      </span>
                    </div>
                    <div className="word-meaning-cell">
                      <span>
                        {word.meaningVi || (
                          <em className="muted">Chưa có nghĩa</em>
                        )}
                      </span>
                      <small className="pos-label">
                        {word.partOfSpeech
                          ? `${word.partOfSpeech} · ${POS_OPTIONS.find(([value]) => value === word.partOfSpeech)?.[1] ?? ''}`
                          : 'Chưa chọn loại từ'}
                      </small>
                    </div>
                    <div className="word-usage-cell">
                      <div className="chips">
                        {word.categories.map((category) => (
                          <span className="chip" key={category.id}>
                            {category.titleVi}
                          </span>
                        ))}
                        {word.units.slice(0, 3).map((unit) => (
                          <span className="chip chip-neutral" key={unit.unitId}>
                            K{unit.gradeLevel} · {unit.title}
                          </span>
                        ))}
                        {word.units.length > 3 ? (
                          <span className="chip chip-neutral">
                            +{word.units.length - 3}
                          </span>
                        ) : null}
                      </div>
                      <div className="word-flags">
                        {!word.imageKey ? <span>Thiếu ảnh</span> : null}
                        {!word.meaningVi ? <span>Thiếu nghĩa</span> : null}
                        {!word.units.length ? (
                          <span>Chưa gắn unit</span>
                        ) : word.unplayable ? (
                          <span>Chưa dùng được trong trò chơi</span>
                        ) : null}
                      </div>
                    </div>
                    <span className="row-arrow" aria-hidden>
                      ↗
                    </span>
                  </button>
                ))}
                {(groups[letter]?.length ?? 0) < counts[letter] ? (
                  <button
                    className="load-more"
                    disabled={!!loadingMore || loading}
                    onClick={() => void loadMore(letter)}
                  >
                    {loadingMore === letter
                      ? 'Đang tải…'
                      : `Xem thêm trong nhóm ${letter === '#' ? 'Khác' : letter} (${groups[letter]?.length ?? 0}/${counts[letter]})`}
                  </button>
                ) : null}
              </section>
            ))
          )}
        </div>
      </div>
      {editor ? (
        <WordDrawer
          key={editor.key}
          entry={editor.entry}
          grades={grades}
          categories={categories}
          onClose={closeEditor}
          onSaved={saved}
          onOpenExisting={(id) => void openExisting(id)}
        />
      ) : null}
    </>
  );
}
