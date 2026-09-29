import "./globals.css";
import { AppFooter, AppHeader } from "@/components/ui/AppShell";
import { MetaText } from "@/components/ui/primitives";
import { catalog } from "@/lib/catalog";

export const metadata = {
  title: "LM Skills Catalog",
  description: "ListeningMind 리포트형 스킬과 lm-skills 공개 스킬 목록",
};

const NAV = [
  { href: "/", label: "Skills" },
  { href: "/collections/", label: "컬렉션" },
  { href: "/design/", label: "디자인 시스템" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const kit = catalog.groups.find((g) => g.source.version);
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body className="flex min-h-screen flex-col">
        <AppHeader product="Skills Catalog" nav={NAV} right={kit ? <MetaText>{kit.source.repo.split("/").pop()} v{kit.source.version}</MetaText> : undefined} />
        {children}
        <AppFooter>
          <span>© Ascent AI · ListeningMind Skills Catalog</span>
          <span className="font-mono text-xs text-ink-muted">
            {catalog.groups.map((g) => `${g.source.repo}@${g.source.commit ?? "?"}`).join(" · ")} · {catalog.generatedAt.slice(0, 10)}
          </span>
        </AppFooter>
      </body>
    </html>
  );
}
