'use client';

import { Camera, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AVATAR_TYPES } from '../lib/student-avatar';
import { StudentAvatar } from './student-avatar';

export function AvatarPicker({
  id,
  file,
  onChange,
  avatarKey = null,
  displayName = '',
  disabled = false,
}: {
  id: string;
  file: File | null;
  onChange: (file: File | null) => void;
  avatarKey?: string | null;
  displayName?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(
    null,
  );
  const [error, setError] = useState('');
  useEffect(() => {
    if (!file) {
      setPreview(null);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="avatar-field">
      <label htmlFor={id}>
        Ảnh đại diện <span className="auth-optional">(không bắt buộc)</span>
      </label>
      <div className="avatar-controls">
        <label
          htmlFor={id}
          className={`avatar-picker ${disabled ? 'avatar-picker--disabled' : ''}`}
        >
          <span className="avatar-preview" aria-hidden>
            {preview?.file === file ? (
              <img src={preview.url} alt="" />
            ) : (
              <StudentAvatar
                avatarKey={avatarKey}
                displayName={displayName}
                fallback={<Camera size={26} aria-hidden />}
              />
            )}
          </span>
          <span>
            <Camera size={20} aria-hidden />
            {file || avatarKey ? 'Đổi ảnh' : 'Chọn ảnh'}
          </span>
        </label>
        {file ? (
          <button
            className="btn-inline avatar-clear"
            type="button"
            disabled={disabled}
            title="Bỏ ảnh đã chọn"
            aria-label="Bỏ ảnh đã chọn"
            onClick={() => {
              setError('');
              onChange(null);
              inputRef.current?.focus();
            }}
          >
            <X size={20} aria-hidden />
          </button>
        ) : null}
      </div>
      <input
        id={id}
        ref={inputRef}
        className="avatar-input"
        type="file"
        accept={AVATAR_TYPES.join(',')}
        disabled={disabled}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => {
          const selected = event.target.files?.[0];
          if (!selected) return;
          if (
            !AVATAR_TYPES.includes(selected.type) ||
            selected.size > 5 * 1024 * 1024
          ) {
            setError('Hãy chọn ảnh JPG, PNG, WebP hoặc GIF không quá 5 MiB.');
            event.target.value = '';
            onChange(null);
            return;
          }
          setError('');
          onChange(selected);
        }}
      />
      {error ? (
        <p id={`${id}-error`} className="bad" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
