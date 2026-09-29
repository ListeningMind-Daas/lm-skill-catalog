import { Badge, Card, CardFooter, CardTitle, Dot, MetaText, Tag } from "./ui/primitives";
import Icon from "./ui/Icon";
import { CONNECTOR_LABEL, type CardSkill } from "@/lib/labels";

/** 스킬 카드 — 관리자 화면 카드와 같은 층위: 제목·화살표 / 배지 줄 / 설명 3줄 / 태그 / 구분선 + 바닥 줄 */
export default function SkillCard({ skill }: { skill: CardSkill }) {
  const tags = skill.connectors.filter((c) => c !== "keyword_info").slice(0, 3);
  return (
    <Card href={`/skills/${skill.folder}/`}>
      {skill.landing && (
        <div className="mb-1 flex items-baseline gap-2 text-[13px]">
          <span className="font-mono text-ink-muted">{skill.landing.no}</span>
          <span className="font-medium text-ink-soft">{skill.landing.title}</span>
        </div>
      )}
      <CardTitle>{skill.name}</CardTitle>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <Badge tone="link">{skill.groupTitle}</Badge>
        {skill.bandLabel && <Badge tone="brand">{skill.bandLabel}</Badge>}
        {skill.license && (<><Dot /><MetaText>{skill.license}</MetaText></>)}
        {skill.hasExample && <Badge tone="green">예시 있음</Badge>}
      </div>
      <p className="line-clamp-3 mt-3 text-sm leading-[1.625] text-ink-muted">{skill.description || "설명 없음"}</p>
      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((c) => <Tag key={c}>{CONNECTOR_LABEL[c] ?? c}</Tag>)}
        </div>
      )}
      <div className="flex-1" />
      <CardFooter>
        <span className="flex items-center gap-1 text-xs text-ink-muted">
          <Icon name="github" size={13} />
          {skill.repo || "Ascent AI"}
        </span>
        {skill.version ? (
          <span className="font-mono text-xs text-ink-muted">v{skill.version}</span>
        ) : skill.kitVersion ? (
          <span className="font-mono text-xs text-ink-muted" title="스킬 자체 판 표기가 없어 키트 버전을 보인다">키트 v{skill.kitVersion}</span>
        ) : null}
      </CardFooter>
    </Card>
  );
}
