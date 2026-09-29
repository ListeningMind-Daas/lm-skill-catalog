import CopyButton from "@/components/CopyButton";
import SkillCard from "@/components/SkillCard";
import { Page } from "@/components/ui/AppShell";
import Icon, { type IconName } from "@/components/ui/Icon";
import {
  BackLink,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardFooter,
  CardTitle,
  CodeLine,
  Dot,
  Empty,
  MetaTable,
  MetaText,
  PageTitle,
  SectionHeader,
  Tag,
  type BadgeTone,
} from "@/components/ui/primitives";
import { catalog, toCard } from "@/lib/catalog";

export const metadata = { title: "디자인 시스템 · LM Skills Catalog" };

const SWATCHES: { group: string; items: { name: string; hex: string; use: string }[] }[] = [
  {
    group: "Brand",
    items: [
      { name: "brand-50", hex: "#e2e0f8", use: "활성 탭·알약 바탕" },
      { name: "brand-100", hex: "#d5d2f3", use: "옅은 강조 테두리" },
      { name: "brand-500", hex: "#786ebe", use: "그라데이션 시작" },
      { name: "brand-600", hex: "#5e2cc9", use: "활성 글자·주요 버튼" },
      { name: "brand-700", hex: "#542bb5", use: "hover·그라데이션 끝" },
      { name: "point", hex: "#7c5eec", use: "포인트 강조" },
    ],
  },
  {
    group: "Ink",
    items: [
      { name: "ink", hex: "#3d3a46", use: "본문·제목" },
      { name: "ink-soft", hex: "#5d596a", use: "비활성 탭·보조 본문" },
      { name: "ink-muted", hex: "#6a6773", use: "설명문·메타 (관리자 #9691a2 → AA 보정)" },
      { name: "ink-faint", hex: "#c6c2ce", use: "아이콘·구분점 (글자 금지)" },
    ],
  },
  {
    group: "Surface · Line",
    items: [
      { name: "page", hex: "#fbfafb", use: "페이지 바탕" },
      { name: "surface", hex: "#ffffff", use: "카드·입력칸" },
      { name: "surface-muted", hex: "#eae8ee", use: "태그·표 머리" },
      { name: "line", hex: "#eae8ee", use: "기본 테두리" },
      { name: "line-strong", hex: "#c6c2ce", use: "버튼 테두리·hover" },
    ],
  },
  {
    group: "Semantic",
    items: [
      { name: "link", hex: "#4d62dc", use: "링크·배지 글자 (관리자 #4f64e1 → AA 보정)" },
      { name: "link-bg", hex: "#eef0fc", use: "배지 바탕" },
      { name: "danger", hex: "#e05265", use: "오류" },
      { name: "danger-bg", hex: "#fdeef0", use: "오류 바탕" },
      { name: "primary-dark", hex: "#c81414", use: "로고 레드" },
      { name: "viz-green-100", hex: "#4ca33e", use: "양호·공개" },
      { name: "viz-yellow-100", hex: "#d0a300", use: "주의" },
    ],
  },
];

const TYPE = [
  { name: "Page title", cls: "text-2xl font-semibold", spec: "24 / 600 / 33.6", sample: "Skills" },
  { name: "Detail title", cls: "text-[26px] font-semibold", spec: "26 / 600", sample: "lm-pathfinder-report" },
  { name: "Section / card title", cls: "text-base font-semibold", spec: "16 / 600 / 24", sample: "보고서형" },
  { name: "Nav", cls: "text-base font-medium text-ink-soft", spec: "16 / 500", sample: "설치 방법" },
  { name: "Description", cls: "text-sm leading-[1.625] text-ink-muted", spec: "14 / 400 / 22.75 · ink-muted", sample: "시드 키워드의 검색 여정을 분석해 리치 HTML 리포트를 생성합니다." },
  { name: "Meta / badge", cls: "text-xs font-medium text-ink-muted tracking-[.3px]", spec: "12 / 500 · tracking .3", sample: "KR · DaaS" },
  { name: "Mono", cls: "font-mono text-[15px]", spec: "JetBrains Mono 15", sample: "0.2.2" },
];

const ICONS: IconName[] = ["search", "arrowRight", "arrowLeft", "external", "download", "copy", "check", "login", "plug", "file", "github"];
const TONES: BadgeTone[] = ["link", "brand", "muted", "green", "yellow", "danger"];

function Block({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <SectionHeader title={title} sub={sub} />
      {children}
    </section>
  );
}

