import { notFound } from "next/navigation";
import SkillCard from "@/components/SkillCard";
import { Page } from "@/components/ui/AppShell";
import { BackLink, MetaTable, SectionHeader } from "@/components/ui/primitives";
import { catalog, groupById, skillByName, toCard } from "@/lib/catalog";

export function generateStaticParams() {
  return catalog.groups.map((g) => ({ id: g.id }));
}

export function generateMetadata({ params }: { params: { id: string } }) {
  const g = groupById(params.id);
  return g ? { title: `${g.title} · LM Skills Catalog`, description: g.sub } : {};
}

export default function CollectionPage({ params }: { params: { id: string } }) {
  const g = groupById(params.id);
  if (!g) notFound();
  const skills = g.skills.map(skillByName).filter(Boolean);
  const gh = g.source.url;

  return (
    <Page>
      <BackLink href="/collections/">컬렉션 목록</BackLink>
      <h1 className="mt-6 text-[26px] font-semibold leading-tight text-ink">{g.title}</h1>
      <p className="mt-3 text-base leading-7 text-ink-muted">{g.sub}</p>

      <div className="mt-6">
        <MetaTable
          rows={[
            { key: "Source", value: gh ? <a href={gh} target="_blank" rel="noreferrer" className="text-link hover:underline">{g.source.repo}</a> : g.source.repo },
            {
              key: "Commit",
              value: `${g.source.commit ?? "—"}${g.source.stale ? " · 갱신 실패로 캐시 사용" : ""}${g.source.fallback ? " · dev 원본으로 대신함" : ""}`,
              mono: true,
            },
            ...(g.source.private ? [{ key: "Access", value: "비공개 저장소 — 읽기 권한이 있는 계정만 받을 수 있다" }] : []),
            { key: "Version", value: g.source.version ?? "—", mono: true },
            { key: "Install", value: g.installNote ?? "—" },
            { key: "Skills", value: `${skills.length}종` },
          ]}
        />
      </div>

      <section className="mt-10">
        <SectionHeader title="스킬" count={skills.length} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {skills.map((s) => <SkillCard key={s!.folder} skill={toCard(s!)} />)}
        </div>
      </section>
    </Page>
  );
}
