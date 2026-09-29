/** 공개 사이트 주소 — 테스트 실행 프롬프트에 절대 주소로 넣는다(브라우저 패널이 열 주소). 배포별로 NEXT_PUBLIC_SITE_URL 로 바꿀 수 있다. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://lm-skill-catalog.vercel.app").replace(/\/$/, "");
