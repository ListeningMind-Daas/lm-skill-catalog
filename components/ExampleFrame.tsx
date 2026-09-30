import fs from "node:fs";
import path from "node:path";
import examples from "@/data/examples.json";
import { SectionHeader } from "./ui/primitives";
import Icon from "./ui/Icon";

type Meta = { seed: string; gl: string; date: string; server: string; credits: number; calls: string; request?: string; offline?: string };

/**
 * public/examples/<스킬>/index.html 이 있으면 그 스킬의 산출물 예시를 보인다 (빌드 시점 확인).
 * 주소는 /examples/<스킬>/ — Vercel(Next.js 프리셋)은 public 의 .html 을 확장자 없는 주소로만 내주고,
 * 로컬 정적 서버는 폴더 주소에서 index.html 을 내준다. 두 곳에서 같은 주소가 되게 폴더형으로 둔다(2026-09-29 첫 배포에서 확인).
 */
export function exampleOf(folder: string): { src: string; meta: Meta | null } | null {
  const file = path.join(process.cwd(), "public", "examples", folder, "index.html");
  if (!fs.existsSync(file)) return null;
  const meta = (examples as Record<string, unknown>)[folder] as Meta | undefined;
  return { src: `/examples/${folder}/`, meta: meta ?? null };
}

/**
 * 산출물 예시 — 실제 스킬 실행 결과 HTML 을 iframe 으로 보인다.
 * 불투명 출처 sandbox(allow-scripts 만)는 Claude 앱 브라우저가 프레임째 막아 빈 화면이 된다(2026-09-29 확인) —
 * 그래서 같은 출처로 띄우고, 대신 빌드(scripts/build_catalog.py check_examples)가 예시 HTML 의
 * 네트워크·저장소·부모 창 접근 API 와 글꼴 외 외부 자원을 막는다. 예시는 우리가 만든 정적 파일만 싣는다.
 */
export default function ExampleFrame({ folder }: { folder: string }) {
  const ex = exampleOf(folder);
  if (!ex) return null;
  const m = ex.meta;
  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-base font-semibold text-ink">산출물 예시</h2>
          <span className="text-xs text-ink-muted">이 스킬을 실행하면 이런 결과물이 만들어집니다</span>
        </div>
        <a href={ex.src} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
          새 탭에서 크게 보기
          <Icon name="external" size={14} />
        </a>
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-surface-muted/40 p-2 sm:p-3">
        <iframe
          src={ex.src}
          title={`${folder} 산출물 예시`}
          loading="lazy"
          className="block h-[70vh] min-h-[480px] w-full rounded-md border border-line bg-surface"
        />
      </div>
      {m && (
        <p className="mt-2 text-xs leading-5 text-ink-muted">
          {m.request ? <>질의 «{m.request}» · </> : <>시드 «{m.seed}» · </>}
          {m.offline ? (
            <>{m.date} · {m.offline} · 크레딧 0</>
          ) : (
            <>{m.gl.toUpperCase()} · {m.date} · {m.server} 서버 실측 · 이번 생성 크레딧 {m.credits.toLocaleString("ko-KR")} ({m.calls})</>
          )}
        </p>
      )}
    </section>
  );
}
