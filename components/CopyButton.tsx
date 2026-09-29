"use client";
import { useState } from "react";
import { Button, type ButtonVariant } from "./ui/primitives";

/**
 * 복사 버튼. `text` 는 바로 복사하고, `src` 는 누를 때 그 파일을 받아 복사한다 —
 * 긴 본문(SKILL.md)을 페이지 페이로드에 한 번 더 싣지 않으려고.
 */
export default function CopyButton({
  text,
  src,
  label = "복사",
  variant = "soft",
  title,
}: {
  text?: string;
  src?: string;
  label?: string;
  variant?: ButtonVariant;
  title?: string;
}) {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");
  const flash = (s: "done" | "fail") => {
    setState(s);
    setTimeout(() => setState("idle"), 1600);
  };
  const copy = async () => {
    try {
      if (text !== undefined) {
        await navigator.clipboard.writeText(text);
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
    }
  };
  return (
    <Button variant={variant} icon={state === "done" ? "check" : "copy"} onClick={copy} title={title} aria-live="polite">
      {state === "done" ? "복사됨" : state === "fail" ? "복사 실패" : label}
    </Button>
  );
}
