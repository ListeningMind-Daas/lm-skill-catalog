import { Page } from "@/components/ui/AppShell";
import { Badge, Card, CardFooter, CardTitle, Dot, MetaText, PageTitle, Tag } from "@/components/ui/primitives";
import { catalog } from "@/lib/catalog";

export const metadata = { title: "컬렉션 · LM Skills Catalog" };

export default function CollectionsPage() {
  const { groups } = catalog;
  return (
    <Page>
      <PageTitle count={groups.length}>컬렉션</PageTitle>
      <p className="mt-2 text-sm text-ink-muted">카탈로그에 싣는 스킬 묶음. 묶음마다 출처 저장소와 설치 방법이 다르다.</p>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {groups.map((g) => (
          <Card key={g.id} href={`/collections/${g.id}/`}>
            <CardTitle>{g.title}</CardTitle>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge tone="brand">스킬 {g.skills.length}</Badge>
              {g.source.version && (<><Dot /><MetaText>v{g.source.version}</MetaText></>)}
            </div>
            <p className="mt-3 text-sm leading-[1.625] text-ink-muted">{g.sub}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {g.skills.slice(0, 5).map((s) => <Tag key={s}>{s}</Tag>)}
              {g.skills.length > 5 && <Tag>+{g.skills.length - 5}</Tag>}
            </div>
            <div className="flex-1" />
            <CardFooter>
              <span className="truncate font-mono text-xs text-ink-muted">{g.source.repo}@{g.source.commit}</span>
            </CardFooter>
          </Card>
        ))}
      </div>
    </Page>
  );
}
