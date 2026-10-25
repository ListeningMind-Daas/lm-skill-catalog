---
name: lm-chart
description: >-
  데이터(csv·json·표·API 응답을 펼친 행)를 표준 차트 25종 중 하나로 그리는 스킬 — 코드가 데이터 모양을 읽어 차트를 고르고
  inline SVG 로 그린 뒤 검사까지 한다. "차트 그려줘", "이 데이터 시각화해줘", "그래프로 보여줘", "어떤 차트가 맞아?",
  csv·json 파일을 첨부하며 차트·그래프·시각화를 요청할 때, 리포트 안 숫자 표를 그림으로 바꿔 달라고 할 때 켠다.
  외부 차트 라이브러리·CDN·캔버스를 쓰지 않고, LLM 이 차트 유형을 고르지 않는다. 선택 규칙·렌더러·검사·카탈로그 문서가 이 스킬 안에
  있어 혼자서 돈다(크레딧 0 · 표준 라이브러리만).
metadata:
  visibility: oss
  scope: common
  version: "0.1.0"
  author: Ascent AI
  category: rendering
  tags: 차트, 시각화, inline SVG, 카탈로그 25종
---

# lm-chart — 데이터 한 파일 → 표준 차트 한 장

**한 줄** — 사용자가 데이터와 "차트 그려줘"를 주면, 명령 하나로 코드가 차트를 고르고 그려 페이지로 낸다. 에이전트는 단위·기간·의도를
묻고, 결과(페이지 경로 · 1위 차트와 이유 · 대안)를 보고하고, 수정 요청을 스펙 옵션으로 옮기기만 한다.

선택 규칙 · 렌더러 · 검사 · 카탈로그 문서의 정본이 이 폴더에 있다. `lima-agents` 안의 `lib/viz.py`·`scripts/viz.py` 는 같은 코드를 다시 내보내는 다리다(빌더가 `from lib import viz` 로 쓴다).

| 파일 | 역할 |
|---|---|
| `scripts/chart.py` | 진입점 — 인자를 `scripts/viz.py` 에 그대로 넘긴다 |
| `scripts/viz.py` | CLI: catalog · select · render · check · gallery · reference · auto |
| `lib/viz.py` | CATALOG 25종 · INTENTS · 프로파일 · select · render · check_html(정본) |
| `lib/viz_samples.py` · `lib/palette_check.py` | 견본 25종 · 팔레트 계산 검증(OKLab·색각·대비) |
| `references/viz-catalog.md` | 조건 · 인코딩 규칙 · 값의 상태 · 발견 문장 틀 · 기본 선택 순서(정본 문서) |
| `references/quick-reference.md` | **생성 파일** — 차트 25종 이름·질문 · 의도 목록(`scripts/build_quick_reference.py`) |

## 절차 — 호출 한 번

```bash
C=.claude/skills/lm-chart/scripts/chart.py
python3 $C auto <데이터.csv|json> --unit <단위> --period <기간> [--title …] [--source …] [--intent …] [--compare] [--json]
python3 $C check <페이지.html>          # 결과 페이지를 다시 검사(auto 가 그린 차트는 통과해야 한다)
```

1. **데이터와 두 값을 확인한다.** csv(머리행 있음) 또는 json(행 목록 `[{…}]` · viz-data 스펙). `--unit`(예: `건/월` · `%`)과 `--period`(예: `2025-09~2026-08`)가
   없으면 렌더하지 않는다(종료 코드 2) — 사용자 발화에 없으면 **AskUserQuestion 으로 묻는다**, 짐작하지 않는다. API 응답 원본이면 `data` 를 먼저 행으로 펼친다.
   가로형 csv(열 이름이 YYYY-MM)는 세로형(월 열 하나 + 값 열 하나)으로 바꿔 준다.
2. **의도는 발화에 있을 때만.** "추이"·"비교"·"구성"·"성수기"·"여정" 같은 말이 있으면 `--intent`(`references/quick-reference.md` 의 의도 표)를 준다.
   의도는 힌트다 — 데이터가 조건을 못 채우면 코드가 기본 선택으로 돌아가고 `intent_note` 에 이유를 남긴다. 사용자가 "어떤 차트가 맞는지 보여줘"라면 `--compare`(상위 3 모두 그림).
