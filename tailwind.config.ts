import type { Config } from "tailwindcss";

/**
 * 디자인 토큰 — llm-skill-admin.ascentlab.io (Ascent AI Skills Admin) 의 Tailwind 테마에서 옮겼다 (2026-09-29 실측).
 * 토큰 이름도 그쪽과 같게 둔다: 두 앱의 컴포넌트를 서로 옮겨 쓸 때 클래스를 고치지 않아도 되게.
 *
 * 접근성 보정 (WCAG AA 4.5:1 — 2026-09-29 감사):
 *   ink-muted  관리자 #9691a2(흰 바탕 3.06:1) → #6a6773 (흰 5.53 · 태그 바탕 4.55)
 *   link       관리자 #4f64e1(link-bg 위 4.36:1) → #4d62dc (4.52)
 *   ink-faint  #c6c2ce(1.75:1) 는 글자에 쓰지 않는다 — 아이콘·구분점·테두리 같은 장식 전용
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#e2e0f8", 100: "#d5d2f3", 500: "#786ebe", 600: "#5e2cc9", 700: "#542bb5" },
        point: "#7c5eec",
        primary: { dark: "#c81414" },
        ink: { DEFAULT: "#3d3a46", soft: "#5d596a", muted: "#6a6773", faint: "#c6c2ce" },
        line: { DEFAULT: "#eae8ee", strong: "#c6c2ce" },
        link: { DEFAULT: "#4d62dc", bg: "#eef0fc" },
        surface: { DEFAULT: "#ffffff", muted: "#eae8ee" },
        page: "#fbfafb",
        danger: { DEFAULT: "#e05265", bg: "#fdeef0" },
        viz: {
          green: { 50: "#c0e884", 70: "#8bc435", 100: "#4ca33e" },
          yellow: { 50: "#f7e4a0", 70: "#ffe526", 100: "#d0a300" },
        },
        platform: { claude: "#ad5e48", chatgpt: "#10a37f", gemini: "#4285f4" },
      },
      fontFamily: {
        sans: ['"Noto Sans KR"', "-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: { DEFAULT: "6px", md: "6px", lg: "10px" },
      maxWidth: { page: "1200px" },
    },
  },
  plugins: [],
};
export default config;
