"use client";
import { useState } from "react";
import { Button, type ButtonVariant } from "./ui/primitives";

/**
 * 복사 버튼. `text` 는 바로 복사하고, `src` 는 누를 때 그 파일을 받아 복사한다 —
 * 긴 본문(SKILL.md)을 페이지 페이로드에 한 번 더 싣지 않으려고.
 */
/** 비동기 Clipboard API 가 막혔을 때의 대안 — 숨긴 textarea 를 골라 execCommand("copy") */
function legacyCopy(text: string): boolean {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

export default function CopyButton({
  text,
  src,
  label = "복사",
  variant = "soft",
  title,
  fallbackTarget,
}: {
  text?: string;
  src?: string;
  label?: string;
  variant?: ButtonVariant;
  title?: string;
  /** 복사가 막혔을 때 선택해 보여 줄 요소 id */
  fallbackTarget?: string;
}) {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");
  const flash = (s: "done" | "fail") => {
    setState(s);
    setTimeout(() => setState("idle"), 1600);
  };
  const copy = async () => {
    try {
      if (text !== undefined) {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // 비동기 클립보드가 막힌 곳(Claude 앱 브라우저 패널 등) — 예전 방식으로 한 번 더
          if (!legacyCopy(text)) throw new Error("clipboard");
        }
      } else if (src) {
        const body = fetch(src).then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.text();
        });
        // Safari 는 사용자 동작 직후에 ClipboardItem 을 만들어야 한다 — 내용은 Promise 로 넘긴다
        if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
          await navigator.clipboard.write([
            new ClipboardItem({ "text/plain": body.then((t) => new Blob([t], { type: "text/plain" })) }),
          ]);
        } else {
          await navigator.clipboard.writeText(await body);
        }
      }
      flash("done");
    } catch {
      flash("fail");
      // 복사가 안 되면 대신 보여 줄 곳을 선택해 둔다 — ⌘C 로 바로 복사할 수 있게
      if (fallbackTarget) {
        const el = document.getElementById(fallbackTarget);
        if (el) {
          el.scrollIntoView({ block: "center" });
          const range = document.createRange();
          range.selectNodeContents(el);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      }
    }
  };
  return (
    <Button variant={variant} icon={state === "done" ? "check" : "copy"} onClick={copy} title={title} aria-live="polite">
      {state === "done" ? "복사됨" : state === "fail" ? (fallbackTarget ? "아래 문구를 복사하세요" : "복사 실패") : label}
    </Button>
  );
}
