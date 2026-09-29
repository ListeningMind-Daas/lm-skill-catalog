import { Marked, type Token, type Tokens } from "marked";

/**
 * SKILL.md 본문 렌더 — lm-skills 는 외부 기여를 받는 저장소라 본문을 반신뢰 입력으로 다룬다.
 *  · 원시 HTML 은 싣지 않는다(주석 포함 전부 제거) — marked 는 HTML 을 정리하지 않는다
 *  · 링크 href·title 등 속성 값은 전부 이스케이프하고, http(s)·mailto·#앵커 외 스킴은 링크로 만들지 않는다
 *  · 저장소 안 상대 경로 링크(references/foo.md)는 웹에서 열 수 없으므로 경로 표기로 바꾼다
 */

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function escapeAttr(v: string) {
  return v.replace(/[&<>"']/g, (c) => ESC[c]);
}

/** 제목 → 앵커 id 바탕. 한글은 그대로 두고 공백·기호만 정리한다. */
export function slugify(text: string) {
  return (
    text
      .toLowerCase()
      .replace(/<[^>]+>/g, "")
      .replace(/[`*_~()[\]{}.,:;!?'"“”‘’·/\\|<>=+#@$%^&]/g, "")
      .trim()
      .replace(/\s+/g, "-") || "section"
  );
}

/** 인라인 토큰 → 평문 (목차·id 용). 링크는 글자만, 코드·강조는 내용만 남긴다. */
function plain(tokens: Token[] | undefined): string {
  if (!tokens) return "";
  return tokens
    .map((t) => {
      const any = t as Token & { tokens?: Token[]; text?: string };
      if (t.type === "html") return "";
      if (any.tokens?.length) return plain(any.tokens);
      if (t.type === "codespan" || t.type === "text" || t.type === "escape") return any.text ?? "";
      return any.text ?? "";
    })
    .join("");
}

/** 같은 문서 안에서 겹치지 않는 id — 번호를 붙인 결과가 기존 id 와 겹쳐도 계속 올린다 */
function idMaker() {
  const used = new Set<string>();
  return (base: string) => {
    let id = base;
    for (let n = 1; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return id;
  };
}

function headingText(h: Tokens.Heading) {
  return plain(h.tokens).replace(/\s+/g, " ").trim();
}

export function renderSkillMarkdown(md: string) {
  const nextId = idMaker();
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      html() {
        return "";
      },
      heading(this: any, h: Tokens.Heading) {
        const id = nextId(slugify(headingText(h)));
        return `<h${h.depth} id="${escapeAttr(id)}">${this.parser.parseInline(h.tokens)}</h${h.depth}>\n`;
      },
      link(this: any, { href, title, tokens }: Tokens.Link) {
        const label = this.parser.parseInline(tokens);
        const t = title ? ` title="${escapeAttr(title)}"` : "";
        if (/^(https?:|mailto:)/i.test(href)) return `<a href="${escapeAttr(href)}"${t} target="_blank" rel="noreferrer noopener">${label}</a>`;
        if (href.startsWith("#")) return `<a href="${escapeAttr(href)}"${t}>${label}</a>`;
        return `<span class="path" title="${escapeAttr(href)}">${label}</span>`;
      },
      image({ href, text }: Tokens.Image) {
        // 저장소 안 이미지 경로는 웹에서 열리지 않는다 — 대체 글만 남긴다
        return /^https?:/i.test(href)
          ? `<img src="${escapeAttr(href)}" alt="${escapeAttr(text)}" loading="lazy" />`
          : `<span class="path" title="${escapeAttr(href)}">${escapeAttr(text || href)}</span>`;
      },
    },
  });
  return marked.parse(md) as string;
}

/** 목차 — 렌더러와 같은 규칙으로 id 를 만들어 ##·### 제목만 돌려준다. */
export function tocOf(body: string) {
  const nextId = idMaker();
  const out: { level: number; text: string; id: string }[] = [];
  const walk = (tokens: Token[]) => {
    for (const t of tokens) {
      if (t.type === "heading") {
        const h = t as Tokens.Heading;
        const text = headingText(h);
        const id = nextId(slugify(text));
        if (h.depth === 2 || h.depth === 3) out.push({ level: h.depth, text, id });
        continue;
      }
      // 인용·목록 안의 제목도 렌더러는 id 를 매긴다 — 같은 순서로 따라가야 번호가 어긋나지 않는다
      if (t.type === "blockquote") walk((t as Tokens.Blockquote).tokens);
      if (t.type === "list") for (const item of (t as Tokens.List).items) walk(item.tokens);
    }
  };
  walk(new Marked({ gfm: true }).lexer(body));
  return out;
}