export default function DesignPage() {
  const sample = catalog.skills.find((s) => s.folder === "pathfinder-report") ?? catalog.skills[0];
  return (
    <Page>
      <PageTitle>디자인 시스템</PageTitle>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
        Ascent AI Skills Admin(llm-skill-admin.ascentlab.io)의 화면에서 잰 값을 그대로 옮긴 템플릿입니다. 토큰 이름을 관리자 화면의 Tailwind
        테마와 같게 두어서, 두 앱이 컴포넌트를 주고받을 때 클래스를 고치지 않아도 됩니다. 정의는 <code className="font-mono text-ink">tailwind.config.ts</code>와{" "}
        <code className="font-mono text-ink">components/ui/</code>에 있습니다.
      </p>

      <Block title="색" sub="tailwind.config.ts · theme.extend.colors">
        <div className="flex flex-col gap-6">
          {SWATCHES.map((g) => (
            <div key={g.group}>
              <div className="mb-2 text-xs font-medium uppercase tracking-[.3px] text-ink-muted">{g.group}</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {g.items.map((c) => (
                  <div key={c.name} className="overflow-hidden rounded-lg border border-line bg-surface">
                    <div className="h-14 border-b border-line" style={{ background: c.hex }} />
                    <div className="px-3 py-2">
                      <div className="font-mono text-[12.5px] text-ink">{c.name}</div>
                      <div className="font-mono text-[11px] text-ink-muted">{c.hex}</div>
                      <div className="mt-0.5 text-[11.5px] text-ink-muted">{c.use}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Block>

      <Block title="글자" sub="Noto Sans KR · JetBrains Mono">
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          {TYPE.map((t, i) => (
            <div key={t.name} className={`grid gap-1 px-4 py-3 sm:grid-cols-[180px_1fr_200px] sm:items-baseline ${i ? "border-t border-line" : ""}`}>
              <span className="text-xs uppercase tracking-[.3px] text-ink-muted">{t.name}</span>
              <span className={`${t.cls} ${t.cls.includes("text-ink") ? "" : "text-ink"}`}>{t.sample}</span>
              <span className="font-mono text-xs text-ink-muted">{t.spec}</span>
            </div>
          ))}
        </div>
      </Block>

      <Block title="모서리·간격" sub="radius 6 · 10 · full / 본문 최대 폭 1200 · 좌우 20 · 위아래 32">
        <div className="flex flex-wrap gap-4">
          {[
            ["rounded", "6px — 배지·태그·탭"],
            ["rounded-lg", "10px — 카드·버튼·입력칸"],
            ["rounded-full", "9999px — 필터 알약"],
          ].map(([cls, label]) => (
            <div key={cls} className="flex items-center gap-3">
              <div className={`h-12 w-20 border border-line-strong bg-surface ${cls}`} />
              <div>
                <div className="font-mono text-xs text-ink">{cls}</div>
                <div className="text-xs text-ink-muted">{label}</div>
              </div>
            </div>
          ))}
        </div>
      </Block>

      <Block title="버튼" sub="Button · ButtonLink · CopyButton">
        <div className="flex flex-wrap items-center gap-3">
          <Button icon="login">로그인</Button>
          <ButtonLink href="#" icon="github" trailing="external">저장소</ButtonLink>
          <Button variant="outline" icon="download">zip 다운로드</Button>
          <Button variant="soft" icon="download">zip</Button>
          <Button variant="brand">실행</Button>
          <Button variant="ghost">취소</Button>
          <CopyButton text="/plugin install lm-reports@lm-agent-plugins" />
        </div>
      </Block>

      <Block title="배지·태그" sub="Badge(tone) · Tag · MetaText">
        <div className="flex flex-wrap items-center gap-2">
          {TONES.map((t) => <Badge key={t} tone={t}>{t}</Badge>)}
          <span className="mx-2 h-4 w-px bg-line" />
          <Badge tone="link">DaaS</Badge>
          <Dot />
          <MetaText>KR</MetaText>
          <span className="mx-2 h-4 w-px bg-line" />
          <Tag>보고서</Tag>
          <Tag>검색 여정</Tag>
        </div>
      </Block>

      <Block title="아이콘" sub="components/ui/Icon.tsx · 24 격자 · stroke 2">
        <div className="flex flex-wrap gap-2">
          {ICONS.map((n) => (
            <div key={n} className="flex w-24 flex-col items-center gap-1.5 rounded-lg border border-line bg-surface py-3 text-ink-soft">
              <Icon name={n} size={20} />
              <span className="font-mono text-[11px] text-ink-muted">{n}</span>
            </div>
          ))}
        </div>
      </Block>

      <Block title="카드" sub="Card · CardTitle · CardFooter — 실제 데이터 카드와 빈 틀">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {sample && <SkillCard skill={toCard(sample)} />}
          <Card>
            <CardTitle>lm-pathfinder-report-daas</CardTitle>
            <div className="mt-1.5 flex items-center gap-1.5">
              <Badge>DaaS</Badge>
              <Dot />
              <MetaText>KR</MetaText>
            </div>
            <p className="line-clamp-3 mt-3 text-sm leading-[1.625] text-ink-muted">
              카드 설명은 14px · ink-muted · 세 줄에서 자릅니다. 그 아래에 분류 태그, 구분선, 작성자와 보조 버튼이 옵니다.
            </p>
            <div className="mt-3 flex gap-1.5"><Tag>보고서</Tag><Tag>검색 여정</Tag></div>
            <CardFooter>
              <span className="flex items-center gap-1 text-xs text-ink-muted"><Icon name="github" size={13} />Ascent AI</span>
              <Button variant="soft" icon="download">zip</Button>
            </CardFooter>
          </Card>
        </div>
      </Block>

      <Block title="제목 줄" sub="PageTitle · SectionHeader · BackLink">
        <div className="flex flex-col gap-5 rounded-lg border border-dashed border-line p-5">
          <BackLink href="#">스킬 목록</BackLink>
          <PageTitle count={4}>Skills</PageTitle>
          <SectionHeader title="보고서형" sub="조사 결과를 리포트로 만들어내는 스킬" count={4} />
        </div>
      </Block>

      <Block title="메타 표" sub="MetaTable — 상세 화면 속성">
        <MetaTable
          rows={[
            { key: "License", value: "—" },
            { key: "Allowed tools", value: "Bash, Read, Write" },
            { key: "Version", value: "0.2.2", mono: true },
            { key: "Author", value: "AscentKorea" },
          ]}
        />
      </Block>

      <Block title="코드 한 줄·빈 상태" sub="CodeLine · Empty">
        <div className="flex flex-col gap-4">
          <CodeLine action={<CopyButton text="/plugin install lm-reports@lm-agent-plugins" />}>/plugin install lm-reports@lm-agent-plugins</CodeLine>
          <Empty>조건에 맞는 스킬이 없습니다.</Empty>
        </div>
      </Block>
    </Page>
  );
}
