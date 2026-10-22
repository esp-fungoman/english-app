const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

export function apiUrl(path: string) {
  return `${API}/api${path}`;
}

export type StudentMe = {
  id: string;
  username: string;
  displayName: string;
  gradeId: string | null;
  school: string | null;
  className: string | null;
  avatarKey: string | null;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-App-Request': '1',
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
  });
  if (!res.ok) {
    let message = await res.text();
    try {
      const parsed = JSON.parse(message) as { message?: string | string[] };
      if (Array.isArray(parsed.message)) message = parsed.message.join(', ');
      else if (parsed.message) message = parsed.message;
    } catch {
      /* keep text */
    }
    if (res.status === 429)
      message = `Bạn thao tác quá nhanh. Hãy thử lại sau ${res.headers.get('Retry-After') || 'ít'} giây.`;
    throw new ApiError(message || `Lỗi ${res.status}`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function getMe(): Promise<StudentMe | null> {
  try {
    return await api<StudentMe>('/student/auth/me');
  } catch {
    return null;
  }
}

export async function registerStudent(body: {
  username: string;
  password: string;
  confirmPassword: string;
  displayName: string;
  gradeId: string;
  school?: string;
  className?: string;
}): Promise<StudentMe> {
  return api<StudentMe>('/student/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function loginStudent(body: {
  username: string;
  password: string;
}): Promise<StudentMe> {
  return api<StudentMe>('/student/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function logoutStudent(): Promise<void> {
  await api('/student/auth/logout', { method: 'POST' });
}

export function afterAuthPath(me: StudentMe): string {
  if (!me.gradeId) return '/onboarding/grade';
  return `/path/${me.gradeId}`;
}

export function speakWord(word: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word);
  u.lang = 'en-US';
  u.rate = 0.85;
  window.speechSynthesis.speak(u);
}

export function spellWord(word: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const parts = [word, ...word.split('')];
  parts.forEach((part, i) => {
    const u = new SpeechSynthesisUtterance(
      part.toUpperCase() === part && part.length === 1 ? part : word,
    );
    u.lang = 'en-US';
    u.rate = i === 0 ? 0.85 : 0.7;
    u.volume = 1;
    window.speechSynthesis.speak(u);
  });
}
