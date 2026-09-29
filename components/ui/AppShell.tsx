import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import type { ReactNode } from "react";
import NavLinks from "./NavLinks";

// 로고 파일(public/logo-listeningmind.svg)이 있으면 그것을, 없으면 글자 로고를 쓴다.
const HAS_LOGO = fs.existsSync(path.join(process.cwd(), "public", "logo-listeningmind.svg"));

export function Logo({ product }: { product: string }) {
  return (
    <Link href="/" className="flex items-center gap-3">
      {HAS_LOGO ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/logo-listeningmind.svg" alt="ListeningMind" width={184} height={28} className="h-7 w-auto" />
      ) : (
        <span className="flex items-center gap-2 text-[22px] font-bold tracking-tight text-ink">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary-dark text-sm font-black text-white">L</span>
          ListeningMind
        </span>
      )}
      <span className="hidden h-5 w-px bg-line sm:block" />
      <span className="hidden text-[15px] text-ink-soft sm:block">{product}</span>
    </Link>
  );
}

/** 상단 바 — sticky · 흰 85% + blur 8 · 아래 테두리 line · 높이 57 (768px 미만은 탭이 아래 줄로 내려온다) */
export function AppHeader({
  product,
  nav,
  right,
}: {
  product: string;
  nav: { href: string; label: string }[];
  right?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur-[8px]">
      <div className="mx-auto flex h-14 max-w-page items-center gap-6 px-5">
        <Logo product={product} />
        <NavLinks items={nav} />
        {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
      </div>
      <NavLinks items={nav} mobile />
    </header>
  );
}

export function AppFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="border-t border-line bg-surface/60">
      <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-[13px] text-ink-muted">
        {children}
      </div>
    </footer>
  );
}

/** 본문 폭 — 최대 1200 · 좌우 20 · 위아래 32 */
export function Page({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-page flex-1 px-4 py-8 sm:px-5">{children}</main>;
}
