// 정적 내보내기 — 빌드 결과(out/)는 정적 호스팅의 **도메인 루트**에 올린다.
// 링크가 모두 절대 경로(/_next/…, /skills/x/)라 file:// 로 열거나 하위 경로에 두면 깨진다 — 그럴 땐 basePath 를 쓴다.
// 데이터는 빌드 시점의 SKILL.md 스냅샷(scripts/build_catalog.py).
const nextConfig = { output: "export", trailingSlash: true, images: { unoptimized: true } };
export default nextConfig;