3. **`auto` 를 한 번 호출한다.** 결과: 페이지(`<데이터>.viz.html` 또는 `--out`) · 1위 차트와 선택 이유 · 다른 선택 2개와 이유 · 데이터에서 읽은 것(힌트).
4. **사용자에게 보고한다** — 페이지 경로, 1위 차트 이름과 이유, 대안 2개와 이유를 코드 출력 그대로. 이유를 다시 쓰거나 숫자를 보태지 않는다
   (차트 위 '발견 한 줄'은 코드가 계산한 문장이다 ). 단위·기간·출처는 페이지 부제에 이미 있다.
5. **수정 요청은 스펙 옵션으로만 옮긴다.** json 스펙의 `options` 에 적고 다시 `auto`(또는 `render --chart`)를 돌린다. SVG 를 손으로 고치지 않는다.

| 사용자 말 | 옵션 |
|---|---|
| "우리 브랜드만 색으로" · "A 를 강조" | `options.emphasis: ["A"]` |
| "발견 문장 빼줘" · "이 문장으로" | `options.finding: "off"` 또는 문장(숫자는 차트 글자에 있는 것만 — 아니면 멈춤) |
| "연령 순서대로" · "단계 순서는 …" | `options.order: ["10대", "20대", …]` |
| "여정 단계를 5개로" | `options.steps: 5` (여정 지도) |
| "상위 8개만" | `options.top_n: 8` |
| "기준 검색어는 X" (양방향 나무) | `options.seed: "X"` |
| "로그 눈금으로" | `options.log_x` / `options.log_y: true` |
| "예측 구간 표시" · "최신 달은 미완결" | `options.forecast_from` · `options.incomplete_from: "YYYY-MM"` |
| "다른 차트로" | `--chart <코드 이름>` — 조건을 못 채우면 멈춘다(종료 코드 2). 조건을 바꾸지 말고 데이터를 다시 본다 |

옵션 전체·값의 상태(`null` · `{"state": "not_queried"}` · `below_gate` · `not_returned`)·측정값 종류(`kind`)는 `references/viz-catalog.md` §2·§2b.

## 금지 — 이 스킬이 하지 않는 것

- **SVG·HTML 차트를 직접 쓰지 않는다.** 차트는 `auto`/`render` 출력만 쓴다. 카탈로그에 없는 차트(파이·이중 축·워드클라우드·게이지·3D)는 만들지 않는다 — 필요하면 정본 코드·문서·견본·테스트를 함께 바꾼다.
- **외부 차트 라이브러리·CDN·캔버스를 쓰지 않는다**(Chart.js·D3·Recharts·AntV 등). 정본 규칙 `listeningmind-universal/references/_shared-core.md` §7.
- **LLM 이 차트 유형을 고르지 않는다.** 선택은 `select` 의 결과다. 사용자가 유형을 지정하면 `--chart` 로 넘기고, 코드가 거절하면 그 이유를 전한다.
- 데이터 값을 고치거나 보태지 않는다(결측은 `null`, 조회 안 함·기저 미달은 상태로). 리포트 저장본 값만 쓴다.
- 정본은 이 폴더 하나다 — 다른 스킬·빌더에 복제하지 않는다(lima-agents 는 다리로 쓴다). 테스트가 복제를 막는다.
- 결과 페이지에 고객 이름·고객 앱 이름을 넣지 않는다. 외부 전달물은 `--public`(코드 이름 없는 공개판)으로 낸다.

## 검사

- `auto` 가 만든 페이지는 `check` 를 통과해야 한다(카탈로그 밖 차트·단위/기간 누락·캔버스·라이브러리 → 종료 코드 11). 통과하지 못하면 보고하지 말고 원인을 본다.
- 어휘: lima-agents 가 함께 설치돼 있으면 `lima-agents/scripts/check_lexicon.py file <페이지.html>` 로 작업 용어를 검사한다(이 스킬 혼자서는 `check` 까지).
- 회귀 테스트(크레딧 0): `python3 -m unittest tests.reports.test_lm_chart_skill tests.reports.test_viz`.

## 다른 스킬과의 관계

- 리포트·레이더·내비게이터 등 빌더 안에서는 이 스킬을 거치지 않고 `viz.auto(spec)` / `viz.render(spec)` 를 직접 부른다(계약: `viz-catalog.md` §1).
- 이 스킬은 "데이터가 손에 있고 차트만 필요한" 단발 요청용이다. 데이터 수집(DaaS 호출)이 필요하면 `listeningmind-universal`·버티컬 스킬이 먼저다.
- 빠른 참조가 카탈로그와 어긋나면 `python3 .claude/skills/lm-chart/scripts/build_quick_reference.py` 로 다시 만든다(손으로 고치지 않는다 · `--check` 로 대조).
