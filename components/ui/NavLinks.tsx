"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** 상단 탭 — 활성: brand-50 바탕 · brand-600 글자 / 비활성: ink-soft. 16/500 · r6 · px12 py8 */
export default function NavLinks({ items, mobile = false }: { items: { href: string; label: string }[]; mobile?: boolean }) {
  const path = usePathname() || "/";
  const active = (href: string) =>
    href === "/" ? path === "/" || path.startsWith("/skills") : path.startsWith(href);
  return (
    <nav
      aria-label="주요 메뉴"
      className={mobile ? "flex items-center gap-1 overflow-x-auto px-3 pb-2 md:hidden" : "hidden items-center gap-1 md:flex"}
    >
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          aria-current={active(it.href) ? "page" : undefined}
          className={`shrink-0 rounded px-3 font-medium transition-colors ${mobile ? "py-1.5 text-sm" : "py-2 text-base"} ${
            active(it.href) ? "bg-brand-50 text-brand-600" : "text-ink-soft hover:bg-surface-muted/50"
          }`}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
