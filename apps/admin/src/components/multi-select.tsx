'use client';
export function MultiSelect({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: { id: string; title: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <details className="multi-select">
      <summary>
        {label}{' '}
        {value.length ? (
          <span className="count-pill">{value.length}</span>
        ) : (
          <span className="muted">Tất cả</span>
        )}
      </summary>
      <div className="multi-select-menu">
        <button
          type="button"
          className="text-button"
          disabled={disabled}
          onClick={() => onChange([])}
        >
          Bỏ chọn
        </button>
        {options.length ? (
          options.map((option) => (
            <label className="check-label" key={option.id}>
              <input
                type="checkbox"
                checked={value.includes(option.id)}
                disabled={disabled}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...value, option.id]
                      : value.filter((id) => id !== option.id),
                  )
                }
              />
              {option.title}
            </label>
          ))
        ) : (
          <p className="muted">Chưa có lựa chọn.</p>
        )}
      </div>
    </details>
  );
}
