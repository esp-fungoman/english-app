'use client';

import { EmptyStateArt } from '../../components/animations/student-effects';

import { StudentLoading } from '../../components/animations/student-animation';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Search, Volume2 } from 'lucide-react';
import { StudentNav } from '../../components/student-nav';
import { WordImage } from '../../components/word-image';
import { api, getMe, speakWord, type StudentMe } from '../../lib/api';
import type { WordbookData } from '../../lib/learning';

const PART_OF_SPEECH_VI: Record<string, string> = {
  noun: 'Danh từ',
  verb: 'Động từ',
  adjective: 'Tính từ',
  adverb: 'Trạng từ',
  pronoun: 'Đại từ',
  preposition: 'Giới từ',
  determiner: 'Từ hạn định',
  conjunction: 'Liên từ',
  interjection: 'Thán từ',
  other: 'Loại từ khác',
};

export default function WordbookPage() {
  const router = useRouter();
  const [me, setMe] = useState<StudentMe | null>(null);
  const [data, setData] = useState<WordbookData | null>(null);
  const [error, setError] = useState('');
  const [unitId, setUnitId] = useState('all');
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [audioAvailable, setAudioAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    setAudioAvailable(
      typeof window.speechSynthesis?.speak === 'function' &&
        typeof window.SpeechSynthesisUtterance === 'function',
    );
    (async () => {
      const student = await getMe();
      if (!student) return router.replace('/login');
      if (!student.gradeId) return router.replace('/onboarding/grade');
      if (!active) return;
      setMe(student);
      const wordbook = await api<WordbookData>('/learning/wordbook');
      if (active) setData(wordbook);
    })().catch(() => {
      if (active) setError('Chưa tải được sổ từ. Hãy thử lại.');
    });
    return () => {
      active = false;
    };
  }, [router]);

  const categories = useMemo(
    () =>
      [
        ...new Set(
          data?.units.flatMap((unit) =>
            unit.words.flatMap((word) => word.categories),
          ) ?? [],
        ),
      ].sort(),
    [data],
  );
  const words = useMemo(
    () =>
      data?.units.flatMap((unit) =>
        unit.words.map((word) => ({
          ...word,
          unitId: unit.id,
          unitTitle: unit.title,
        })),
      ) ?? [],
    [data],
  );
  const filtered = words.filter(
    (word) =>
      (unitId === 'all' || word.unitId === unitId) &&
      (category === 'all' || word.categories.includes(category)) &&
      `${word.lemma} ${word.meaningVi ?? ''}`
        .toLocaleLowerCase('vi')
        .includes(query.trim().toLocaleLowerCase('vi')),
  );

  return (
    <main className="wordbook-screen">
      {me ? <StudentNav me={me} /> : null}
      <header className="learning-heading">
        <p className="learning-kicker">
          <BookOpen size={20} aria-hidden /> Sổ từ của mình
        </p>
        <h1>Những từ mình đang học</h1>
        <p className="muted">
          {words.length} từ trong {data?.units.length ?? 0} unit đang mở
        </p>
      </header>
      {error ? (
        <p className="bad" role="alert">
          {error}
        </p>
      ) : null}
      {!data && !error ? <StudentLoading>Đang mở sổ từ…</StudentLoading> : null}
      {data && words.length === 0 ? (
        <section className="learning-empty">
          <EmptyStateArt />
          <h2>Chưa có từ để xem</h2>
          <p>Các unit đang mở của khối này chưa có từ vựng.</p>
          <Link
            className="btn home-next-action"
            href={me?.gradeId ? `/path/${me.gradeId}` : '/'}
          >
            Về hành trình
          </Link>
        </section>
      ) : null}
      {data && words.length > 0 ? (
        <>
          <div className="wordbook-filters">
            <label>
              Unit
              <select
                value={unitId}
                onChange={(event) => {
                  setUnitId(event.target.value);
                  setCategory('all');
                }}
              >
                <option value="all">Tất cả unit</option>
                {data.units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nhóm
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="all">Tất cả nhóm</option>
                {categories.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="wordbook-search">
              Tìm từ
              <span>
                <Search size={18} aria-hidden />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tên từ hoặc nghĩa"
                />
              </span>
            </label>
          </div>
          <p className="wordbook-count" aria-live="polite">
            {filtered.length} từ
          </p>
          {filtered.length ? (
            <div className="wordbook-grid">
              {filtered.map((word) => (
                <article className="wordbook-card" key={word.id}>
                  <div className="wordbook-art">
                    <span aria-hidden>{word.lemma[0]?.toUpperCase()}</span>
                    <WordImage imageKey={word.imageKey} alt={word.lemma} />
                  </div>
                  <div className="wordbook-copy">
                    <p className="wordbook-unit-label">
                      {word.unitTitle} ·{' '}
                      {word.categories.join(', ') || 'Từ vựng'}
                    </p>
                    <h2>{word.lemma}</h2>
                    <p>{word.meaningVi || 'Chưa có nghĩa tiếng Việt'}</p>
                    {word.partOfSpeech ? (
                      <p className="wordbook-part-of-speech">
                        {PART_OF_SPEECH_VI[word.partOfSpeech] ??
                          word.partOfSpeech}
                      </p>
                    ) : null}
                    <span
                      className={`wordbook-state ${word.needsReview ? 'wordbook-state--review' : ''}`}
                    >
                      {word.needsReview
                        ? 'Cần ôn'
                        : word.practiced
                          ? 'Đã luyện'
                          : 'Chưa luyện'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="wordbook-speak"
                    aria-label={`Nghe từ ${word.lemma}`}
                    title={
                      audioAvailable
                        ? 'Nghe phát âm'
                        : 'Thiết bị chưa hỗ trợ âm thanh'
                    }
                    onClick={() => speakWord(word.lemma)}
                    disabled={!audioAvailable}
                  >
                    <Volume2 size={23} aria-hidden />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="learning-empty">Không có từ nào khớp bộ lọc.</p>
          )}
        </>
      ) : null}
    </main>
  );
}
