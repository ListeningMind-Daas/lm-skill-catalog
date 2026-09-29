import Link from "next/link";
import { notFound } from "next/navigation";
import CopyButton from "@/components/CopyButton";
import ExampleFrame from "@/components/ExampleFrame";
import Icon from "@/components/ui/Icon";
import { Page } from "@/components/ui/AppShell";
import { BackLink, Badge, ButtonLink, CodeLine, MetaTable, SectionHeader, Tag } from "@/components/ui/primitives";
import {
  catalog,
  CONNECTOR_LABEL,
  groupOf,
  skillByName,
  summaryOf,
  testRunOf,
  kitVersionOf,
  bandLabel,
} from "@/lib/catalog";
import { renderSkillMarkdown, tocOf } from "@/lib/markdown";

export function generateStaticParams() {
  return catalog.skills.map((s) => ({ name: s.folder }));
}

export function generateMetadata({ params }: { params: { name: string } }) {
  const s = skillByName(params.name);
  return s ? { title: `${s.name} · LM Skills Catalog`, description: summaryOf(s.description, 160) } : {};
}

export default function SkillPage({ params }: { params: { name: string } }) {
  const s = skillByName(params.name);
  if (!s) notFound();
  const group = groupOf(s);
  const src = group?.source;
  const repoUrl = src?.url ? `${src.url}/tree/${src.tag ?? "main"}/skills/${s.folder}` : null;
  const kit = kitVersionOf(s);
  const version = s.version ? (kit ? `${s.version} (키트 v${kit})` : s.version) : kit ? `키트 v${kit} (스킬 판 표기 없음)` : "—";
  // 날짜의 뜻이 출처마다 다르다 — git 출처는 발행 저장소에 반영된 날, local 은 dev 저장소 마지막 커밋
  const updatedKey = src?.kind === "git" ? "Published" : "Last commit";
  const test = testRunOf(s);
  const html = renderSkillMarkdown(s.body);
  const toc = tocOf(s.body);
  const siblings = group ? group.skills.filter((n) => n !== s.folder) : [];
  const fileGroups = Object.entries(s.files).sort(([a], [b]) => (a === "." ? -1 : b === "." ? 1 : a.localeCompare(b)));

  return (
    <Page>
      <BackLink href="/">스킬 목록</BackLink>

      {s.landing && (
        <div className="mt-6 flex flex-wrap items-baseline gap-2 text-sm">
          <span className="font-mono text-ink-muted">{s.landing.no}</span>
          <span className="font-medium text-ink-soft">{s.landing.title}</span>
          {bandLabel(s.landing.band) && <Badge tone="brand">{bandLabel(s.landing.band)}</Badge>}
        </div>
      )}
      <div className={`${s.landing ? "mt-2" : "mt-6"} flex flex-wrap items-start justify-between gap-3`}>
        <h1 className="break-all text-[26px] font-semibold leading-tight text-ink">{s.name}</h1>
        <div className="flex gap-2">
          {repoUrl && (
            <ButtonLink href={repoUrl} external icon="github" trailing="external">저장소</ButtonLink>
          )}
          <CopyButton src={`/raw/${s.folder}/SKILL.md`} label="SKILL.md 복사" variant="outline" title="frontmatter 포함 · 변경 이력 제외" />
          <CopyButton text={test.prompt} label="테스트 실행" variant="brand" title="Claude 앱에 붙여 넣는 실행 프롬프트를 복사합니다" fallbackTarget="test-run-prompt" />
        </div>
      </div>
      <p className="mt-3 whitespace-pre-line text-base leading-7 text-ink-muted">{s.description.replace(/\*\*/g, "")}</p>

      <div className="mt-6">
        <MetaTable
          rows={[
            { key: "Collection", value: group?.title ?? "—" },
            ...(s.landing ? [{ key: "Landing card", value: `${s.landing.no} · ${s.landing.title} (${bandLabel(s.landing.band) ?? s.landing.band})` }] : []),
            { key: "License", value: s.license ?? "—" },
            { key: "Allowed tools", value: s.allowedTools.length ? s.allowedTools.join(", ") : "—" },
            { key: "Version", value: version, mono: true },
            { key: "Author", value: s.author ?? "—" },
            { key: updatedKey, value: s.updated ?? "—", mono: true },
            { key: "Files", value: `${s.fileCount}개 · SKILL.md ${s.skillLines}줄` },
          ]}
        />
      </div>

      <ExampleFrame folder={s.folder} />

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_260px]">
        <article className="min-w-0">
          <section id="test-run" className="mb-8 scroll-mt-28 md:scroll-mt-20">
            <SectionHeader title="테스트 실행" sub="Claude 앱에 붙여 넣으면 이 페이지를 오른쪽 브라우저 패널로 열고 스킬을 실행합니다" />
            <CodeLine id="test-run-prompt" action={<CopyButton text={test.prompt} fallbackTarget="test-run-prompt" />}>{test.prompt}</CodeLine>
            <p className="mt-2 text-[13px] leading-5 text-ink-muted">
              웹 페이지는 앱의 브라우저 패널을 직접 열 수 없어 실행 지시문을 복사해 붙여 넣는 방식입니다. API 를 부르기 전에 예상 크레딧을 먼저 보여 주고
              확인을 받습니다 — 실행하는 컴퓨터에 스킬 설치와 ListeningMind API 키가 필요합니다.
            </p>
          </section>

          <section className="mb-8">
            <SectionHeader title="설치" sub={group?.installNote ?? undefined} />
            <CodeLine action={<CopyButton text={s.install} />}>{s.install}</CodeLine>
            {src?.private && (
              <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-muted">
                <Icon name="login" size={14} />
                {src.repo} 저장소는 현재 비공개입니다 — 읽기 권한이 있는 계정에서만 받을 수 있습니다.
              </p>
            )}
          </section>

          {s.triggers.length > 0 && (
            <section className="mb-8">
              <SectionHeader title="이렇게 부르면 켜집니다" sub="설명문에 적힌 발화 예시" count={s.triggers.length} />
              <div className="flex flex-wrap gap-1.5">
                {s.triggers.map((t) => (
                  <span key={t} className="rounded-full border border-line bg-surface px-3 py-1 text-[13px] text-ink-soft">“{t}”</span>
                ))}
              </div>
            </section>
          )}

          <SectionHeader title="SKILL.md" sub="본문 · 변경 이력 제외" />
          <div className="rounded-lg border border-line bg-surface px-5 py-2 sm:px-7">
            <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </article>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
          <div>
            <SectionHeader title="API 커넥터" count={s.connectors.length} />
            {s.connectors.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {s.connectors.map((c) => <Tag key={c}>{CONNECTOR_LABEL[c] ?? c}</Tag>)}
              </div>
            ) : (
              <p className="text-[13px] text-ink-soft">{s.kind === "meta" ? "API를 직접 부르지 않는 메타 스킬입니다." : "없음"}</p>
            )}
            <p className="mt-2 text-xs leading-5 text-ink-muted">
              {s.connectorsBasis === "declared"
                ? "스킬 머리 주석(lm-skill)에 선언된 커넥터입니다."
                : "SKILL.md에 이름이 나온 커넥터입니다. 실제 호출 여부는 실행 경로에 따라 다릅니다."}
            </p>
          </div>

          {toc.length > 0 && (
            <div>
              <SectionHeader title="목차" />
              <ul className="max-h-[40vh] overflow-auto text-[13px]">
                {toc.map((h) => (
                  <li key={h.id} className={h.level === 3 ? "pl-3" : ""}>
                    <a href={`#${h.id}`} className={`block py-1 hover:text-brand-600 ${h.level === 3 ? "text-ink-muted" : "text-ink-soft"}`}>{h.text}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <SectionHeader title="폴더 구성" count={s.fileCount} />
            <div className="overflow-hidden rounded-lg border border-line bg-surface">
              {fileGroups.map(([dir, files], i) => (
                <details key={dir} className={i ? "border-t border-line" : ""}>
                  <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-[13px] text-ink-soft hover:bg-surface-muted/40">
                    <span className="font-mono">{dir === "." ? "./" : `${dir}/`}</span>
                    <span className="text-xs text-ink-muted">{files.length}</span>
                  </summary>
                  <ul className="border-t border-line bg-surface-muted/20 px-3 py-2 font-mono text-[11.5px] leading-5 text-ink-muted">
                    {files.slice(0, 60).map((f) => <li key={f} className="break-all">{f}</li>)}
                    {files.length > 60 && <li>… 외 {files.length - 60}개</li>}
                  </ul>
                </details>
              ))}
            </div>
          </div>

          {siblings.length > 0 && (
            <div>
              <SectionHeader title="같은 컬렉션" count={siblings.length} />
              <ul className="text-[13px]">
                {siblings.map((n) => (
                  <li key={n}><Link href={`/skills/${n}/`} className="block py-1 text-ink-soft hover:text-brand-600">{n}</Link></li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </Page>
  );
}
