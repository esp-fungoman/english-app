import { useRef } from 'react';
import { api, ApiError } from './api';

export const AVATAR_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

async function uploadStudentAvatar(
  studentId: string,
  file: File,
): Promise<string> {
  if (file.size > 5 * 1024 * 1024)
    throw new Error('Ảnh vượt quá 5 MiB. Hãy chọn ảnh nhỏ hơn.');
  if (!AVATAR_TYPES.includes(file.type))
    throw new Error('Hãy chọn ảnh JPG, PNG, WebP hoặc GIF.');
  let ticket: { url: string; key: string; contentType: string };
  try {
    ticket = await api('/student/uploads/presign', {
      method: 'POST',
      body: JSON.stringify({ filename: file.name, contentType: file.type }),
    });
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 501)
      throw new Error(
        'Chưa lưu được ảnh: kho ảnh chưa được cấu hình (501). Bạn có thể thêm ảnh sau trong Cài đặt.',
      );
    if (cause instanceof TypeError)
      throw new Error('Chưa kết nối được kho ảnh. Hãy thử lại.');
    throw cause;
  }
  const prefix = `uploads/avatars/${studentId}/`;
  if (
    !ticket ||
    typeof ticket.key !== 'string' ||
    !ticket.key.startsWith(prefix) ||
    ticket.key.includes('..') ||
    !AVATAR_TYPES.includes(ticket.contentType) ||
    typeof ticket.url !== 'string' ||
    !/^https?:\/\//.test(ticket.url)
  )
    throw new Error('Đường dẫn tải ảnh không hợp lệ. Hãy thử lại.');
  try {
    const response = await fetch(ticket.url, {
      method: 'PUT',
      credentials: 'omit',
      headers: { 'Content-Type': ticket.contentType },
      body: file,
    });
    if (!response.ok) throw new Error('Upload failed');
  } catch {
    throw new Error(
      'Chưa tải được ảnh. Hãy kiểm tra kết nối hoặc thử lại sau.',
    );
  }
  return ticket.key;
}

export function useAvatarUpload() {
  const uploaded = useRef<{
    studentId: string;
    file: File;
    key: string;
  } | null>(null);
  return async (studentId: string, file: File) => {
    if (
      uploaded.current?.studentId === studentId &&
      uploaded.current.file === file
    )
      return uploaded.current.key;
    const key = await uploadStudentAvatar(studentId, file);
    // A failed profile PATCH can reuse this key without uploading another object.
    uploaded.current = { studentId, file, key };
    return key;
  };
}
