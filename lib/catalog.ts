import fs from "node:fs";
import path from "node:path";
import raw from "@/data/catalog.json";
import demo from "@/data/demo.json";
import examples from "@/data/examples.json";
import { SITE_URL } from "./site";
import type { Band, CardGroup, CardSkill, LandingCard } from "./labels";

export type Skill = {
  name: string;
  folder: string;
  group: string;
  description: string;
  version: string | null;
  author: string | null;
  license: string | null;
  allowedTools: string[];
  triggers: string[];
  connectors: string[];
  fileCount: number;
  skillLines: number;
  files: Record<string, string[]>;
  body: string;
  updated: string | null;
  install: string;
  landing: LandingCard | null;
  kind: string | null;
  connectorsBasis: "declared" | "mentioned";
};

export type Group = {
  id: string;
  title: string;
  sub: string;
  skills: string[];
  installNote: string | null;
  source: {
    kind: "local" | "git";
    repo: string;
    commit: string | null;
    version: string | null;
    url: string | null;
    tag?: string;
    private: boolean | null;
    stale: boolean;
    fallback: boolean;
  };
};

export type Catalog = { generatedAt: string; groups: Group[]; bands: Band[]; skills: Skill[] };

export const catalog = raw as unknown as Catalog;

export { CONNECTOR_LABEL } from "./labels";

export function skillByName(name: string) {
  return catalog.skills.find((s) => s.folder === name);
}
export function groupById(id: string) {
  return catalog.groups.find((g) => g.id === id);
}
export function groupOf(skill: Skill) {
  return groupById(skill.group);
}
/** 스킬이 속한 키트(발행 저장소) 버전 — 스킬 자체 판과 다르다 */
export function kitVersionOf(skill: Skill) {
  return groupOf(skill)?.source.version ?? null;
}

/** 설명문 첫 문장(메타 설명용). 마크다운 강조·목록 기호는 걷어낸다. */
export function summaryOf(desc: string, max = 150) {
  const flat = desc
    .replace(/\*\*/g, "")
    .replace(/^\s*[-\d.]+\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  const cut = flat.search(/(?<=[.。다요])\s/);
  const first = cut > 20 ? flat.slice(0, cut) : flat;
  return first.length > max ? first.slice(0, max - 1) + "…" : first;
}

export function bandLabel(id: string | undefined) {
  return catalog.bands.find((b) => b.id === id)?.label ?? null;
}

export function toCard(s: Skill): CardSkill {
  const g = groupOf(s);
  const band = bandLabel(s.landing?.band);
  return {
    name: s.name,
    folder: s.folder,
    group: s.group,
    groupTitle: g?.title ?? s.group,
    repo: g?.source.repo ?? "",
    description: s.description.replace(/\*\*/g, ""),
    license: s.license,
    version: s.version,
    kitVersion: kitVersionOf(s),
    connectors: s.connectors,
    landing: s.landing,
    hasExample: fs.existsSync(path.join(process.cwd(), "public", "examples", s.folder, "index.html")),
    bandLabel: band,
    search: [s.name, s.landing?.title ?? "", band ?? "", s.description, s.triggers.join(" "), s.connectors.join(" "), s.group]
      .join(" ")
      .toLowerCase(),
  };
}
export function toCardGroup(g: Group): CardGroup {
  return { id: g.id, title: g.title, sub: g.sub, skills: g.skills };
}

/**
 * «테스트 실행» 프롬프트 — Claude 앱에 붙여 넣으면 이 페이지를 브라우저 패널로 열고 스킬을 실행한다.
 * 웹 페이지는 앱 패널을 직접 열 수 없어서, 실행 지시문을 복사해 붙여 넣는 방식이다.
 * 요청 문장: data/demo.json(안전한 요청으로 바꾼 스킬) → 산출물 예시 시드 + 첫 발화 → 자리표시자 없는 첫 발화.
 */
export function testRunOf(s: Skill): { request: string; prompt: string } {
  const override = (demo as Record<string, string>)[s.folder];
  const ex = (examples as Record<string, { seed?: string; request?: string }>)[s.folder] || {};
  const seed = ex.seed;
  const plain = s.triggers.find((t) => !/[○{]/.test(t)) ?? s.triggers[0] ?? s.name;
  const request = override ?? ex.request ?? (seed ? `«${seed}» ${plain}` : plain);
  const page = `${SITE_URL}/skills/${s.folder}/`;
  const hasExample = fs.existsSync(path.join(process.cwd(), "public", "examples", s.folder, "index.html"));
  const lines = [
    `${page} 를 브라우저 패널로 열어 줘.`,
    ...(hasExample ? [`이 스킬의 산출물 예시(${SITE_URL}/examples/${s.folder}/)도 브라우저 패널로 보여 줘.`] : []),
    `그다음 ${s.name} 스킬로 테스트 실행해 줘 — 요청: "${request}"`,
    "- 스킬이 설치돼 있지 않으면 이 페이지의 설치 명령부터 안내해 줘",
    "- API 를 부르기 전에 예상 크레딧을 먼저 알려 주고 내 확인을 받아 줘",
    "- 결과물이 HTML 이면 브라우저 패널로 열어 줘",
  ];
  return { request, prompt: lines.join("\n") };
}
