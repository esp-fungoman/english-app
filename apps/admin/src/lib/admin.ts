export const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';
export const POS_OPTIONS = [
  ['noun', 'Danh từ'],
  ['verb', 'Động từ'],
  ['adjective', 'Tính từ'],
  ['adverb', 'Trạng từ'],
  ['pronoun', 'Đại từ'],
  ['preposition', 'Giới từ'],
  ['determiner', 'Từ hạn định'],
  ['conjunction', 'Liên từ'],
  ['interjection', 'Thán từ'],
  ['other', 'Khác'],
] as const;
export const ACTIVITIES = {
  group: 'Ghép từ theo nhóm',
  odd_letter: 'Tìm chữ cái thừa',
  scramble: 'Sắp xếp chữ cái',
  listen_spell: 'Nghe và chọn chữ cái',
};
export type Activity = keyof typeof ACTIVITIES;
export type Category = { id: string; slug: string; titleVi: string };
export type Unit = {
  id: string;
  gradeId: string;
  title: string;
  sortOrder: number;
  manualLock: boolean;
  opensAt: string | null;
  open: boolean;
  lockReason: string | null;
  groupMode: 'single' | 'board';
  boardAvailable: boolean;
  wordCount: number;
  activities: { activityType: Activity }[];
};
export type Grade = { id: string; level: number; title: string; units: Unit[] };
export type Availability = Record<
  Activity,
  { usable: boolean; reason: string | null }
>;
export type Usage = {
  id: string;
  unitId: string;
  title: string;
  gradeId: string;
  gradeLevel: number;
  categoryIds: string[];
  categories: Category[];
  activities: Availability;
};
export type WordEntry = {
  id: string;
  lemma: string;
  meaningVi: string | null;
  partOfSpeech: string | null;
  imageKey: string | null;
  audioKey: string | null;
  initial: string;
  categoryIds: string[];
  categories: Category[];
  units: Usage[];
  activities: Availability;
  unplayable: boolean;
};
export type WordList = {
  orderedIds: string[];
  groups?: Record<string, WordEntry[]>;
  total: number;
  counts: Record<string, number>;
  items: WordEntry[];
  hasMore: boolean;
};
export type WordDraft = {
  lemma: string;
  meaningVi: string;
  partOfSpeech: string;
  imageKey: string | null;
  audioKey: string | null;
  categoryIds: string[];
  units: { unitId: string; categoryIds: string[] }[];
};
export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API}/api${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'X-App-Request': '1',
        ...(options.body && !(options.body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new Error('Không kết nối được máy chủ. Hãy thử lại.');
  }
  if (response.status === 429)
    throw new Error(
      `Bạn thao tác quá nhanh. Hãy thử lại sau ${response.headers.get('Retry-After') || 'ít'} giây.`,
    );
  if (response.status === 401 && path !== '/admin/auth/login') {
    window.location.assign('/');
    throw new Error('Phiên đăng nhập đã hết hạn.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      Array.isArray(data?.message)
        ? data.message.join('. ')
        : (data?.message ?? 'Không thực hiện được. Hãy thử lại.'),
    );
  return data as T;
}
export function errorText(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Không thực hiện được. Hãy thử lại.';
}
export function vietnamTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(value))
    : 'Chưa đặt lịch';
}
export function toLocalInput(value: string | null) {
  if (!value) return '';
  const date = new Date(new Date(value).getTime() + 7 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 16);
}
export function fromLocalInput(value: string) {
  return value ? new Date(`${value}:00+07:00`).toISOString() : null;
}
