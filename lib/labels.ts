// 클라이언트 컴포넌트가 쓰는 값·타입 — catalog.json 을 import 하지 않는다 (번들에 전체 본문이 실리지 않게)

export const CONNECTOR_LABEL: Record<string, string> = {
  keyword_info: "키워드 정보",
  intent_finder: "쿼리 파인더",
  cluster_finder: "클러스터 파인더",
  path_finder: "패스 파인더",
  serp: "검색결과 화면",
  trend_finder: "트렌드 파인더",
  ai_overview: "AI 요약",
};

/** 랜딩 #/catalog 카드 — 번호·효용 제목·밴드 (lm-skills 만) */
export type LandingCard = { no: string; title: string; band: string };
export type Band = { id: string; label: string };

/** 카드·목록에 필요한 필드만 — 본문·파일 목록은 상세 페이지(서버 렌더)에서만 쓴다 */
export type CardSkill = {
  name: string;
  folder: string;
  group: string;
  groupTitle: string;
  repo: string;
  description: string;
  license: string | null;
  version: string | null;
  kitVersion: string | null;
  connectors: string[];
  landing: LandingCard | null;
  hasExample: boolean;
  bandLabel: string | null;
  search: string;
};

export type CardGroup = { id: string; title: string; sub: string; skills: string[] };
