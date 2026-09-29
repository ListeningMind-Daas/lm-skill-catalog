"use client";

/** 필터 알약 — 상단 탭과 같은 활성 색(brand-50 / brand-600)을 작게 쓴다. 토글 버튼이라 aria-pressed 로 상태를 알린다. */
export default function Pills<T extends string>({
  label,
  options,
  value,
  onChange,
  allLabel = "전체",
}: {
  label: string;
  options: { value: T; label: string; count?: number }[];
  value: T | null;
  onChange: (v: T | null) => void;
  allLabel?: string;
}) {
  const cls = (on: boolean) =>
    `inline-flex h-7 items-center gap-1 rounded-full px-3 text-[13px] font-medium transition-colors ${
      on ? "bg-brand-50 text-brand-600" : "text-ink-soft hover:bg-surface-muted/50"
    }`;
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1">
      <button type="button" aria-pressed={value === null} className={cls(value === null)} onClick={() => onChange(null)}>
        {allLabel}
      </button>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          className={cls(value === o.value)}
          onClick={() => onChange(value === o.value ? null : o.value)}
        >
          {o.label}
          {o.count !== undefined && <span className="text-xs text-ink-muted">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
