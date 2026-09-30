# LM Skills Catalog

ListeningMind 검색 데이터 분석 스킬 카탈로그 — 리포트형 스킬과 공개 스킬 모음 [lm-skills](https://github.com/ListeningMind-Daas/lm-skills).

> **이 저장소는 발행본이다 — 직접 커밋하지 않는다.** 원본은 lm-agent-dev 의 `skill-catalog-web/` 이고,
> `packaging/manifests/skill-catalog.toml` 로 빌드해 민다. 고칠 것은 원본에서 고치고 다시 발행한다.

| 묶음 | 스킬 | 출처 |
|---|---|---|
| 리포트형 | 4 | `lm-agent-plugins · LM Reports@897b984` |
| 시장 분석 | 11 | `ListeningMind-Daas/lm-skills@56a1f6a` |
| 연동·개발 도구 | 2 | `ListeningMind-Daas/lm-skills@56a1f6a` |

- 판 v0.1.5 · dev `897b984` 에서 생성 (`build-stamp.json`)
- 카탈로그 데이터(`data/catalog.json` · `public/raw/`)는 발행 때 만들어 담았다 — `data/PREBUILT` 가 있으면 빌드가 그대로 쓴다
- 빌드: `npm ci && npm run build` → `out/` (정적 사이트 · 도메인 루트 배포)
