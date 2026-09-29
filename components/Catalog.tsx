"use client";
import { useEffect, useRef, useState } from "react";
import SkillCard from "./SkillCard";
import Pills from "./ui/Pills";
import SearchInput from "./ui/SearchInput";
import { Empty, PageTitle, SectionHeader } from "./ui/primitives";
import type { Band, CardGroup, CardSkill } from "@/lib/labels";

export default function Catalog({ skills, groups, bands }: { skills: CardSkill[]; groups: CardGroup[]; bands: Band[] }) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [band, setBand] = useState<string | null>(null);

  // 필터 상태는 URL 해시에 남겨 링크로 공유할 수 있게 한다 (#c=lm-skills&b=market&q=…).
  // · 마운트 때와 hashchange 때 해시를 읽고, 쓰기는 첫 렌더 다음부터 — 들어온 해시를 빈 상태로 지우지 않게
  // · 필터 키가 없는 해시(#lm-skills 같은 섹션 앵커)는 건드리지 않는다
  // · replaceState 에 기존 history.state 를 그대로 넘긴다 — Next 라우터가 뒤로 가기에 쓰는 값이다
  const hydrated = useRef(false);
  useEffect(() => {
    const read = () => {
      const h = new URLSearchParams(window.location.hash.slice(1));
      if (!["c", "b", "q"].some((k) => h.has(k))) return; // 섹션 앵커 등 — 필터는 그대로
      const c = h.get("c");
      const b = h.get("b");
      setGroup(c && groups.some((g) => g.id === c) ? c : null);
      setBand(b && bands.some((x) => x.id === b) ? b : null);
      setQ(h.get("q") ?? "");
    };
    read();
    window.addEventListener("hashchange", read); // 같은 페이지에서 공유 링크(#c=…)로 옮겨 올 때
    return () => window.removeEventListener("hashchange", read);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true; // 첫 커밋은 읽기 effect 와 같이 돈다 — 아직 빈 상태이므로 쓰지 않는다
      return;
    }
    const cur = window.location.hash.slice(1);
    const ours = ["c", "b", "q"].some((k) => new URLSearchParams(cur).has(k));
    const h = new URLSearchParams();
    if (group) h.set("c", group);
    if (band) h.set("b", band);
    if (q) h.set("q", q);
    const next = h.toString();
    if (!next && !ours) return; // 필터 없음 + 남의 해시 → 그대로 둔다
    if (next === cur) return;
    const url = window.location.pathname + window.location.search + (next ? `#${next}` : "");
    window.history.replaceState(window.history.state, "", url);
  }, [q, group, band]);

  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const match = (s: CardSkill) =>
    (!group || s.group === group) &&
    (!band || s.landing?.band === band) &&
    terms.every((t) => s.search.includes(t));

  const shown = groups
    .map((g) => ({ g, items: g.skills.map((n) => skills.find((s) => s.folder === n)!).filter(match) }))
    .filter((x) => x.items.length);
  const total = shown.reduce((n, x) => n + x.items.length, 0);

  return (
    <>
      <PageTitle count={total} right={<SearchInput value={q} onChange={setQ} className="w-full sm:w-[200px]" />}>
        Skills
      </PageTitle>

      <div className="mt-4 border-b border-line pb-4">
        <Pills
          label="컬렉션"
          options={groups.map((g) => ({ value: g.id, label: g.title, count: g.skills.length }))}
          value={group}
          onChange={setGroup}
        />
        {bands.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span aria-hidden="true" className="text-xs font-medium text-ink-muted">밴드</span>
            <Pills
              label="밴드"
              options={bands.map((b) => ({ value: b.id, label: b.label, count: skills.filter((s) => s.landing?.band === b.id).length }))}
              value={band}
              onChange={setBand}
            />
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-8">
        {shown.map(({ g, items }) => (
          <section key={g.id}>
            <SectionHeader id={g.id} title={g.title} sub={g.sub} count={items.length} />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((s) => <SkillCard key={s.folder} skill={s} />)}
            </div>
          </section>
        ))}
        {!total && <Empty>조건에 맞는 스킬이 없습니다. 검색어나 필터를 바꿔 보세요.</Empty>}
      </div>
    </>
  );
}
