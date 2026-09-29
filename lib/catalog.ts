import fs from "node:fs";
import path from "node:path";
import raw from "@/data/catalog.json";
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
    hasExample: fs.existsSync(path.join(process.cwd(), "public", "examples", `${s.folder}.html`)),
    bandLabel: band,
    search: [s.name, s.landing?.title ?? "", band ?? "", s.description, s.triggers.join(" "), s.connectors.join(" "), s.group]
      .join(" ")
      .toLowerCase(),
  };
}
export function toCardGroup(g: Group): CardGroup {
  return { id: g.id, title: g.title, sub: g.sub, skills: g.skills };
}
