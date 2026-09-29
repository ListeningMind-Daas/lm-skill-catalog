import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import Icon, { type IconName } from "./Icon";

/* ── 버튼 ─────────────────────────────────────────────
 * outline: 헤더 '로그인' · 상세 '저장소' 버튼 (h40 · r10 · 14/700 · line-strong 테두리)
 * soft:    카드 안 'zip' 버튼 (h32 · 흰 바탕 · line 테두리)
 * brand:   주요 실행 (brand-600 채움) */
const BTN = {
  outline: "h-10 px-4 text-sm font-bold border border-line-strong text-ink hover:bg-surface-muted/40",
  soft: "h-8 px-3 text-sm font-medium border border-line bg-surface text-ink hover:border-line-strong",
  brand: "h-10 px-4 text-sm font-bold bg-brand-600 text-white hover:bg-brand-700",
  ghost: "h-8 px-2 text-sm text-ink-soft hover:bg-surface-muted/50",
} as const;
export type ButtonVariant = keyof typeof BTN;

export function buttonClass(variant: ButtonVariant = "outline", extra = "") {
  return `inline-flex items-center justify-center gap-1.5 rounded-lg transition-colors whitespace-nowrap ${BTN[variant]} ${extra}`;
}

export function Button({
  variant = "outline",
  icon,
  className = "",
  children,
  ...rest
}: ComponentProps<"button"> & { variant?: ButtonVariant; icon?: IconName }) {
  return (
    <button type="button" className={buttonClass(variant, className)} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "outline",
  icon,
  trailing,
  external,
  className = "",
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  icon?: IconName;
  trailing?: IconName;
  external?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const inner = (
    <>
      {icon && <Icon name={icon} />}
      {children}
      {trailing && <Icon name={trailing} size={14} className="text-ink-faint" />}
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={buttonClass(variant, className)}>{inner}</a>
  ) : (
    <Link href={href} className={buttonClass(variant, className)}>{inner}</Link>
  );
}

/* ── 배지·태그 ─────────────────────────────────────────
 * Badge link: 카드의 'DaaS' (link-bg · link · 12/500 · r6 · px6 py2)
 * Tag:        카드 하단 '보고서' (surface-muted · ink-muted · 12 · r6 · px8 py2) */
const BADGE = {
  link: "bg-link-bg text-link",
  brand: "bg-brand-50 text-brand-600",
  muted: "bg-surface-muted text-ink-muted",
  danger: "bg-danger-bg text-danger",
  green: "bg-viz-green-50/40 text-viz-green-100",
  yellow: "bg-viz-yellow-50/70 text-viz-yellow-100",
} as const;
export type BadgeTone = keyof typeof BADGE;

export function Badge({ tone = "link", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${BADGE[tone]}`}>
      {children}
    </span>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded bg-surface-muted px-2 py-0.5 text-xs text-ink-muted">{children}</span>;
}

/** 배지 옆 보조 표기 — '· KR' (ink-muted · 12/500 · tracking .3px) */
export function MetaText({ children }: { children: ReactNode }) {
  return <span className="text-xs font-medium tracking-[.3px] text-ink-muted">{children}</span>;
}

export function Dot() {
  return <span aria-hidden="true" className="text-xs text-ink-faint">·</span>;
}

/* ── 카드 ─────────────────────────────────────────────
 * 흰 바탕 · line 테두리 · r10 · p16. 링크 카드는 hover 때 테두리만 짙어진다. */
export function Card({ href, className = "", children }: { href?: string; className?: string; children: ReactNode }) {
  const cls = `flex flex-col rounded-lg border border-line bg-surface p-4 ${className}`;
  return href ? (
    <Link href={href} className={`${cls} group transition-colors hover:border-line-strong`}>{children}</Link>
  ) : (
    <div className={cls}>{children}</div>
  );
}

/** 카드 제목 줄 — 제목(16/600) + 오른쪽 위 화살표(ink-faint → hover 시 brand) */
export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <h3 className="break-all text-base font-semibold text-ink">{children}</h3>
      <Icon name="arrowRight" className="mt-1 text-ink-faint transition-colors group-hover:text-brand-600" />
    </div>
  );
}

export function CardFooter({ children }: { children: ReactNode }) {
  return <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">{children}</div>;
}

/* ── 제목 ─────────────────────────────────────────────
 * PageTitle:     'Skills 4' (24/600 + 개수 ink-muted 16)
 * SectionHeader: '보고서형 · 조사 결과를…' (16/600 + 12 muted, 오른쪽 개수) */
export function PageTitle({ children, count, right }: { children: ReactNode; count?: number; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="flex items-baseline gap-2 text-2xl font-semibold text-ink">
        {children}
        {count !== undefined && <span className="text-base font-normal text-ink-muted">{count}</span>}
      </h1>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

export function SectionHeader({
  title,
  sub,
  count,
  id,
}: {
  title: ReactNode;
  sub?: ReactNode;
  count?: number;
  id?: string;
}) {
  return (
    <div id={id} className="mb-3 flex scroll-mt-28 items-baseline md:scroll-mt-20 justify-between gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {sub && <span className="text-xs text-ink-muted">{sub}</span>}
      </div>
      {count !== undefined && <span className="text-xs text-ink-muted">{count}</span>}
    </div>
  );
}

/* ── 메타 표 ───────────────────────────────────────────
 * 상세 화면의 LICENSE / ALLOWED TOOLS / VERSION 표. 왼쪽 열은 대문자 12 muted, 옅은 바탕. */
export function MetaTable({ rows }: { rows: { key: string; value: ReactNode; mono?: boolean }[] }) {
  return (
    <dl className="overflow-hidden rounded-lg border border-line bg-surface">
      {rows.map((r, i) => (
        <div key={r.key} className={`grid grid-cols-[120px_1fr] sm:grid-cols-[168px_1fr] ${i ? "border-t border-line" : ""}`}>
          <dt className="bg-surface-muted/40 px-4 py-3 text-xs uppercase tracking-[.3px] text-ink-muted">{r.key}</dt>
          <dd className={`min-w-0 break-words px-4 py-2.5 text-ink ${r.mono ? "font-mono text-[15px]" : "text-[15px]"}`}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
      <Icon name="arrowLeft" size={14} />
      {children}
    </Link>
  );
}

/** 코드 한 줄 + 복사 — 설치 명령 등 */
export function CodeLine({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-line bg-surface-muted/40 py-1.5 pl-3 pr-1.5">
      <code className="min-w-0 flex-1 whitespace-pre-wrap break-all py-1 font-mono text-[13px] leading-5 text-ink">{children}</code>
      {action}
    </div>
  );
}

/** 빈 상태 */
export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line py-10 text-center text-sm text-ink-muted">{children}</p>;
}
